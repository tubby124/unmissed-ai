import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { assertStripeEnvSafety, isProductionRuntime } from '../stripe-env-guard'

describe('stripe env guard', () => {
  test('blocks live Stripe secret keys outside production by default', () => {
    assert.throws(
      () =>
        assertStripeEnvSafety({
          NODE_ENV: 'development',
          STRIPE_SECRET_KEY: 'sk_live_123',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
        }),
      /Live Stripe secret key detected outside production/,
    )
  })

  test('allows live Stripe keys in production runtimes', () => {
    assert.doesNotThrow(() =>
      assertStripeEnvSafety({
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_live_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
      }),
    )
  })

  test('allows explicit operator override outside production', () => {
    assert.doesNotThrow(() =>
      assertStripeEnvSafety({
        NODE_ENV: 'development',
        ALLOW_LIVE_STRIPE_LOCAL: 'true',
        STRIPE_SECRET_KEY: 'sk_live_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
      }),
    )
  })

  test('blocks mixed live/test Stripe key pairs', () => {
    assert.throws(
      () =>
        assertStripeEnvSafety({
          NODE_ENV: 'production',
          STRIPE_SECRET_KEY: 'sk_live_123',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        }),
      /secret key is live but publishable key is test/,
    )
  })

  test('detects Railway and Vercel production runtime flags', () => {
    assert.equal(isProductionRuntime({ RAILWAY_ENVIRONMENT: 'production' }), true)
    assert.equal(isProductionRuntime({ VERCEL_ENV: 'production' }), true)
    assert.equal(isProductionRuntime({ NODE_ENV: 'development' }), false)
  })
})
