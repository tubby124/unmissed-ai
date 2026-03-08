import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall } from '@/lib/ultravox'
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

  // Fetch client from Supabase
  const supabase = createServiceClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id')
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

  console.log(`[inbound] Client found: slug=${slug} clientId=${client.id} promptLen=${client.system_prompt.length}`)

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`
  console.log(`[inbound] Creating Ultravox call: callbackUrl=${callbackUrl}`)

  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    ultravoxCall = await createCall({
      systemPrompt: client.system_prompt,
      voice: client.agent_voice_id,
      callbackUrl,
      metadata: {
        caller_phone: callerPhone,
        client_slug: slug,
        client_id: client.id,
      },
    })
  } catch (error) {
    console.error('[inbound] Ultravox call creation failed:', error)
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice">Sorry, we're experiencing technical difficulties. Please try again shortly.</Say></Response>`
    return new NextResponse(fallbackTwiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  console.log(`[inbound] Ultravox call created: callId=${ultravoxCall.callId} joinUrl=${ultravoxCall.joinUrl.slice(0, 60)}...`)

  // Fire-and-forget: insert 'live' row — must not block or break the call
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
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
