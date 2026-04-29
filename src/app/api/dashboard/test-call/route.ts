import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { createCall, callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { APP_URL } from '@/lib/app-url'
import twilio from 'twilio'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  // Admin can target any client; owners can only test their own
  const clientId = scope.targetClientId
  const toPhone: string = body.to_phone

  if (!toPhone) return NextResponse.json({ error: 'to_phone required (E.164 format)' }, { status: 400 })

  // Fetch client config — same columns buildAgentContext() needs + Twilio fields
  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, niche, business_name, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, tools, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system_prompt configured' }, { status: 400 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio credentials or from number not configured' }, { status: 500 })
  }

  // Build full context via shared buildAgentContext() — same as inbound webhook
  const clientRow: ClientRow = {
    id: client.id,
    slug: client.slug as string,
    niche: (client.niche as string | null) ?? undefined,
    business_name: (client.business_name as string | null) ?? undefined,
    timezone: (client.timezone as string | null) ?? undefined,
    business_hours_weekday: (client.business_hours_weekday as string | null) ?? undefined,
    business_hours_weekend: (client.business_hours_weekend as string | null) ?? undefined,
    after_hours_behavior: (client.after_hours_behavior as string | null) ?? undefined,
    after_hours_emergency_phone: (client.after_hours_emergency_phone as string | null) ?? undefined,
    business_facts: (client.business_facts as string | null) ?? undefined,
    extra_qa: (client.extra_qa as { q: string; a: string }[] | null) ?? undefined,
    context_data: (client.context_data as string | null) ?? undefined,
    context_data_label: (client.context_data_label as string | null) ?? undefined,
    knowledge_backend: (client.knowledge_backend as string | null) ?? undefined,
    injected_note: (client.injected_note as string | null) ?? undefined,
  }
  const knowledgeBackend = client.knowledge_backend as string | null
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, toPhone, [], new Date(), corpusAvailable)

  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  // Build tool overrides from clients.tools (runtime-authoritative source, same as inbound path)
  const overrideTools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined
  const slug = client.slug as string

  // Callback URL → production completed webhook for classification, gap detection, minute tracking
  const callbackBaseUrl = `${APP_URL}/api/webhook/${slug}/completed`
  const callbackUrl = signCallbackUrl(callbackBaseUrl, slug)

  // Create Ultravox call with full context
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      ultravoxCall = await callViaAgent(client.ultravox_agent_id as string, {
        callbackUrl,
        callerContext: callerContextRaw,
        businessFacts: knowledgeBlockStr,
        contextData: contextDataBlock,
        metadata: { caller_phone: toPhone, client_slug: slug, client_id: client.id, source: 'dashboard-test-call' },
        overrideTools,
      })
    } else {
      // Fallback: assemble full prompt with context blocks appended
      const callerContextBlock = ctx.assembled.callerContextBlock
      let promptFull = client.system_prompt + `\n\n${callerContextBlock}`
      if (knowledgeBlockStr) promptFull += `\n\n${knowledgeBlockStr}`
      if (contextDataBlock) promptFull += `\n\n${contextDataBlock}`

      ultravoxCall = await createCall({
        systemPrompt: promptFull,
        voice: client.agent_voice_id,
        callbackUrl,
        metadata: { caller_phone: toPhone, client_slug: slug, client_id: client.id, source: 'dashboard-test-call' },
      })
    }
  } catch (err) {
    return NextResponse.json({ error: `Ultravox call creation failed: ${String(err)}` }, { status: 500 })
  }

  // Insert call_logs row — completed webhook picks this up for classification + minute tracking
  const svc = createServiceClient()
  svc.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: clientId,
    caller_phone: toPhone,
    call_status: 'test',
    started_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error(`[test-call] call_logs insert failed: ${error.message}`)
  })

  // Dial the operator via Twilio outbound, connecting to the Ultravox stream
  const twiml = `<Response><Connect><Stream url="${ultravoxCall.joinUrl}"/></Connect></Response>`
  try {
    const twilioClient = twilio(accountSid, authToken)
    const call = await twilioClient.calls.create({
      to: toPhone,
      from: fromNumber,
      twiml,
    })
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/test-call',
        method: 'POST',
        payload: { client_id: clientId, to_phone: toPhone, ultravox_call_id: ultravoxCall.callId, twilio_sid: call.sid },
      })
    }
    return NextResponse.json({ ok: true, callId: ultravoxCall.callId, twilio_sid: call.sid })
  } catch (err) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/test-call',
        method: 'POST',
        payload: { client_id: clientId, to_phone: toPhone },
        status: 'error',
        errorMessage: String(err),
      })
    }
    return NextResponse.json({ error: `Twilio dial failed: ${String(err)}` }, { status: 500 })
  }
}
