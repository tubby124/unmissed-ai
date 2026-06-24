/**
 * GET /api/cron/classifier-health
 *
 * Watches the call classifier (OpenRouter → Claude Haiku) — the dependency that
 * turns a transcript into the "who called + why" summary on every call. When it
 * fails (HTTP 402 out-of-balance, dead key, provider outage), calls silently land
 * as call_status='UNKNOWN' with ai_summary="Classification failed (...)" and the
 * client gets a gibberish alert. This went unmonitored for ~3 months (incident
 * 2026-06-24): a 4% failure rate across 7 clients with no signal.
 *
 * Three checks, any one flips unhealthy → Telegram alert to the operator:
 *   1. Liveness  — live ping to the exact model classifyCall() uses. Catches 402/5xx/dead-key.
 *   2. Balance   — OpenRouter remaining credit below floor (early warning before it 402s).
 *   3. Outcome   — calls in the last window that already failed classification.
 *
 * Schedule: hourly :25 via GitHub Actions cron (crons.yml).
 * Auth: Bearer CRON_SECRET only (matches notification-health).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// Same model the production classifier uses (src/lib/openrouter.ts classifyCall).
const CLASSIFIER_MODEL = 'anthropic/claude-haiku-4.5'
// Alert when remaining OpenRouter credit drops below this — early warning before 402s start.
const BALANCE_FLOOR_USD = 15
// Window for the "did any call already fail classification" check.
const OUTCOME_WINDOW_MS = 2 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const alerts: string[] = []
  let unhealthy = false

  const apiKey = process.env.OPENROUTER_API_KEY
  let balanceRemaining: number | null = null
  let liveness: 'ok' | 'fail' | 'no_key' = 'no_key'

  // ── Check 1 + 2: OpenRouter liveness + balance ──────────────────────────────
  if (!apiKey) {
    unhealthy = true
    alerts.push(
      `🔴 <b>Classifier DOWN — OPENROUTER_API_KEY not set</b>`,
      `Every call will land as UNKNOWN. Set OPENROUTER_API_KEY in Railway env.`,
    )
  } else {
    // Balance (remaining credit). Endpoint is free.
    try {
      const res = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } }
        const credits = json.data?.total_credits
        const usage = json.data?.total_usage
        if (typeof credits === 'number' && typeof usage === 'number') {
          balanceRemaining = credits - usage
          if (balanceRemaining < BALANCE_FLOOR_USD) {
            unhealthy = true
            alerts.push(
              `⚠️ <b>OpenRouter balance LOW</b>`,
              `Remaining: $${balanceRemaining.toFixed(2)} (floor $${BALANCE_FLOOR_USD}).`,
              `Top up at openrouter.ai/credits — at $0 every client call becomes "Classification failed".`,
              ``,
            )
          }
        }
      }
    } catch (balErr) {
      console.error('[classifier-health] balance check failed:', balErr)
    }

    // Liveness: a real, tiny call to the exact classifier model. Catches 402/5xx/dead-key.
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CLASSIFIER_MODEL,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) {
        liveness = 'ok'
      } else {
        liveness = 'fail'
        unhealthy = true
        const body = await res.text().catch(() => '(unreadable)')
        alerts.push(
          `🔴 <b>Classifier DOWN — OpenRouter HTTP ${res.status}</b>`,
          `Model: ${CLASSIFIER_MODEL}`,
          res.status === 402
            ? `402 = out of credit/quota. Calls are landing as "Classification failed" RIGHT NOW. Top up openrouter.ai/credits.`
            : `${body.slice(0, 200)}`,
          ``,
        )
      }
    } catch (liveErr) {
      liveness = 'fail'
      unhealthy = true
      alerts.push(
        `🔴 <b>Classifier DOWN — OpenRouter unreachable</b>`,
        `Model: ${CLASSIFIER_MODEL} · ${String(liveErr).slice(0, 150)}`,
        ``,
      )
    }
  }

  // ── Check 3: outcome — calls that already failed classification in the window ──
  const supabase = createServiceClient()
  const windowStart = new Date(Date.now() - OUTCOME_WINDOW_MS).toISOString()
  let failedCount = 0

  const { data: failedCalls, error: failedErr } = await supabase
    .from('call_logs')
    .select('id, client_id, call_status, ai_summary, created_at')
    .ilike('ai_summary', 'Classification failed%')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(50)

  if (failedErr) {
    console.error('[classifier-health] outcome query failed:', failedErr.message)
  } else if (failedCalls?.length) {
    failedCount = failedCalls.length
    unhealthy = true
    const clientCount = new Set(failedCalls.map((c) => c.client_id)).size
    alerts.push(
      `🔴 <b>Classification failures (last 2h)</b>`,
      `${failedCount} call(s) across ${clientCount} client(s) — real callers got no summary.`,
      ...failedCalls.slice(0, 5).map(
        (c) => `• call=${c.id.slice(0, 8)} client=${c.client_id?.slice(0, 8) || 'unknown'} ${c.created_at}`,
      ),
      ...(failedCount > 5 ? [`... and ${failedCount - 5} more`] : []),
    )
  }

  // ── Send alert if anything is unhealthy ─────────────────────────────────────
  if (!unhealthy) {
    console.log(
      `[classifier-health] healthy — liveness=${liveness} balance=$${balanceRemaining?.toFixed(2) ?? 'n/a'} failures(2h)=0`,
    )
    return NextResponse.json({
      status: 'healthy',
      liveness,
      balance_remaining_usd: balanceRemaining,
      classification_failures_2h: 0,
    })
  }

  const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
  const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID

  if (operatorToken && operatorChat) {
    try {
      await sendAlert(operatorToken, operatorChat, alerts.join('\n'))
    } catch (tgErr) {
      console.error('[classifier-health] alert send failed:', tgErr)
    }
  }

  const result = {
    status: 'unhealthy',
    liveness,
    balance_remaining_usd: balanceRemaining,
    classification_failures_2h: failedCount,
  }
  console.log('[classifier-health] unhealthy:', result)
  return NextResponse.json(result)
}
