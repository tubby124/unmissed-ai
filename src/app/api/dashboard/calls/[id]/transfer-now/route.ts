import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { redirectCall } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

/**
 * Manual mid-call transfer — owner/admin clicks "Take this call" on LiveCallBanner.
 * Pulls the active caller off the AI agent and dials the client's forwarding_number.
 *
 * Mirrors the agent-initiated path at /api/webhook/[slug]/transfer/route.ts but is
 * triggered by a dashboard user instead of by the agent's transferCall tool.
 *
 * Auth: any authenticated client_user with a row matching the call's client_id.
 * Idempotency: CAS update on transfer_status (NULL -> 'transferring') prevents
 * race conditions if multiple users click simultaneously.
 * Failure recovery: reuses /api/webhook/[slug]/transfer-status — if the owner's
 * phone doesn't pick up, Twilio reconnects the caller back to the AI agent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ultravoxCallId } = await params

  const userClient = await createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: log } = await supabase
    .from('call_logs')
    .select('id, client_id, twilio_call_sid, caller_phone, transfer_status, call_status')
    .eq('ultravox_call_id', ultravoxCallId)
    .limit(1)
    .maybeSingle()

  if (!log) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('client_id', log.client_id)
    .limit(1)
    .maybeSingle()

  const { data: roleRow } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (!membership && !roleRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!log.twilio_call_sid) {
    return NextResponse.json(
      { error: 'This call cannot be transferred (browser test calls have no phone line).' },
      { status: 412 }
    )
  }

  if (log.transfer_status) {
    return NextResponse.json(
      { error: 'This call is already being transferred or has ended.' },
      { status: 409 }
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, forwarding_number, twilio_number, business_name')
    .eq('id', log.client_id)
    .limit(1)
    .maybeSingle()

  if (!client?.forwarding_number) {
    return NextResponse.json(
      { error: 'No forwarding number is set for this account. Set one in the Transfer settings first.' },
      { status: 412 }
    )
  }

  const { data: claimed, error: claimErr } = await supabase
    .from('call_logs')
    .update({
      transfer_status: 'transferring',
      transfer_started_at: new Date().toISOString(),
    })
    .eq('id', log.id)
    .is('transfer_status', null)
    .select('id')
    .limit(1)
    .maybeSingle()

  if (claimErr || !claimed) {
    console.warn(`[manual-transfer] CAS lock failed for callId=${ultravoxCallId} — already in flight`)
    return NextResponse.json(
      { error: 'This call is already being transferred.' },
      { status: 409 }
    )
  }

  const callerPhone = (log.caller_phone as string | null) ?? 'unknown'
  const clientNumber = (client.twilio_number as string | null) ?? undefined
  const actionUrl = `${APP_URL}/api/webhook/${client.slug}/transfer-status`

  try {
    await redirectCall(log.twilio_call_sid, client.forwarding_number, {
      callerPhone: callerPhone !== 'unknown' ? callerPhone : undefined,
      clientNumber,
      actionUrl,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[manual-transfer] Twilio redirect failed for callId=${ultravoxCallId}: ${msg}`)
    await supabase
      .from('call_logs')
      .update({ transfer_status: null, transfer_started_at: null })
      .eq('id', log.id)
    return NextResponse.json(
      { error: 'Could not start the transfer. Please try again.' },
      { status: 502 }
    )
  }

  await supabase
    .from('call_logs')
    .update({
      call_status: 'transferred',
      ai_summary: `Call manually transferred to owner by ${user.email ?? 'dashboard user'}`,
    })
    .eq('id', log.id)

  const { error: nlErr } = await supabase
    .from('notification_logs')
    .insert({
      call_id: log.id,
      client_id: client.id,
      channel: 'dashboard',
      recipient: client.forwarding_number,
      content: `Manual transfer triggered by ${user.email ?? user.id}. Caller ${callerPhone} -> ${client.forwarding_number}.`,
      status: 'sent',
      error: null,
    })
  if (nlErr) console.warn(`[manual-transfer] notification_logs insert failed: ${nlErr.message}`)

  console.log(`[manual-transfer] Redirected callSid=${log.twilio_call_sid} to ${client.forwarding_number} for slug=${client.slug} by user=${user.email ?? user.id}`)

  return NextResponse.json({ ok: true })
}
