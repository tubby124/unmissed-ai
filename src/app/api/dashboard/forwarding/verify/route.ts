import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhoneNA } from '@/lib/utils/phone'

export const maxDuration = 15

const TEST_TIMEOUT_MS = 60_000

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

  const callbackPhone = normalizePhoneNA((client.callback_phone as string | null) ?? '')
  if (!callbackPhone) {
    return NextResponse.json({ error: 'callback_phone not set on client' }, { status: 400 })
  }
  if (!client.twilio_number) {
    return NextResponse.json({ error: 'twilio_number not provisioned for client' }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  const svc = createServiceClient()

  // Block back-to-back tests: if a pending test started < 90s ago, return that instead of dialing again.
  const { data: existing } = await svc
    .from('forwarding_verify_tests')
    .select('id, status, started_at')
    .eq('client_id', clientId)
    .eq('status', 'pending')
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
      callback_phone: callbackPhone,
      from_number: fromNumber,
      status: 'pending',
    })
    .select('id, started_at')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json({ error: `Failed to create test: ${insertErr?.message}` }, { status: 500 })
  }

  const twiml =
    '<Response>' +
    '<Say voice="Polly.Joanna">This is an automated forwarding test. Please do not answer. Your assistant will pick up if forwarding is set up correctly. Goodbye.</Say>' +
    '<Pause length="18"/>' +
    '<Hangup/>' +
    '</Response>'

  try {
    const twilioClient = twilio(accountSid, authToken)
    const call = await twilioClient.calls.create({
      to: callbackPhone,
      from: fromNumber,
      twiml,
      timeout: 20,
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
