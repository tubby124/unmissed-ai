import { NextRequest, NextResponse } from 'next/server'
import { APP_URL } from '@/lib/app-url'
import { validateSignature } from '@/lib/twilio'

export const maxDuration = 10

/**
 * Go Live Tab Section 4 — TwiML served to the carrier-chain verification call.
 *
 * The POST /api/dashboard/forwarding-verify route asks Twilio to dial the
 * client's twilio_number and fetch this TwiML. If the owner's carrier
 * forwarding is set up correctly the call has already been redirected to
 * their personal cell by the time TwiML plays — they hear the Say, press 1,
 * and Twilio POSTs the digit to the confirm endpoint below.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ client_id: string }> }
) {
  const { client_id } = await params

  const formData = await req.formData()
  const params_: Record<string, string> = {}
  for (const [k, v] of formData.entries()) params_[k] = String(v)

  const signature = req.headers.get('X-Twilio-Signature') || ''
  const fullUrl = `${APP_URL}/api/webhook/forwarding-verify-twiml/${client_id}`
  if (!validateSignature(signature, fullUrl, params_)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const confirmUrl = `${APP_URL}/api/webhook/forwarding-verify-confirm/${client_id}`

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Forwarding works. Press one to confirm, then hang up.</Say>
  <Gather numDigits="1" action="${confirmUrl}" method="POST" timeout="10" />
  <Hangup/>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}
