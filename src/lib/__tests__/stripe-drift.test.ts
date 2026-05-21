/**
 * stripe-drift.test.ts — unit tests for the comparison logic in stripe-drift.ts.
 *
 * Mocks Stripe responses with stub projections (StripeSubProjection /
 * StripeCustomerProjection). No live key, no SDK, no network — pure rules.
 *
 * Run: npx tsx --test src/lib/__tests__/stripe-drift.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkClient,
  checkOrphanActiveSubs,
  exitCodeForFindings,
  type DbClientForStripeCheck,
  type StripeSnapshotForClient,
  type StripeSubLookup,
  type StripeCustomerLookup,
} from '../stripe-drift.js'

const NOW = Date.UTC(2026, 4, 20) // 2026-05-20 (UTC)

function client(overrides: Partial<DbClientForStripeCheck> = {}): DbClientForStripeCheck {
  return {
    id: 'cl_test',
    slug: 'acme',
    subscription_status: 'active',
    stripe_subscription_id: 'sub_123',
    stripe_customer_id: 'cus_123',
    selected_plan: 'core',
    ...overrides,
  }
}

function subFound(overrides: { status?: string; trial_end?: number | null; customer_id?: string | null; id?: string } = {}): StripeSubLookup {
  return {
    kind: 'found',
    sub: {
      id: overrides.id ?? 'sub_123',
      status: overrides.status ?? 'active',
      trial_end: overrides.trial_end ?? null,
      customer_id: overrides.customer_id ?? 'cus_123',
    },
  }
}

function customerFound(deleted = false): StripeCustomerLookup {
  return { kind: 'found', customer: { id: 'cus_123', deleted } }
}

function findingCheck(name: string, list: ReturnType<typeof checkClient>): boolean {
  return list.some(f => f.check_name === name)
}

describe('checkClient — stripe_customer_deleted (P0)', () => {
  test('fires when Stripe customer has deleted=true', () => {
    const out = checkClient(client(), { sub: subFound(), customer: customerFound(true) }, NOW)
    assert.ok(findingCheck('stripe_customer_deleted', out))
    const f = out.find(x => x.check_name === 'stripe_customer_deleted')!
    assert.equal(f.severity, 'P0')
    assert.equal(f.client_slug, 'acme')
  })

  test('fires on hard 404 (customer fully purged)', () => {
    const snap: StripeSnapshotForClient = { sub: subFound(), customer: { kind: 'not_found' } }
    const out = checkClient(client(), snap, NOW)
    const f = out.find(x => x.check_name === 'stripe_customer_deleted')!
    assert.ok(f)
    assert.equal(f.details.not_found, true)
  })

  test('does NOT fire when customer is live', () => {
    const out = checkClient(client(), { sub: subFound(), customer: customerFound(false) }, NOW)
    assert.equal(findingCheck('stripe_customer_deleted', out), false)
  })

  test('does NOT fire when DB has no stripe_customer_id', () => {
    const out = checkClient(
      client({ stripe_customer_id: null }),
      { sub: subFound(), customer: null },
      NOW,
    )
    assert.equal(findingCheck('stripe_customer_deleted', out), false)
  })
})

describe('checkClient — stripe_sub_missing (P0)', () => {
  test('fires on Stripe 404 for the subscription', () => {
    const snap: StripeSnapshotForClient = { sub: { kind: 'not_found' }, customer: customerFound() }
    const out = checkClient(client(), snap, NOW)
    const f = out.find(x => x.check_name === 'stripe_sub_missing')!
    assert.ok(f)
    assert.equal(f.severity, 'P0')
    assert.equal(f.details.stripe_subscription_id, 'sub_123')
  })

  test('does NOT fire on transient error (kind=error)', () => {
    // Errors are surfaced separately in script; the rule layer must not
    // misreport a network blip as a missing sub.
    const snap: StripeSnapshotForClient = {
      sub: { kind: 'error', message: 'ETIMEDOUT' },
      customer: customerFound(),
    }
    const out = checkClient(client(), snap, NOW)
    assert.equal(findingCheck('stripe_sub_missing', out), false)
  })

  test('does NOT fire when DB has no stripe_subscription_id', () => {
    const out = checkClient(
      client({ stripe_subscription_id: null }),
      { sub: null, customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_sub_missing', out), false)
  })
})

describe('checkClient — stripe_status_mismatch (P0)', () => {
  for (const dbStatus of ['active', 'trialing', 'past_due'] as const) {
    for (const stripeStatus of ['canceled', 'incomplete_expired', 'unpaid', 'paused'] as const) {
      test(`fires when DB=${dbStatus} but Stripe=${stripeStatus} (silent revenue leak)`, () => {
        const out = checkClient(
          client({ subscription_status: dbStatus }),
          { sub: subFound({ status: stripeStatus }), customer: customerFound() },
          NOW,
        )
        const f = out.find(x => x.check_name === 'stripe_status_mismatch')!
        assert.ok(f, `expected stripe_status_mismatch when DB=${dbStatus} Stripe=${stripeStatus}`)
        assert.equal(f.severity, 'P0')
        assert.equal(f.details.db_subscription_status, dbStatus)
        assert.equal(f.details.stripe_subscription_status, stripeStatus)
      })
    }
  }

  test('does NOT fire when DB=active and Stripe=active', () => {
    const out = checkClient(
      client({ subscription_status: 'active' }),
      { sub: subFound({ status: 'active' }), customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_status_mismatch', out), false)
  })

  test('does NOT fire when DB already shows canceled (caught up)', () => {
    const out = checkClient(
      client({ subscription_status: 'canceled' }),
      { sub: subFound({ status: 'canceled' }), customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_status_mismatch', out), false)
  })
})

describe('checkClient — stripe_trial_converted_db_still_trialing (P0)', () => {
  test('fires when DB=trialing but Stripe=active with trial_end in past', () => {
    const trialEnd = Math.floor((NOW - 10 * 24 * 60 * 60 * 1000) / 1000) // 10d ago
    const out = checkClient(
      client({ subscription_status: 'trialing' }),
      { sub: subFound({ status: 'active', trial_end: trialEnd }), customer: customerFound() },
      NOW,
    )
    const f = out.find(x => x.check_name === 'stripe_trial_converted_db_still_trialing')!
    assert.ok(f)
    assert.equal(f.severity, 'P0')
  })

  test('does NOT fire when trial_end is still in the future', () => {
    const trialEnd = Math.floor((NOW + 3 * 24 * 60 * 60 * 1000) / 1000) // 3d ahead
    const out = checkClient(
      client({ subscription_status: 'trialing' }),
      { sub: subFound({ status: 'trialing', trial_end: trialEnd }), customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_trial_converted_db_still_trialing', out), false)
  })

  test('does NOT fire when DB already shows active (caught up)', () => {
    const trialEnd = Math.floor((NOW - 10 * 24 * 60 * 60 * 1000) / 1000)
    const out = checkClient(
      client({ subscription_status: 'active' }),
      { sub: subFound({ status: 'active', trial_end: trialEnd }), customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_trial_converted_db_still_trialing', out), false)
  })
})

describe('checkClient — stripe_past_due_db_active (P1)', () => {
  test('fires when Stripe=past_due but DB=active', () => {
    const out = checkClient(
      client({ subscription_status: 'active' }),
      { sub: subFound({ status: 'past_due' }), customer: customerFound() },
      NOW,
    )
    const f = out.find(x => x.check_name === 'stripe_past_due_db_active')!
    assert.ok(f)
    assert.equal(f.severity, 'P1')
  })

  test('does NOT fire when DB already shows past_due (caught up)', () => {
    const out = checkClient(
      client({ subscription_status: 'past_due' }),
      { sub: subFound({ status: 'past_due' }), customer: customerFound() },
      NOW,
    )
    assert.equal(findingCheck('stripe_past_due_db_active', out), false)
  })
})

describe('checkClient — clean case', () => {
  test('returns zero findings when DB and Stripe agree on active', () => {
    const out = checkClient(client(), { sub: subFound(), customer: customerFound() }, NOW)
    assert.deepEqual(out, [])
  })

  test('returns zero findings when client has no Stripe linkage at all', () => {
    const out = checkClient(
      client({ stripe_subscription_id: null, stripe_customer_id: null, subscription_status: 'expired' }),
      { sub: null, customer: null },
      NOW,
    )
    assert.deepEqual(out, [])
  })
})

describe('checkOrphanActiveSubs', () => {
  test('reports a Stripe-active sub whose customer is unknown to DB', () => {
    const stripeSubs = [
      { id: 'sub_orphan', customer_id: 'cus_ghost', status: 'active', metadata_slug: 'mystery-co' },
    ]
    const out = checkOrphanActiveSubs(stripeSubs, new Set(), new Set())
    assert.equal(out.length, 1)
    assert.equal(out[0].check_name, 'stripe_orphan_active_sub')
    assert.equal(out[0].severity, 'P1')
    assert.equal(out[0].client_slug, 'mystery-co')
  })

  test('skips subs whose id is in dbStripeSubIds', () => {
    const stripeSubs = [
      { id: 'sub_known', customer_id: 'cus_x', status: 'active', metadata_slug: 'acme' },
    ]
    const out = checkOrphanActiveSubs(stripeSubs, new Set(['sub_known']), new Set())
    assert.equal(out.length, 0)
  })

  test('skips subs whose customer is in dbStripeCustomerIds', () => {
    const stripeSubs = [
      { id: 'sub_other', customer_id: 'cus_known', status: 'active', metadata_slug: 'acme' },
    ]
    const out = checkOrphanActiveSubs(stripeSubs, new Set(), new Set(['cus_known']))
    assert.equal(out.length, 0)
  })

  test('handles null metadata_slug (returns null client_slug)', () => {
    const stripeSubs = [
      { id: 'sub_orphan2', customer_id: 'cus_z', status: 'active', metadata_slug: null },
    ]
    const out = checkOrphanActiveSubs(stripeSubs, new Set(), new Set())
    assert.equal(out.length, 1)
    assert.equal(out[0].client_slug, null)
  })
})

describe('exitCodeForFindings', () => {
  test('returns 0 for no findings', () => {
    assert.equal(exitCodeForFindings([]), 0)
  })

  test('returns 1 when any P0 present', () => {
    const out = exitCodeForFindings([
      { check_name: 'x', severity: 'P0', client_slug: 'a', summary: '', details: {} },
      { check_name: 'y', severity: 'P1', client_slug: 'b', summary: '', details: {} },
    ])
    assert.equal(out, 1)
  })

  test('returns 2 when only P1 present', () => {
    const out = exitCodeForFindings([
      { check_name: 'y', severity: 'P1', client_slug: 'b', summary: '', details: {} },
    ])
    assert.equal(out, 2)
  })
})

describe('checkClient — composite scenarios (realistic webhook-miss cases)', () => {
  test('portal-cancel scenario: DB active, Stripe canceled, customer alive — exactly one finding', () => {
    // Common case: customer cancels in Stripe Customer Portal,
    // customer.subscription.deleted webhook is dropped/errors.
    const out = checkClient(
      client({ subscription_status: 'active' }),
      { sub: subFound({ status: 'canceled' }), customer: customerFound(false) },
      NOW,
    )
    assert.equal(out.length, 1)
    assert.equal(out[0].check_name, 'stripe_status_mismatch')
  })

  test('deleted-customer scenario: DB active, Stripe customer deleted, sub also 404 — fires both customer + sub findings', () => {
    const out = checkClient(
      client(),
      { sub: { kind: 'not_found' }, customer: { kind: 'not_found' } },
      NOW,
    )
    const names = out.map(f => f.check_name).sort()
    assert.deepEqual(names, ['stripe_customer_deleted', 'stripe_sub_missing'])
  })
})
