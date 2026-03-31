import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSmsTracked } from '@/lib/twilio'
import { parseCallState, setStateUpdate, readCallStateFromDb, persistCallStateToDb } from '@/lib/call-state'
import { APP_URL } from '@/lib/app-url'

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
  // Note: VoIP detection is NOT implemented; the prompt does not claim we skip VoIP numbers.
  if (!/^\+1[2-9]\d{9}$/.test(to)) {
    if (call_id) {
      const supabase = createServiceClient()
      const { data: callRow } = await supabase
        .from('call_logs')
        .select('id')
        .eq('ultravox_call_id', call_id)
        .maybeSingle()
      if (callRow?.id) {
        await supabase.from('call_logs')
          .update({ sms_outcome: 'failed_missing_phone' })
          .eq('id', callRow.id)
      }
    }
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, twilio_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Trial clients have no dedicated twilio_number yet — fall back to platform number so SMS
  // works during the full-feature trial period (test calls and dashboard agent tests).
  const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER
  if (!fromNumber) {
    return NextResponse.json({ error: 'No Twilio number configured' }, { status: 404 })
  }

  // DB fallback: Agents API doesn't inject X-Call-State (no initialState support)
  if (!callState && call_id) callState = await readCallStateFromDb(supabase, call_id)

  // Resolve call_logs row id for linking and outcome writes.
  // If not in call_logs, check demo_calls and guard against double-send there too.
  let relatedCallId: string | null = null
  let isDemoCall = false
  if (call_id) {
    const { data: callRow } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', call_id)
      .maybeSingle()
    relatedCallId = callRow?.id ?? null

    if (!relatedCallId) {
      // Not a production call — check demo_calls for dedup
      const { data: demoRow } = await supabase
        .from('demo_calls')
        .select('id, in_call_sms_sent')
        .eq('ultravox_call_id', call_id)
        .maybeSingle()
      if (demoRow) {
        isDemoCall = true
        if (demoRow.in_call_sms_sent) {
          // Demo already sent — logical guard (demo calls are low-concurrency)
          console.log(`[sms-tool] SKIP demo duplicate: slug=${slug} call_id=${call_id}`)
          return NextResponse.json({ result: 'already_attempted' })
        }
      }
    }
  }

  // Check opt-out list before sending (TCPA/CRTC compliance)
  const { data: optOut } = await supabase
    .from('sms_opt_outs')
    .select('id, opted_back_in_at')
    .eq('phone_number', to)
    .eq('client_id', client.id)
    .single()

  if (optOut && !optOut.opted_back_in_at) {
    console.log(`[sms-tool] BLOCKED — recipient opted out: slug=${slug} to=${to}`)
    if (relatedCallId) {
      await supabase.from('call_logs')
        .update({ sms_outcome: 'blocked_opt_out' })
        .eq('id', relatedCallId)
    }
    const blockedResponse = NextResponse.json({ result: 'SMS blocked — recipient opted out' })
    if (callState) setStateUpdate(blockedResponse, { lastToolOutcome: 'sms_blocked' })
    if (call_id) await persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_blocked' })
    return blockedResponse
  }

  // ── Track B.1: Atomic idempotency via DB unique constraint ──────────────────
  // INSERT the sms_logs row before calling Twilio. The unique index on
  // (related_call_id) WHERE direction='outbound' means only one concurrent
  // request can claim this call's SMS send. The second gets a 23505 and bails.
  // This is atomic — no read-then-skip race window.
  const statusCallbackUrl = `${APP_URL}/api/webhook/${slug}/sms-status`
  const { data: claimRow, error: claimError } = await supabase.from('sms_logs').insert({
    client_id: client.id,
    related_call_id: relatedCallId,
    direction: 'outbound',
    from_number: fromNumber,
    to_number: to,
    body: message,
    status: 'pending',
    attempted_at: new Date().toISOString(),
  }).select('id').single()

  if (claimError) {
    if (claimError.code === '23505') {
      // Unique constraint fired — another concurrent request already owns this send
      console.log(`[sms-tool] SKIP duplicate — unique constraint hit: slug=${slug} call_id=${call_id}`)
      return NextResponse.json({ result: 'already_attempted' })
    }
    // Non-unique DB error — log but don't abort the send over a logging issue
    console.error(`[sms-tool] sms_logs claim insert failed: ${claimError.message}`)
  }

  try {
    const twilioMessage = await sendSmsTracked(to, fromNumber, message, statusCallbackUrl)
    console.log(`[sms-tool] Sent in-call SMS: slug=${slug} to=${to} call_id=${call_id} sid=${twilioMessage.sid}`)

    // Update the claimed sms_logs row with real SID and status
    if (claimRow?.id) {
      const { error: updateErr } = await supabase.from('sms_logs')
        .update({
          message_sid: twilioMessage.sid,
          provider_message_sid: twilioMessage.sid,
          status: 'sent',
        })
        .eq('id', claimRow.id)
      if (updateErr) console.error(`[sms-tool] sms_logs update failed: ${updateErr.message}`)
    }

    // Write outcome to call_logs (production calls)
    if (relatedCallId) {
      const { error: logUpdateError } = await supabase.from('call_logs')
        .update({ in_call_sms_sent: true, sms_outcome: 'sent' })
        .eq('id', relatedCallId)
      if (logUpdateError) {
        console.error(`[sms-tool] call_logs outcome write failed: slug=${slug} call_id=${call_id} error=${logUpdateError.message}`)
      }
    } else if (call_id) {
      // No call_logs row — try demo_calls (call-me widget)
      const { error: demoError } = await supabase.from('demo_calls')
        .update({ in_call_sms_sent: true })
        .eq('ultravox_call_id', call_id)
      if (demoError) {
        console.error(`[sms-tool] demo_calls update failed: slug=${slug} call_id=${call_id} error=${demoError.message}`)
      }
    }

    const sentResponse = NextResponse.json({ result: 'SMS sent' })
    if (callState) setStateUpdate(sentResponse, { lastToolOutcome: 'sms_sent' })
    if (call_id) await persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_sent' })
    return sentResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sms-tool] Send failed: ${msg}`)

    // Update claimed row with failure details
    if (claimRow?.id) {
      await supabase.from('sms_logs')
        .update({ status: 'failed', error_message: msg })
        .eq('id', claimRow.id)
    }

    // Write outcome to call_logs
    if (relatedCallId) {
      await supabase.from('call_logs')
        .update({ sms_outcome: 'failed_provider' })
        .eq('id', relatedCallId)
    }

    const errResponse = NextResponse.json({ error: msg }, { status: 500 })
    if (callState) setStateUpdate(errResponse, { lastToolOutcome: 'sms_error' })
    if (call_id) await persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'sms_error' })
    return errResponse
  }
}
