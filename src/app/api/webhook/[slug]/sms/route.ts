import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSmsTracked } from '@/lib/twilio'
import { parseCallState, setStateUpdate, readCallStateFromDb, persistCallStateToDb } from '@/lib/call-state'

export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Auth — same shared secret pattern as transfer route
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // B3: Read call state — header first (createCall), DB fallback (Agents API lacks initialState)
  let callState = parseCallState(req)

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

  // DB fallback: Agents API doesn't inject X-Call-State (no initialState support)
  if (!callState && call_id) callState = await readCallStateFromDb(supabase, call_id)

  // Check opt-out list before sending (TCPA/CRTC compliance)
  const { data: optOut } = await supabase
    .from('sms_opt_outs')
    .select('id, opted_back_in_at')
    .eq('phone_number', to)
    .eq('client_id', client.id)
    .single()

  if (optOut && !optOut.opted_back_in_at) {
    console.log(`[sms-tool] BLOCKED — recipient opted out: slug=${slug} to=${to}`)
    const blockedResponse = NextResponse.json({ result: 'SMS blocked — recipient opted out' })
    if (callState) setStateUpdate(blockedResponse, { lastToolOutcome: 'sms_blocked' })
    if (call_id) persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_blocked' })
    return blockedResponse
  }

  // Find related call_log id for linking
  let relatedCallId: string | null = null
  if (call_id) {
    const { data: callRow } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', call_id)
      .single()
    relatedCallId = callRow?.id ?? null
  }

  try {
    const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/sms-status`
    const twilioMessage = await sendSmsTracked(to, client.twilio_number, message, statusCallbackUrl)
    console.log(`[sms-tool] Sent in-call SMS: slug=${slug} to=${to} call_id=${call_id} sid=${twilioMessage.sid}`)

    // Log outbound SMS
    const { error: logError } = await supabase.from('sms_logs').insert({
      client_id: client.id,
      message_sid: twilioMessage.sid,
      direction: 'outbound',
      from_number: client.twilio_number,
      to_number: to,
      body: message,
      status: 'sent',
      related_call_id: relatedCallId,
    })
    if (logError) {
      console.error(`[sms-tool] sms_logs insert failed: ${logError.message}`)
    }

    // Mark that in-call SMS was sent (for post-call dedupe)
    if (call_id) {
      // Try call_logs first (production calls)
      const { data: logRow, error: logUpdateError } = await supabase.from('call_logs')
        .update({ in_call_sms_sent: true })
        .eq('ultravox_call_id', call_id)
        .select('id')

      if (logUpdateError) {
        console.error(`[sms-tool] DEDUPE WRITE FAILED call_logs: slug=${slug} call_id=${call_id} error=${logUpdateError.message}`)
      }

      // If not in call_logs, try demo_calls (call-me widget demos)
      if (!logRow?.length) {
        const { error: demoError } = await supabase.from('demo_calls')
          .update({ in_call_sms_sent: true })
          .eq('ultravox_call_id', call_id)

        if (demoError) {
          console.error(`[sms-tool] DEDUPE WRITE FAILED demo_calls: slug=${slug} call_id=${call_id} error=${demoError.message}`)
        } else {
          console.log(`[sms-tool] Marked demo_calls.in_call_sms_sent: slug=${slug} call_id=${call_id}`)
        }
      }
    }

    const sentResponse = NextResponse.json({ result: 'SMS sent' })
    if (callState) setStateUpdate(sentResponse, { lastToolOutcome: 'sms_sent' })
    if (call_id) persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_sent' })
    return sentResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sms-tool] Send failed: ${msg}`)
    const errResponse = NextResponse.json({ error: msg }, { status: 500 })
    if (callState) setStateUpdate(errResponse, { lastToolOutcome: 'sms_error' })
    if (call_id) persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_error' })
    return errResponse
  }
}
