import { NextRequest, NextResponse } from 'next/server'
import { APP_URL } from '@/lib/app-url'
import { validateSignature } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

/**
 * Go Live Tab Section 4 — receives the press-1 digit from the carrier-chain
 * verification call. If Digits === '1' we mark the client's forwarding as
 * verified (real test, not self-attest) and flip the most recent matching
 * pending test row to 'forwarded'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ client_id: string }> }
) {
  const { client_id } = await params

  const formData = await req.formData()
  const params_: Record<string, string> = {}
  for (const [k, v] of formData.entries()) params_[k] = String(v)

  const signature = req.headers.get('X-Twilio-Signature') || ''
  const fullUrl = `${APP_URL}/api/webhook/forwarding-verify-confirm/${client_id}`
  if (!validateSignature(signature, fullUrl, params_)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const digit = (params_['Digits'] || '').trim()

  if (digit !== '1') {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
    )
  }

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()

  // Mark the client as forwarding-verified by real call (self_attested=false).
  await svc
    .from('clients')
    .update({
      forwarding_verified_at: nowIso,
      forwarding_self_attested: false,
    })
    .eq('id', client_id)

  // Flip the most recent pending carrier-chain test for this client to
  // 'forwarded'. Carrier-chain rows have from_number === client.twilio_number.
  const { data: clientRow } = await svc
    .from('clients')
    .select('twilio_number')
    .eq('id', client_id)
    .maybeSingle()

  if (clientRow?.twilio_number) {
    const { data: latestPending } = await svc
      .from('forwarding_verify_tests')
      .select('id')
      .eq('client_id', client_id)
      .eq('status', 'pending')
      .eq('from_number', clientRow.twilio_number)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestPending) {
      await svc
        .from('forwarding_verify_tests')
        .update({ status: 'forwarded', completed_at: nowIso })
        .eq('id', latestPending.id)
    }
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Confirmed.</Say><Hangup/></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
  )
}
