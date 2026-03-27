import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature, buildVoicemailTwiml } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

/**
 * S14d: Twilio VoiceFallbackUrl — fires when primary /inbound webhook returns non-200 or times out.
 * Attempts voicemail fallback with client lookup. Falls back to generic message if DB is also down.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>
  const callerPhone = body.From || 'unknown'
  const callSid = body.CallSid || 'unknown'

  // Validate Twilio signature — prevents log pollution from arbitrary HTTP clients
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/fallback`
  if (!validateSignature(signature, url, body)) {
    console.error(`[fallback] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.error(`[fallback] Primary webhook failed for slug=${slug} caller=${callerPhone} callSid=${callSid}`)

  // Attempt client lookup for branded voicemail — if DB is also down, fall through to generic
  try {
    const supabase = createServiceClient()
    const { data: client } = await supabase
      .from('clients')
      .select('id, business_name, voicemail_greeting_text, voicemail_greeting_audio_url')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (client) {
      const recordingCallbackUrl = `${APP_URL}/api/webhook/${slug}/voicemail`

      // Dedup: check if a call_log row already exists for this CallSid
      // (Twilio retries fallback on slow responses — prevents duplicate VOICEMAIL rows)
      const { data: existing } = await supabase
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .limit(1)
        .maybeSingle()

      if (!existing) {
        supabase.from('call_logs').insert({
          client_id: client.id,
          caller_phone: callerPhone,
          twilio_call_sid: callSid,
          call_status: 'VOICEMAIL',
          started_at: new Date().toISOString(),
          ai_summary: 'Voicemail fallback — primary webhook failed',
        }).then(({ error }) => {
          if (error) console.error(`[fallback] Voicemail call_log insert failed:`, error.message)
        })
      } else {
        console.log(`[fallback] Duplicate CallSid=${callSid} — skipping call_log insert`)
      }

      const twiml = buildVoicemailTwiml({
        businessName: client.business_name,
        greetingText: client.voicemail_greeting_text,
        audioUrl: client.voicemail_greeting_audio_url,
        recordingCallbackUrl,
      })
      return new NextResponse(twiml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }
  } catch (dbErr) {
    console.error(`[fallback] Client lookup failed for slug=${slug}:`, dbErr)
  }

  // Last resort: generic message (DB unavailable or client not found)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, our system is temporarily unavailable. Please call back in a few minutes.</Say>
  <Hangup/>
</Response>`
  return new NextResponse(twiml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
