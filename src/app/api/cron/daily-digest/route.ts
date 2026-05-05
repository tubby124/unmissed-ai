/**
 * POST /api/cron/daily-digest
 *
 * Scheduled at 8 AM CST (14:00 UTC) via railway.json.
 * Builds and sends a daily Telegram digest to the admin.
 *
 * Reports:
 *   - New intakes today
 *   - Provisioned but not yet activated clients
 *   - Trial health: expiring next 7 days, past expiry without conversion
 *   - Call counts last 24h per active client (HOT/WARM/MISSED/JUNK + min usage)
 *   - Credit/balance health: Twilio + OpenRouter
 *
 * Auth: Bearer CRON_SECRET only (no ADMIN_PASSWORD fallback — S13a).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { BRAND_NAME } from '@/lib/brand'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

interface HealthWarning {
  service: string
  message: string
}

async function checkTwilioBalance(): Promise<{ balance: number | null; warning: HealthWarning | null }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return { balance: null, warning: null }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (!res.ok) return { balance: null, warning: null }
    const data = await res.json() as { balance: string }
    const balance = parseFloat(data.balance)
    const warning = balance < 10
      ? { service: 'Twilio', message: `Balance $${balance.toFixed(2)} — LOW (< $10)` }
      : null
    return { balance, warning }
  } catch {
    return { balance: null, warning: null }
  }
}

async function checkOpenRouterBalance(): Promise<{ usagePct: number | null; warning: HealthWarning | null }> {
  if (!OPENROUTER_KEY) return { usagePct: null, warning: null }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    })
    if (!res.ok) return { usagePct: null, warning: null }
    const data = await res.json() as { data?: { usage: number; limit: number | null } }
    const { usage, limit } = data.data ?? {}
    if (!limit || usage === undefined) return { usagePct: null, warning: null }
    const pct = (usage / limit) * 100
    const warning = pct > 80
      ? { service: 'OpenRouter', message: `Usage ${pct.toFixed(0)}% of limit ($${limit}) — HIGH` }
      : null
    return { usagePct: pct, warning }
  } catch {
    return { usagePct: null, warning: null }
  }
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterday = new Date(now)
  yesterday.setHours(now.getHours() - 24, now.getMinutes(), now.getSeconds(), 0)

  // ── Run all queries in parallel ─────────────────────────────────────────────
  const [
    newIntakesRes,
    pendingActivationRes,
    recentCallsRes,
    activeClientsRes,
    adminClientRes,
    twilioHealth,
    openRouterHealth,
  ] = await Promise.all([
    // New intakes today
    svc.from('intake_submissions')
      .select('business_name, niche, contact_email, submitted_at')
      .gte('submitted_at', todayStart.toISOString())
      .order('submitted_at', { ascending: false }),

    // Provisioned but not activated
    svc.from('intake_submissions')
      .select('business_name, contact_email, status, progress_status')
      .eq('status', 'provisioned')
      .neq('progress_status', 'activated'),

    // Calls last 24h
    svc.from('call_logs')
      .select('client_id, call_status, clients(business_name, slug)')
      .gte('started_at', yesterday.toISOString()),

    // Active clients for reference (with trial + usage fields for digest sections)
    svc.from('clients')
      .select('id, business_name, slug, subscription_status, trial_converted, trial_expires_at, monthly_minute_limit, seconds_used_this_month, stripe_customer_id')
      .eq('status', 'active'),

    // Admin Telegram credentials
    svc.from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single(),

    checkTwilioBalance(),
    checkOpenRouterBalance(),
  ])

  const newIntakes = newIntakesRes.data ?? []
  const pendingActivation = pendingActivationRes.data ?? []
  const recentCalls = recentCallsRes.data ?? []
  const activeClients = activeClientsRes.data ?? []
  const adminClient = adminClientRes.data

  if (!adminClient?.telegram_bot_token || !adminClient?.telegram_chat_id) {
    console.error('[daily-digest] No admin Telegram credentials found')
    return NextResponse.json({ ok: false, error: 'No admin Telegram credentials' })
  }

  // ── Aggregate calls per active client ───────────────────────────────────────
  const callsByClient = new Map<string, { total: number; hot: number; warm: number; missed: number; junk: number }>()
  for (const client of activeClients) {
    callsByClient.set(client.id, { total: 0, hot: 0, warm: 0, missed: 0, junk: 0 })
  }
  for (const call of recentCalls) {
    const clientId = call.client_id as string
    if (!callsByClient.has(clientId)) continue
    const entry = callsByClient.get(clientId)!
    entry.total++
    const status = (call.call_status as string | null) ?? ''
    if (status === 'HOT') entry.hot++
    else if (status === 'WARM') entry.warm++
    else if (status === 'MISSED') entry.missed++
    else if (status === 'JUNK') entry.junk++
  }

  // ── Trial health buckets ────────────────────────────────────────────────────
  const nowMs = now.getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  type TrialRow = { business_name: string; slug: string; trial_expires_at: string; days: number; hasCard: boolean }
  const trialsExpiringSoon: TrialRow[] = []
  const trialsPastExpiry: TrialRow[] = []
  for (const c of activeClients) {
    if (c.subscription_status !== 'trialing' || c.trial_converted) continue
    if (!c.trial_expires_at) continue
    const expMs = new Date(c.trial_expires_at as string).getTime()
    const diffDays = Math.round((expMs - nowMs) / (24 * 60 * 60 * 1000))
    const row: TrialRow = {
      business_name: c.business_name as string,
      slug: c.slug as string,
      trial_expires_at: c.trial_expires_at as string,
      days: diffDays,
      hasCard: !!c.stripe_customer_id,
    }
    if (expMs < nowMs) {
      // Only surface past-expiry within the last 7 days — anything older is
      // stale/test-niche noise that's already been seen and chosen to be ignored.
      if (nowMs - expMs <= sevenDaysMs) trialsPastExpiry.push(row)
    } else if (expMs - nowMs <= sevenDaysMs) {
      trialsExpiringSoon.push(row)
    }
  }
  trialsPastExpiry.sort((a, b) => b.days - a.days) // freshest expiry first (closest to 0)
  trialsExpiringSoon.sort((a, b) => a.days - b.days) // soonest first

  // ── Build message ───────────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  const lines: string[] = [`<b>${BRAND_NAME} — Daily Digest</b>\n${dateStr}`]

  // New intakes section
  if (newIntakes.length > 0) {
    lines.push(`\n<b>New Intakes Today (${newIntakes.length})</b>`)
    for (const intake of newIntakes) {
      lines.push(`• ${intake.business_name} — ${intake.niche?.replace(/_/g, ' ') || 'unknown niche'}`)
    }
  } else {
    lines.push('\n<b>New Intakes Today</b>\nNone')
  }

  // Pending activation section
  if (pendingActivation.length > 0) {
    lines.push(`\n<b>Awaiting Activation (${pendingActivation.length})</b>`)
    for (const p of pendingActivation) {
      lines.push(`• ${p.business_name}${p.contact_email ? ` — ${p.contact_email}` : ''}`)
    }
  }

  // Trial health section
  if (trialsPastExpiry.length > 0 || trialsExpiringSoon.length > 0) {
    lines.push('\n<b>Trial Health</b>')
    if (trialsPastExpiry.length > 0) {
      lines.push(`⚠️ Past expiry, no conversion (${trialsPastExpiry.length})`)
      for (const t of trialsPastExpiry) {
        const card = t.hasCard ? '' : ' · no card'
        lines.push(`  • ${t.business_name} — expired ${Math.abs(t.days)}d ago${card}`)
      }
    }
    if (trialsExpiringSoon.length > 0) {
      lines.push(`🔜 Expiring next 7d (${trialsExpiringSoon.length})`)
      for (const t of trialsExpiringSoon) {
        const when = t.days === 0 ? 'today' : t.days === 1 ? 'tomorrow' : `in ${t.days}d`
        const card = t.hasCard ? '' : ' · no card'
        lines.push(`  • ${t.business_name} — expires ${when}${card}`)
      }
    }
  }

  // Calls section — only show clients with activity (calls in 24h OR minutes used this month)
  // Idle/test clients collapse to a count line so the message stays scannable.
  lines.push('\n<b>Calls Last 24h</b>')
  if (activeClients.length === 0) {
    lines.push('No active clients')
  } else {
    const activeRows = activeClients
      .map(client => {
        const stats = callsByClient.get(client.id) ?? { total: 0, hot: 0, warm: 0, missed: 0, junk: 0 }
        const minUsed = Math.floor(((client.seconds_used_this_month as number | null) ?? 0) / 60)
        return { client, stats, minUsed }
      })
      .filter(({ stats, minUsed }) => stats.total > 0 || minUsed > 0)

    const idleCount = activeClients.length - activeRows.length

    activeRows.sort((a, b) => {
      if (b.stats.total !== a.stats.total) return b.stats.total - a.stats.total
      if (b.minUsed !== a.minUsed) return b.minUsed - a.minUsed
      return (a.client.business_name as string).localeCompare(b.client.business_name as string)
    })

    if (activeRows.length === 0) {
      lines.push('No activity across any client')
    } else {
      for (const { client, stats, minUsed } of activeRows) {
        const breakdown: string[] = []
        if (stats.hot > 0) breakdown.push(`${stats.hot} HOT`)
        if (stats.warm > 0) breakdown.push(`${stats.warm} WARM`)
        if (stats.missed > 0) breakdown.push(`${stats.missed} MISSED`)
        if (stats.junk > 0) breakdown.push(`${stats.junk} JUNK`)
        const callPart = stats.total === 0
          ? '0 calls today'
          : `${stats.total} call${stats.total === 1 ? '' : 's'}${breakdown.length > 0 ? ` (${breakdown.join(' · ')})` : ''}`
        const minLimit = (client.monthly_minute_limit as number | null) ?? 0
        const usagePart = minLimit > 0 ? ` · ${minUsed}/${minLimit} min` : ''
        lines.push(`• ${client.business_name}: ${callPart}${usagePart}`)
      }
    }

    if (idleCount > 0) {
      lines.push(`<i>+ ${idleCount} idle client${idleCount === 1 ? '' : 's'} (no calls, 0 min used)</i>`)
    }
  }

  // Credit health section
  const warnings: HealthWarning[] = [
    ...(twilioHealth.warning ? [twilioHealth.warning] : []),
    ...(openRouterHealth.warning ? [openRouterHealth.warning] : []),
  ]

  if (warnings.length > 0) {
    lines.push('\n<b>⚠️ Low Credits</b>')
    for (const w of warnings) {
      lines.push(`• ${w.service}: ${w.message}`)
    }
  } else {
    const creditParts: string[] = []
    if (twilioHealth.balance !== null) creditParts.push(`Twilio $${twilioHealth.balance.toFixed(2)}`)
    if (openRouterHealth.usagePct !== null) creditParts.push(`OpenRouter ${openRouterHealth.usagePct.toFixed(0)}% used`)
    if (creditParts.length > 0) lines.push(`\n<b>Credits OK</b> — ${creditParts.join(' | ')}`)
  }

  const message = lines.join('\n')

  const sent = await sendAlert(
    adminClient.telegram_bot_token as string,
    adminClient.telegram_chat_id as string,
    message
  )

  console.log(
    `[daily-digest] Sent=${sent} intakes=${newIntakes.length} calls=${recentCalls.length} ` +
    `trials_past=${trialsPastExpiry.length} trials_soon=${trialsExpiringSoon.length}`
  )

  return NextResponse.json({
    ok: sent,
    newIntakes: newIntakes.length,
    pendingActivation: pendingActivation.length,
    recentCalls: recentCalls.length,
    trialsPastExpiry: trialsPastExpiry.length,
    trialsExpiringSoon: trialsExpiringSoon.length,
    warnings: warnings.length,
  })
}
