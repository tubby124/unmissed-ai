/**
 * Shared rate limiter for public API routes.
 * 60 requests per IP per minute — generous for legitimate use, blocks abuse.
 */
import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const publicLimiter = new SlidingWindowRateLimiter(60, 60_000)

/**
 * Check rate limit for a public request. Returns a 429 response if exceeded,
 * or null if the request is allowed.
 */
export function checkPublicRateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const key = `pub:${ip}`
  const { allowed, retryAfterMs } = publicLimiter.check(key)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    )
  }
  publicLimiter.record(key)
  return null
}
