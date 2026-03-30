/**
 * POST /api/cron/scheduled-callbacks
 *
 * Runs every 5 minutes. Finds campaign leads with `scheduled_callback_at <= now()`
 * and auto-dials them using the client's outbound prompt + Twilio.
 *
 * Mirrors /api/dashboard/leads/dial-out logic:
 *   - Skips leads whose client has no outbound_prompt
 *   - Uses AMD if outbound_vm_script is set
 *   - Calls dial_out_update_lead RPC + clears scheduled_callback_at on success
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { APP_URL } from '@/lib/app-url'
import twilio from 'twilio'

function resolveOutboundPrompt(template: string, vars: {
  leadName: string
  leadPhone: string
  leadNotes: string
  businessName: string
  agentName: string
}): string {
  return template
    .replace(/\{\{LEAD_NAME\}\}/g, vars.leadName)
    .replace(/\{\{LEAD_PHONE\}\}/g, vars.leadPhone)
    .replace(/\{\{LEAD_NOTES\}\}/g, vars.leadNotes)
    .replace(/\{\{BUSINESS_NAME\}\}/g, vars.businessName)
    .replace(/\{\{AGENT_NAME\}\}/g, vars.agentName)
}

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()

  // Find leads due for callback — exclude statuses that indicate active/completed calls
  const { data: leads, error: leadsErr } = await svc
    .from('campaign_leads')
    .select('id, phone, name, notes, client_id, scheduled_callback_at')
    .lte('scheduled_callback_at', now)
    .not('status', 'in', '("called","completed","calling")')
    .limit(20)

  if (leadsErr) {
    console.error('[scheduled-callbacks] Query failed:', leadsErr.message)
    return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  }

  if (!leads?.length) {
    console.log('[scheduled-callbacks] No leads due for callback')
    return NextResponse.json({ dialed: 0 })
  }

  console.log(`[scheduled-callbacks] Found ${leads.length} leads due`)

  // Collect unique client IDs and fetch configs in batch
  const clientIds = [...new Set(leads.map(l => l.client_id).filter(Boolean))] as string[]
  const { data: clients } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, agent_voice_id, outbound_prompt, outbound_vm_script, twilio_number, tools, context_data, context_data_label, business_facts, extra_qa, timezone, knowledge_backend, injected_note, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, niche')
    .in('id', clientIds)

  const clientMap = new Map((clients ?? []).map(c => [c.id as string, c]))

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    console.error('[scheduled-callbacks] Twilio credentials not configured')
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  let dialed = 0
  const errors: string[] = []

  for (const lead of leads) {
    const clientId = lead.client_id
    if (!clientId) {
      console.warn(`[scheduled-callbacks] Lead ${lead.id} has no client_id — skipping`)
      continue
    }

    const client = clientMap.get(clientId)
    if (!client) {
      console.warn(`[scheduled-callbacks] Client ${clientId} not found — skipping lead ${lead.id}`)
      continue
    }

    if (!client.outbound_prompt) {
      console.warn(`[scheduled-callbacks] Client ${client.slug} has no outbound_prompt — skipping lead ${lead.id}`)
      continue
    }

    const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER
    if (!fromNumber) {
      console.warn(`[scheduled-callbacks] Client ${client.slug} has no phone number — skipping lead ${lead.id}`)
      continue
    }

    const toPhone = lead.phone as string
    const slug = client.slug as string
    const businessName = (client.business_name as string | null) ?? 'our team'
    const agentName = (client.agent_name as string | null) ?? 'Alex'

    // Build knowledge/business context
    const clientRow: ClientRow = {
      id: client.id,
      slug,
      niche: (client.niche as string | null) ?? undefined,
      business_name: businessName,
      timezone: (client.timezone as string | null) ?? undefined,
      business_hours_weekday: (client.business_hours_weekday as string | null) ?? undefined,
      business_hours_weekend: (client.business_hours_weekend as string | null) ?? undefined,
      after_hours_behavior: (client.after_hours_behavior as string | null) ?? undefined,
      after_hours_emergency_phone: (client.after_hours_emergency_phone as string | null) ?? undefined,
      business_facts: (client.business_facts as string[] | null) ?? undefined,
      extra_qa: (client.extra_qa as { q: string; a: string }[] | null) ?? undefined,
      context_data: (client.context_data as string | null) ?? undefined,
      context_data_label: (client.context_data_label as string | null) ?? undefined,
      knowledge_backend: (client.knowledge_backend as string | null) ?? undefined,
      injected_note: (client.injected_note as string | null) ?? undefined,
    }
    const corpusAvailable = client.knowledge_backend === 'pgvector'
    const ctx = buildAgentContext(clientRow, toPhone, [], new Date(), corpusAvailable)

    const resolvedPrompt = resolveOutboundPrompt(client.outbound_prompt as string, {
      leadName: (lead.name as string | null) ?? 'there',
      leadPhone: toPhone,
      leadNotes: (lead.notes as string | null) ?? '',
      businessName,
      agentName,
    })

    let fullPrompt = resolvedPrompt
    if (ctx.knowledge.block) fullPrompt += `\n\n${ctx.knowledge.block}`
    if (ctx.assembled.contextDataBlock) fullPrompt += `\n\n${ctx.assembled.contextDataBlock}`

    const HANGUP_TOOL = { toolName: 'hangUp', parameterOverrides: { strict: true } }
    const tools = [
      HANGUP_TOOL,
      ...(Array.isArray(client.tools) ? (client.tools as object[]) : []),
    ]

    const callbackUrl = signCallbackUrl(`${APP_URL}/api/webhook/${slug}/completed`, slug)

    let ultravoxCall: { joinUrl: string; callId: string }
    try {
      ultravoxCall = await createCall({
        systemPrompt: fullPrompt,
        voice: client.agent_voice_id,
        callbackUrl,
        tools,
        waitForUser: true,
        metadata: {
          caller_phone: toPhone,
          client_slug: slug,
          client_id: client.id,
          lead_id: lead.id,
          source: 'scheduled_callback',
        },
      })
    } catch (err) {
      const msg = `Ultravox failed for lead ${lead.id}: ${String(err)}`
      console.error(`[scheduled-callbacks] ${msg}`)
      errors.push(msg)
      continue
    }

    const vmScript = (client.outbound_vm_script as string | null) ?? null
    let twilio_sid: string
    try {
      const twilioClient = twilio(accountSid, authToken)
      let call
      if (vmScript) {
        const connectUrl = signCallbackUrl(
          `${APP_URL}/api/webhook/${slug}/outbound-connect?j=${encodeURIComponent(ultravoxCall.joinUrl)}&v=${encodeURIComponent(vmScript)}`,
          slug,
        )
        call = await twilioClient.calls.create({
          to: toPhone,
          from: fromNumber,
          url: connectUrl,
          machineDetection: 'Enable',
        })
      } else {
        const twiml = `<Response><Connect><Stream url="${ultravoxCall.joinUrl}"/></Connect></Response>`
        call = await twilioClient.calls.create({ to: toPhone, from: fromNumber, twiml })
      }
      twilio_sid = call.sid
    } catch (err) {
      const msg = `Twilio failed for lead ${lead.id}: ${String(err)}`
      console.error(`[scheduled-callbacks] ${msg}`)
      errors.push(msg)
      continue
    }

    // Update lead: set status='called', increment call_count, clear scheduled_callback_at
    const { error: rpcErr } = await svc.rpc('dial_out_update_lead', { p_lead_id: lead.id, p_now: now })
    if (rpcErr) console.error(`[scheduled-callbacks] lead RPC failed for ${lead.id}: ${rpcErr.message}`)

    await svc
      .from('campaign_leads')
      .update({ scheduled_callback_at: null })
      .eq('id', lead.id)

    const { error: logErr } = await svc.from('call_logs').insert({
      ultravox_call_id: ultravoxCall.callId,
      client_id: clientId,
      caller_phone: toPhone,
      call_status: 'live',
      started_at: now,
    })
    if (logErr) console.error(`[scheduled-callbacks] call_logs insert failed for ${lead.id}: ${logErr.message}`)

    console.log(`[scheduled-callbacks] Dialed lead ${lead.id} (${slug}) twilio_sid=${twilio_sid}`)
    dialed++
  }

  console.log(`[scheduled-callbacks] Done: ${dialed} dialed, ${errors.length} errors`)
  return NextResponse.json({ dialed, errors: errors.length ? errors : undefined })
}
