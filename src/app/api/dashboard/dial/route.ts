import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createCall, signCallbackUrl } from '@/lib/ultravox'
import { buildStreamTwiml } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// POST — initiate an outbound call from the dashboard (no n8n)
// Flow: create Ultravox call → Twilio REST dials lead → same inbound infrastructure handles it
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { slug, phone } = body as { slug?: string; phone?: string }

  if (!slug || !phone) {
    return NextResponse.json({ error: 'slug and phone required' }, { status: 400 })
  }

  // Sanitize phone — ensure E.164 format
  const dialPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`

  // Fetch client config — same columns buildAgentContext() needs + Twilio fields
  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, niche, business_name, system_prompt, agent_voice_id, twilio_number, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'Client has no system prompt' }, { status: 400 })
  if (!client.twilio_number) return NextResponse.json({ error: 'Client has no Twilio number' }, { status: 400 })

  // Build full context via shared buildAgentContext() — same as inbound webhook
  const clientRow: ClientRow = {
    id: client.id,
    slug: client.slug as string,
    niche: client.niche as string | null,
    business_name: client.business_name as string | null,
    timezone: client.timezone as string | null,
    business_hours_weekday: client.business_hours_weekday as string | null,
    business_hours_weekend: client.business_hours_weekend as string | null,
    after_hours_behavior: client.after_hours_behavior as string | null,
    after_hours_emergency_phone: client.after_hours_emergency_phone as string | null,
    business_facts: client.business_facts as string | null,
    extra_qa: client.extra_qa as { q: string; a: string }[] | null,
    context_data: client.context_data as string | null,
    context_data_label: client.context_data_label as string | null,
    knowledge_backend: client.knowledge_backend as string | null,
    injected_note: client.injected_note as string | null,
  }
  const knowledgeBackend = client.knowledge_backend as string | null
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, dialPhone, [], new Date(), corpusAvailable)

  // Assemble full prompt with context blocks — same pattern as inbound fallback
  const callerContextBlock = ctx.assembled.callerContextBlock
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  let promptFull = client.system_prompt + `\n\n${callerContextBlock}`
  if (knowledgeBlockStr) promptFull += `\n\n${knowledgeBlockStr}`
  if (contextDataBlock) promptFull += `\n\n${contextDataBlock}`

  // S13b-T1d: sign callback URL so completed route can reject forged webhooks
  const completedUrl = signCallbackUrl(`${APP_URL}/api/webhook/${slug}/completed`, slug)

  // Create Ultravox call with full context
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    ultravoxCall = await createCall({
      systemPrompt: promptFull,
      voice: client.agent_voice_id,
      callbackUrl: completedUrl,
      metadata: {
        caller_phone: dialPhone,
        client_slug: slug,
        client_id: client.id,
        direction: 'outbound',
      },
    })
  } catch (err) {
    console.error('[dial] Ultravox call creation failed:', err)
    return NextResponse.json({ error: 'Failed to create AI call' }, { status: 502 })
  }

  // Insert live row in Supabase
  const { error: insertError } = await supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: dialPhone,
    call_status: 'live',
    started_at: new Date().toISOString(),
  })
  if (insertError) console.error('[dial] Live row insert failed:', insertError.message)

  // Build inline TwiML — Twilio dials lead and streams directly to Ultravox
  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)

  // Create Twilio outbound call via REST API
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        To: dialPhone,
        From: client.twilio_number,
        Twiml: twiml,
      }).toString(),
    }
  )

  if (!twilioRes.ok) {
    const err = await twilioRes.text()
    console.error('[dial] Twilio call creation failed:', twilioRes.status, err)
    // Clean up the live row since call won't happen
    await supabase.from('call_logs').delete().eq('ultravox_call_id', ultravoxCall.callId)
    return NextResponse.json({ error: 'Twilio dial failed', detail: err }, { status: 502 })
  }

  const twilioData = await twilioRes.json()

  return NextResponse.json({
    ok: true,
    callId: ultravoxCall.callId,
    callSid: twilioData.sid,
    message: `Dialing ${dialPhone}…`,
  })
}
