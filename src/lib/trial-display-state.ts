/**
 * trial-display-state.ts
 *
 * Single source of truth for deriving which trial phase a user is in.
 * Used by ClientHome and any other surface that needs phase-aware trial UI.
 *
 * Pure function — no DB calls, no async, no side effects.
 */

/**
 * active_early   — trial active, 3+ days left (neutral)
 * active_urgent  — trial active, 2 days left (amber treatment)
 * active_final   — trial active, 1 day left (maximum urgency)
 * expired        — trial ended, user has not converted
 * paid_or_non_trial — not on a trial (paid subscriber or no trial ever)
 */
export type TrialPhase =
  | 'active_early'
  | 'active_urgent'
  | 'active_final'
  | 'expired'
  | 'paid_or_non_trial'

interface TrialPhaseInput {
  subscriptionStatus: string | null
  daysLeft: number | null
  isTrialExpired: boolean
}

export function deriveTrialPhase({
  subscriptionStatus,
  daysLeft,
  isTrialExpired,
}: TrialPhaseInput): TrialPhase {
  if (isTrialExpired) return 'expired'
  if (subscriptionStatus !== 'trialing') return 'paid_or_non_trial'
  // Active trial — classify by urgency
  const days = daysLeft ?? 0
  if (days <= 1) return 'active_final'
  if (days <= 2) return 'active_urgent'
  return 'active_early'
}
