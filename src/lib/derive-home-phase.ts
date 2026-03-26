/**
 * derive-home-phase.ts
 *
 * Composes deriveTrialPhase() + deriveActivationState() into a single
 * HomePhase used by ClientHome to select which bento layout to render.
 *
 * Pure function — no DB calls, no async, no side effects.
 */

import { type TrialPhase } from './trial-display-state'
import { type ActivationState } from './derive-activation-state'

/**
 * trial_active   — subscription_status='trialing' AND not yet expired
 * trial_expired  — subscription_status='trialing' AND expired
 * paid_awaiting  — paid/active but Twilio number not provisioned OR setup not complete
 * paid_ready     — paid/active AND activation.state === 'ready'
 */
export type HomePhase = 'trial_active' | 'trial_expired' | 'paid_awaiting' | 'paid_ready'

export function deriveHomePhase(
  trialPhase: TrialPhase,
  activationState: ActivationState,
): HomePhase {
  if (trialPhase === 'expired') return 'trial_expired'
  if (trialPhase !== 'paid_or_non_trial') return 'trial_active'
  if (activationState !== 'ready') return 'paid_awaiting'
  return 'paid_ready'
}
