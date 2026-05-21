/**
 * data-hygiene.ts — pure check functions for nightly data-hygiene-check.
 *
 * Why split out from scripts/data-hygiene-check.ts: the regex / threshold
 * logic must be unit-testable against synthetic rows (no Supabase). The
 * script is the IO orchestration layer; this file is the rules.
 *
 * Why this exists at all: 2026-05-19 production audit found
 *   - 7 stale injected_note rows (one with a competitor recommendation,
 *     one with explicit content) that the spoken prompt was reading verbatim
 *     because injected_note_expires_at was never set OR cleanup never ran
 *   - 14 clients stuck in subscription_status='trialing' with
 *     trial_expires_at 40+ days in past — the trial-expiry cron filters by
 *     status='active' so rows already moved to status='paused' for other
 *     reasons are skipped by it
 *
 * Severity model:
 *   FAIL → blocks the script's exit code at 1 and triggers Telegram
 *   WARN → same exit code but lower-priority message
 *   PASS → silent
 */

export type Severity = 'PASS' | 'WARN' | 'FAIL'

export interface CheckResult {
  /** Stable id for this check. Used as the JSON key in last-run state file. */
  id: string
  /** Human label for Telegram + stdout. */
  label: string
  severity: Severity
  /** Per-row findings. Empty when severity === 'PASS'. */
  findings: Finding[]
  /** Optional summary line for stdout / Telegram. */
  summary?: string
}

export interface Finding {
  /** Free-form identifier — slug for client checks, call_id for call_logs checks, phone number for dupe check. */
  key: string
  /** One-line detail. NEVER include full injected_note content (PII / abuse text). */
  detail: string
}

export interface ClientRow {
  id?: string
  slug: string
  injected_note?: string | null
  injected_note_expires_at?: string | null
  subscription_status?: string | null
  trial_expires_at?: string | null
  stripe_subscription_id?: string | null
  selected_plan?: string | null
  /** Stored as jsonb in DB; pass the raw string here for ILIKE simulation in tests. */
  tools_text?: string | null
  twilio_number?: string | null
}

export interface CallLogRow {
  id: string
  call_status?: string | null
  ai_summary?: string | null
  created_at: string
}

