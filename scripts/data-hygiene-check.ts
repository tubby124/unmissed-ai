/**
 * data-hygiene-check.ts — nightly harness for "customer updates that conflict,
 * look stale, or contain bad content".
 *
 * 8 checks (see src/lib/data-hygiene.ts for the rule logic):
 *   A — stale injected_notes (expired OR no expiry set)
 *   B — content red-flags in injected_note (competitor / profanity / explicit / URL)
 *   C — trial-status drift (trialing past trial_expires_at)
 *   D — zombie active subs (status=active, stripe_subscription_id NULL, not allow-listed)
 *   E — plan-tier vs tool mismatch (Lite with transferCall etc.)
 *   F — stuck live calls (>2h in 'live')
 *   G — untranscribed voicemails (>24h, no ai_summary)
 *   H — duplicate twilio_numbers (call routing race)
 *
 * Run:
 *   npx tsx scripts/data-hygiene-check.ts            # default: report + Telegram
 *   npx tsx scripts/data-hygiene-check.ts --dry-run  # report only, NO Telegram, NO write
 *   npx tsx scripts/data-hygiene-check.ts --fix      # auto-clean stale rows, NO Telegram
 *
 * Exit codes:
 *   0 — all PASS
 *   1 — any WARN or FAIL
 *
 * Idempotency: state in .github/data-hygiene-state/last-run.json. Same finding
 * set within 24h → suppress Telegram (re-alerting the same 7 stale notes every
 * morning trains the owner to ignore the bot).
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { sendAlert } from '../src/lib/telegram.js'
import {
  checkStaleNotes,
  checkInjectedNoteContent,
  checkTrialStatusDrift,
  checkZombieActiveSubs,
  checkPlanTierToolMismatch,
  checkStuckLiveCalls,
  checkUntranscribedVoicemails,
  checkDuplicateTwilioNumbers,
  worstSeverity,
  fingerprintResults,
  type CheckResult,
  type ClientRow,
  type CallLogRow,
  type FlagsConfig,
} from '../src/lib/data-hygiene.js'

const STATE_PATH = '.github/data-hygiene-state/last-run.json'
const FLAGS_PATH = 'scripts/data-hygiene-flags.json'
const SUPPRESS_HOURS = 24

interface CliArgs {
  dryRun: boolean
  fix: boolean
}

function parseArgs(argv: string[]): CliArgs {
  return {
    dryRun: argv.includes('--dry-run'),
    fix: argv.includes('--fix'),
  }
}

function loadFlags(): FlagsConfig {
  const raw = JSON.parse(readFileSync(FLAGS_PATH, 'utf-8')) as Record<string, unknown>
  return {
    competitors: (raw.competitors as string[]) ?? [],
    profanity: (raw.profanity as string[]) ?? [],
    explicit: (raw.explicit as string[]) ?? [],
    url_regex: (raw.url_regex as string) ?? 'rx:https?://',
    allow_list_slugs: (raw.allow_list_slugs as string[]) ?? [],
  }
}

function buildConciergeAllowList(): Set<string> {
  const base = ['hasan-sharif', 'exp-realty']
  const extra = (process.env.CONCIERGE_CLIENTS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return new Set([...base, ...extra])
}

async function fetchClients(sb: SupabaseClient): Promise<ClientRow[]> {
  const { data, error } = await sb
    .from('clients')
    .select('id, slug, injected_note, injected_note_expires_at, subscription_status, trial_expires_at, stripe_subscription_id, selected_plan, tools, twilio_number')
  if (error) throw new Error(`clients query failed: ${error.message}`)
  type RawClientRow = {
    id: string
    slug: string
    injected_note: string | null
    injected_note_expires_at: string | null
    subscription_status: string | null
    trial_expires_at: string | null
    stripe_subscription_id: string | null
    selected_plan: string | null
    tools: unknown
    twilio_number: string | null
  }
  return (data ?? []).map((r: RawClientRow) => ({
    id: r.id,
    slug: r.slug,
    injected_note: r.injected_note,
    injected_note_expires_at: r.injected_note_expires_at,
    subscription_status: r.subscription_status,
    trial_expires_at: r.trial_expires_at,
    stripe_subscription_id: r.stripe_subscription_id,
    selected_plan: r.selected_plan,
    // Tools is jsonb — flatten to string for ILIKE-equivalent match.
    tools_text: r.tools ? JSON.stringify(r.tools) : null,
    twilio_number: r.twilio_number,
  }))
}

async function fetchRecentCallLogs(sb: SupabaseClient): Promise<CallLogRow[]> {
  // Pull 30d window — sufficient for "stuck live" (max 2h interesting) and
  // "untranscribed VM" (>24h). 30d cap keeps query bounded on big call_logs.
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await sb
    .from('call_logs')
    .select('id, call_status, ai_summary, created_at')
    .gte('created_at', sinceIso)
  if (error) throw new Error(`call_logs query failed: ${error.message}`)
  type RawCallLogRow = { id: string; call_status: string | null; ai_summary: string | null; created_at: string }
  return (data ?? []).map((r: RawCallLogRow) => ({
    id: r.id,
    call_status: r.call_status,
    ai_summary: r.ai_summary,
    created_at: r.created_at,
  }))
}

async function fetchAdminTelegram(sb: SupabaseClient): Promise<{ bot: string; chat: string } | null> {
  const { data, error } = await sb
    .from('clients')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .single()
  if (error || !data) return null
  if (!data.telegram_bot_token || !data.telegram_chat_id) return null
  return { bot: data.telegram_bot_token as string, chat: data.telegram_chat_id as string }
}

async function applyFixes(
  sb: SupabaseClient,
  results: CheckResult[],
): Promise<{ id: string; rows_updated: number }[]> {
  const log: { id: string; rows_updated: number }[] = []

  // A. Stale notes → clear injected_note + expires
  const staleFinding = results.find(r => r.id === 'A_stale_notes')
  if (staleFinding && staleFinding.findings.length) {
    const slugs = staleFinding.findings.map(f => f.key)
    const { error, count } = await sb
      .from('clients')
      .update({ injected_note: null, injected_note_expires_at: null }, { count: 'exact' })
      .in('slug', slugs)
    if (error) console.error(`[fix A] ${error.message}`)
    log.push({ id: 'A_stale_notes', rows_updated: count ?? 0 })
  }

  // C. Trial drift → set subscription_status='expired'
  const trialFinding = results.find(r => r.id === 'C_trial_drift')
  if (trialFinding && trialFinding.findings.length) {
    const slugs = trialFinding.findings.map(f => f.key)
    const { error, count } = await sb
      .from('clients')
      .update({ subscription_status: 'expired' }, { count: 'exact' })
      .in('slug', slugs)
    if (error) console.error(`[fix C] ${error.message}`)
    log.push({ id: 'C_trial_drift', rows_updated: count ?? 0 })
  }

  // F. Stuck live calls → mark unknown + ended_at=now
  const stuckFinding = results.find(r => r.id === 'F_stuck_live_calls')
  if (stuckFinding && stuckFinding.findings.length) {
    const ids = stuckFinding.findings.map(f => f.key)
    const { error, count } = await sb
      .from('call_logs')
      .update({ call_status: 'unknown', ended_at: new Date().toISOString() }, { count: 'exact' })
      .in('id', ids)
    if (error) console.error(`[fix F] ${error.message}`)
    log.push({ id: 'F_stuck_live_calls', rows_updated: count ?? 0 })
  }

  return log
}

function formatTap(results: CheckResult[]): string {
  const lines: string[] = [`1..${results.length}`]
  results.forEach((r, i) => {
    const tag = r.severity === 'PASS' ? 'ok' : 'not ok'
    lines.push(`${tag} ${i + 1} - [${r.severity}] ${r.label}${r.summary ? ` — ${r.summary}` : ''}`)
    if (r.findings.length) {
      // Cap detail output at 20 rows per check — anything more is just noise.
      const capped = r.findings.slice(0, 20)
      for (const f of capped) {
        lines.push(`  # ${f.key}: ${f.detail}`)
      }
      if (r.findings.length > capped.length) {
        lines.push(`  # … and ${r.findings.length - capped.length} more`)
      }
    }
  })
  return lines.join('\n')
}

function formatTelegram(results: CheckResult[], fixLog: { id: string; rows_updated: number }[]): string {
  const failing = results.filter(r => r.severity !== 'PASS')
  if (failing.length === 0) return ''

  const lines: string[] = ['<b>Data hygiene check — findings</b>']
  for (const r of failing) {
    lines.push(`\n<b>[${r.severity}]</b> ${escapeHtml(r.label)}`)
    const capped = r.findings.slice(0, 10)
    for (const f of capped) {
      lines.push(`• <code>${escapeHtml(f.key)}</code> — ${escapeHtml(f.detail)}`)
    }
    if (r.findings.length > capped.length) {
      lines.push(`  … +${r.findings.length - capped.length} more`)
    }
  }
  if (fixLog.length) {
    lines.push('\n<b>Auto-fixes applied</b>')
    for (const f of fixLog) {
      lines.push(`• ${f.id}: ${f.rows_updated} row(s)`)
    }
  }
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface StateFile {
  last_run_iso: string
  fingerprint: string
  worst: string
}

function loadState(): StateFile | null {
  if (!existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as StateFile
  } catch {
    return null
  }
}

function saveState(state: StateFile): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true })
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return 2
  }

  const sb = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const flags = loadFlags()
  const allowList = buildConciergeAllowList()

  console.log(`[data-hygiene] mode=${args.fix ? 'fix' : args.dryRun ? 'dry-run' : 'report'}`)

  const [clients, callLogs] = await Promise.all([fetchClients(sb), fetchRecentCallLogs(sb)])

  console.log(`[data-hygiene] fetched ${clients.length} client(s), ${callLogs.length} recent call_log(s)`)

  const results: CheckResult[] = [
    checkStaleNotes(clients),
    checkInjectedNoteContent(clients, flags),
    checkTrialStatusDrift(clients),
    checkZombieActiveSubs(clients, allowList),
    checkPlanTierToolMismatch(clients),
    checkStuckLiveCalls(callLogs),
    checkUntranscribedVoicemails(callLogs),
    checkDuplicateTwilioNumbers(clients),
  ]

  console.log(formatTap(results))

  const worst = worstSeverity(results)
  const fp = fingerprintResults(results)

  let fixLog: { id: string; rows_updated: number }[] = []
  if (args.fix && !args.dryRun) {
    fixLog = await applyFixes(sb, results)
    for (const f of fixLog) console.log(`[fix] ${f.id}: ${f.rows_updated} row(s)`)
  }

  // Idempotency: same findings within 24h → skip Telegram alert. Still write state.
  const prev = loadState()
  const prevWithinWindow =
    prev && Date.now() - new Date(prev.last_run_iso).getTime() < SUPPRESS_HOURS * 60 * 60 * 1000
  const suppress = !!(prevWithinWindow && prev.fingerprint === fp)

  if (!args.dryRun) {
    saveState({ last_run_iso: new Date().toISOString(), fingerprint: fp, worst })
  }

  if (worst !== 'PASS' && !args.dryRun && !args.fix && !suppress) {
    const tg = await fetchAdminTelegram(sb)
    if (tg) {
      const msg = formatTelegram(results, fixLog)
      try {
        await sendAlert(tg.bot, tg.chat, msg)
        console.log('[data-hygiene] Telegram alert sent')
      } catch (err) {
        console.error('[data-hygiene] Telegram send failed:', err)
      }
    } else {
      console.warn('[data-hygiene] admin Telegram creds missing (hasan-sharif client) — skipping alert')
    }
  } else if (suppress) {
    console.log(`[data-hygiene] same findings as previous run within ${SUPPRESS_HOURS}h — Telegram suppressed`)
  }

  return worst === 'PASS' ? 0 : 1
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[data-hygiene] fatal:', err)
    process.exit(2)
  })
