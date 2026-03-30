/**
 * POST /api/webhook/[slug]/outbound-connect
 *
 * Twilio AMD callback for outbound leads dialed via /api/dashboard/leads/dial-out
 * or the scheduled-callbacks cron.
 * Called by Twilio once the call is answered, with `AnsweredBy` in the POST body.
 *
 * - AnsweredBy=human / unknown → connect the call to the Ultravox AI stream
 * - AnsweredBy=machine_start / machine_end / fax → play the VM script and hang up
 *   Also terminates the waiting Ultravox call immediately to stop billing (D90).
 *
 * Query params (set by dial-out route / cron):
 *   t  = outbound_connect_token ID (preferred, short URL) (D91)
 *   j  = URL-encoded Ultravox joinUrl — legacy fallback for in-flight calls
 *   v  = URL-encoded voicemail script text — legacy fallback
 *
 * Auth: Twilio signature (X-Twilio-Signature)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'
import { createServiceClient } from '@/lib/supabase/server'
import { endCall } from '@/lib/ultravox'

export const maxDuration = 10

/** Full XML entity escape — & MUST come first to avoid double-escaping (D96) */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

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

  // Resolve joinUrl and vmScript — token (short URL) takes priority over legacy params
  let joinUrl: string | null = null
  let vmScript: string | null = null
  let ultravoxCallId: string | null = null

  const tokenId = reqUrl.searchParams.get('t')
  if (tokenId) {
    const svc = createServiceClient()
    const { data: token } = await svc
      .from('outbound_connect_tokens')
      .select('join_url, vm_script, ultravox_call_id')
      .eq('id', tokenId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (token) {
      joinUrl = token.join_url
      vmScript = token.vm_script
      ultravoxCallId = token.ultravox_call_id
      // Clean up used token (fire-and-forget)
      svc.from('outbound_connect_tokens').delete().eq('id', tokenId).then(() => {})
    } else {
      console.warn(`[outbound-connect] Token ${tokenId} not found or expired for slug=${slug}`)
    }
  } else {
    // Legacy fallback for in-flight calls created before token table existed
    joinUrl = reqUrl.searchParams.get('j') ? decodeURIComponent(reqUrl.searchParams.get('j')!) : null
    vmScript = reqUrl.searchParams.get('v') ? decodeURIComponent(reqUrl.searchParams.get('v')!) : null
  }

  console.log(`[outbound-connect] slug=${slug} answeredBy=${answeredBy} callSid=${body.CallSid}`)

  // Machine detected — play voicemail script and hang up
  // Also terminate the waiting Ultravox call to stop billing immediately (D90)
  if (answeredBy.startsWith('machine')) {
    if (ultravoxCallId) {
      endCall(ultravoxCallId).catch(() => {}) // fire-and-forget
    }
    const script = vmScript || 'Hi, this is a message for you. Please call us back at your earliest convenience. Thank you.'
    const twiml = `<Response><Say>${xmlEscape(script)}</Say><Hangup/></Response>`
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
