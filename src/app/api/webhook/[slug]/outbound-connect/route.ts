/**
 * POST /api/webhook/[slug]/outbound-connect
 *
 * Twilio AMD callback for outbound leads dialed via /api/dashboard/leads/dial-out.
 * Called by Twilio once the call is answered, with `AnsweredBy` in the POST body.
 *
 * - AnsweredBy=human / unknown → connect the call to the Ultravox AI stream
 * - AnsweredBy=machine_start / machine_end / fax → play the VM script and hang up
 *
 * Query params (set by dial-out route):
 *   j  = URL-encoded Ultravox joinUrl (WebSocket stream URL)
 *   v  = URL-encoded voicemail script text
 *
 * Auth: Twilio signature (X-Twilio-Signature)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

export const maxDuration = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  // Validate Twilio signature — include query string so it matches signed URL
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const reqUrl = new URL(req.url)
  const url = `${APP_URL}/api/webhook/${slug}/outbound-connect${reqUrl.search || ''}`
  if (!validateSignature(signature, url, body)) {
    console.error(`[outbound-connect] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  const answeredBy = (body.AnsweredBy || '').toLowerCase()
  const joinUrl = reqUrl.searchParams.get('j') ? decodeURIComponent(reqUrl.searchParams.get('j')!) : null
  const vmScript = reqUrl.searchParams.get('v') ? decodeURIComponent(reqUrl.searchParams.get('v')!) : null

  console.log(`[outbound-connect] slug=${slug} answeredBy=${answeredBy} callSid=${body.CallSid}`)

  // Machine detected — play voicemail script and hang up
  if (answeredBy.startsWith('machine')) {
    const script = vmScript || 'Hi, this is a message for you. Please call us back at your earliest convenience. Thank you.'
    const twiml = `<Response><Say>${script.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Say><Hangup/></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Human (or unknown / no-answer / fax) — connect to Ultravox AI stream
  if (!joinUrl) {
    console.error(`[outbound-connect] No joinUrl for slug=${slug} — returning hangup`)
    return new NextResponse('<Response><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } })
  }

  const twiml = `<Response><Connect><Stream url="${joinUrl}"/></Connect></Response>`
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
