/**
 * provisioning-guards.ts — Phase 6: Provisioning Hardening
 *
 * Pure validation and idempotency functions for the activation chain.
 * No side effects, no DB calls — designed for unit testing.
 *
 * Run tests: npx tsx --test src/lib/__tests__/provisioning-guards.test.ts
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ClientStatus = 'setup' | 'active' | 'paused' | 'churned'
export type ActivationMode = 'stripe' | 'trial' | 'trial_convert'

export interface ClientRowForGuard {
  status: ClientStatus
  activation_log: Record<string, unknown> | null
  stripe_subscription_id: string | null
  trial_expires_at: string | null
  trial_converted: boolean | null
}

export interface ActivationGuardResult {
  allowed: boolean
  reason: string
  alreadyActivated?: boolean
}

// ── Idempotency guard ────────────────────────────────────────────────────────

/**
 * Check if this client has already been activated (same mode).
 * Prevents duplicate emails, SMS, Twilio purchases on Stripe webhook retries.
 *
 * Returns { allowed: false, alreadyActivated: true } if activation already completed.
 */
export function checkIdempotency(
  client: ClientRowForGuard,
  mode: ActivationMode
): ActivationGuardResult {
  // If status is active AND activation_log exists, this is a repeat activation
  if (client.status === 'active' && client.activation_log !== null) {
    // Exception: trial_convert is allowed on an active trial client
    if (mode === 'trial_convert' && client.trial_expires_at && !client.trial_converted) {
      return { allowed: true, reason: 'trial_convert allowed on active trial' }
    }
    return {
      allowed: false,
      reason: `already activated (status=active, activation_log exists)`,
      alreadyActivated: true,
    }
  }

  return { allowed: true, reason: 'not yet activated' }
}

// ── State transition guard ───────────────────────────────────────────────────

/**
 * Validate that the client's current status allows activation.
 *
 * Valid transitions:
 *   setup  → active  (normal activation)
 *   active → active  (trial_convert only — trial client upgrading)
 *
 * Invalid transitions:
 *   paused → active  (needs explicit reactivation, not auto-activation)
 *   churned → active (needs explicit re-onboarding)
 */
export function checkStateTransition(
  client: ClientRowForGuard,
  mode: ActivationMode
): ActivationGuardResult {
  const { status } = client

  // setup → active: always allowed (normal flow)
  if (status === 'setup') {
    return { allowed: true, reason: `setup → active allowed` }
  }

  // active + trial_convert: allowed (upgrading from trial)
  if (status === 'active' && mode === 'trial_convert') {
    if (!client.trial_expires_at) {
      return { allowed: false, reason: 'trial_convert requires trial_expires_at' }
    }
    if (client.trial_converted) {
      return { allowed: false, reason: 'trial already converted' }
    }
    return { allowed: true, reason: 'active trial → trial_convert allowed' }
  }

  // active + stripe/trial: likely a retry — defer to idempotency check
  if (status === 'active') {
    return { allowed: true, reason: 'active — deferred to idempotency check' }
  }

  // paused: not allowed via auto-activation
  if (status === 'paused') {
    return { allowed: false, reason: 'cannot auto-activate a paused client — reactivate manually' }
  }

  // churned: not allowed
  if (status === 'churned') {
    return { allowed: false, reason: 'cannot activate a churned client — re-onboard required' }
  }

  // Unknown status
  return { allowed: false, reason: `unknown client status: ${status}` }
}

// ── Mode validation ──────────────────────────────────────────────────────────

/**
 * Validate that the activation mode is compatible with the client state.
 */
export function validateActivationMode(
  mode: ActivationMode,
  client: ClientRowForGuard
): ActivationGuardResult {
  if (mode === 'trial_convert') {
    if (!client.trial_expires_at) {
      return { allowed: false, reason: 'trial_convert but client has no trial_expires_at' }
    }
    if (client.trial_converted) {
      return { allowed: false, reason: 'trial already converted' }
    }
  }

  if (mode === 'trial' && client.status === 'active') {
    return { allowed: false, reason: 'cannot start trial on already-active client' }
  }

  return { allowed: true, reason: 'mode valid' }
}

// ── Combined pre-activation check ────────────────────────────────────────────

/**
 * Run all guards in order. Returns the first failure, or { allowed: true }.
 */
export function runActivationGuards(
  client: ClientRowForGuard,
  mode: ActivationMode
): ActivationGuardResult {
  // 1. Mode validation
  const modeCheck = validateActivationMode(mode, client)
  if (!modeCheck.allowed) return modeCheck

  // 2. State transition
  const stateCheck = checkStateTransition(client, mode)
  if (!stateCheck.allowed) return stateCheck

  // 3. Idempotency
  const idempCheck = checkIdempotency(client, mode)
  if (!idempCheck.allowed) return idempCheck

  return { allowed: true, reason: 'all guards passed' }
}

// ── Reserved number expiry ───────────────────────────────────────────────────

const RESERVATION_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check if a number reservation has expired.
 */
export function isReservationExpired(reservedAt: string | null, nowMs?: number): boolean {
  if (!reservedAt) return true
  const reservedMs = new Date(reservedAt).getTime()
  if (isNaN(reservedMs)) return true
  const now = nowMs ?? Date.now()
  return now - reservedMs > RESERVATION_EXPIRY_MS
}

// ── Activation step result tracking ──────────────────────────────────────────

export type ActivationStepName =
  | 'twilio_assign'
  | 'twilio_purchase'
  | 'auth_user'
  | 'welcome_email'
  | 'onboarding_sms'
  | 'client_update'
  | 'intake_update'
  | 'knowledge_docs'
  | 'faq_persist'
  | 'telegram_alert'
  | 'activation_log'

export interface StepResult {
  step: ActivationStepName
  ok: boolean
  error?: string
  skipped?: boolean
  skipReason?: string
}

/**
 * Check if any critical step failed. Critical steps are those that mean
 * the client cannot function without them.
 */
export function hasCriticalFailure(steps: StepResult[], mode: ActivationMode): boolean {
  // For non-trial modes, Twilio number is critical
  if (mode !== 'trial') {
    const twilioStep = steps.find(s => s.step === 'twilio_assign' || s.step === 'twilio_purchase')
    if (twilioStep && !twilioStep.ok && !twilioStep.skipped) return true
  }

  // client_update is always critical
  const clientUpdate = steps.find(s => s.step === 'client_update')
  if (clientUpdate && !clientUpdate.ok) return true

  return false
}

/**
 * Summarize step results into a compact object for the activation_log.
 */
export function summarizeSteps(steps: StepResult[]): Record<string, string> {
  const summary: Record<string, string> = {}
  for (const s of steps) {
    if (s.skipped) {
      summary[s.step] = `skipped: ${s.skipReason ?? 'n/a'}`
    } else if (s.ok) {
      summary[s.step] = 'ok'
    } else {
      summary[s.step] = `failed: ${s.error ?? 'unknown'}`
    }
  }
  return summary
}
