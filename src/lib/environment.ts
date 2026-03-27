/**
 * Environment detection helpers.
 *
 * Provides clean staging/production/dev separation so code can
 * make environment-aware decisions without scattered process.env checks.
 *
 * Railway sets RAILWAY_ENVIRONMENT_NAME. Local dev uses NODE_ENV.
 * Staging detection: RAILWAY_ENVIRONMENT_NAME === 'staging' or NODE_ENV === 'staging'.
 */

/** Current environment name, normalized. */
export function getEnvironment(): 'production' | 'staging' | 'development' {
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase()
  if (railwayEnv === 'staging') return 'staging'
  if (railwayEnv === 'production') return 'production'

  const nodeEnv = process.env.NODE_ENV?.toLowerCase()
  if (nodeEnv === 'production') return 'production'
  if (nodeEnv === 'staging') return 'staging'

  return 'development'
}

export const isProduction = () => getEnvironment() === 'production'
export const isStaging = () => getEnvironment() === 'staging'
export const isDevelopment = () => getEnvironment() === 'development'

/**
 * Guard for dangerous operations that should not run in production
 * unless explicitly confirmed. Use in admin routes (delete, sync-all, etc.).
 *
 * Returns true if the operation is safe to proceed.
 * In production: requires `confirm_production=true` in the request body.
 * In staging/dev: always returns true.
 */
export function requireProductionConfirmation(body: Record<string, unknown>): boolean {
  if (!isProduction()) return true
  return body.confirm_production === true
}

/**
 * Prefix for log lines — helps distinguish environments in shared log streams.
 */
export function envPrefix(): string {
  const env = getEnvironment()
  if (env === 'production') return ''
  return `[${env.toUpperCase()}] `
}
