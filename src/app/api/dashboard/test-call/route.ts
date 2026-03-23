import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createCall, callViaAgent } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import twilio from 'twilio'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  // Admin can target any client; owners can only test their own
  const clientId = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id
  const toPhone: string = body.to_phone

  if (!toPhone) return NextResponse.json({ error: 'to_phone required (E.164 format)' }, { status: 400 })

  // Fetch client config — same columns buildAgentContext() needs + Twilio fields
  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, niche, business_name, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
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

  // Create Ultravox call with full context
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      ultravoxCall = await callViaAgent(client.ultravox_agent_id as string, {
        callerContext: callerContextRaw,
        businessFacts: knowledgeBlockStr,
        contextData: contextDataBlock,
        metadata: { caller_phone: toPhone, client_slug: client.slug as string, client_id: client.id, test_call: 'true' },
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
        metadata: { caller_phone: toPhone, client_slug: client.slug as string, client_id: client.id, test_call: 'true' },
      })
    }
  } catch (err) {
    return NextResponse.json({ error: `Ultravox call creation failed: ${String(err)}` }, { status: 500 })
  }

  // Dial the operator via Twilio outbound, connecting to the Ultravox stream
  const twiml = `<Response><Connect><Stream url="${ultravoxCall.joinUrl}"/></Connect></Response>`
  try {
    const twilioClient = twilio(accountSid, authToken)
    const call = await twilioClient.calls.create({
      to: toPhone,
      from: fromNumber,
      twiml,
    })
    return NextResponse.json({ ok: true, callId: ultravoxCall.callId, twilio_sid: call.sid })
  } catch (err) {
    return NextResponse.json({ error: `Twilio dial failed: ${String(err)}` }, { status: 500 })
  }
}
