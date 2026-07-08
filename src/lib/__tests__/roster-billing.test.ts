import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billingBadge, minutesPct, type RosterBillingInput } from '../roster-billing'

const NOW = new Date('2026-07-07T12:00:00Z').getTime()

function input(overrides: Partial<RosterBillingInput> = {}): RosterBillingInput {
  return {
    status: 'active',
    subscription_status: null,
    effective_monthly_rate: null,
    trial_expires_at: null,
    grace_period_end: null,
    has_stripe: false,
    ...overrides,
  }
}

test('paused status wins over everything', () => {
  const b = billingBadge(input({ status: 'paused', subscription_status: 'active', has_stripe: true }), NOW)
  assert.equal(b.label, 'paused')
})

test('trialing shows days left', () => {
  const b = billingBadge(input({ subscription_status: 'trialing', trial_expires_at: '2026-07-10T12:00:00Z' }), NOW)
  assert.equal(b.label, 'trialing')
  assert.equal(b.detail, '3d left')
})

test('trialing past expiry shows expired', () => {
  const b = billingBadge(input({ subscription_status: 'trialing', trial_expires_at: '2026-07-01T12:00:00Z' }), NOW)
  assert.equal(b.label, 'trialing')
  assert.equal(b.detail, 'expired')
})

test('trialing beats comped even at rate 0', () => {
  const b = billingBadge(input({ subscription_status: 'trialing', effective_monthly_rate: 0 }), NOW)
  assert.equal(b.label, 'trialing')
})

test('past_due shows grace end countdown', () => {
  const b = billingBadge(input({ subscription_status: 'past_due', grace_period_end: '2026-07-12T12:00:00Z' }), NOW)
  assert.equal(b.label, 'past due')
  assert.equal(b.detail, 'grace ends in 5d')
})

test('past_due with elapsed grace shows grace ended', () => {
  const b = billingBadge(input({ subscription_status: 'past_due', grace_period_end: '2026-07-01T12:00:00Z' }), NOW)
  assert.equal(b.detail, 'grace ended')
})

test('active subscription with stripe customer = paying', () => {
  const b = billingBadge(input({ subscription_status: 'active', has_stripe: true, effective_monthly_rate: 149 }), NOW)
  assert.equal(b.label, 'paying')
})

test('active subscription WITHOUT stripe and rate 0 = comped', () => {
  const b = billingBadge(input({ subscription_status: 'active', has_stripe: false, effective_monthly_rate: 0 }), NOW)
  assert.equal(b.label, 'comped')
})

test('active client, no subscription, rate 0 = comped', () => {
  const b = billingBadge(input({ status: 'active', effective_monthly_rate: 0 }), NOW)
  assert.equal(b.label, 'comped')
})

test('active client, no subscription, nonzero rate = none', () => {
  const b = billingBadge(input({ status: 'active', effective_monthly_rate: 49 }), NOW)
  assert.equal(b.label, 'none')
})

test('non-active non-paused status with no billing = none', () => {
  const b = billingBadge(input({ status: 'provisioning' }), NOW)
  assert.equal(b.label, 'none')
})

test('minutesPct basic + null limit', () => {
  assert.equal(minutesPct(50, 100), 50)
  assert.equal(minutesPct(90, 100), 90)
  assert.equal(minutesPct(null, 100), 0)
  assert.equal(minutesPct(50, null), null)
  assert.equal(minutesPct(50, 0), null)
})
