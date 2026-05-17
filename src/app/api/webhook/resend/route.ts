/**
 * POST /api/webhook/resend
 *
 * Resend webhook receiver. Archives every email event (sent/delivered/opened/
 * clicked/bounced/complained/delivery_delayed) into `resend_email_events` and
 * auto-unsubscribes recipients on hard bounce + complaint.
 *
 * Signature verification: Resend uses Svix-style signing. Headers:
 *   svix-id        — unique event id (idempotency key)
 *   svix-timestamp — unix seconds, age-checked for replay
 *   svix-signature — `v1,<base64-hmac-sha256(secret, "<id>.<ts>.<body>")>`
 *
 * RESEND_WEBHOOK_SECRET must be set on Railway. Configure the webhook endpoint
 * in the Resend dashboard at https://resend.com/webhooks pointing to
 * https://endvoicemail.ai/api/webhook/resend.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'

const REPLAY_WINDOW_SECONDS = 300 // 5 minutes

function verifySignature(opts: {
  secret: string
  id: string
  timestamp: string
  body: string
  signatureHeader: string
}): boolean {
  // Resend / Svix base64-encode the raw secret after the "whsec_" prefix.
  // The HMAC is computed against the decoded bytes.
  const rawSecret = opts.secret.startsWith('whsec_')
    ? Buffer.from(opts.secret.slice('whsec_'.length), 'base64')
    : Buffer.from(opts.secret)

  const signedPayload = `${opts.id}.${opts.timestamp}.${opts.body}`
  const expected = crypto
    .createHmac('sha256', rawSecret)
    .update(signedPayload)
    .digest('base64')

  // Header format: "v1,base64sig v1,base64sig2 ..." (space-separated)
  const tokens = opts.signatureHeader.split(/\s+/)
  for (const token of tokens) {
    const parts = token.split(',')
    if (parts.length !== 2 || parts[0] !== 'v1') continue
    const got = parts[1]
    if (got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
      return true
    }
  }
  return false
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured')
    return new NextResponse('Webhook not configured', { status: 500 })
  }

  const svixId = req.headers.get('svix-id') ?? ''
  const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
  const svixSignature = req.headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing Svix headers', { status: 400 })
  }

  // Replay guard
  const tsNum = Number(svixTimestamp)
  if (!Number.isFinite(tsNum)) {
    return new NextResponse('Invalid timestamp', { status: 400 })
  }
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - tsNum)
  if (ageSec > REPLAY_WINDOW_SECONDS) {
    return new NextResponse('Timestamp too old', { status: 400 })
  }

  const rawBody = await req.text()
  if (!verifySignature({ secret, id: svixId, timestamp: svixTimestamp, body: rawBody, signatureHeader: svixSignature })) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let event: {
    type?: string
    created_at?: string
    data?: {
      email_id?: string
      to?: string[] | string
      from?: string
      subject?: string
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const supabase = createServiceClient()

  const toEmail = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to
  const occurredAt = event.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString()

  // Idempotent insert keyed on svix-id
  const { error: insertErr } = await supabase
    .from('resend_email_events')
    .insert({
      event_id: svixId,
      event_type: event.type ?? 'unknown',
      resend_email_id: event.data?.email_id ?? null,
      to_email: toEmail ?? null,
      from_email: event.data?.from ?? null,
      subject: event.data?.subject ?? null,
      occurred_at: occurredAt,
      data: event,
    })

  if (insertErr && !insertErr.message.includes('duplicate key')) {
    console.error('[resend-webhook] Insert failed:', insertErr.message)
  }

  // Auto-unsubscribe on hard bounce or complaint
  if (toEmail && (event.type === 'email.bounced' || event.type === 'email.complained')) {
    const { error: updateErr } = await supabase
      .from('clients')
      .update({ email_notifications_enabled: false })
      .eq('contact_email', toEmail.toLowerCase())
    if (updateErr) {
      console.error(`[resend-webhook] Auto-unsubscribe failed for ${toEmail}: ${updateErr.message}`)
    }
  }

  return new NextResponse('OK', { status: 200 })
}
