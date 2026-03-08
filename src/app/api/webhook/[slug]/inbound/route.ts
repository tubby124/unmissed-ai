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

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/inbound`
  if (!validateSignature(signature, url, body)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Fetch client from Supabase
  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) {
    return new NextResponse('Client not found', { status: 404 })
  }

  const callerPhone = body.From || 'unknown'
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`

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

  // Fire-and-forget: insert 'live' row — must not block or break the call
  supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: callerPhone,
    call_status: 'live',
    started_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[inbound] Live row insert failed:', error.message)
  })

  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
