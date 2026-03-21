/**
 * POST /api/cron/daily-digest
 *
 * Scheduled at 8 AM CST (14:00 UTC) via railway.json.
 * Builds and sends a daily Telegram digest to the admin.
 *
 * Reports:
 *   - New intakes today
 *   - Provisioned but not yet activated clients
 *   - Call counts last 24h per active client
 *   - Credit/balance health: Twilio + OpenRouter
 *
 * Auth: Bearer CRON_SECRET only (no ADMIN_PASSWORD fallback — S13a).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

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

    // Active clients for reference
    svc.from('clients')
      .select('id, business_name, slug')
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
  const callsByClient = new Map<string, { total: number; hot: number; warm: number; missed: number }>()
  for (const client of activeClients) {
    callsByClient.set(client.id, { total: 0, hot: 0, warm: 0, missed: 0 })
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
  }

  // ── Build message ───────────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  const lines: string[] = [`<b>unmissed.ai — Daily Digest</b>\n${dateStr}`]

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

  // Calls section
  lines.push('\n<b>Calls Last 24h</b>')
  if (activeClients.length === 0) {
    lines.push('No active clients')
  } else {
    for (const client of activeClients) {
      const stats = callsByClient.get(client.id) ?? { total: 0, hot: 0, warm: 0, missed: 0 }
      const parts = [`${stats.total} calls`]
      if (stats.hot > 0) parts.push(`${stats.hot} HOT`)
      if (stats.warm > 0) parts.push(`${stats.warm} WARM`)
      if (stats.missed > 0) parts.push(`${stats.missed} missed`)
      lines.push(`• ${client.business_name}: ${parts.join(', ')}`)
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

  console.log(`[daily-digest] Sent=${sent} intakes=${newIntakes.length} calls=${recentCalls.length}`)

  return NextResponse.json({
    ok: sent,
    newIntakes: newIntakes.length,
    pendingActivation: pendingActivation.length,
    recentCalls: recentCalls.length,
    warnings: warnings.length,
  })
}
