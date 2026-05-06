import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirectCall, sendSms } from '@/lib/twilio'
import { parseCallState, setStateUpdate, readCallStateFromDb, persistCallStateToDb } from '@/lib/call-state'
import { APP_URL } from '@/lib/app-url'
import { recordToolInvocation } from '@/lib/tool-invocations'

export const maxDuration = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const startedAt = Date.now()
  const { slug } = await params

  // Verify shared secret — Ultravox sends this as a static header
  const secret = req.headers.get('x-tool-secret') || req.headers.get('x-transfer-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // B3: Read call state — header first (createCall), DB fallback (Agents API lacks initialState)
  let callState = parseCallState(req)

  let call_id: string | undefined
  let reason: string | undefined
  try {
    const body = await req.json()
    call_id = body.call_id
    reason = typeof body.reason === 'string' ? body.reason : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  }
  const transferQueryText = reason ?? ''

  const supabase = createServiceClient()

  // Fetch forwarding_number for this client
  const { data: client } = await supabase
    .from('clients')
    .select('id, forwarding_number, twilio_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.forwarding_number) {
    console.error(`[transfer] No forwarding_number for slug=${slug}`)
    if (client?.id) {
      void recordToolInvocation({
        clientId: client.id, callLogId: null, toolName: 'transferCall',
        queryText: transferQueryText, chunkIdsHit: null,
        success: false, latencyMs: Date.now() - startedAt,
      })
    }
    return NextResponse.json({ error: 'No forwarding number configured' }, { status: 404 })
  }

  // DB fallback: Agents API doesn't inject X-Call-State (no initialState support)
  if (!callState && call_id) callState = await readCallStateFromDb(supabase, call_id)

  // Look up Twilio callSid from call_logs
  const { data: log } = await supabase
    .from('call_logs')
    .select('id, twilio_call_sid, caller_phone')
    .eq('ultravox_call_id', call_id)
    .eq('client_id', client.id)
    .limit(1)
    .single()

  if (!log?.twilio_call_sid) {
    console.error(`[transfer] No twilio_call_sid for call_id=${call_id} slug=${slug}`)
    void recordToolInvocation({
      clientId: client.id, callLogId: (log?.id as string | undefined) ?? null, toolName: 'transferCall',
      queryText: transferQueryText, chunkIdsHit: null,
      success: false, latencyMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'Call SID not found' }, { status: 404 })
  }
  const callLogId = log.id as string

  try {
    const callerPhone = (log.caller_phone as string | null) ?? 'unknown'
    const clientNumber = (client.twilio_number as string | null) ?? undefined
    if (clientNumber) {
      const smsBody = callerPhone !== 'unknown'
        ? `Incoming transfer to you. Caller: ${callerPhone}. Your agent is connecting them now.`
        : `Incoming transfer. Your agent is connecting a caller to you now.`
      try {
        await sendSms(client.forwarding_number, clientNumber, smsBody)
      } catch (err) {
        console.warn(`[transfer] SMS alert failed: ${err}`)
      }
    }
    // Build action URL for transfer failure recovery — Twilio will POST here after dial ends
    const actionUrl = `${APP_URL}/api/webhook/${slug}/transfer-status`

    await redirectCall(log.twilio_call_sid, client.forwarding_number, {
      callerPhone: callerPhone !== 'unknown' ? callerPhone : undefined,
      clientNumber,
      actionUrl,
    })
    // Mark original call as 'transferred' + set transfer_status lifecycle
    try {
      const { error: markErr } = await supabase.from('call_logs')
        .update({
          call_status: 'transferred',
          ai_summary: 'Call transferred to owner',
          transfer_status: 'transferring',
          transfer_started_at: new Date().toISOString(),
        })
        .eq('ultravox_call_id', call_id)
      if (markErr) console.warn(`[transfer] Failed to mark call as transferred: ${markErr.message}`)
    } catch (markCatchErr) {
      console.warn(`[transfer] Failed to mark call as transferred: ${markCatchErr}`)
    }
    console.log(`[transfer] Redirected callSid=${log.twilio_call_sid} to ${client.forwarding_number} for slug=${slug}`)
    const okResponse = NextResponse.json({ result: 'Transfer initiated' })
    if (callState) setStateUpdate(okResponse, { escalationFlag: true, lastToolOutcome: 'transferred' })
    if (call_id) await persistCallStateToDb(supabase, call_id, callState, { escalationFlag: true, lastToolOutcome: 'transferred' })
    void recordToolInvocation({
      clientId: client.id, callLogId, toolName: 'transferCall',
      queryText: transferQueryText, chunkIdsHit: null,
      success: true, latencyMs: Date.now() - startedAt,
    })
    return okResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[transfer] Twilio redirect failed: ${msg}`)
    const errResponse = NextResponse.json({ error: msg }, { status: 500 })
    if (callState) setStateUpdate(errResponse, { lastToolOutcome: 'transfer_error' })
    if (call_id) await persistCallStateToDb(supabase, call_id, callState, { lastToolOutcome: 'transfer_error' })
    void recordToolInvocation({
      clientId: client.id, callLogId, toolName: 'transferCall',
      queryText: transferQueryText, chunkIdsHit: null,
      success: false, latencyMs: Date.now() - startedAt,
    })
    return errResponse
  }
}
