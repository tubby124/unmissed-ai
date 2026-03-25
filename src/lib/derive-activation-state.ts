/**
 * derive-activation-state.ts
 *
 * Single source of truth for paid activation status.
 * Grounded in actual clients DB fields — no invented states.
 * Pure function — no DB calls, no async, no side effects.
 */

/**
 * awaiting_number   — paid user, twilio_number not yet provisioned
 * forwarding_needed — has number, setup_complete is false/null
 * ready             — has number, setup_complete true
 */
export type ActivationState =
  | 'awaiting_number'
  | 'forwarding_needed'
  | 'ready'

export interface ActivationInput {
  twilio_number: string | null
  setup_complete: boolean | null
}

export function deriveActivationState(input: ActivationInput): ActivationState {
  if (!input.twilio_number) return 'awaiting_number'
  if (!input.setup_complete) return 'forwarding_needed'
  return 'ready'
}
