/**
 * telegram-health — pure-comparison logic for the nightly Telegram delivery
 * health harness.
 *
 * Closes the "notifications silently dropping" gap: bot token rotated /
 * revoked, getMe failing, webhook in a sustained error state, a client's
 * `telegram_chat_id` gone stale (user blocked the bot, deleted the chat), or
 * the account-wide send-failure rate spiking above 10%.
 *
 * No I/O lives here — the script in scripts/telegram-health-check.ts is the
 * orchestration layer (Telegram API + Supabase fetch + recordFindings +
 * Telegram alert). Splitting the rules out keeps them unit-testable against
 * synthetic Telegram payloads (no live bot token, no network).
 *
 * Severity model (maps to harness-writer.ts Severity):
 *   P0 — token unusable (getMe fails). Every outbound notification is dead.
 *   P1 — webhook in error state, individual client chat unreachable, or
 *        account-wide failure rate above threshold. Owner-actionable in the
 *        morning; no on-call wake-up.
 *
 * Why getChat instead of sendMessage for the per-client check: sendMessage
 * would actually deliver a message to the customer ("test ping from bot")
 * every night. getChat is read-only — returns 400 "chat not found" when the
 * chat is unreachable, no message side effect.
 */

import type { Severity } from './harness-writer'

// ─── Telegram API minimal projections ─────────────────────────────────────
// Hand-rolled so this file has zero runtime deps — tests can mock with
// plain objects instead of pulling a Telegram client library.

/** Result of GET /bot{token}/getMe. */
export interface TelegramGetMeResult {
  ok: boolean
  /** Present when ok=true. Bot identity. */
  result?: {
    id: number
    is_bot: boolean
    username: string
    first_name?: string
  }
  /** Present when ok=false. */
  error_code?: number
  description?: string
}

/** Result of GET /bot{token}/getWebhookInfo. */
export interface TelegramWebhookInfoResult {
  ok: boolean
  result?: {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
    /** Unix seconds (Telegram convention) of most recent webhook delivery error. */
    last_error_date?: number
    last_error_message?: string
    /** Unix seconds of most recent successful sync (newer Bot API versions). */
    last_synchronization_error_date?: number
    max_connections?: number
    ip_address?: string
  }
  error_code?: number
  description?: string
}

/**
 * Result of GET /bot{token}/getChat?chat_id=... — `ok:true` means the chat is
 * reachable. `ok:false` with 400 is the "user blocked bot / chat deleted"
 * signal we care about; other error_codes (401/5xx) are not finding-worthy
 * (env or transient — script logs and moves on).
 */
export interface TelegramGetChatResult {
  ok: boolean
  result?: {
    id: number
    type: string
    title?: string
    username?: string
    first_name?: string
  }
  error_code?: number
  description?: string
}

/** Slice of a client row we need for the per-client chat check. */
export interface TelegramHealthClientRow {
  slug: string
  telegram_chat_id: string | null
}

/** Aggregated notification_logs counts for the recent_send_failure_rate check. */
export interface NotificationLogStats {
  /** Rows where channel='telegram' and created_at >= since. */
  total: number
  /** Subset of `total` where status in {'failed', 'error'}. */
  failures: number
  /** ISO timestamp of the window start — recorded in details for visibility. */
  window_since_iso: string
}

