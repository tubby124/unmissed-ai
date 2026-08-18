/**
 * outbound-attempts.ts — campaign attempt controls (Task 8).
 *
 * Pure, deterministic rules for automated outbound dialing. The cron path
 * (/api/cron/scheduled-callbacks) consults these before dialing; the completed
 * webhook uses `nextRetryAt()` to schedule the next automated attempt. Keeping
 * them here (instead of inline) makes the compliance rules unit-testable.
 *
 * Rules encoded:
 *   - max N automated attempts per lead (default 3, overridable via
 *     `clients.outbound_max_attempts`);
 *   - first retry no sooner than 48h after a no-answer/voicemail;
 *   - DNC / wrong-number / do-not-call terminates immediately (no retries);
 *   - an answered lead is never auto-redialed;
 *   - one missed-call SMS per lead per 24h (cooldown constant shared with the
 *     completed-notifications lane).
 */

import {
  nextCallingWindow,
  withinCallingWindow,
  type CallingWindowConfig,
} from './outbound-window'

export const DEFAULT_MAX_AUTOMATED_ATTEMPTS = 3

/** Minimum delay between a no-answer and the next automated attempt. */
export const RETRY_COOLDOWN_MS = 48 * 60 * 60 * 1000

/** One missed-call SMS per lead per 24h. */
export const MISSED_CALL_SMS_COOLDOWN_MS = 24 * 60 * 60 * 1000

const TERMINAL_DISPOSITIONS = new Set([
  'do_not_call',
  'do not call',
  'dnc',
  'wrong_number',
  'wrong number',
])

export interface AttemptGateLead {
  status?: string | null
  disposition?: string | null
  call_count?: number | null
  last_called_at?: string | null
}

export interface AttemptGateOptions {
  /** Resolved max attempts (e.g. clients.outbound_max_attempts). Falls back to 3. */
  maxAttempts?: number | null
  now?: Date
}

export type AttemptGateReason =
  | 'dnc'
  | 'wrong_number'
  | 'answered'
  | 'attempt_cap'
  | 'cooldown'

export interface AttemptGateResult {
  allowed: boolean
  reason?: AttemptGateReason
}

export function resolveMaxAttempts(maxAttempts: number | null | undefined): number {
  if (typeof maxAttempts === 'number' && Number.isFinite(maxAttempts) && maxAttempts >= 1) {
    return Math.floor(maxAttempts)
  }
  return DEFAULT_MAX_AUTOMATED_ATTEMPTS
}

function normalizeDisposition(disposition: string | null | undefined): string {
  return (disposition ?? '').toLowerCase().replace(/[_-]+/g, ' ').trim()
}

function isRetryableOutcome(disposition: string): boolean {
  return disposition === 'no answer' || disposition === 'no-answer'
    || disposition === 'vm' || disposition === 'voicemail'
}

/**
 * True when a lead must never be dialed again (DNC status, or a
 * wrong-number / do-not-call disposition). Shared by both the automated cron
 * gate and the manual dial-out guard — DNC/wrong-number terminates immediately
 * regardless of how the call would have been placed.
 */
export function isTerminallyBlocked(lead: AttemptGateLead): boolean {
  const status = (lead.status ?? '').toLowerCase()
  return status === 'dnc' || TERMINAL_DISPOSITIONS.has(normalizeDisposition(lead.disposition))
}

/**
 * Whether the automated cron may dial this lead right now.
 * Order matters: terminal/suppression outcomes short-circuit before the cap
 * and cooldown checks so a DNC lead is never re-queued.
 */
export function shouldAttemptAutomatedCall(
  lead: AttemptGateLead,
  opts: AttemptGateOptions = {},
): AttemptGateResult {
  const status = (lead.status ?? '').toLowerCase()
  const disposition = normalizeDisposition(lead.disposition)
  const now = opts.now ?? new Date()
  const maxAttempts = resolveMaxAttempts(opts.maxAttempts)
  const callCount = typeof lead.call_count === 'number' ? lead.call_count : 0

  if (isTerminallyBlocked(lead)) {
    return { allowed: false, reason: status === 'dnc' ? 'dnc' : 'wrong_number' }
  }
  if (disposition === 'answered') return { allowed: false, reason: 'answered' }
  if (callCount >= maxAttempts) return { allowed: false, reason: 'attempt_cap' }

  // 48h cooldown only matters for a lead that already reached the person's
  // voicemail/no-answer — a never-called lead has no cooldown.
  if (lead.last_called_at && isRetryableOutcome(disposition)) {
    const lastCalled = new Date(lead.last_called_at).getTime()
    if (!Number.isNaN(lastCalled) && now.getTime() - lastCalled < RETRY_COOLDOWN_MS) {
      return { allowed: false, reason: 'cooldown' }
    }
  }

  return { allowed: true }
}

/**
 * Next automated retry instant for a no-answer at `noAnswerAt`: at least 48h
 * later, snapped forward into the next calling window when the raw +48h lands
 * outside one. Never earlier than `now`.
 */
export function nextRetryAt(
  noAnswerAt: Date,
  tz: string,
  config?: CallingWindowConfig | null,
  now?: Date,
): Date {
  const floor = Math.max(
    noAnswerAt.getTime() + RETRY_COOLDOWN_MS,
    (now ?? new Date()).getTime(),
  )
  const candidate = new Date(floor)
  if (withinCallingWindow(tz, candidate, config)) return candidate
  return nextCallingWindow(tz, candidate, config)
}

/**
 * True when a missed-call SMS was already sent within the 24h window.
 * (Completed-notifications enforces the same 24h lane via notification_logs;
 * this helper mirrors the rule for tests and future callers.)
 */
export function withinMissedCallSmsCooldown(
  lastSentAt: string | null | undefined,
  now?: Date,
): boolean {
  if (!lastSentAt) return false
  const t = new Date(lastSentAt).getTime()
  if (Number.isNaN(t)) return false
  return (now ?? new Date()).getTime() - t < MISSED_CALL_SMS_COOLDOWN_MS
}
