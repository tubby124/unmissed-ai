import twilio from 'twilio'

export async function redirectCall(
  callSid: string,
  toNumber: string,
  opts?: { callerPhone?: string; clientNumber?: string; actionUrl?: string }
): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const announcement = '<Say voice="Polly.Amy">Please hold while I connect you to our team.</Say>'
  const dialAttrs = [
    opts?.clientNumber ? ` callerId="${opts.clientNumber}"` : '',
    opts?.actionUrl ? ` action="${opts.actionUrl}"` : '',
    ' timeout="20"',
  ].join('')
  // When actionUrl is set, Twilio POSTs to it after dial ends (no inline fallback needed).
  // Without actionUrl, fall through to an inline <Say> fallback (legacy behavior).
  const fallback = opts?.actionUrl
    ? ''
    : '<Say>Sorry, no one was available to take your call. Please try again later.</Say>'
  await client.calls(callSid).update({
    twiml: `<Response>${announcement}<Dial${dialAttrs}><Number>${toNumber}</Number></Dial>${fallback}</Response>`,
  })
}

export async function sendSms(to: string, from: string, body: string): Promise<void> {
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  await twilioClient.messages.create({ to, from, body })
}

export async function sendSmsTracked(
  to: string,
  from: string,
  body: string,
  statusCallback?: string
): Promise<{ sid: string }> {
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const msg = await twilioClient.messages.create({
    to,
    from,
    body,
    ...(statusCallback ? { statusCallback } : {}),
  })
  return { sid: msg.sid }
}

export function validateSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not set — skipping signature validation')
    return process.env.NODE_ENV !== 'production'
  }
  return twilio.validateRequest(authToken, signature, url, params)
}

export function buildStreamTwiml(joinUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${joinUrl}"/>
  </Connect>
</Response>`
}

/**
 * S14: Voicemail fallback TwiML — plays greeting then records a message.
 * Priority: audioUrl > greetingText > auto-generated from businessName.
 * recordingCallback receives Twilio POST when recording file is ready.
 */
export function buildVoicemailTwiml(opts: {
  businessName?: string | null
  greetingText?: string | null
  audioUrl?: string | null
  recordingCallbackUrl: string
}): string {
  const { businessName, greetingText, audioUrl, recordingCallbackUrl } = opts

  // Greeting: custom audio > custom text > auto-generated
  let greetingTwiml: string
  if (audioUrl) {
    greetingTwiml = `<Play>${escapeXml(audioUrl)}</Play>`
  } else {
    const text = greetingText
      || (businessName
        ? `Hi, you've reached ${businessName}. We're unable to take your call right now. Please leave a message after the beep and we'll get back to you as soon as possible.`
        : `Hi, we're unable to take your call right now. Please leave a message after the beep and we'll get back to you as soon as possible.`)
    greetingTwiml = `<Say voice="Polly.Joanna">${escapeXml(text)}</Say>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" recordingStatusCallback="${escapeXml(recordingCallbackUrl)}" recordingStatusCallbackMethod="POST" />
  <Say voice="Polly.Joanna">We didn't receive a message. Goodbye.</Say>
</Response>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
