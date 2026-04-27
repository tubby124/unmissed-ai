import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { normalizePhoneNA } from '@/lib/utils/phone'

export const maxDuration = 15

const TEST_TIMEOUT_MS = 30_000 // spec: UI polls every 2s up to 30s

/**
 * Go Live Tab Section 4 — carrier-chain forwarding verification.
 *
 * Distinct from the legacy /api/dashboard/forwarding/verify route, which dials
 * the user's callback_phone directly and therefore can't actually prove that
 * carrier forwarding is set up (it always rings their phone regardless).
 *
 * This route dials the client's TWILIO NUMBER and asks the caller to press 1.
 * If carrier forwarding is correctly enabled, the call traverses the forward
 * chain and reaches the owner's phone. They press 1 → /forwarding-verify-confirm
 * sets clients.forwarding_verified_at. If forwarding isn't set up, the call
 * lands on the regular inbound webhook (the agent answers itself), no DTMF
 * arrives, and the row times out at 30s.
 *
 * The `forwarding_number` body field per spec is accepted but the actual
 * forward destination this codebase uses is clients.callback_phone (see Track A
 * caveat). The UI/page-assembly track decides which DB column to bind the
 * Section 4 phone input to — this route just initiates the carrier-chain test.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = cu.role === 'admin' && typeof body.client_id === 'string' ? body.client_id : cu.client_id

  const { data: client } = await supabase
    .from('clients')
    .select('id, callback_phone, twilio_number')
    .eq('id', clientId)
    .limit(1)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (!client.twilio_number) {
    return NextResponse.json({ error: 'twilio_number not provisioned for client' }, { status: 400 })
  }

  // Per spec body field name is `forwarding_number`, but in this codebase the
  // owner's personal cell that gets forwarded TO the Twilio number is
  // callback_phone (forwarding_number drives transferCall instead). Accept the
  // spec field but fall back to callback_phone — see Track A caveat.
  const requestedForwardNumber = typeof body.forwarding_number === 'string' ? body.forwarding_number : null
  const ownerCellRaw = requestedForwardNumber ?? (client.callback_phone as string | null) ?? ''
  const ownerCell = normalizePhoneNA(ownerCellRaw)
  if (!ownerCell) {
    return NextResponse.json({ error: 'forwarding number not set (provide forwarding_number in body or set callback_phone on client)' }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  const svc = createServiceClient()

  // Block back-to-back tests: if a carrier-chain test started < 90s ago and is
  // still pending, return that instead of dialing again. Carrier-chain tests
  // are distinguished from legacy /forwarding/verify rows by from_number
  // matching the client's twilio_number (legacy uses TWILIO_FROM_NUMBER).
  const { data: existing } = await svc
    .from('forwarding_verify_tests')
    .select('id, status, started_at')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .eq('from_number', client.twilio_number)
    .gte('started_at', new Date(Date.now() - 90_000).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      test_id: existing.id,
      started_at: existing.started_at,
      reused: true,
    })
  }

  const { data: inserted, error: insertErr } = await svc
    .from('forwarding_verify_tests')
    .insert({
      client_id: clientId,
      callback_phone: ownerCell,
      // from_number set to the client's twilio_number — this distinguishes the
      // carrier-chain test row from a legacy /forwarding/verify row, which
      // sets from_number to the global TWILIO_FROM_NUMBER.
      from_number: client.twilio_number,
      status: 'pending',
    })
    .select('id, started_at')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json({ error: `Failed to create test: ${insertErr?.message}` }, { status: 500 })
  }

  // Outbound call dials the TWILIO number. If carrier forwarding is set up
  // correctly on the owner's cell (callback_phone), the call rides the forward
  // chain and rings them; press-1 confirms. If not, the call hits inbound and
  // the agent answers itself — no DTMF arrives, row eventually times out.
  const twimlUrl = `${APP_URL}/api/webhook/forwarding-verify-twiml/${clientId}`

  try {
    const twilioClient = twilio(accountSid, authToken)
    const call = await twilioClient.calls.create({
      to: client.twilio_number,
      from: fromNumber,
      url: twimlUrl,
      method: 'POST',
      timeout: 25,
    })

    await svc
      .from('forwarding_verify_tests')
      .update({ outbound_twilio_sid: call.sid })
      .eq('id', inserted.id)

    return NextResponse.json({
      test_id: inserted.id,
      started_at: inserted.started_at,
      twilio_sid: call.sid,
      timeout_ms: TEST_TIMEOUT_MS,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await svc
      .from('forwarding_verify_tests')
      .update({ status: 'failed', error_message: errMsg, completed_at: new Date().toISOString() })
      .eq('id', inserted.id)

    return NextResponse.json({ error: `Twilio dial failed: ${errMsg}` }, { status: 500 })
  }
}

/**
 * Polling endpoint for the Go Live UI.
 * Spec: UI polls every 2s for up to 30s. Returns current row state plus the
 * client's forwarding_verified_at so the UI can flip the green pill the moment
 * the confirm endpoint records the press-1.
 *
 * NOTE: A separate GET on this distinct path (not the legacy [test_id]/route.ts)
 * is needed because the UI returns `forwarding_verified_at` in the same payload
 * — the legacy GET only returns the test row.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const testId = url.searchParams.get('id')
  if (!testId) return NextResponse.json({ error: 'id query param required' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) return new NextResponse('Forbidden', { status: 403 })

  const svc = createServiceClient()
  const { data: test, error } = await svc
    .from('forwarding_verify_tests')
    .select('id, client_id, status, started_at, completed_at, error_message')
    .eq('id', testId)
    .limit(1)
    .maybeSingle()

  if (error || !test) return NextResponse.json({ error: 'Test not found' }, { status: 404 })

  if (cu.role !== 'admin' && test.client_id !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Lazy timeout: if still pending and past 30s window, flip to 'timeout'.
  let status = test.status as string
  let completedAt = test.completed_at as string | null
  if (status === 'pending') {
    const age = Date.now() - new Date(test.started_at).getTime()
    if (age > TEST_TIMEOUT_MS) {
      const nowIso = new Date().toISOString()
      await svc
        .from('forwarding_verify_tests')
        .update({ status: 'timeout', completed_at: nowIso })
        .eq('id', test.id)
        .eq('status', 'pending')
      status = 'timeout'
      completedAt = nowIso
    }
  }

  // Read forwarding_verified_at from clients so the UI can flip its pill in
  // the same poll cycle the confirm endpoint sets it.
  const { data: clientRow } = await svc
    .from('clients')
    .select('forwarding_verified_at, forwarding_self_attested')
    .eq('id', test.client_id)
    .maybeSingle()

  return NextResponse.json({
    test_id: test.id,
    status,
    started_at: test.started_at,
    completed_at: completedAt,
    error_message: test.error_message,
    forwarding_verified_at: clientRow?.forwarding_verified_at ?? null,
    forwarding_self_attested: clientRow?.forwarding_self_attested ?? false,
  })
}
