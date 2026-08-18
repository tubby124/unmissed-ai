import type { LoftyWritebackDisposition } from './lofty-writeback'

/**
 * Operator-facing manual outcome vocabulary for the Lofty campaign call
 * outcome desk. Matches the disposition values produced by
 * `resolveLoftyWritebackDisposition` so a manual override never invents a
 * new downstream stage name.
 */
export const MANUAL_OUTCOMES: readonly LoftyWritebackDisposition[] = [
  'active_now',
  'future_timeline',
  'not_looking',
  'wrong_number',
  'do_not_call',
  'no_answer',
  'voicemail',
  'answered',
] as const

export const MANUAL_OUTCOME_LABELS: Record<LoftyWritebackDisposition, string> = {
  active_now: 'Active now',
  future_timeline: 'Future timeline',
  not_looking: 'Not looking',
  wrong_number: 'Wrong number',
  do_not_call: 'Do not call',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  answered: 'Answered',
}

/** Dispositions that must never be auto-dialed again. */
export const SUPPRESSING_OUTCOMES: readonly LoftyWritebackDisposition[] = [
  'do_not_call',
  'wrong_number',
] as const

/**
 * Build a link to the lead's record in the Lofty CRM web app. The exact
 * deep-link path is best-effort (Lofty has no stable public lead URL scheme);
 * override the base via LOFTY_APP_BASE_URL when the tenant uses a custom
 * subdomain.
 */
export function buildLoftyRecordUrl(loftyLeadId: string | null | undefined): string | null {
  if (!loftyLeadId) return null
  const base = (process.env.LOFTY_APP_BASE_URL ?? 'https://app.lofty.com').replace(/\/+$/, '')
  return `${base}/leads/${loftyLeadId}`
}
