import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'

export const maxDuration = 15

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Parse x-www-form-urlencoded body (Twilio format)
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const callerPhone = body.From || 'unknown'
  const callSid = body.CallSid || 'unknown'
  console.log(`[inbound] slug=${slug} callerPhone=${callerPhone} callSid=${callSid}`)

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/inbound`
  if (!validateSignature(signature, url, body)) {
    console.error(`[inbound] Twilio signature FAILED for slug=${slug} url=${url}`)
    return new NextResponse('Forbidden', { status: 403 })
  }
  console.log(`[inbound] Twilio signature OK for slug=${slug}`)

  // Fetch client — includes tools + ultravox_agent_id for Agents API
  const supabase = createServiceClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id, ultravox_agent_id, tools')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (clientError || !client) {
    console.error(`[inbound] Client not found: slug=${slug} error=${clientError?.message || 'null row'}`)
    return new NextResponse('Client not found', { status: 404 })
  }

  if (!client.system_prompt) {
    console.error(`[inbound] No system_prompt for slug=${slug} clientId=${client.id} — returning unavailable message`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this line is temporarily unavailable. Please try again later.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  console.log(`[inbound] Client found: slug=${slug} clientId=${client.id} promptLen=${client.system_prompt.length} agentId=${client.ultravox_agent_id || 'none'}`)

  // ── Returning caller detection ─────────────────────────────────────────────
  let callerContext: string | undefined
  if (callerPhone !== 'unknown') {
    const { data: priorCalls } = await supabase
      .from('call_logs')
      .select('started_at, call_status, ai_summary')
      .eq('caller_phone', callerPhone)
      .eq('client_id', client.id)
      .order('started_at', { ascending: false })
      .limit(5)

    if (priorCalls?.length) {
      const callCount = priorCalls.length
      const lastCall = priorCalls[0]
      const lastDate = new Date(lastCall.started_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
      const lastSummary = lastCall.ai_summary
        ? ` Last call: ${(lastCall.ai_summary as string).slice(0, 120)}`
        : ''
      callerContext = `RETURNING CALLER — ${callCount} prior call${callCount > 1 ? 's' : ''}. Most recent: ${lastDate}.${lastSummary}`
      console.log(`[inbound] Returning caller: ${callerPhone} — ${callCount} prior calls, context injected`)
    }
  }

  const rawCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`
  const tools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined

  // ── Create Ultravox call ───────────────────────────────────────────────────
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      // Agents API — one persistent profile per client, lightweight per-call payload
      console.log(`[inbound] Agents API: agentId=${client.ultravox_agent_id}`)
      ultravoxCall = await callViaAgent(client.ultravox_agent_id, {
        metadata: { caller_phone: callerPhone, client_slug: slug, client_id: client.id },
        ...(callerContext ? { callerContext } : {}),
      })
    } else {
      // Per-call creation — fallback when no Agents API profile set up yet
      console.log(`[inbound] Per-call creation (no agentId for slug=${slug})`)
      ultravoxCall = await createCall({
        systemPrompt: callerContext ? client.system_prompt + `\n\n[${callerContext}]` : client.system_prompt,
        voice: client.agent_voice_id,
        tools,
        metadata: { caller_phone: callerPhone, client_slug: slug, client_id: client.id },
      })
    }
  } catch (error) {
    console.error('[inbound] Ultravox call creation failed:', error)
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice">Sorry, we're experiencing technical difficulties. Please try again shortly.</Say></Response>`
    return new NextResponse(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Sign callback URL now that we have callId
  const signedCallbackUrl = signCallbackUrl(rawCallbackUrl, ultravoxCall.callId)

  // PATCH callback URL onto the created call (fire-and-forget — non-critical)
  fetch(`https://api.ultravox.ai/api/calls/${ultravoxCall.callId}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ callbacks: { ended: { url: signedCallbackUrl } } }),
  }).catch(err => console.warn(`[inbound] Callback URL PATCH failed (non-critical): ${err}`))

  console.log(`[inbound] Ultravox call created: callId=${ultravoxCall.callId} joinUrl=${ultravoxCall.joinUrl.slice(0, 60)}...`)

  // Fire-and-forget: insert 'live' row
  supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: callerPhone,
    twilio_call_sid: body.CallSid || null,
    call_status: 'live',
    started_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[inbound] Live row insert failed:', error.message)
    else console.log(`[inbound] Live row inserted: callId=${ultravoxCall.callId}`)
  })

  console.log(`[inbound] Returning TwiML stream for callId=${ultravoxCall.callId}`)
  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
