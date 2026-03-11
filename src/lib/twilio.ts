import twilio from 'twilio'

export async function redirectCall(callSid: string, toNumber: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  await client.calls(callSid).update({
    twiml: `<Response><Dial><Number>${toNumber}</Number></Dial></Response>`,
  })
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
