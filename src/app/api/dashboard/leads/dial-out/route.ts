import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { createCall, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { outboundBookingReady, appendOutboundBookingTools, buildOutboundDateBlock } from '@/lib/outbound-call-assembly'
import { assembleOutboundPrompt, resolveOutboundPrompt, type OutboundTone } from '@/lib/outbound-prompt-builder'
import { buildRealtorOutboundPrompt, resolveRealtorLeadContext, REALTOR_LOFTY_REVIVAL_MODE } from '@/lib/realtor-outbound-prompt'
import { validateOutboundVmScript } from '@/lib/outbound-safety'
import { APP_URL } from '@/lib/app-url'
import twilio from 'twilio'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { lead_id, template_id } = body

  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  // Fetch the campaign lead
  const { data: lead } = await supabase
    .from('campaign_leads')
    .select('id, phone, name, notes, client_id, source, external_ref, call_count, lead_status, status')
    .eq('id', lead_id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Auth gate: owners can only dial their own client's leads
  if (cu.role !== 'admin' && lead.client_id !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const clientId = lead.client_id ?? cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client associated with this lead' }, { status: 400 })

  // Fetch client config — include outbound_prompt + structured fields + all context fields
  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, business_name, agent_name, agent_voice_id, outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone, outbound_allowed_start, outbound_allowed_end, twilio_number, tools, context_data, context_data_label, business_facts, extra_qa, timezone, knowledge_backend, injected_note, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, niche, recording_consent_acknowledged_at, service_areas, booking_enabled, calendar_auth_status, selected_plan, subscription_status')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Wave 1.5 — Outbound calling requires explicit consent acknowledgment.
  // Operator must have confirmed authority to record callers in their jurisdiction.
  if (!client.recording_consent_acknowledged_at) {
    return NextResponse.json(
      { error: 'Recording authorization is required before placing outbound calls. Acknowledge from your dashboard to enable.' },
      { status: 403 },
    )
  }

  // Check outbound calling hours restriction
  if (client.outbound_allowed_start && client.outbound_allowed_end) {
    const now = new Date()
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
    const startParts = (client.outbound_allowed_start as string).split(':').map(Number)
    const endParts = (client.outbound_allowed_end as string).split(':').map(Number)
    const startMinutes = startParts[0] * 60 + (startParts[1] || 0)
    const endMinutes = endParts[0] * 60 + (endParts[1] || 0)
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return NextResponse.json({
        error: `Outbound calling is restricted to ${client.outbound_allowed_start}–${client.outbound_allowed_end} UTC.`,
      }, { status: 403 })
    }
  }

  const svc = createServiceClient()

  let selectedTemplate: {
    client_id: string
    is_builtin: boolean
    goal: string
    tone: string
    opening: string | null
    vm_script: string | null
    call_notes: string | null
    special_instructions: string | null
  } | null = null

  if (typeof template_id === 'string' && template_id) {
    const { data: template, error: templateError } = await svc
      .from('outbound_templates')
      .select('client_id, is_builtin, goal, tone, opening, vm_script, call_notes, special_instructions')
      .eq('id', template_id)
      .maybeSingle()

    if (templateError) {
      return NextResponse.json({ error: templateError.message }, { status: 500 })
    }
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    if (!template.is_builtin && template.client_id !== clientId) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    selectedTemplate = template
  }

  // If outbound_prompt is null but structured fields exist, assemble on the fly and backfill DB
  let outboundPrompt = client.outbound_prompt as string | null
  let vmScript = (client.outbound_vm_script as string | null) ?? null

  const realtorContext = resolveRealtorLeadContext({
    name: (lead.name as string | null) ?? null,
    source: (lead.source as string | null) ?? null,
    externalRef: ((lead as { external_ref?: string | number | null }).external_ref) ?? null,
    pipelineStage: (lead.lead_status as string | null) ?? (lead.status as string | null) ?? null,
    priorAttempts: (lead.call_count as number | null) ?? 0,
  })
  const outboundCallMode: 'generic' | typeof REALTOR_LOFTY_REVIVAL_MODE = realtorContext ? REALTOR_LOFTY_REVIVAL_MODE : 'generic'

  if (realtorContext) {
    outboundPrompt = buildRealtorOutboundPrompt(realtorContext)
  } else if (selectedTemplate) {
    vmScript = selectedTemplate.vm_script
    outboundPrompt = assembleOutboundPrompt({
      goal: selectedTemplate.goal,
      tone: selectedTemplate.tone as OutboundTone,
      opening: selectedTemplate.opening ?? "Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I'm trying to reach {{LEAD_NAME}} — do you have a quick minute?",
      vmScript: selectedTemplate.vm_script ?? 'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out — give us a call back when you get a chance. Thanks!',
      callNotes: selectedTemplate.call_notes,
      specialInstructions: selectedTemplate.special_instructions,
    })
  } else if (!outboundPrompt && (client.outbound_goal || client.outbound_opening)) {
    outboundPrompt = assembleOutboundPrompt({
      goal: (client.outbound_goal as string | null) ?? 'Follow up and schedule a conversation',
      tone: ((client.outbound_tone as string | null) ?? 'warm') as OutboundTone,
      opening: (client.outbound_opening as string | null) ?? "Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I'm trying to reach {{LEAD_NAME}} — do you have a quick minute?",
      vmScript: (client.outbound_vm_script as string | null) ?? 'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out — give us a call back when you get a chance. Thanks!',
    })
    // Backfill so subsequent dials skip this assembly step (fire-and-forget, non-blocking)
    void svc.from('clients').update({ outbound_prompt: outboundPrompt }).eq('id', clientId)
  }

  if (!outboundPrompt) {
    return NextResponse.json({
      error: 'Outbound agent not configured. Set an outbound prompt in the Leads page before dialing.',
    }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }
  if (!fromNumber) {
    return NextResponse.json({
      error: 'No phone number configured. Upgrade to a paid plan to get a calling number.',
    }, { status: 400 })
  }

  const vmSafety = validateOutboundVmScript(vmScript)
  if (!vmSafety.ok) {
    return NextResponse.json({ error: vmSafety.error }, { status: 400 })
  }

  const toPhone: string = lead.phone
  const slug = client.slug as string
  const businessName = (client.business_name as string | null) ?? 'our team'
  const agentName = (client.agent_name as string | null) ?? 'Alex'

  // Build knowledge/business context block for appending
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
    service_areas: (client.service_areas as string[] | null) ?? undefined,
  }
  const corpusAvailable = client.knowledge_backend === 'pgvector'
  const ctx = buildAgentContext(clientRow, toPhone, [], new Date(), corpusAvailable)

  // Substitute lead-specific placeholders into outbound prompt
  const resolvedPrompt = resolveOutboundPrompt(outboundPrompt, {
    leadName: (lead.name as string | null) ?? 'there',
    leadPhone: toPhone,
    leadNotes: (lead.notes as string | null) ?? '',
    businessName,
    agentName,
  })

  // Append knowledge/business facts block if available
  let fullPrompt = resolvedPrompt
  if (ctx.knowledge.block) fullPrompt += `\n\n${ctx.knowledge.block}`
  if (ctx.assembled.contextDataBlock) fullPrompt += `\n\n${ctx.assembled.contextDataBlock}`

  // Build tools — hangUp must be present, client.tools may already include it
  const clientTools = Array.isArray(client.tools) ? (client.tools as Record<string, unknown>[]) : []
  const hasHangUp = clientTools.some(t =>
    t.toolName === 'hangUp' || t.nameOverride === 'hangUp' ||
    (t.temporaryTool as Record<string, unknown> | undefined)?.modelToolName === 'hangUp'
  )
  const HANGUP_TOOL = { toolName: 'hangUp', parameterOverrides: { strict: true } }
  let tools = hasHangUp ? clientTools : [HANGUP_TOOL, ...clientTools]

  // Outbound on-call booking: direct calendar tools (no stage transition) +
  // a date anchor so the model can resolve "tomorrow" into YYYY-MM-DD.
  if (outboundBookingReady(client)) {
    tools = appendOutboundBookingTools(tools, slug)
    fullPrompt += `\n\n${buildOutboundDateBlock(client.timezone as string | null, toPhone)}`
  }

  console.log('[dial-out] tools being sent:', JSON.stringify(tools.map((t: Record<string, unknown>) => t.toolName || (t.temporaryTool as Record<string, unknown>)?.modelToolName || '__unknown__')))

  const callbackUrl = signCallbackUrl(`${APP_URL}/api/webhook/${slug}/completed`, slug)

  // createCall() directly — NOT callViaAgent() — per Sonar Pro validation.
  // Separate outbound prompt, waitForUser=true so agent waits for "Hello?" before speaking.
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
        ...(realtorContext ? { call_mode: outboundCallMode, lofty_lead_id: realtorContext.loftyLeadId } : {}),
        source: 'outbound',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `Ultravox call creation failed: ${String(err)}` }, { status: 500 })
  }

  // Twilio outbound dial → Ultravox stream
  // If the client has a voicemail script configured, enable AMD so we can play it instead
  // of connecting the AI agent to an answering machine.
  let twilio_sid: string
  try {
    const twilioClient = twilio(accountSid, authToken)
    let call
    if (vmScript) {
      // AMD path: store joinUrl+vmScript in a short-lived token row to keep the callback URL short (D91)
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
        return NextResponse.json({ error: `Token insert failed: ${tokenErr?.message}` }, { status: 500 })
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
      // No VM script — connect directly (no AMD delay)
      const twiml = `<Response><Connect><Stream url="${ultravoxCall.joinUrl}"/></Connect></Response>`
      call = await twilioClient.calls.create({ to: toPhone, from: fromNumber, twiml })
    }
    twilio_sid = call.sid
  } catch (err) {
    return NextResponse.json({ error: `Twilio dial failed: ${String(err)}` }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Update status + increment call_count in one SQL expression
  const { error: leadErr } = await svc.rpc('dial_out_update_lead', { p_lead_id: lead.id, p_now: now })
  if (leadErr) console.error(`[dial-out] lead update failed: ${leadErr.message}`)

  const { error: logErr } = await svc.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    twilio_call_sid: twilio_sid,
    client_id: clientId,
    caller_phone: toPhone,
    call_status: 'live',
    call_direction: 'outbound',
    started_at: now,
  })
  if (logErr) console.error(`[dial-out] call_logs insert failed: ${logErr.message}`)

  return NextResponse.json({ ok: true, callId: ultravoxCall.callId, twilio_sid })
}
