/**
 * POST /api/cron/spam-digest
 *
 * Scheduled 14:30 UTC daily (~8:30 AM in Alberta) via .github/workflows/crons.yml.
 *
 * Daily spam-screen digest: when a client has notification_filter_spam=true,
 * their JUNK call alerts are suppressed in real time (D457 gate in the
 * completed webhook). This cron gives owners visibility — once a day, if a
 * client had >=1 JUNK call in the last 24h, send them a short "your agent
 * screened out N spam calls" note via Telegram and/or owner SMS.
 *
 * Idempotency: intentionally none — the cron fires once daily; a manual
 * re-run just re-sends the same harmless summary.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { resolveSmsOwnerDestination } from '@/lib/completed-notifications'
import twilio from 'twilio'

interface ClientRow {
  id: string
  slug: string
  business_name: string | null
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  telegram_chat_id_2: string | null
  telegram_notifications_enabled: boolean | null
  sms_alerts_enabled: boolean | null
  alert_phone: string | null
  callback_phone: string | null
  twilio_number: string | null
}

function buildSpamDigestMessage(junkCount: number): string {
  const noun = junkCount === 1 ? 'spam/robocall' : 'spam/robocalls'
  return `🛡️ Your agent screened out ${junkCount} ${noun} yesterday — no action needed, you weren't alerted. All real callers still come through instantly.`
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()

  // Eligible: active clients with the spam filter turned on
  const { data: clients, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_notifications_enabled, sms_alerts_enabled, alert_phone, callback_phone, twilio_number')
    .eq('status', 'active')
    .eq('notification_filter_spam', true)

  if (clientErr) {
    console.error('[spam-digest] Client query failed:', clientErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const eligibleClients = (clients ?? []) as ClientRow[]
  if (eligibleClients.length === 0) {
    console.log('[spam-digest] No eligible clients')
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // JUNK calls in the last 24 hours across all eligible clients
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: junkCalls, error: callErr } = await svc
    .from('call_logs')
    .select('client_id')
    .in('client_id', eligibleClients.map((c) => c.id))
    .eq('call_status', 'JUNK')
    .gte('started_at', dayAgo)

  if (callErr) {
    console.error('[spam-digest] Call query failed:', callErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const junkCountByClient = new Map<string, number>()
  for (const c of (junkCalls ?? []) as { client_id: string }[]) {
    junkCountByClient.set(c.client_id, (junkCountByClient.get(c.client_id) ?? 0) + 1)
  }

  let sent = 0
  let skipped = 0
  const details: { slug: string; junk: number; telegram: boolean; sms: boolean }[] = []

  for (const client of eligibleClients) {
    const junkCount = junkCountByClient.get(client.id) ?? 0
    if (junkCount === 0) {
      skipped++
      continue
    }

    const message = buildSpamDigestMessage(junkCount)
    let telegramSent = false
    let smsSent = false

    // ── Telegram — same gates as the completed webhook ────────────────────
    if (
      client.telegram_bot_token &&
      client.telegram_chat_id &&
      client.telegram_notifications_enabled !== false
    ) {
      try {
        telegramSent = await sendAlert(
          client.telegram_bot_token,
          client.telegram_chat_id,
          message,
          client.telegram_chat_id_2 ?? undefined
        )
      } catch (err) {
        console.error(`[spam-digest] Telegram failed for ${client.slug}:`, err)
      }
    }

    // ── Owner SMS — same gates as sendOwnerSmsAlert ───────────────────────
    const smsTo = resolveSmsOwnerDestination(client)
    if (client.sms_alerts_enabled === true && smsTo && client.twilio_number) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      if (accountSid && authToken) {
        try {
          const twilioClient = twilio(accountSid, authToken)
          const twilioMsg = await twilioClient.messages.create({
            body: message,
            from: client.twilio_number,
            to: smsTo,
          })
          smsSent = true
          console.log(`[spam-digest] SMS sent slug=${client.slug} to=****${smsTo.slice(-4)} sid=${twilioMsg.sid}`)
        } catch (err) {
          console.error(`[spam-digest] SMS failed for ${client.slug}:`, err)
        }
      } else {
        console.error(`[spam-digest] SMS skipped for ${client.slug}: missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN env`)
      }
    }

    if (telegramSent || smsSent) {
      sent++
      console.log(`[spam-digest] Sent to ${client.slug}: ${junkCount} JUNK call(s), telegram=${telegramSent} sms=${smsSent}`)
    } else {
      skipped++
      console.log(`[spam-digest] No channel available for ${client.slug} (${junkCount} JUNK call(s)) — skipped`)
    }
    details.push({ slug: client.slug, junk: junkCount, telegram: telegramSent, sms: smsSent })
  }

  console.log(`[spam-digest] Done: ${sent} sent, ${skipped} skipped`)
  return NextResponse.json({ sent, skipped, details })
}
