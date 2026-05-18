/**
 * POST /api/cron/trial-expiry
 *   Daily cron: finds clients whose trial has expired, pauses their agent,
 *   sends a conversion email via Resend, and alerts admin via Telegram.
 *
 * GET  /api/cron/trial-expiry?dry_run=1
 *   Admin debugging: reports what the POST path WOULD do, without mutating
 *   anything. Added 2026-04-09 after Phase F pre-flight found 25 stale
 *   expired-trialing rows that the scheduled cron had not cleaned up —
 *   the GET path lets an operator confirm the query + count before deciding
 *   whether to curl the POST or run scripts/admin-trial-cleanup.mjs.
 *
 * Auth: Bearer CRON_SECRET only (no ADMIN_PASSWORD fallback — S13a).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

interface ExpiredClient {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
}

interface ReminderClient {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
  trial_reminder_sent: Record<string, string> | null
}

interface ChurnedWithNumber {
  id: string
  slug: string
  twilio_number: string
}

export async function POST(req: NextRequest) {
  const adminSupa = createServiceClient()
  // ── Auth: same pattern as daily-digest ────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
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

    const resendKey = process.env.RESEND_API_KEY
    const details: { slug: string; paused: boolean; emailSent: boolean }[] = []

    // ── Fetch admin Telegram credentials (needed by both loops) ──────────────
    const { data: adminClient } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    const adminBot = adminClient?.telegram_bot_token as string | null
    const adminChat = adminClient?.telegram_chat_id as string | null

    if (clients.length === 0) {
      console.log('[trial-expiry] No expired trials found')
    } else {
      console.log(`[trial-expiry] Found ${clients.length} expired trial(s)`)
    }

    // ── Pre-expiry reminder emails ────────────────────────────────────────────
    const upgradeUrl = `${APP_URL}/dashboard?upgrade=1`
    const remindersSent: { slug: string; day: string }[] = []

    if (resendKey) {
      const now = new Date()
      const day3Window = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const day1Window = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      const midpointWindow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)
      const dashboardUrl = `${APP_URL}/dashboard`

      // Midpoint engagement nudge — trial expires in 4–5 days AND zero real calls
      // Goal: catch stuck users before they hit the "3 days left" panic email.
      const { data: midpointClients } = await adminSupa
        .from('clients')
        .select('id, slug, business_name, contact_email, trial_reminder_sent')
        .gt('trial_expires_at', midpointWindow.toISOString())
        .lt('trial_expires_at', new Date(midpointWindow.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .eq('trial_converted', false)
        .eq('status', 'active')

      for (const c of (midpointClients ?? []) as ReminderClient[]) {
        if (!c.contact_email) continue
        if (c.trial_reminder_sent?.midpoint) continue
        // Engagement check — only nudge clients with zero real calls
        const { count: realCallCount } = await adminSupa
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', c.id)
          .neq('call_status', 'test')
        if ((realCallCount ?? 0) > 0) continue // skip — they're engaged
        const result = await sendBrandedEmail({
          to: c.contact_email,
          clientId: c.id,
          clientSlug: c.slug,
          purpose: 'marketing',
          tag: 'trial_midpoint_nudge',
          reason: `You're on a free trial of ${BRAND_NAME}.`,
          subject: `Stuck setting up your ${BRAND_NAME} agent?`,
          html: `<h2 style="margin-bottom:4px">Need a hand getting your agent live?</h2>
<p>Hi${c.business_name ? ` ${c.business_name}` : ''},</p>
<p>You signed up for ${BRAND_NAME} a few days ago but your agent hasn't taken a real call yet. Most owners get there in 10 minutes — if you're stuck, here's the 1-minute fix:</p>
<ol style="line-height:1.7">
  <li><strong>Forward your business line</strong> to your agent's number (instructions in your dashboard)</li>
  <li>Send a test call to make sure it picks up</li>
  <li>Pin Telegram alerts so you see every caller in real time</li>
</ol>
<a href="${dashboardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Open my dashboard</a>
<p style="font-size:14px;color:#555">Reply to this email if you want help — Hasan personally answers.</p>`,
        })
        if (result.ok) {
          await adminSupa
            .from('clients')
            .update({ trial_reminder_sent: { ...(c.trial_reminder_sent ?? {}), midpoint: now.toISOString() } })
            .eq('id', c.id)
          remindersSent.push({ slug: c.slug, day: 'midpoint' })
          console.log(`[trial-expiry] Midpoint nudge sent to ${c.contact_email} (${c.slug}) — zero calls yet`)
        } else {
          console.error(`[trial-expiry] Midpoint nudge failed for ${c.slug}: ${result.error}`)
        }
      }

      // Day-3 window: trial expires in 3–4 days
      const { data: day3Clients } = await adminSupa
        .from('clients')
        .select('id, slug, business_name, contact_email, trial_reminder_sent')
        .gt('trial_expires_at', day3Window.toISOString())
        .lt('trial_expires_at', new Date(day3Window.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .eq('trial_converted', false)
        .eq('status', 'active')

      for (const c of (day3Clients ?? []) as ReminderClient[]) {
        if (!c.contact_email) continue
        if (c.trial_reminder_sent?.day3) continue // already sent
        const result = await sendBrandedEmail({
          to: c.contact_email,
          clientId: c.id,
          clientSlug: c.slug,
          purpose: 'marketing',
          tag: 'trial_day3_reminder',
          reason: `You're on a free trial of ${BRAND_NAME}.`,
          subject: `Your ${BRAND_NAME} agent has 3 days left`,
          html: `<h2 style="margin-bottom:4px">3 days remaining on your trial</h2>
<p>Hi${c.business_name ? ` ${c.business_name}` : ''},</p>
<p>Your ${BRAND_NAME} voice agent trial ends in 3 days. After that, your agent will be paused and you'll stop catching missed calls.</p>
<a href="${upgradeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Keep my agent active</a>
<p style="font-size:14px;color:#555">Your call history and configuration are safe — activating takes 30 seconds.</p>`,
        })
        if (result.ok) {
          await adminSupa
            .from('clients')
            .update({ trial_reminder_sent: { ...(c.trial_reminder_sent ?? {}), day3: now.toISOString() } })
            .eq('id', c.id)
          remindersSent.push({ slug: c.slug, day: 'day3' })
          console.log(`[trial-expiry] Day-3 reminder sent to ${c.contact_email} (${c.slug})`)
        } else {
          console.error(`[trial-expiry] Day-3 reminder failed for ${c.slug}: ${result.error}`)
        }
      }

      // Day-1 window: trial expires in 1–2 days
      const { data: day1Clients } = await adminSupa
        .from('clients')
        .select('id, slug, business_name, contact_email, trial_reminder_sent')
        .gt('trial_expires_at', day1Window.toISOString())
        .lt('trial_expires_at', new Date(day1Window.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .eq('trial_converted', false)
        .eq('status', 'active')

      for (const c of (day1Clients ?? []) as ReminderClient[]) {
        if (!c.contact_email) continue
        if (c.trial_reminder_sent?.day1) continue // already sent
        const result = await sendBrandedEmail({
          to: c.contact_email,
          clientId: c.id,
          clientSlug: c.slug,
          purpose: 'marketing',
          tag: 'trial_day1_reminder',
          reason: `You're on a free trial of ${BRAND_NAME}.`,
          subject: `Tomorrow your ${BRAND_NAME} agent pauses`,
          html: `<h2 style="margin-bottom:4px">Last day of your trial</h2>
<p>Hi${c.business_name ? ` ${c.business_name}` : ''},</p>
<p>Tomorrow your ${BRAND_NAME} voice agent trial ends. Your agent will pause and missed calls won't be caught.</p>
<a href="${upgradeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Activate now — keep answering calls</a>
<p style="font-size:14px;color:#555">Takes 30 seconds. Your agent picks back up immediately.</p>`,
        })
        if (result.ok) {
          await adminSupa
            .from('clients')
            .update({ trial_reminder_sent: { ...(c.trial_reminder_sent ?? {}), day1: now.toISOString() } })
            .eq('id', c.id)
          remindersSent.push({ slug: c.slug, day: 'day1' })
          console.log(`[trial-expiry] Day-1 reminder sent to ${c.contact_email} (${c.slug})`)
        } else {
          console.error(`[trial-expiry] Day-1 reminder failed for ${c.slug}: ${result.error}`)
        }
      }
    }

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
        const result = await sendBrandedEmail({
          to: client.contact_email,
          clientId: client.id,
          clientSlug: client.slug,
          purpose: 'marketing',
          tag: 'trial_expired_conversion',
          reason: `Your free trial of ${BRAND_NAME} just ended.`,
          subject: `Your ${BRAND_NAME} trial has ended — activate to keep your agent`,
          html: `<h2 style="margin-bottom:4px">Your trial has ended</h2>
<p>Hi${client.business_name ? ` ${client.business_name}` : ''},</p>
<p>Your ${BRAND_NAME} voice agent trial has expired and your agent has been paused.</p>
<p>To keep your AI receptionist active and never miss another call, activate your subscription now:</p>
<a href="${upgradeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Activate my agent</a>
<p style="font-size:14px;color:#555">Your agent configuration and call history are preserved. Activating will resume service immediately.</p>`,
        })
        if (result.ok) {
          emailSent = true
          console.log(`[trial-expiry] Conversion email sent to ${client.contact_email} for ${client.slug} (id=${result.id})`)
        } else {
          console.error(`[trial-expiry] Email failed for ${client.slug}: ${result.error}`)
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

    // ── S20a: Release Twilio numbers for clients paused > 7 days ─────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: numbersToRelease, error: releaseQueryErr } = await adminSupa
      .from('clients')
      .select('id, slug, twilio_number')
      .lt('trial_expires_at', sevenDaysAgo)
      .eq('trial_converted', false)
      .eq('status', 'paused')
      .not('twilio_number', 'is', null)

    const numbersReleased: string[] = []

    if (!releaseQueryErr && numbersToRelease && numbersToRelease.length > 0) {
      const churned = numbersToRelease as ChurnedWithNumber[]
      console.log(`[trial-expiry] Found ${churned.length} number(s) to release (7-day grace elapsed)`)

      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken  = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      for (const c of churned) {
        const { data: invRow } = await adminSupa
          .from('number_inventory')
          .select('id, twilio_sid')
          .eq('phone_number', c.twilio_number)
          .maybeSingle()

        if (invRow) {
          // Reconfigure VoiceUrl → idle
          const patchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
          const patchRes = await fetch(patchUrl, {
            method: 'POST',
            headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              VoiceUrl:            `${APP_URL}/api/webhook/inventory-idle`,
              VoiceMethod:         'POST',
              VoiceFallbackUrl:    `${APP_URL}/api/webhook/inventory-idle`,
              VoiceFallbackMethod: 'POST',
            }).toString(),
            signal: AbortSignal.timeout(30_000),
          })
          if (!patchRes.ok) {
            console.error(`[trial-expiry] Twilio PATCH failed for ${c.twilio_number} (${c.slug})`)
            // Continue — still clear DB so cost stops recurring
          } else {
            await adminSupa
              .from('number_inventory')
              .update({ status: 'available', assigned_client_id: null, reserved_intake_id: null, reserved_at: null })
              .eq('id', invRow.id)
            console.log(`[trial-expiry] ${c.twilio_number} (${c.slug}) returned to inventory`)
          }
        } else {
          console.log(`[trial-expiry] ${c.twilio_number} (${c.slug}) not in inventory — clearing DB only`)
        }

        // Always clear the client's number reference
        await adminSupa
          .from('clients')
          .update({ twilio_number: null, updated_at: new Date().toISOString() })
          .eq('id', c.id)

        numbersReleased.push(`${c.slug}: ${c.twilio_number}`)
      }

      if (numbersReleased.length > 0 && adminBot && adminChat) {
        try {
          await sendAlert(
            adminBot,
            adminChat,
            `<b>S20a: Released ${numbersReleased.length} Twilio number(s)</b>\n` +
            numbersReleased.map(n => `• ${n}`).join('\n')
          )
        } catch {
          console.error('[trial-expiry] Telegram alert for number releases failed')
        }
      }
    } else if (releaseQueryErr) {
      console.error('[trial-expiry] S20a query failed:', releaseQueryErr)
    }

    if (details.length === 0 && numbersReleased.length === 0) {
      console.log('[trial-expiry] Nothing to do')
    }

    return NextResponse.json({ expired: details.length, details, numbers_released: numbersReleased, reminders_sent: remindersSent })
  } catch (err) {
    console.error('[trial-expiry] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cron/trial-expiry?dry_run=1
 *
 * Admin debugging view of what the POST path would transition and release,
 * without mutating anything. Added 2026-04-09 after Phase F pre-flight found
 * 25 stale expired-trialing rows the scheduled cron had not cleaned up. Lets
 * an operator confirm the query + count before deciding whether to curl POST
 * or run scripts/admin-trial-cleanup.mjs.
 *
 * Intentionally defined AFTER POST so the S18k cron method parity test
 * (which regexes the FIRST exported function) still resolves POST for this
 * route — railway.json schedules POST at 0 7 * * *.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  if (url.searchParams.get('dry_run') !== '1') {
    return NextResponse.json(
      { error: 'GET only supports ?dry_run=1 — use POST to actually run.' },
      { status: 400 },
    )
  }

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: expiredClients, error: queryErr } = await svc
    .from('clients')
    .select('id, slug, business_name, contact_email, trial_expires_at, twilio_number')
    .lt('trial_expires_at', nowIso)
    .eq('trial_converted', false)
    .eq('status', 'active')

  if (queryErr) {
    return NextResponse.json({ error: 'Query failed', details: queryErr.message }, { status: 500 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: numbersToRelease, error: relErr } = await svc
    .from('clients')
    .select('id, slug, twilio_number')
    .lt('trial_expires_at', sevenDaysAgo)
    .eq('trial_converted', false)
    .eq('status', 'paused')
    .not('twilio_number', 'is', null)

  if (relErr) {
    return NextResponse.json({ error: 'Release query failed', details: relErr.message }, { status: 500 })
  }

  return NextResponse.json({
    dry_run: true,
    now: nowIso,
    expired_trials_to_pause: (expiredClients ?? []).length,
    expired_trials: (expiredClients ?? []).map(c => ({
      slug: c.slug,
      business_name: c.business_name,
      trial_expires_at: c.trial_expires_at,
      has_twilio_number: Boolean(c.twilio_number),
      has_contact_email: Boolean(c.contact_email),
    })),
    twilio_numbers_to_release: (numbersToRelease ?? []).length,
    numbers: (numbersToRelease ?? []).map(n => ({ slug: n.slug, twilio_number: n.twilio_number })),
  })
}
