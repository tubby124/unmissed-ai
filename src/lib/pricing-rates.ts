/**
 * Per-minute / per-month rates for cost computation.
 *
 * Used by:
 *  - src/app/api/webhook/ultravox/route.ts (writes billed_cost_cents on call.billed)
 *  - src/app/api/dashboard/costs/route.ts (admin cost dashboard)
 *
 * Update here when rates change — verify against Twilio Console + Ultravox pricing page.
 * Rates are in USD.
 */
export const PRICING = {
  twilio_inbound_per_min: 0.0085,    // Twilio Canada local inbound voice
  twilio_outbound_per_min: 0.0140,   // Twilio Canada local outbound voice
  twilio_number_per_month: 1.15,     // Twilio local CA phone number rental/month
  ultravox_per_min: 0.05,            // Ultravox AI voice (billing rounds up to 60s min)
} as const

/**
 * Compute billed cost in cents for an inbound Ultravox call, given billed duration in seconds.
 * Sums Ultravox per-minute + Twilio inbound per-minute. Ignores fixed monthly number rental.
 * Returns 0 for non-billable durations (unjoined / 0s calls).
 */
export function computeBilledCostCents(billedDurationSeconds: number | null | undefined): number {
  if (!billedDurationSeconds || billedDurationSeconds <= 0) return 0
  const minutes = billedDurationSeconds / 60
  const dollars = minutes * (PRICING.ultravox_per_min + PRICING.twilio_inbound_per_min)
  return Math.round(dollars * 100)
}
