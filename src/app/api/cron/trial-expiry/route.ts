/**
 * GET /api/cron/trial-expiry
 *
 * Daily cron: finds clients whose trial has expired, pauses their agent,
 * sends a conversion email via Resend, and alerts admin via Telegram.
 *
 * Auth: Bearer CRON_SECRET (or ADMIN_PASSWORD for manual trigger).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAlert } from '@/lib/telegram'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface ExpiredClient {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
}

export async function GET(req: NextRequest) {
  // ── Auth: same pattern as daily-digest ────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const adminPassword = process.env.ADMIN_PASSWORD
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if ((!cronSecret || token !== cronSecret) && (!adminPassword || token !== adminPassword)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    // ── Query expired trials ──────────────────────────────────────────────────
    const { data: expiredClients, error: queryErr } = await adminSupa
      .from('clients')
      .select('id, slug, business_name, contact_email')
      .lt('trial_expires_at', new Date().toISOString())
      .eq('trial_converted', false)
      .eq('status', 'active')

    if (queryErr) {
      console.error('[trial-expiry] Query failed:', queryErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const clients = (expiredClients ?? []) as ExpiredClient[]

    if (clients.length === 0) {
      console.log('[trial-expiry] No expired trials found')
      return NextResponse.json({ expired: 0, details: [] })
    }

    console.log(`[trial-expiry] Found ${clients.length} expired trial(s)`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
    const resendKey = process.env.RESEND_API_KEY
    const details: { slug: string; paused: boolean; emailSent: boolean }[] = []

    // ── Fetch admin Telegram credentials ────────────────────────────────────
    const { data: adminClient } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    const adminBot = adminClient?.telegram_bot_token as string | null
    const adminChat = adminClient?.telegram_chat_id as string | null

    for (const client of clients) {
      let paused = false
      let emailSent = false

      // 1. Pause the client
      const { error: updateErr } = await adminSupa
        .from('clients')
        .update({
          status: 'paused',
          subscription_status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id)

      if (updateErr) {
        console.error(`[trial-expiry] Failed to pause ${client.slug}:`, updateErr)
      } else {
        paused = true
        console.log(`[trial-expiry] Paused ${client.slug}`)
      }

      // 2. Send conversion email via Resend
      if (resendKey && client.contact_email) {
        try {
          const { Resend } = await import('resend')
          const resend = new Resend(resendKey)
          const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
          const convertUrl = `${appUrl}/api/stripe/trial-convert?clientId=${client.id}`

          await resend.emails.send({
            from: fromAddress,
            to: client.contact_email,
            subject: 'Your unmissed.ai trial has ended — activate to keep your agent',
            html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:4px">Your trial has ended</h2>
  <p>Hi${client.business_name ? ` ${client.business_name}` : ''},</p>
  <p>Your unmissed.ai voice agent trial has expired and your agent has been paused.</p>
  <p>To keep your AI receptionist active and never miss another call, activate your subscription now:</p>
  <a href="${convertUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
    Activate my agent
  </a>
  <p style="font-size:14px;color:#555">Your agent configuration and call history are preserved. Activating will resume service immediately.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#888">unmissed.ai — AI receptionist for service businesses</p>
</div>`,
          })
          emailSent = true
          console.log(`[trial-expiry] Conversion email sent to ${client.contact_email} for ${client.slug}`)
        } catch (emailErr) {
          console.error(`[trial-expiry] Email failed for ${client.slug}:`, emailErr)
        }
      } else if (!client.contact_email) {
        console.warn(`[trial-expiry] No contact email for ${client.slug} — skipping email`)
      }

      // 3. Telegram alert to admin
      if (adminBot && adminChat) {
        try {
          await sendAlert(
            adminBot,
            adminChat,
            `<b>Trial expired:</b> ${client.business_name} (${client.slug})\n` +
            `Status: ${paused ? 'paused' : 'pause failed'}\n` +
            `Email: ${emailSent ? 'sent' : 'not sent'}${client.contact_email ? '' : ' (no email on file)'}`
          )
        } catch {
          console.error(`[trial-expiry] Telegram alert failed for ${client.slug}`)
        }
      }

      details.push({ slug: client.slug, paused, emailSent })
    }

    console.log(`[trial-expiry] Processed ${details.length} expired trial(s)`)

    return NextResponse.json({ expired: details.length, details })
  } catch (err) {
    console.error('[trial-expiry] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
