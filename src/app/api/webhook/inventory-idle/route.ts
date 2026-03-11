/**
 * GET /api/webhook/inventory-idle
 *
 * TwiML endpoint used as VoiceUrl when an inventory number has been unassigned.
 * Answers the call, says a brief message, and hangs up.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This number is not currently in service. Please contact us directly. Goodbye.</Say>
  <Hangup/>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET() {
  return POST()
}
