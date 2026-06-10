import { isProduction } from '@/lib/environment'

export function checkToolSecret(headerValue: string | null): string | null {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) {
    return isProduction() ? 'Tool secret is not configured' : null
  }
  if (headerValue !== secret) return 'Forbidden'
  return null
}
