/**
 * GET /api/cron/notification-health
 *
 * S9c: Periodic check for failed notifications.
 * S9.5e: Detect permanently stuck `processing` rows (>10 min).
 * S9.5f: Detect orphaned `live`/`transferred` rows (>30 min).
 *
 * Queries notification_logs for status=failed in the last hour,
 * plus call_logs for stuck/orphaned rows, and sends a summary
 * Telegram alert to admin.
 *
 * Schedule: every hour via Railway cron.
 *
 * Auth: Bearer CRON_SECRET only (no ADMIN_PASSWORD fallback — see S13a).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const alerts: string[] = []
  let unhealthy = false

  // ── S9c: Failed notifications in the last hour ──────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: failures, error } = await supabase
    .from('notification_logs')
    .select('id, client_id, channel, recipient, error, created_at')
    .eq('status', 'failed')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[notification-health] Query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (failures?.length) {
    unhealthy = true
    const byChannel: Record<string, number> = {}
    for (const f of failures) {
      byChannel[f.channel] = (byChannel[f.channel] || 0) + 1
    }
    const channelSummary = Object.entries(byChannel)
      .map(([ch, count]) => `${ch}: ${count}`)
      .join(', ')

    alerts.push(
      `\ud83d\udd34 <b>Notification Failures (last 1h)</b>`,
      `Total: ${failures.length}`,
      `Channels: ${channelSummary}`,
      ``,
      ...failures.slice(0, 5).map(f =>
        `\u2022 ${f.channel} \u2192 ${f.recipient?.slice(0, 20) || 'unknown'}: ${(f.error || 'no error detail').slice(0, 100)}`
      ),
      ...(failures.length > 5 ? [`... and ${failures.length - 5} more`] : []),
    )
  }

  // ── S9.5e: Permanently stuck `processing` rows (>10 min) ───────────────────
  const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: stuckRows, error: stuckErr } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, client_id, updated_at')
    .eq('call_status', 'processing')
    .lt('updated_at', stuckThreshold)
    .limit(20)

  if (stuckErr) {
    console.error('[notification-health] Stuck processing query failed:', stuckErr.message)
  } else if (stuckRows?.length) {
    unhealthy = true
    // S9.6d: Auto-remediate stuck processing rows → error
    const stuckIds = stuckRows.map(r => r.id)
    const { error: remediateErr } = await supabase
      .from('call_logs')
      .update({ call_status: 'error', ai_summary: 'Auto-remediated: stuck in processing >10 min' })
      .in('id', stuckIds)
    if (remediateErr) console.error('[notification-health] Stuck remediation failed:', remediateErr.message)
    else console.log(`[notification-health] Remediated ${stuckIds.length} stuck processing row(s)`)
    alerts.push(
      ``,
      `\u26a0\ufe0f <b>Stuck Processing (>10 min) — REMEDIATED</b>`,
      `Count: ${stuckRows.length} → set to error`,
      ...stuckRows.slice(0, 5).map(r =>
        `\u2022 callLog=${r.id} ultravox=${r.ultravox_call_id?.slice(0, 12)} updated=${r.updated_at}`
      ),
      ...(stuckRows.length > 5 ? [`... and ${stuckRows.length - 5} more`] : []),
    )
  }

  // ── S9.5f: Orphaned `live`/`transferred` rows (>30 min) ────────────────────
  const orphanThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: orphanRows, error: orphanErr } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, call_status, client_id, started_at')
    .in('call_status', ['live', 'transferred'])
    .lt('started_at', orphanThreshold)
    .limit(20)

  if (orphanErr) {
    console.error('[notification-health] Orphaned rows query failed:', orphanErr.message)
  } else if (orphanRows?.length) {
    unhealthy = true
    // S9.6d: Auto-remediate orphaned rows → MISSED
    const orphanIds = orphanRows.map(r => r.id)
    const { error: orphanRemErr } = await supabase
      .from('call_logs')
      .update({ call_status: 'MISSED', ai_summary: 'Auto-remediated: orphaned row >30 min (webhook never fired)' })
      .in('id', orphanIds)
    if (orphanRemErr) console.error('[notification-health] Orphan remediation failed:', orphanRemErr.message)
    else console.log(`[notification-health] Remediated ${orphanIds.length} orphaned row(s)`)
    const liveCount = orphanRows.filter(r => r.call_status === 'live').length
    const transferCount = orphanRows.filter(r => r.call_status === 'transferred').length
    alerts.push(
      ``,
      `\u26a0\ufe0f <b>Orphaned Rows (>30 min) — REMEDIATED</b>`,
      `Live: ${liveCount} | Transferred: ${transferCount} → set to MISSED`,
      ...orphanRows.slice(0, 5).map(r =>
        `\u2022 ${r.call_status} callLog=${r.id} ultravox=${r.ultravox_call_id?.slice(0, 12)} started=${r.started_at}`
      ),
      ...(orphanRows.length > 5 ? [`... and ${orphanRows.length - 5} more`] : []),
    )
  }

  // ── Send alert if anything is unhealthy ─────────────────────────────────────
  if (!unhealthy) {
    console.log('[notification-health] All healthy — no failures, no stuck rows, no orphans')
    return NextResponse.json({ status: 'healthy', failures: 0, stuck_processing: 0, orphaned: 0 })
  }

  const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
  const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID

  if (operatorToken && operatorChat) {
    try {
      await sendAlert(operatorToken, operatorChat, alerts.join('\n'))
    } catch (tgErr) {
      console.error('[notification-health] Alert send failed:', tgErr)
    }
  }

  const result = {
    status: 'unhealthy',
    failures: failures?.length || 0,
    stuck_processing: stuckRows?.length || 0,
    orphaned: orphanRows?.length || 0,
  }
  console.log(`[notification-health] Unhealthy:`, result)
  return NextResponse.json(result)
}
