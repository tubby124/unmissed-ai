/**
 * Environment variable validation — imported at startup via instrumentation.ts.
 * Fails fast with a clear error if critical env vars are missing.
 * S13h: Prevents runtime crashes from undefined env vars.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ULTRAVOX_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'CRON_SECRET',
] as const

const OPTIONAL_BUT_WARNED = [
  'ADMIN_PASSWORD',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENROUTER_API_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'WEBHOOK_SIGNING_SECRET',       // S13b: per-call callback HMAC — completed route rejects unsigned if set
  'ULTRAVOX_WEBHOOK_SECRET',      // S13b: native Ultravox account-level webhook HMAC
] as const

export function validateEnv() {
  const missing: string[] = []
  const warned: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  for (const key of OPTIONAL_BUT_WARNED) {
    if (!process.env[key]) {
      warned.push(key)
    }
  }

  if (warned.length > 0) {
    console.warn(
      `[env-check] Optional env vars missing (some features disabled): ${warned.join(', ')}`
    )
  }

  if (missing.length > 0) {
    const msg = `[env-check] FATAL: Required env vars missing: ${missing.join(', ')}`
    console.error(msg)
    throw new Error(msg)
  }

  console.log('[env-check] All required environment variables present')
}
