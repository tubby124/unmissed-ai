/**
 * POST /api/cron/minute-usage-alert
 *
 * Hourly cron. Alerts owners when their agent crosses 75% or 90% of monthly
 * minute cap. One alert per threshold per month — uses clients.usage_warnings_sent
 * JSONB keyed by year-month for idempotency. Implicit reset each new month.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

interface ClientRow {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
  seconds_used_this_month: number | null
  monthly_minute_limit: number | null
  bonus_minutes: number | null
  email_notifications_enabled: boolean | null
  usage_warnings_sent: Record<string, { '75'?: string; '90'?: string }> | null
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
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
  const { data: clients, error } = await svc
    .from('clients')
    .select('id, slug, business_name, contact_email, seconds_used_this_month, monthly_minute_limit, bonus_minutes, email_notifications_enabled, usage_warnings_sent')
    .eq('status', 'active')
    .not('monthly_minute_limit', 'is', null)
    .gt('monthly_minute_limit', 0)

  if (error) {
    console.error('[minute-usage-alert] Client query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const now = new Date()
  const mKey = monthKey(now)
  const dashboardUrl = `${APP_URL}/dashboard/billing`
  const sent: { slug: string; threshold: 75 | 90; pct: number }[] = []
  const skipped: { slug: string; reason: string }[] = []

  for (const c of (clients ?? []) as ClientRow[]) {
    if (!c.contact_email || c.email_notifications_enabled === false) continue
    const totalLimit = (c.monthly_minute_limit ?? 0) + (c.bonus_minutes ?? 0)
    if (totalLimit <= 0) continue
    const usedMin = (c.seconds_used_this_month ?? 0) / 60
    const pct = usedMin / totalLimit
    if (pct < 0.75) continue

    const warnings = c.usage_warnings_sent ?? {}
    const monthWarnings = warnings[mKey] ?? {}

    // 90% takes priority over 75%
    let threshold: 75 | 90 | null = null
    if (pct >= 0.90 && !monthWarnings['90']) threshold = 90
    else if (pct >= 0.75 && !monthWarnings['75']) threshold = 75

    if (!threshold) {
      skipped.push({ slug: c.slug, reason: `already-warned at ${mKey}` })
      continue
    }

    const usedRounded = Math.round(usedMin)
    const remainingMin = Math.max(0, Math.round(totalLimit - usedMin))
    const subject = threshold === 90
      ? `🟠 ${remainingMin} minutes left this month — ${c.business_name ?? c.slug}`
      : `Heads up: 75% of your monthly minutes used`

    const result = await sendBrandedEmail({
      to: c.contact_email,
      clientId: c.id,
      clientSlug: c.slug,
      purpose: 'system',
      tag: `minute_warning_${threshold}`,
      reason: `Your ${BRAND_NAME} agent is approaching its monthly minute cap.`,
      subject,
      html: `<h2 style="margin-bottom:4px">${threshold === 90 ? 'Almost out of minutes' : '75% of your minutes used'}</h2>
<p>Hi${c.business_name ? ` ${c.business_name}` : ''},</p>
<p>Your ${BRAND_NAME} agent has used <strong>${usedRounded} of ${Math.round(totalLimit)} minutes</strong> this month (${Math.round(pct * 100)}%). About <strong>${remainingMin} minutes left</strong> before the agent pauses to prevent overage.</p>
${threshold === 90
  ? `<p style="color:#dc2626"><strong>Action recommended:</strong> top up minutes or upgrade your plan now so calls keep flowing.</p>`
  : `<p>If you typically use a lot of minutes this time of month, plan ahead — top up or upgrade to avoid hitting the cap.</p>`}
<a href="${dashboardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Top up minutes / upgrade plan</a>
<p style="font-size:14px;color:#555">Limit resets on the 1st of next month.</p>`,
    })

    if (result.ok) {
      const next = {
        ...warnings,
        [mKey]: { ...monthWarnings, [String(threshold)]: now.toISOString() },
      }
      await svc.from('clients').update({ usage_warnings_sent: next }).eq('id', c.id)
      sent.push({ slug: c.slug, threshold, pct: Math.round(pct * 100) })
      console.log(`[minute-usage-alert] Sent ${threshold}% warning to ${c.contact_email} (${c.slug}) — ${usedRounded}/${Math.round(totalLimit)} min`)
    } else {
      skipped.push({ slug: c.slug, reason: result.error ?? 'send failed' })
      console.error(`[minute-usage-alert] Send failed for ${c.slug}: ${result.error}`)
    }
  }

  return NextResponse.json({ sent: sent.length, skipped: skipped.length, sent_details: sent, skipped_details: skipped })
}
