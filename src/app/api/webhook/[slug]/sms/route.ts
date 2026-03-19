import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'

export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Auth — same shared secret pattern as transfer route
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let to: string, message: string, call_id: string
  try {
    const body = await req.json()
    to = body.to
    message = body.message
    call_id = body.call_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!to || !message) {
    return NextResponse.json({ error: 'to and message required' }, { status: 400 })
  }

  // Validate E.164 — NANP only (US/Canada +1)
  if (!/^\+1[2-9]\d{9}$/.test(to)) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, twilio_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.twilio_number) {
    return NextResponse.json({ error: 'Client or Twilio number not found' }, { status: 404 })
  }

  try {
    await sendSms(to, client.twilio_number, message)
    console.log(`[sms-tool] Sent in-call SMS: slug=${slug} to=${to} call_id=${call_id}`)

    // Mark that in-call SMS was sent (for post-call dedupe)
    if (call_id) {
      const { error: markError } = await supabase.from('call_logs')
        .update({ in_call_sms_sent: true })
        .eq('ultravox_call_id', call_id)
      if (markError) console.warn(`[sms-tool] Failed to mark in_call_sms_sent: ${markError.message}`)
    }

    return NextResponse.json({ result: 'SMS sent' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sms-tool] Send failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
