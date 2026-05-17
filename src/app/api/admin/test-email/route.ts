/**
 * POST /api/admin/test-email
 *
 * Admin-only endpoint that sends the same welcome email the Stripe webhook sends,
 * so admin can verify Resend delivery without paying real money.
 *
 * Body: { clientSlug: string, email?: string }
 * Returns: { ok: true, sentTo: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientSlug?: string; email?: string }
  if (!body.clientSlug) {
    return NextResponse.json({ error: 'clientSlug required' }, { status: 400 })
  }

  // ── Load client ──────────────────────────────────────────────────────────
  const { data: client } = await svc
    .from('clients')
    .select('id, business_name, twilio_number, contact_email, slug')
    .eq('slug', body.clientSlug)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const sendTo = body.email || client.contact_email || user.email
  if (!sendTo) {
    return NextResponse.json({ error: 'No email to send to — pass email in body' }, { status: 400 })
  }

  // ── Send via Resend ────────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const businessName = client.business_name || body.clientSlug
  const twilioNumber = client.twilio_number

  const result = await sendBrandedEmail({
    to: sendTo,
    clientId: client.id,
    clientSlug: client.slug,
    purpose: 'system',
    tag: 'admin_test_email',
    subject: `[TEST] ${businessName} — your AI agent is live${twilioNumber ? ` (${twilioNumber})` : ''}`,
    html: `<p style="background:#fef3c7;padding:8px 12px;border-radius:6px;font-size:12px;color:#92400e;margin-bottom:16px">This is a <strong>test email</strong> sent from the admin panel. Not a real activation.</p>
<h2 style="margin-bottom:4px">Welcome to ${BRAND_NAME}</h2>
<p style="color:#555;margin-top:0">Your AI receptionist is now live.</p>
${twilioNumber ? `<p><strong>Your AI phone number:</strong> ${twilioNumber}</p>` : '<p><em>No Twilio number assigned (skipTwilio was on)</em></p>'}
<p><strong>Set up your dashboard password</strong></p>
<p><a href="${APP_URL}/login" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600">Go to Dashboard</a></p>`,
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'Email send failed', detail: result.error }, { status: 500 })
  }

  console.log(`[test-email] Welcome email sent to ${sendTo} for ${body.clientSlug} (id=${result.id})`)
  return NextResponse.json({ ok: true, sentTo: sendTo, id: result.id })
}