/** Finding shape compatible with harness-writer Finding. */
export interface TelegramHealthFinding {
  check_name: string
  severity: Severity
  client_slug: string | null
  summary: string
  details: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────

/**
 * Recent-window threshold for webhook_health. Telegram returns
 * `last_error_date` as the most recent failure ever — we only alert when it
 * happened in the last 24h, so a one-off blip last month doesn't keep
 * re-firing forever.
 */
export const WEBHOOK_ERROR_WINDOW_HOURS = 24

/**
 * Failure-rate threshold for recent_send_failure_rate. 10% is "something is
 * systemically wrong" — under normal operation the rate should sit at 0-2%
 * (occasional 4xx for stale chat ids). Below the threshold we skip the
 * finding to avoid alert fatigue.
 */
export const FAILURE_RATE_THRESHOLD = 0.1

/**
 * Minimum sample size before failure-rate is meaningful. If fewer than this
 * many sends went out in the window, the rate is too noisy to alert on.
 */
export const MIN_FAILURE_RATE_SAMPLE = 10

// ─── Check functions ──────────────────────────────────────────────────────

/**
 * bot_token_valid (P0). Single source of truth for "is the bot token usable".
 *
 * Failure modes captured:
 *   - Token rotated externally (TELEGRAM_BOT_TOKEN env stale)
 *   - Token revoked via BotFather
 *   - 401 from Telegram (any cause)
 *
 * Does NOT fire on transient 5xx — callers are expected to retry getMe at
 * least once before passing the final result in. If getMe never completes,
 * pass `{ ok: false, description: 'network: ...' }` and we still record P0
 * because that's the operationally correct signal (we cannot send).
 */
export function checkBotTokenValid(getMe: TelegramGetMeResult): TelegramHealthFinding[] {
  if (getMe.ok && getMe.result?.is_bot) return []
  const desc = getMe.description ?? 'getMe returned ok=false'
  const code = getMe.error_code ?? null
  return [
    {
      check_name: 'bot_token_valid',
      severity: 'P0',
      client_slug: null,
      summary: `Telegram getMe failed${code ? ` (HTTP ${code})` : ''}: ${desc}`.slice(0, 280),
      details: {
        telegram_error_code: code,
        telegram_description: desc,
        getMe_ok: getMe.ok,
      },
    },
  ]
}

/**
 * webhook_health (P1). Fires when the Telegram-side webhook is in a
 * sustained error state — last_error_date inside the last 24h AND a
 * last_error_message is set. Catches bot-server crashes, certificate
 * expiries, 502s from Railway.
 *
 * Skipped silently when:
 *   - getWebhookInfo failed entirely (no actionable info; the P0 token check
 *     already covered the only common cause)
 *   - No webhook URL is configured (Bot API used in long-poll mode)
 *   - last_error_date is older than the window
 */
export function checkWebhookHealth(
  info: TelegramWebhookInfoResult,
  now: number = Date.now(),
): TelegramHealthFinding[] {
  if (!info.ok || !info.result) return []
  if (!info.result.url) return [] // long-poll mode — no webhook to be unhealthy
  const lastErrSec = info.result.last_error_date
  const lastErrMsg = info.result.last_error_message
  if (!lastErrSec || !lastErrMsg) return []
  const ageMs = now - lastErrSec * 1000
  if (ageMs > WEBHOOK_ERROR_WINDOW_HOURS * 60 * 60 * 1000) return []
  return [
    {
      check_name: 'webhook_health',
      severity: 'P1',
      client_slug: null,
      summary: `Telegram webhook last_error within ${WEBHOOK_ERROR_WINDOW_HOURS}h: ${lastErrMsg}`.slice(0, 280),
      details: {
        webhook_url: info.result.url,
        last_error_date_iso: new Date(lastErrSec * 1000).toISOString(),
        last_error_message: lastErrMsg,
        pending_update_count: info.result.pending_update_count,
      },
    },
  ]
}

/**
 * client_chat_id_invalid (P1, per-client). One finding per client whose
 * stored telegram_chat_id is unreachable via getChat.
 *
 * Treats only 400-class as actionable. 401/403/5xx are bot-level problems
 * the P0 token check is responsible for; we don't want to spam one finding
 * per client when the real issue is one bot-wide failure.
 *
 * `chatResults` is keyed by client slug so the script can call getChat for
 * each client and pass results in batch. Clients without a stored chat_id
 * are skipped (no row in `chatResults`).
 */
export function checkClientChatIdsInvalid(
  clients: TelegramHealthClientRow[],
  chatResults: Map<string, TelegramGetChatResult>,
): TelegramHealthFinding[] {
  const findings: TelegramHealthFinding[] = []
  for (const c of clients) {
    if (!c.telegram_chat_id) continue
    const res = chatResults.get(c.slug)
    if (!res) continue // script didn't probe (e.g. no chat_id) — nothing to report
    if (res.ok && res.result) continue // chat reachable
    const code = res.error_code ?? null
    // Only 400 = "chat not found / not enough rights / bot blocked" type signals.
    // 401/403 are auth-level — the P0 token check will fire instead.
    // 5xx is transient — skip to avoid alert fatigue on Telegram outages.
    if (code !== 400 && code !== 403) continue
    // 403 can be either bot-wide ("bot was blocked by the user") or auth.
    // For per-chat 403 with "blocked by the user" / "kicked" we want a finding;
    // for a bot-wide 403 the P0 token check would have caught it already.
    findings.push({
      check_name: 'client_chat_id_invalid',
      severity: 'P1',
      client_slug: c.slug,
      summary: `Telegram chat unreachable for ${c.slug} (HTTP ${code}): ${res.description ?? 'no description'}`.slice(0, 280),
      details: {
        telegram_chat_id: c.telegram_chat_id,
        telegram_error_code: code,
        telegram_description: res.description ?? null,
      },
    })
  }
  return findings
}

/**
 * recent_send_failure_rate (P1, account-wide). Fires when the
 * telegram-channel rows in notification_logs show >10% failure over the
 * last 24h AND the sample size is large enough to be statistically
 * meaningful (>=10 sends).
 *
 * Catches the "bot is alive but Telegram is rate-limiting us into oblivion"
 * class — the bot_token_valid check would still pass but real notifications
 * are dropping.
 *
 * Skipped silently when sample < MIN_FAILURE_RATE_SAMPLE — a quiet day
 * shouldn't fire a 100% rate alarm because 1 of 1 sends failed.
 */
export function checkRecentSendFailureRate(
  stats: NotificationLogStats,
): TelegramHealthFinding[] {
  if (stats.total < MIN_FAILURE_RATE_SAMPLE) return []
  const rate = stats.failures / stats.total
  if (rate <= FAILURE_RATE_THRESHOLD) return []
  const pct = (rate * 100).toFixed(1)
  const threshPct = (FAILURE_RATE_THRESHOLD * 100).toFixed(0)
  return [
    {
      check_name: 'recent_send_failure_rate',
      severity: 'P1',
      client_slug: null,
      summary: `Telegram send failure rate ${pct}% (${stats.failures}/${stats.total}) over 24h — above ${threshPct}% threshold`.slice(0, 280),
      details: {
        failures: stats.failures,
        total: stats.total,
        failure_rate: Number(rate.toFixed(4)),
        threshold: FAILURE_RATE_THRESHOLD,
        window_since_iso: stats.window_since_iso,
      },
    },
  ]
}

// ─── Exit-code aggregation ────────────────────────────────────────────────

/**
 * Exit codes per task spec:
 *   0 — clean (no findings)
 *   1 — any P0 (token unusable — pager-worthy)
 *   2 — any P1 (no P0) — dashboard ticket, no wake-up
 */
export function exitCodeForFindings(findings: TelegramHealthFinding[]): 0 | 1 | 2 {
  if (findings.some(f => f.severity === 'P0')) return 1
  if (findings.some(f => f.severity === 'P1')) return 2
  return 0
}
