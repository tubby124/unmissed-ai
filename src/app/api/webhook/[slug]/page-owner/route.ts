import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSmsTracked } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

export const maxDuration = 10

/**
 * pageOwner tool webhook
 *
 * Fires when the VIP call flow cannot reach the owner live.
 * Sends an urgent alert SMS to the owner's forwarding_number.
 * Unlike the caller SMS tool, there is no opt-out check — the owner
 * is an internal party, not a subscriber.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Auth — X-Tool-Secret static shared secret (same pattern as /sms and /transfer)
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let vipName: string, message: string | undefined, call_id: string | undefined
  try {
    const body = await req.json()
    vipName = body.vipName
    message = body.message
    call_id = body.call_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!vipName) {
    return NextResponse.json({ error: 'vipName is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, twilio_number, forwarding_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.forwarding_number) {
    console.warn(`[page-owner] No forwarding_number for slug=${slug}`)
    return NextResponse.json({ error: 'Owner phone not configured' }, { status: 404 })
  }

  if (!client?.twilio_number) {
    console.warn(`[page-owner] No twilio_number for slug=${slug}`)
    return NextResponse.json({ error: 'Twilio number not configured' }, { status: 404 })
  }

  const ownerPhone = client.forwarding_number
  const fromPhone = client.twilio_number

  const smsBody = message
    ? `📲 ${vipName} tried to reach you just now — give them a call back. Note: ${message}`
    : `📲 ${vipName} tried to reach you just now — give them a call back.`

  // Resolve call_logs row id for linking
  let relatedCallId: string | null = null
  if (call_id) {
    const { data: callRow } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', call_id)
      .maybeSingle()
    relatedCallId = callRow?.id ?? null
  }

  const statusCallbackUrl = `${APP_URL}/api/webhook/${slug}/sms-status`

  // Insert sms_logs row before sending (tracks the send attempt)
  const { data: claimRow, error: claimError } = await supabase.from('sms_logs').insert({
    client_id: client.id,
    related_call_id: relatedCallId,
    direction: 'owner_page',
    from_number: fromPhone,
    to_number: ownerPhone,
    body: smsBody,
    status: 'pending',
    attempted_at: new Date().toISOString(),
  }).select('id').single()

  if (claimError) {
    console.error(`[page-owner] sms_logs insert failed: ${claimError.message}`)
    // Non-fatal — proceed with send even if logging fails
  }

  try {
    const twilioMessage = await sendSmsTracked(ownerPhone, fromPhone, smsBody, statusCallbackUrl)
    console.log(`[page-owner] Owner paged: slug=${slug} vipName=${vipName} to=${ownerPhone} sid=${twilioMessage.sid}`)

    if (claimRow?.id) {
      await supabase.from('sms_logs')
        .update({
          message_sid: twilioMessage.sid,
          provider_message_sid: twilioMessage.sid,
          status: 'sent',
        })
        .eq('id', claimRow.id)
    }

    return NextResponse.json({ result: 'owner paged' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[page-owner] Send failed: slug=${slug} vipName=${vipName} error=${msg}`)

    if (claimRow?.id) {
      await supabase.from('sms_logs')
        .update({ status: 'failed', error_message: msg })
        .eq('id', claimRow.id)
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
