type StripeEnv = {
  NODE_ENV?: string
  RAILWAY_ENVIRONMENT?: string
  VERCEL_ENV?: string
  ALLOW_LIVE_STRIPE_LOCAL?: string
  STRIPE_SECRET_KEY?: string
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
}

type StripeMode = 'live' | 'test' | null

function stripeMode(key: string | undefined, livePrefix: string, testPrefix: string): StripeMode {
  if (!key) return null
  if (key.startsWith(livePrefix)) return 'live'
  if (key.startsWith(testPrefix)) return 'test'
  return null
}

export function isProductionRuntime(env: StripeEnv = process.env): boolean {
  return (
    env.NODE_ENV === 'production' ||
    env.RAILWAY_ENVIRONMENT === 'production' ||
    env.VERCEL_ENV === 'production'
  )
}

export function assertStripeEnvSafety(env: StripeEnv = process.env): void {
  const secretMode = stripeMode(env.STRIPE_SECRET_KEY, 'sk_live_', 'sk_test_')
  const publishableMode = stripeMode(
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    'pk_live_',
    'pk_test_',
  )

  if (secretMode && publishableMode && secretMode !== publishableMode) {
    throw new Error(
      `[env-check] FATAL: Stripe secret key is ${secretMode} but publishable key is ${publishableMode}`,
    )
  }

  if (
    secretMode === 'live' &&
    !isProductionRuntime(env) &&
    env.ALLOW_LIVE_STRIPE_LOCAL !== 'true'
  ) {
    throw new Error(
      '[env-check] FATAL: Live Stripe secret key detected outside production. Use sk_test locally or set ALLOW_LIVE_STRIPE_LOCAL=true for an intentional operator run.',
    )
  }
}
