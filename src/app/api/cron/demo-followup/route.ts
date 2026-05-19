/**
 * POST /api/cron/demo-followup
 *
 * Hourly cron. Sends a one-time follow-up email to demo callers who provided
 * an email and haven't been followed up yet. Window: demo ended 1-24h ago.
 *
 * Anti-spam guard: skip if caller_email matches any existing clients.contact_email
 * (don't re-prospect paying customers who just clicked the homepage demo).
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

interface DemoCallRow {
  id: string
  caller_email: string | null
  caller_name: string | null
  demo_id: string | null
  ended_at: string | null
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 })
  }

  const svc = createServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await svc
    .from('demo_calls')
    .select('id, caller_email, caller_name, demo_id, ended_at')
    .not('caller_email', 'is', null)
    .is('followup_sent_at', null)
    .gte('ended_at', dayAgo)
    .lt('ended_at', oneHourAgo)
    .order('ended_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[demo-followup] Query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = (candidates ?? []) as DemoCallRow[]
  if (rows.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // Pull existing client emails so we don't re-prospect paying customers
  const candidateEmails = Array.from(new Set(rows.map((r) => r.caller_email!.toLowerCase())))
  const { data: existingClients } = await svc
    .from('clients')
    .select('contact_email')
    .in('contact_email', candidateEmails)
  const clientEmails = new Set((existingClients ?? []).map((c) => (c.contact_email as string | null)?.toLowerCase()).filter(Boolean))

  const onboardUrl = `${APP_URL}/onboard`
  const sent: { id: string; email: string }[] = []
  const skipped: { id: string; reason: string }[] = []

  for (const c of rows) {
    const email = c.caller_email!.toLowerCase()
    if (clientEmails.has(email)) {
      skipped.push({ id: c.id, reason: 'already a client' })
      // Stamp anyway to avoid re-checking next hour
      await svc.from('demo_calls').update({ followup_sent_at: new Date().toISOString() }).eq('id', c.id)
      continue
    }

    const greeting = c.caller_name ? `Hi ${c.caller_name},` : 'Hi there,'

    const result = await sendBrandedEmail({
      to: email,
      purpose: 'marketing',
      tag: 'demo_followup',
      recipientEmail: email,
      reason: `You tried the ${BRAND_NAME} demo on our homepage.`,
      subject: `That demo you just tried — get the real thing in 10 min`,
      html: `<h2 style="margin-bottom:4px">Liked talking to ${BRAND_NAME}?</h2>
<p>${greeting}</p>
<p>Thanks for trying the demo. The agent you just spoke with is the same one we'd set up for your business — it answers forwarded missed calls, captures lead details, and sends you the summary after the call.</p>
<p><strong>Setup takes about 10 minutes.</strong> You forward your line, we train it on your services, and it's live for your next missed call.</p>
<a href="${onboardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Get my agent live</a>
<p style="font-size:14px;color:#555"><strong>50 activation minutes included.</strong> Card required to activate your AI number. Cancel anytime if it doesn't earn its keep.</p>
<p style="font-size:14px;color:#555">Reply to this email with questions — Hasan answers personally.</p>`,
    })

    if (result.ok) {
      await svc.from('demo_calls').update({ followup_sent_at: new Date().toISOString() }).eq('id', c.id)
      sent.push({ id: c.id, email })
      console.log(`[demo-followup] Sent to ${email} (demo_call=${c.id})`)
    } else {
      skipped.push({ id: c.id, reason: result.error ?? 'send failed' })
      console.error(`[demo-followup] Send failed for ${email}: ${result.error}`)
    }
  }

  return NextResponse.json({ sent: sent.length, skipped: skipped.length, sent_details: sent, skipped_details: skipped })
}