export interface FlagsConfig {
  competitors: string[]
  profanity: string[]
  explicit: string[]
  /** Stored as "rx:<pattern>"; compiled at use time. */
  url_regex: string
  allow_list_slugs: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// A. Stale injected_notes
// ──────────────────────────────────────────────────────────────────────────────

export function checkStaleNotes(rows: ClientRow[], nowMs: number = Date.now()): CheckResult {
  const findings: Finding[] = []
  for (const r of rows) {
    if (!r.injected_note) continue
    const exp = r.injected_note_expires_at
    const isStale = !exp || new Date(exp).getTime() < nowMs
    if (isStale) {
      const preview = r.injected_note.slice(0, 60).replace(/\s+/g, ' ')
      findings.push({
        key: r.slug,
        detail: `note="${preview}${r.injected_note.length > 60 ? '…' : ''}" expires=${exp ?? 'NULL'}`,
      })
    }
  }
  return {
    id: 'A_stale_notes',
    label: 'Stale injected_notes',
    severity: findings.length === 0 ? 'PASS' : 'WARN',
    findings,
    summary: findings.length ? `${findings.length} stale note(s)` : 'no stale notes',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// B. Content red-flags in injected_note
// ──────────────────────────────────────────────────────────────────────────────

export function checkInjectedNoteContent(rows: ClientRow[], flags: FlagsConfig): CheckResult {
  const findings: Finding[] = []
  const urlRx = flags.url_regex.startsWith('rx:')
    ? new RegExp(flags.url_regex.slice(3), 'i')
    : new RegExp(flags.url_regex, 'i')

  const allow = new Set(flags.allow_list_slugs)

  for (const r of rows) {
    if (!r.injected_note) continue
    if (allow.has(r.slug)) continue
    const note = r.injected_note
    const lc = note.toLowerCase()

    const hits: string[] = []
    for (const term of flags.competitors) {
      if (lc.includes(term.toLowerCase())) hits.push(`competitor:${term}`)
    }
    for (const term of flags.profanity) {
      if (lc.includes(term.toLowerCase())) hits.push(`profanity:${term}`)
    }
    for (const term of flags.explicit) {
      if (lc.includes(term.toLowerCase())) hits.push(`explicit:${term}`)
    }
    const urlMatch = note.match(urlRx)
    if (urlMatch) {
      // Truncate matched URL to avoid leaking long tracking links into the log.
      const trimmed = urlMatch[0].length > 40 ? urlMatch[0].slice(0, 40) + '…' : urlMatch[0]
      hits.push(`url:${trimmed}`)
    }
    if (hits.length) {
      findings.push({ key: r.slug, detail: hits.join(', ') })
    }
  }

  return {
    id: 'B_note_content',
    label: 'injected_note content red-flags',
    severity: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    summary: findings.length ? `${findings.length} flagged note(s)` : 'no flagged content',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// C. Trial-status drift
// ──────────────────────────────────────────────────────────────────────────────

export function checkTrialStatusDrift(rows: ClientRow[], nowMs: number = Date.now()): CheckResult {
  const findings: Finding[] = []
  for (const r of rows) {
    if (r.subscription_status !== 'trialing') continue
    if (!r.trial_expires_at) continue
    const expMs = new Date(r.trial_expires_at).getTime()
    if (expMs < nowMs) {
      const daysExpired = Math.floor((nowMs - expMs) / (24 * 60 * 60 * 1000))
      findings.push({ key: r.slug, detail: `expired ${daysExpired}d ago (trial_expires_at=${r.trial_expires_at})` })
    }
  }
  return {
    id: 'C_trial_drift',
    label: 'Trialing past trial_expires_at',
    severity: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    summary: findings.length ? `${findings.length} stuck trial row(s)` : 'no stuck trial rows',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// D. Zombie active subs
// ──────────────────────────────────────────────────────────────────────────────

export function checkZombieActiveSubs(rows: ClientRow[], allowList: Set<string>): CheckResult {
  const findings: Finding[] = []
  for (const r of rows) {
    if (r.subscription_status !== 'active') continue
    if (r.stripe_subscription_id) continue
    if (allowList.has(r.slug)) continue
    findings.push({ key: r.slug, detail: 'subscription_status=active but stripe_subscription_id=NULL (not in allow-list)' })
  }
  return {
    id: 'D_zombie_subs',
    label: 'Active subs missing stripe_subscription_id',
    severity: findings.length === 0 ? 'PASS' : 'WARN',
    findings,
    summary: findings.length ? `${findings.length} zombie sub(s)` : 'no zombie subs',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// E. Plan-tier tool mismatches
// ──────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_TOOLS_BY_PLAN: Record<string, string[]> = {
  lite: ['transferCall', 'bookAppointment', 'checkForCoaching'],
  core: ['checkForCoaching'],
}

export function checkPlanTierToolMismatch(rows: ClientRow[]): CheckResult {
  const findings: Finding[] = []
  for (const r of rows) {
    if (!r.selected_plan) continue
    const forbidden = FORBIDDEN_TOOLS_BY_PLAN[r.selected_plan]
    if (!forbidden) continue
    const toolsLc = (r.tools_text ?? '').toLowerCase()
    if (!toolsLc) continue
    const violations = forbidden.filter(t => toolsLc.includes(t.toLowerCase()))
    if (violations.length) {
      findings.push({
        key: r.slug,
        detail: `plan=${r.selected_plan} has forbidden tool(s): ${violations.join(', ')}`,
      })
    }
  }
  return {
    id: 'E_plan_tier_tools',
    label: 'Plan-tier vs tool registration mismatch',
    severity: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    summary: findings.length ? `${findings.length} plan-tool mismatch(es)` : 'no plan-tool mismatches',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// F. Stuck live calls
// ──────────────────────────────────────────────────────────────────────────────

export function checkStuckLiveCalls(rows: CallLogRow[], nowMs: number = Date.now()): CheckResult {
  const findings: Finding[] = []
  const twoHoursMs = 2 * 60 * 60 * 1000
  for (const r of rows) {
    if (r.call_status !== 'live') continue
    const ageMs = nowMs - new Date(r.created_at).getTime()
    if (ageMs > twoHoursMs) {
      const ageHr = (ageMs / (60 * 60 * 1000)).toFixed(1)
      findings.push({ key: r.id, detail: `call_status=live for ${ageHr}h (created=${r.created_at})` })
    }
  }
  return {
    id: 'F_stuck_live_calls',
    label: 'call_logs stuck in live > 2h',
    severity: findings.length === 0 ? 'PASS' : 'WARN',
    findings,
    summary: findings.length ? `${findings.length} stuck call(s)` : 'no stuck live calls',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// G. Untranscribed voicemails
// ──────────────────────────────────────────────────────────────────────────────

export function checkUntranscribedVoicemails(rows: CallLogRow[], nowMs: number = Date.now()): CheckResult {
  const findings: Finding[] = []
  const dayMs = 24 * 60 * 60 * 1000
  for (const r of rows) {
    if ((r.call_status ?? '').toUpperCase() !== 'VOICEMAIL') continue
    const ageMs = nowMs - new Date(r.created_at).getTime()
    if (ageMs < dayMs) continue
    const summary = r.ai_summary ?? ''
    if (!summary || summary.includes('PLACEHOLDER')) {
      findings.push({ key: r.id, detail: `VOICEMAIL ${Math.floor(ageMs / dayMs)}d old, ai_summary=${summary ? 'PLACEHOLDER' : 'NULL'}` })
    }
  }
  return {
    id: 'G_untranscribed_vm',
    label: 'Voicemails > 24h with no transcript',
    severity: findings.length === 0 ? 'PASS' : 'WARN',
    findings,
    summary: findings.length ? `${findings.length} untranscribed voicemail(s)` : 'all voicemails transcribed',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// H. Duplicate twilio_numbers
// ──────────────────────────────────────────────────────────────────────────────

export function checkDuplicateTwilioNumbers(rows: ClientRow[]): CheckResult {
  const byNumber = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.twilio_number) continue
    const list = byNumber.get(r.twilio_number) ?? []
    list.push(r.slug)
    byNumber.set(r.twilio_number, list)
  }
  const findings: Finding[] = []
  for (const [num, slugs] of byNumber.entries()) {
    if (slugs.length > 1) {
      findings.push({ key: num, detail: `assigned to ${slugs.length} clients: ${slugs.join(', ')}` })
    }
  }
  return {
    id: 'H_dupe_twilio_numbers',
    label: 'Duplicate twilio_numbers',
    severity: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    summary: findings.length ? `${findings.length} duplicate number(s)` : 'no duplicate numbers',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Summary helpers
// ──────────────────────────────────────────────────────────────────────────────

export function worstSeverity(results: CheckResult[]): Severity {
  if (results.some(r => r.severity === 'FAIL')) return 'FAIL'
  if (results.some(r => r.severity === 'WARN')) return 'WARN'
  return 'PASS'
}

/** Stable signature for idempotency dedupe — keyed by findings, not the timestamp. */
export function fingerprintResults(results: CheckResult[]): string {
  const parts = results
    .filter(r => r.severity !== 'PASS')
    .map(r => `${r.id}:${r.findings.map(f => f.key).sort().join(',')}`)
    .sort()
  return parts.join('|')
}
