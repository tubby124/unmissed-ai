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
