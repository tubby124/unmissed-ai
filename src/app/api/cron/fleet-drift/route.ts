/**
 * POST /api/cron/fleet-drift
 *
 * Fleet drift detector cron. Read-only audit of Twilio + Supabase + Ultravox
 * state. Telegram-alerts operator on CRITICAL findings.
 *
 * Complements the existing /api/cron/drift-check (which auto-fixes
 * Supabase↔Ultravox prompt drift). This route catches the dimensions that
 * route misses: Twilio webhook URL drift, prompt-vs-tool mismatch,
 * prompt-over-hard-max, slug mismatch.
 *
 * Schedule: hourly via Railway cron. Read-only — does NOT auto-fix.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { auditFleet, formatFleetReport } from '@/lib/drift-detector'
import { sendAlert } from '@/lib/telegram'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const ultravoxApiKey = process.env.ULTRAVOX_API_KEY
  if (!twilioSid || !twilioToken || !ultravoxApiKey) {
    console.error('[cron/fleet-drift] Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / ULTRAVOX_API_KEY env vars')
    return NextResponse.json({ error: 'Missing required env vars' }, { status: 500 })
  }

  const supabase = createServiceClient()
  let report
  try {
    report = await auditFleet(supabase, { twilioSid, twilioToken, ultravoxApiKey })
  } catch (e) {
    const msg = (e as Error).message
    console.error(`[cron/fleet-drift] Audit failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const bySev = report.findings.reduce(
    (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
    {} as Record<string, number>,
  )
  const criticalCount = bySev.CRITICAL ?? 0
  const highCount = bySev.HIGH ?? 0

  console.log(
    `[cron/fleet-drift] checked=${report.clients_audited} findings=${report.findings.length} ` +
      `CRITICAL=${criticalCount} HIGH=${highCount} MEDIUM=${bySev.MEDIUM ?? 0} LOW=${bySev.LOW ?? 0} ` +
      `errors=${report.errors.length}`,
  )

  // ── Telegram alert ONLY on CRITICAL findings ──────────────────────────────
  // HIGH/MEDIUM/LOW go to logs only — would otherwise be too noisy at hourly cadence.
  if (criticalCount > 0) {
    const opToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const opChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (opToken && opChat) {
      const critical = report.findings.filter(f => f.severity === 'CRITICAL').slice(0, 8)
      const lines: string[] = [
        '🚨 <b>Fleet Drift Detector — CRITICAL</b>',
        `${criticalCount} critical finding(s) across ${report.clients_audited} active clients.`,
        '',
      ]
      for (const f of critical) {
        lines.push(`<b>${f.client_slug}</b> — ${f.dimension}`)
        lines.push(`  expected: ${f.expected.slice(0, 100)}`)
        lines.push(`  actual: ${f.actual.slice(0, 100)}`)
        if (f.note) lines.push(`  note: ${f.note.slice(0, 120)}`)
        lines.push('')
      }
      lines.push(`Counts: CRITICAL ${criticalCount} | HIGH ${highCount} | MEDIUM ${bySev.MEDIUM ?? 0} | LOW ${bySev.LOW ?? 0}`)
      await sendAlert(opToken, opChat, lines.join('\n')).catch(err => {
        console.error('[cron/fleet-drift] Telegram alert failed:', err)
      })
    } else {
      console.warn('[cron/fleet-drift] CRITICAL findings present but no TELEGRAM_OPERATOR_CHAT_ID/TELEGRAM_CHAT_ID — skipping alert')
    }
  }

  return NextResponse.json({
    checked: report.clients_audited,
    findings_total: report.findings.length,
    by_severity: bySev,
    errors: report.errors,
    report_markdown: formatFleetReport(report),
  })
}
