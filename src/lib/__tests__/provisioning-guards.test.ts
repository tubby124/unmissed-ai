/**
 * provisioning-guards.test.ts — Phase 6: Provisioning Hardening
 *
 * Tests for idempotency, state transitions, mode validation,
 * reserved number expiry, and step result tracking.
 *
 * Run: npx tsx --test src/lib/__tests__/provisioning-guards.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkIdempotency,
  checkStateTransition,
  validateActivationMode,
  runActivationGuards,
  isReservationExpired,
  hasCriticalFailure,
  summarizeSteps,
  type ClientRowForGuard,
  type ActivationMode,
  type StepResult,
} from '../provisioning-guards.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<ClientRowForGuard> = {}): ClientRowForGuard {
  return {
    status: 'setup',
    activation_log: null,
    stripe_subscription_id: null,
    trial_expires_at: null,
    trial_converted: null,
    ...overrides,
  }
}

// ── checkIdempotency ─────────────────────────────────────────────────────────

describe('checkIdempotency', () => {
  test('allows activation when status=setup', () => {
    const r = checkIdempotency(makeClient({ status: 'setup' }), 'stripe')
    assert.equal(r.allowed, true)
  })

  test('allows activation when status=active but no activation_log', () => {
    const r = checkIdempotency(makeClient({ status: 'active', activation_log: null }), 'stripe')
    assert.equal(r.allowed, true)
  })

  test('blocks repeat activation (status=active + activation_log present)', () => {
    const r = checkIdempotency(
      makeClient({ status: 'active', activation_log: { activated_at: '2026-01-01' } }),
      'stripe'
    )
    assert.equal(r.allowed, false)
    assert.equal(r.alreadyActivated, true)
    assert.ok(r.reason.includes('already activated'))
  })

  test('blocks repeat trial activation', () => {
    const r = checkIdempotency(
      makeClient({ status: 'active', activation_log: { mode: 'trial' } }),
      'trial'
    )
    assert.equal(r.allowed, false)
    assert.equal(r.alreadyActivated, true)
  })

  test('allows trial_convert on active trial client even with activation_log', () => {
    const r = checkIdempotency(
      makeClient({
        status: 'active',
        activation_log: { mode: 'trial' },
        trial_expires_at: '2026-04-01T00:00:00Z',
        trial_converted: null,
      }),
      'trial_convert'
    )
    assert.equal(r.allowed, true)
    assert.ok(r.reason.includes('trial_convert allowed'))
  })

  test('blocks trial_convert if trial already converted', () => {
    const r = checkIdempotency(
      makeClient({
        status: 'active',
        activation_log: { mode: 'trial' },
        trial_expires_at: '2026-04-01T00:00:00Z',
        trial_converted: true,
      }),
      'trial_convert'
    )
    assert.equal(r.allowed, false)
    assert.equal(r.alreadyActivated, true)
  })
})

// ── checkStateTransition ─────────────────────────────────────────────────────

describe('checkStateTransition', () => {
  test('setup → active: stripe allowed', () => {
    const r = checkStateTransition(makeClient({ status: 'setup' }), 'stripe')
    assert.equal(r.allowed, true)
  })

  test('setup → active: trial allowed', () => {
    const r = checkStateTransition(makeClient({ status: 'setup' }), 'trial')
    assert.equal(r.allowed, true)
  })

  test('active + trial_convert: allowed with trial_expires_at', () => {
    const r = checkStateTransition(
      makeClient({ status: 'active', trial_expires_at: '2026-04-01T00:00:00Z' }),
      'trial_convert'
    )
    assert.equal(r.allowed, true)
  })

  test('active + trial_convert: blocked without trial_expires_at', () => {
    const r = checkStateTransition(makeClient({ status: 'active' }), 'trial_convert')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('trial_expires_at'))
  })

  test('active + trial_convert: blocked if already converted', () => {
    const r = checkStateTransition(
      makeClient({ status: 'active', trial_expires_at: '2026-04-01', trial_converted: true }),
      'trial_convert'
    )
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('already converted'))
  })

  test('paused: blocked', () => {
    const r = checkStateTransition(makeClient({ status: 'paused' }), 'stripe')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('paused'))
  })

  test('churned: blocked', () => {
    const r = checkStateTransition(makeClient({ status: 'churned' }), 'stripe')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('churned'))
  })

  test('active + stripe: defers to idempotency', () => {
    const r = checkStateTransition(makeClient({ status: 'active' }), 'stripe')
    assert.equal(r.allowed, true)
    assert.ok(r.reason.includes('idempotency'))
  })
})

// ── validateActivationMode ───────────────────────────────────────────────────

describe('validateActivationMode', () => {
  test('stripe on setup: valid', () => {
    const r = validateActivationMode('stripe', makeClient({ status: 'setup' }))
    assert.equal(r.allowed, true)
  })

  test('trial on setup: valid', () => {
    const r = validateActivationMode('trial', makeClient({ status: 'setup' }))
    assert.equal(r.allowed, true)
  })

  test('trial on active: invalid', () => {
    const r = validateActivationMode('trial', makeClient({ status: 'active' }))
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('cannot start trial'))
  })

  test('trial_convert without trial_expires_at: invalid', () => {
    const r = validateActivationMode('trial_convert', makeClient({ status: 'active' }))
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('no trial_expires_at'))
  })

  test('trial_convert with trial_expires_at: valid', () => {
    const r = validateActivationMode(
      'trial_convert',
      makeClient({ status: 'active', trial_expires_at: '2026-04-01' })
    )
    assert.equal(r.allowed, true)
  })

  test('trial_convert already converted: invalid', () => {
    const r = validateActivationMode(
      'trial_convert',
      makeClient({ status: 'active', trial_expires_at: '2026-04-01', trial_converted: true })
    )
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('already converted'))
  })
})

// ── runActivationGuards (combined) ───────────────────────────────────────────

describe('runActivationGuards', () => {
  test('normal stripe activation: all pass', () => {
    const r = runActivationGuards(makeClient({ status: 'setup' }), 'stripe')
    assert.equal(r.allowed, true)
    assert.ok(r.reason.includes('all guards passed'))
  })

  test('normal trial activation: all pass', () => {
    const r = runActivationGuards(makeClient({ status: 'setup' }), 'trial')
    assert.equal(r.allowed, true)
  })

  test('trial_convert on valid trial client: all pass', () => {
    const r = runActivationGuards(
      makeClient({ status: 'active', trial_expires_at: '2026-04-01', activation_log: { mode: 'trial' } }),
      'trial_convert'
    )
    assert.equal(r.allowed, true)
  })

  test('repeat stripe on already-activated client: blocked by idempotency', () => {
    const r = runActivationGuards(
      makeClient({ status: 'active', activation_log: { mode: 'stripe' } }),
      'stripe'
    )
    assert.equal(r.allowed, false)
    assert.equal(r.alreadyActivated, true)
  })

  test('stripe on paused client: blocked by state transition', () => {
    const r = runActivationGuards(makeClient({ status: 'paused' }), 'stripe')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('paused'))
  })

  test('trial on active client: blocked by mode validation', () => {
    const r = runActivationGuards(makeClient({ status: 'active' }), 'trial')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('cannot start trial'))
  })

  test('trial_convert without trial: blocked by mode validation', () => {
    const r = runActivationGuards(makeClient({ status: 'active' }), 'trial_convert')
    assert.equal(r.allowed, false)
  })

  test('churned client: blocked regardless of mode', () => {
    for (const mode of ['stripe', 'trial', 'trial_convert'] as ActivationMode[]) {
      const r = runActivationGuards(makeClient({ status: 'churned' }), mode)
      assert.equal(r.allowed, false, `should block mode=${mode} on churned`)
    }
  })
})

// ── isReservationExpired ─────────────────────────────────────────────────────

describe('isReservationExpired', () => {
  const thirtyOneMinAgo = Date.now() - 31 * 60 * 1000
  const twentyNineMinAgo = Date.now() - 29 * 60 * 1000

  test('null reserved_at → expired', () => {
    assert.equal(isReservationExpired(null), true)
  })

  test('invalid date string → expired', () => {
    assert.equal(isReservationExpired('not-a-date'), true)
  })

  test('31 minutes ago → expired', () => {
    assert.equal(isReservationExpired(new Date(thirtyOneMinAgo).toISOString()), true)
  })

  test('29 minutes ago → not expired', () => {
    assert.equal(isReservationExpired(new Date(twentyNineMinAgo).toISOString()), false)
  })

  test('just now → not expired', () => {
    assert.equal(isReservationExpired(new Date().toISOString()), false)
  })

  test('custom now parameter works', () => {
    const reservedAt = '2026-03-18T10:00:00Z'
    const nowBefore = new Date('2026-03-18T10:25:00Z').getTime() // 25 min later
    const nowAfter = new Date('2026-03-18T10:31:00Z').getTime()  // 31 min later
    assert.equal(isReservationExpired(reservedAt, nowBefore), false)
    assert.equal(isReservationExpired(reservedAt, nowAfter), true)
  })
})

// ── hasCriticalFailure ───────────────────────────────────────────────────────

describe('hasCriticalFailure', () => {
  test('no steps → no failure', () => {
    assert.equal(hasCriticalFailure([], 'stripe'), false)
  })

  test('all ok → no failure', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: true },
      { step: 'auth_user', ok: true },
      { step: 'client_update', ok: true },
    ]
    assert.equal(hasCriticalFailure(steps, 'stripe'), false)
  })

  test('twilio_purchase failed on stripe mode → critical', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: false, error: 'no numbers available' },
      { step: 'client_update', ok: true },
    ]
    assert.equal(hasCriticalFailure(steps, 'stripe'), true)
  })

  test('twilio_assign failed on trial_convert → critical', () => {
    const steps: StepResult[] = [
      { step: 'twilio_assign', ok: false, error: 'PATCH failed' },
      { step: 'client_update', ok: true },
    ]
    assert.equal(hasCriticalFailure(steps, 'trial_convert'), true)
  })

  test('twilio skipped on trial mode → NOT critical', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: false, skipped: true, skipReason: 'trial mode' },
      { step: 'client_update', ok: true },
    ]
    assert.equal(hasCriticalFailure(steps, 'trial'), false)
  })

  test('client_update failed → always critical', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: true },
      { step: 'client_update', ok: false, error: 'DB error' },
    ]
    assert.equal(hasCriticalFailure(steps, 'stripe'), true)
    assert.equal(hasCriticalFailure(steps, 'trial'), true)
  })

  test('non-critical step failed → not critical', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: true },
      { step: 'client_update', ok: true },
      { step: 'welcome_email', ok: false, error: 'Resend timeout' },
      { step: 'onboarding_sms', ok: false, error: 'Twilio rate limit' },
      { step: 'telegram_alert', ok: false, error: 'bot token invalid' },
    ]
    assert.equal(hasCriticalFailure(steps, 'stripe'), false)
  })
})

// ── summarizeSteps ───────────────────────────────────────────────────────────

describe('summarizeSteps', () => {
  test('mixed results summarized correctly', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: true },
      { step: 'auth_user', ok: true },
      { step: 'welcome_email', ok: false, error: 'Resend timeout' },
      { step: 'onboarding_sms', ok: false, skipped: true, skipReason: 'no callback phone' },
      { step: 'client_update', ok: true },
    ]
    const summary = summarizeSteps(steps)
    assert.equal(summary.twilio_purchase, 'ok')
    assert.equal(summary.auth_user, 'ok')
    assert.ok(summary.welcome_email.includes('failed'))
    assert.ok(summary.welcome_email.includes('Resend timeout'))
    assert.ok(summary.onboarding_sms.includes('skipped'))
    assert.ok(summary.onboarding_sms.includes('no callback phone'))
    assert.equal(summary.client_update, 'ok')
  })

  test('empty steps → empty summary', () => {
    assert.deepEqual(summarizeSteps([]), {})
  })

  test('all ok → all marked ok', () => {
    const steps: StepResult[] = [
      { step: 'twilio_purchase', ok: true },
      { step: 'client_update', ok: true },
    ]
    const summary = summarizeSteps(steps)
    assert.equal(Object.values(summary).every(v => v === 'ok'), true)
  })
})

// ── Edge cases and compound scenarios ────────────────────────────────────────

describe('compound scenarios', () => {
  test('Stripe webhook retry scenario: second call blocked', () => {
    // First activation succeeds → client is active with activation_log
    const clientAfterFirstActivation = makeClient({
      status: 'active',
      activation_log: { mode: 'stripe', activated_at: '2026-03-18' },
      stripe_subscription_id: 'sub_abc123',
    })
    const r = runActivationGuards(clientAfterFirstActivation, 'stripe')
    assert.equal(r.allowed, false)
    assert.equal(r.alreadyActivated, true)
  })

  test('Trial → trial_convert lifecycle', () => {
    // Step 1: Trial starts on setup client
    const setupClient = makeClient({ status: 'setup' })
    assert.equal(runActivationGuards(setupClient, 'trial').allowed, true)

    // Step 2: After trial activation, client is active with trial fields
    const trialClient = makeClient({
      status: 'active',
      activation_log: { mode: 'trial' },
      trial_expires_at: '2026-04-01T00:00:00Z',
      trial_converted: null,
    })
    // Cannot re-trial
    assert.equal(runActivationGuards(trialClient, 'trial').allowed, false)
    // Can convert
    assert.equal(runActivationGuards(trialClient, 'trial_convert').allowed, true)

    // Step 3: After conversion
    const convertedClient = makeClient({
      status: 'active',
      activation_log: { mode: 'trial_convert' },
      trial_expires_at: '2026-04-01T00:00:00Z',
      trial_converted: true,
      stripe_subscription_id: 'sub_converted',
    })
    // Cannot convert again
    assert.equal(runActivationGuards(convertedClient, 'trial_convert').allowed, false)
    // Cannot stripe-activate again
    assert.equal(runActivationGuards(convertedClient, 'stripe').allowed, false)
  })

  test('Paused client cannot be auto-activated by any mode', () => {
    const pausedClient = makeClient({ status: 'paused' })
    assert.equal(runActivationGuards(pausedClient, 'stripe').allowed, false)
    assert.equal(runActivationGuards(pausedClient, 'trial').allowed, false)
    // trial_convert on paused fails mode validation (no trial_expires_at)
    assert.equal(runActivationGuards(pausedClient, 'trial_convert').allowed, false)
  })
})
