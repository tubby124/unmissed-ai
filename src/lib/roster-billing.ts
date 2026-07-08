/**
 * roster-billing — pure billing-state resolution for the admin client roster.
 * Kept out of the React components so it can be unit-tested with node:test.
 */

export interface RosterBillingInput {
  status: string | null
  subscription_status: string | null
  effective_monthly_rate: number | null
  trial_expires_at: string | null
  grace_period_end: string | null
  has_stripe: boolean
}

export interface BillingBadge {
  dot: string
  label: 'paused' | 'trialing' | 'past due' | 'paying' | 'comped' | 'none'
  detail?: string
  color: string
}

function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - now) / 86400000)
}

/**
 * Billing state resolution — order matters:
 * paused (clients.status) wins, then subscription_status specifics
 * (trialing / past_due), then paying vs comped, else none.
 */
export function billingBadge(c: RosterBillingInput, now: number = Date.now()): BillingBadge {
  if (c.status === 'paused') {
    return { dot: '⚫', label: 'paused', color: 'var(--color-text-3)' }
  }
  if (c.subscription_status === 'trialing') {
    const d = daysUntil(c.trial_expires_at, now)
    return {
      dot: '🔵',
      label: 'trialing',
      detail: d === null ? undefined : d > 0 ? `${d}d left` : 'expired',
      color: 'rgb(56,189,248)',
    }
  }
  if (c.subscription_status === 'past_due') {
    const d = daysUntil(c.grace_period_end, now)
    return {
      dot: '🟡',
      label: 'past due',
      detail: c.grace_period_end
        ? d !== null && d > 0 ? `grace ends in ${d}d` : 'grace ended'
        : undefined,
      color: 'rgb(251,191,36)',
    }
  }
  if (c.subscription_status === 'active' && c.has_stripe) {
    return { dot: '🟢', label: 'paying', color: 'rgb(74,222,128)' }
  }
  if (c.status === 'active' && (c.effective_monthly_rate ?? 0) === 0) {
    return { dot: '⚪', label: 'comped', color: 'var(--color-text-2)' }
  }
  return { dot: '·', label: 'none', color: 'var(--color-text-3)' }
}

/** Minutes-used percentage, or null when the client has no limit set. */
export function minutesPct(used: number | null, limit: number | null): number | null {
  if (!limit || limit <= 0) return null
  return Math.round(((used ?? 0) / limit) * 100)
}
