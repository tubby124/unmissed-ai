/**
 * telegram-health-check.ts — nightly Telegram delivery-health harness.
 *
 * Closes the "notifications silently dropping" gap that other harnesses miss:
 *   - TELEGRAM_BOT_TOKEN rotated externally / revoked via BotFather (every
 *     notification dead, no signal until the customer complains)
 *   - Webhook in a sustained error state (Telegram has been retrying our
 *     /api/webhook/telegram endpoint and getting 5xx for 6h)
 *   - A client's `telegram_chat_id` has gone stale (user blocked the bot,
 *     deleted the chat) — only that customer's notifications fail
 *   - Account-wide telegram send failure rate above 10% (rate limiting,
 *     transient outage) — bot looks fine but real notifications drop
 *
 * Read-only check: this script never sends a test message to a customer.
 *   - bot_token_valid → GET /bot{token}/getMe
 *   - webhook_health → GET /bot{token}/getWebhookInfo
 *   - client_chat_id_invalid → GET /bot{token}/getChat?chat_id=... (per client)
 *   - recent_send_failure_rate → SELECT FROM notification_logs WHERE channel='telegram'
 *
 * Comparison logic in src/lib/telegram-health.ts (pure, no I/O, unit-tested).
 * This script is the orchestration layer.
 *
 * Run:
 *   npx tsx scripts/telegram-health-check.ts            # write findings + Telegram on P0
 *   npx tsx scripts/telegram-health-check.ts --dry-run  # log only, no DB writes, no Telegram
 *
 * Exit codes:
 *   0 — clean
 *   1 — any P0 (bot token unusable — page the owner)
 *   2 — any P1 only (dashboard ticket, no wake-up)
 *
 * Pairing with other nightlies (UTC):
 *   09:00 nightly-drift-check    (Supabase ↔ Ultravox)
 *   09:30 data-hygiene-check     (Supabase-only)
 *   09:45 stripe-drift-check     (Supabase ↔ Stripe)
 *   10:00 twilio-ownership-check (Supabase ↔ Twilio)
 *   10:30 telegram-health-check  (Telegram API + notification_logs) ← this
 *   10:15 prompt-injection-eval  (separate concern, can overlap)
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recordFindings, type Finding } from '../src/lib/harness-writer.js'
import {
  checkBotTokenValid,
  checkWebhookHealth,
  checkClientChatIdsInvalid,
  checkRecentSendFailureRate,
  exitCodeForFindings,
  type TelegramGetMeResult,
  type TelegramWebhookInfoResult,
  type TelegramGetChatResult,
  type TelegramHealthClientRow,
  type TelegramHealthFinding,
  type NotificationLogStats,
} from '../src/lib/telegram-health.js'

const DRY_RUN = process.argv.includes('--dry-run')

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID
const RUN_ID = process.env.GITHUB_RUN_ID ?? String(Date.now())
const FAILURE_WINDOW_HOURS = 24

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[telegram-health] Missing TELEGRAM_BOT_TOKEN')
  process.exit(2)
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[telegram-health] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

// ─── Telegram API helpers ─────────────────────────────────────────────────
// Hand-rolled fetch calls instead of a Telegram SDK. Keeps the dep-set
// identical to the rest of the repo and lets us pin exactly the response
// shape we project for the rules layer.

const TG_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

async function tgGetMe(): Promise<TelegramGetMeResult> {
  try {
    const res = await fetch(`${TG_BASE}/getMe`, { signal: AbortSignal.timeout(10_000) })
    const body = (await res.json().catch(() => ({}))) as Partial<TelegramGetMeResult>
    if (!res.ok) {
      return {
        ok: false,
        error_code: body.error_code ?? res.status,
        description: body.description ?? `HTTP ${res.status}`,
      }
    }
    return body as TelegramGetMeResult
  } catch (e) {
    return { ok: false, description: `network: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function tgGetWebhookInfo(): Promise<TelegramWebhookInfoResult> {
  try {
    const res = await fetch(`${TG_BASE}/getWebhookInfo`, { signal: AbortSignal.timeout(10_000) })
    const body = (await res.json().catch(() => ({}))) as Partial<TelegramWebhookInfoResult>
    if (!res.ok) {
      return {
        ok: false,
        error_code: body.error_code ?? res.status,
        description: body.description ?? `HTTP ${res.status}`,
      }
    }
    return body as TelegramWebhookInfoResult
  } catch (e) {
    return { ok: false, description: `network: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function tgGetChat(chatId: string): Promise<TelegramGetChatResult> {
  try {
    // GET with query — chat_id can be negative for groups, so encode it.
    const url = `${TG_BASE}/getChat?chat_id=${encodeURIComponent(chatId)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const body = (await res.json().catch(() => ({}))) as Partial<TelegramGetChatResult>
    if (!res.ok) {
      return {
        ok: false,
        error_code: body.error_code ?? res.status,
        description: body.description ?? `HTTP ${res.status}`,
      }
    }
    return body as TelegramGetChatResult
  } catch (e) {
    return { ok: false, description: `network: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function sendOwnerAlert(chatId: string, message: string): Promise<boolean> {
  // Direct fetch (not sendAlert from src/lib/telegram.ts) because that helper
  // would also log to console under a different prefix and we want this
  // script's log lines to stay coherent. Same retry logic isn't needed for a
  // single P0 alert — the rest of the run already proved the bot works.
  try {
    const res = await fetch(`${TG_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error(`[telegram-health] Telegram alert failed HTTP ${res.status}: ${await res.text().catch(() => '')}`)
      return false
    }
    return true
  } catch (e) {
    console.error(`[telegram-health] Telegram alert threw:`, e)
    return false
  }
}

// ─── Supabase fetches ─────────────────────────────────────────────────────

async function fetchClients(sb: SupabaseClient): Promise<TelegramHealthClientRow[]> {
  const { data, error } = await sb
    .from('clients')
    .select('slug, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)
    .order('slug')
  if (error) throw new Error(`clients fetch failed: ${error.message}`)
  type Row = { slug: string; telegram_chat_id: string | null }
  return ((data ?? []) as Row[])
    .filter(r => !!r.telegram_chat_id)
    .map(r => ({ slug: r.slug, telegram_chat_id: r.telegram_chat_id }))
}

async function fetchNotificationLogStats(sb: SupabaseClient): Promise<NotificationLogStats> {
  // Two head:true counts — cheap on Supabase, no row payload over the wire.
  // Window: last 24h. failures = status in ('failed','error'). Anything else
  // (sent / ok / pending) is treated as a success for rate purposes.
  const sinceIso = new Date(Date.now() - FAILURE_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { count: total, error: totalErr } = await sb
    .from('notification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'telegram')
    .gte('created_at', sinceIso)

  if (totalErr) throw new Error(`notification_logs total query failed: ${totalErr.message}`)

  const { count: failures, error: failErr } = await sb
    .from('notification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'telegram')
    .in('status', ['failed', 'error'])
    .gte('created_at', sinceIso)

  if (failErr) throw new Error(`notification_logs failures query failed: ${failErr.message}`)

  return {
    total: total ?? 0,
    failures: failures ?? 0,
    window_since_iso: sinceIso,
  }
}

async function resolveOwnerChatId(sb: SupabaseClient): Promise<string | null> {
  if (TELEGRAM_OWNER_CHAT_ID) return TELEGRAM_OWNER_CHAT_ID
  const { data, error } = await sb
    .from('clients')
    .select('telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .maybeSingle()
  if (error) {
    console.warn(`[telegram-health] owner chat-id lookup failed: ${error.message}`)
    return null
  }
  return (data as { telegram_chat_id: string | null } | null)?.telegram_chat_id ?? null
}

// ─── Telegram alert formatting (P0 only) ──────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function formatP0Alert(p0: TelegramHealthFinding[]): string {
  // Only one P0 check exists today (bot_token_valid), but formatter is
  // future-proofed to handle multiple P0 lines.
  const lines: string[] = [
    `🤖 <b>Telegram Health</b> — ${p0.length} P0 finding(s)`,
    `<i>Bot delivery is broken — outbound notifications dead.</i>`,
    '',
  ]
  for (const f of p0.slice(0, 6)) {
    lines.push(`• <code>${escapeHtml(f.check_name)}</code> — ${escapeHtml(truncate(f.summary, 200))}`)
  }
  if (p0.length > 6) lines.push(`• …and ${p0.length - 6} more — see /admin/harness`)
  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  console.log(`[telegram-health] Starting${DRY_RUN ? ' (dry-run)' : ''} run_id=${RUN_ID}`)
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

  const allFindings: TelegramHealthFinding[] = []

  // ── 1. bot_token_valid (P0) ──────────────────────────────────────────────
  console.log('[telegram-health] checking bot_token_valid (getMe)…')
  const getMe = await tgGetMe()
  const tokenFindings = checkBotTokenValid(getMe)
  allFindings.push(...tokenFindings)
  if (tokenFindings.length > 0) {
    console.log(`  [P0] ${tokenFindings[0].summary}`)
    // Token unusable — short-circuit. Hitting getChat / getWebhookInfo with a
    // bad token would just spam P0 with downstream noise.
    console.log('[telegram-health] Token check failed — short-circuiting (skipping webhook + per-client checks).')
  } else {
    console.log(`  [OK ] getMe ok=true — bot username @${getMe.result?.username ?? 'unknown'}`)

    // ── 2. webhook_health (P1) ────────────────────────────────────────────
    console.log('[telegram-health] checking webhook_health (getWebhookInfo)…')
    const webhookInfo = await tgGetWebhookInfo()
    const webhookFindings = checkWebhookHealth(webhookInfo)
    allFindings.push(...webhookFindings)
    if (webhookFindings.length > 0) {
      console.log(`  [P1] ${webhookFindings[0].summary}`)
    } else {
      console.log(`  [OK ] webhook ${webhookInfo.result?.url ? webhookInfo.result.url : '(long-poll mode)'} — no recent errors`)
    }

    // ── 3. client_chat_id_invalid (P1, per-client) ────────────────────────
    console.log('[telegram-health] checking client_chat_id_invalid (getChat per client)…')
    const clients = await fetchClients(sb)
    console.log(`  Probing ${clients.length} client(s) with stored telegram_chat_id`)
    const chatResults = new Map<string, TelegramGetChatResult>()
    for (const c of clients) {
      if (!c.telegram_chat_id) continue
      const res = await tgGetChat(c.telegram_chat_id)
      chatResults.set(c.slug, res)
      if (!res.ok) {
        console.log(`  [PROBE] ${c.slug} chat_id=${c.telegram_chat_id} → HTTP ${res.error_code} (${res.description ?? 'no description'})`)
      }
    }
    const chatFindings = checkClientChatIdsInvalid(clients, chatResults)
    allFindings.push(...chatFindings)
    console.log(`  Found ${chatFindings.length} invalid chat_id(s)`)

    // ── 4. recent_send_failure_rate (P1, account-wide) ────────────────────
    console.log('[telegram-health] checking recent_send_failure_rate (notification_logs 24h)…')
    try {
      const stats = await fetchNotificationLogStats(sb)
      console.log(`  notification_logs(telegram, 24h): total=${stats.total} failures=${stats.failures}`)
      const rateFindings = checkRecentSendFailureRate(stats)
      allFindings.push(...rateFindings)
      if (rateFindings.length > 0) console.log(`  [P1] ${rateFindings[0].summary}`)
    } catch (e) {
      console.error(`  notification_logs query failed: ${e instanceof Error ? e.message : String(e)}`)
      // Stats failure is not itself a finding — log and continue.
    }
  }

  console.log(`[telegram-health] total findings=${allFindings.length}`)

  // ── Persist to harness_findings ─────────────────────────────────────────
  if (!DRY_RUN) {
    if (allFindings.length > 0) {
      const writerFindings: Finding[] = allFindings.map(f => ({
        check_name: f.check_name,
        severity: f.severity,
        client_slug: f.client_slug,
        summary: f.summary,
        details: f.details,
      }))
      try {
        const res = await recordFindings({ harness: 'telegram-health', run_id: RUN_ID, findings: writerFindings })
        console.log(`[telegram-health] recordFindings: written=${res.written} reopened=${res.reopened} errors=${res.errors.length}`)
        for (const errLine of res.errors) console.error(`  [writer] ${errLine}`)
      } catch (e) {
        console.error(`[telegram-health] recordFindings threw: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      console.log('[telegram-health] No findings — nothing to record.')
    }
  } else {
    console.log(`[telegram-health] DRY RUN — skipping recordFindings (${allFindings.length} would be written)`)
  }

  // ── Telegram alert (P0 only) ────────────────────────────────────────────
  // If the P0 IS bot_token_valid, the bot is dead and our own alert would
  // fail too. We still attempt it: sometimes the failure is a stale env var
  // on the runner (the live token in Railway is fine), in which case the
  // owner's Telegram client may receive the alert anyway. Worst case it
  // logs another error — the dashboard still has the finding.
  const p0 = allFindings.filter(f => f.severity === 'P0')
  if (!DRY_RUN && p0.length > 0) {
    const chat = await resolveOwnerChatId(sb)
    if (!chat) {
      console.error('[telegram-health] No owner chat-id available — cannot send Telegram alert')
    } else {
      const msg = formatP0Alert(p0)
      const sent = await sendOwnerAlert(chat, msg)
      if (sent) console.log('[telegram-health] P0 Telegram alert sent')
      else console.warn('[telegram-health] P0 Telegram alert FAILED (expected when bot_token_valid is the P0)')
    }
  } else if (DRY_RUN && p0.length > 0) {
    console.log(`[telegram-health] DRY RUN — would send P0 alert (${p0.length} finding(s))`)
  }

  return exitCodeForFindings(allFindings)
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[telegram-health] Fatal:', err)
    process.exit(2)
  })
