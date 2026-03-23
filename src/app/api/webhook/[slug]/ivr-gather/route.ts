import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature, buildVoicemailTwiml } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

export const maxDuration = 10

/**
 * IVR keypress handler — fires after /inbound returns a <Gather> TwiML menu.
 *
 * Caller pressed 1 → voicemail (log VOICEMAIL call_log + return buildVoicemailTwiml)
 * No digit / other  → redirect back to /inbound?skip_ivr=1 (connects to AI agent)
 *
 * DB columns written: call_logs (VOICEMAIL path only)
 *   - client_id, caller_phone, twilio_call_sid, call_status='VOICEMAIL', started_at, ai_summary
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const callerPhone = body.From || 'unknown'
  const callSid    = body.CallSid || 'unknown'
  const digit      = body.Digits || ''

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/ivr-gather`
  if (!validateSignature(signature, url, body)) {
    console.error(`[ivr-gather] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.log(`[ivr-gather] slug=${slug} callerPhone=${callerPhone} digit="${digit}"`)

  if (digit === '1') {
    // Caller chose voicemail — fetch minimal client fields
    const supabase = createServiceClient()
    const { data: client } = await supabase
      .from('clients')
      .select('id, business_name, voicemail_greeting_text, voicemail_greeting_audio_url')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (!client) {
      console.error(`[ivr-gather] Client not found for slug=${slug}`)
      return new NextResponse('Client not found', { status: 404 })
    }

    const recordingCallbackUrl = `${APP_URL}/api/webhook/${slug}/voicemail`

    // Log voicemail call (fire-and-forget — TwiML must return fast)
    supabase.from('call_logs').insert({
      client_id:      client.id,
      caller_phone:   callerPhone,
      twilio_call_sid: callSid,
      call_status:    'VOICEMAIL',
      started_at:     new Date().toISOString(),
      ai_summary:     'Caller chose voicemail via IVR menu',
    }).then(({ error }) => {
      if (error) console.error(`[ivr-gather] call_log insert failed:`, error.message)
      else console.log(`[ivr-gather] VOICEMAIL call_log created for callSid=${callSid}`)
    })

    console.log(`[ivr-gather] Routing to voicemail for slug=${slug}`)
    const vmTwiml = buildVoicemailTwiml({
      businessName:  client.business_name as string | null,
      greetingText:  (client as Record<string, unknown>).voicemail_greeting_text as string | null,
      audioUrl:      (client as Record<string, unknown>).voicemail_greeting_audio_url as string | null,
      recordingCallbackUrl,
    })
    return new NextResponse(vmTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // No digit pressed (timeout) or any other key → connect to AI agent
  // Redirect back to inbound with skip_ivr=1 so the IVR gate is bypassed
  console.log(`[ivr-gather] Connecting to agent for slug=${slug} (digit="${digit}")`)
  const redirectUrl = `${APP_URL}/api/webhook/${slug}/inbound?skip_ivr=1`
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${redirectUrl}</Redirect></Response>`
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
