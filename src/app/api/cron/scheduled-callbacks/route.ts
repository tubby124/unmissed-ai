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
 * Fixes applied:
 *   D92 — batch-update matched leads to status='calling' before the loop (dedup guard)
 *   D99 — skip lead after 3 failed attempts (set status='dnc', clear scheduled_callback_at)
 *   D91 — use outbound_connect_tokens table instead of long j=/v= URL params
 *   D95 — send Telegram summary per client after each run
 *   D101 — write call_direction='outbound' to call_logs
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { APP_URL } from '@/lib/app-url'
import { sendAlert } from '@/lib/telegram'
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

  // Find leads due for callback — exclude statuses that indicate active/completed/dnc
  const { data: leads, error: leadsErr } = await svc
    .from('campaign_leads')
    .select('id, phone, name, notes, client_id, scheduled_callback_at, call_count, disposition')
    .lte('scheduled_callback_at', now)
    .not('status', 'in', '("called","completed","calling","dnc")')
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

  // D92: Atomically mark all matched leads as 'calling' before the loop
  // This prevents a second cron run from picking up the same leads
  const leadIds = leads.map(l => l.id)
  await svc
    .from('campaign_leads')
    .update({ status: 'calling' })
    .in('id', leadIds)

  // Collect unique client IDs and fetch configs in batch
  const clientIds = [...new Set(leads.map(l => l.client_id).filter(Boolean))] as string[]
  const { data: clients } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, agent_voice_id, outbound_prompt, outbound_vm_script, twilio_number, tools, context_data, context_data_label, business_facts, extra_qa, timezone, knowledge_backend, injected_note, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, niche, telegram_bot_token, telegram_chat_id, telegram_chat_id_2')
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
  // Per-client dial stats for D95 Telegram summary
  const clientStats: Map<string, { slug: string; dialed: number; skipped: number; errors: number; botToken?: string; chatId?: string; chatId2?: string }> = new Map()

  for (const lead of leads) {
    const clientId = lead.client_id
    if (!clientId) {
      console.warn(`[scheduled-callbacks] Lead ${lead.id} has no client_id — skipping`)
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
      continue
    }

    const client = clientMap.get(clientId)
    if (!client) {
      console.warn(`[scheduled-callbacks] Client ${clientId} not found — skipping lead ${lead.id}`)
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
      continue
    }

    const slug = client.slug as string
    if (!clientStats.has(clientId)) {
      clientStats.set(clientId, {
        slug,
        dialed: 0,
        skipped: 0,
        errors: 0,
        botToken: (client.telegram_bot_token as string | null) ?? undefined,
        chatId: (client.telegram_chat_id as string | null) ?? undefined,
        chatId2: (client.telegram_chat_id_2 as string | null) ?? undefined,
      })
    }
    const stats = clientStats.get(clientId)!

    // D99: Retry cap — after 3 failed attempts, mark as dnc
    const callCount = (lead.call_count as number | null) ?? 0
    if (callCount >= 3 && (lead.disposition as string | null) !== 'answered') {
      console.log(`[scheduled-callbacks] Lead ${lead.id} hit retry cap (call_count=${callCount}) — marking dnc`)
      await svc
        .from('campaign_leads')
        .update({ status: 'dnc', scheduled_callback_at: null })
        .eq('id', lead.id)
      stats.skipped++
      continue
    }

    if (!client.outbound_prompt) {
      console.warn(`[scheduled-callbacks] Client ${slug} has no outbound_prompt — skipping lead ${lead.id}`)
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
      stats.skipped++
      continue
    }

    const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER
    if (!fromNumber) {
      console.warn(`[scheduled-callbacks] Client ${slug} has no phone number — skipping lead ${lead.id}`)
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
      stats.skipped++
      continue
    }

    const toPhone = lead.phone as string
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
      stats.errors++
      // Roll back status so lead can be retried
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
      continue
    }

    const vmScript = (client.outbound_vm_script as string | null) ?? null
    let twilio_sid: string
    try {
      const twilioClient = twilio(accountSid, authToken)
      let call
      if (vmScript) {
        // D91: store joinUrl+vmScript in a short-lived token to keep callback URL short
        const { data: tokenRow, error: tokenErr } = await svc
          .from('outbound_connect_tokens')
          .insert({
            join_url: ultravoxCall.joinUrl,
            vm_script: vmScript,
            ultravox_call_id: ultravoxCall.callId,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single()
        if (tokenErr || !tokenRow) {
          throw new Error(`Token insert failed: ${tokenErr?.message}`)
        }
        const connectUrl = signCallbackUrl(
          `${APP_URL}/api/webhook/${slug}/outbound-connect?t=${tokenRow.id}`,
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
      stats.errors++
      // Roll back status so lead can be retried
      await svc.from('campaign_leads').update({ status: 'queued' }).eq('id', lead.id)
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
      call_direction: 'outbound',
      started_at: now,
    })
    if (logErr) console.error(`[scheduled-callbacks] call_logs insert failed for ${lead.id}: ${logErr.message}`)

    console.log(`[scheduled-callbacks] Dialed lead ${lead.id} (${slug}) twilio_sid=${twilio_sid}`)
    dialed++
    stats.dialed++
  }

  // D95: Send brief Telegram summary per client
  for (const [, stats] of clientStats) {
    if (!stats.botToken || !stats.chatId) continue
    if (stats.dialed === 0 && stats.skipped === 0 && stats.errors === 0) continue
    const parts: string[] = [`📞 <b>Scheduled callbacks</b> [${stats.slug}]`]
    if (stats.dialed > 0) parts.push(`✅ Dialed: ${stats.dialed}`)
    if (stats.skipped > 0) parts.push(`⏭ Skipped: ${stats.skipped}`)
    if (stats.errors > 0) parts.push(`❌ Errors: ${stats.errors}`)
    sendAlert(stats.botToken, stats.chatId, parts.join('\n'), stats.chatId2 ?? undefined)
      .catch(e => console.error(`[scheduled-callbacks] Telegram summary failed for ${stats.slug}:`, e))
  }

  console.log(`[scheduled-callbacks] Done: ${dialed} dialed, ${errors.length} errors`)
  return NextResponse.json({ dialed, errors: errors.length ? errors : undefined })
}
