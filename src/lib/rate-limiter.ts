/**
 * Sliding-window in-memory rate limiter.
 * Resets on deploy (Railway single-instance) — acceptable for abuse prevention.
 * S13e
 */

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>()
  private lastCleanup = Date.now()

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private cleanupIntervalMs = 5 * 60_000,
  ) {}

  /** Check if a request is allowed WITHOUT recording it. */
  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    this.maybeCleanup()
    const now = Date.now()
    const cutoff = now - this.windowMs
    const timestamps = (this.windows.get(key) ?? []).filter((t) => t > cutoff)
    this.windows.set(key, timestamps)

    const remaining = Math.max(0, this.maxRequests - timestamps.length)
    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0]!
      const retryAfterMs = oldest + this.windowMs - now
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) }
    }
    return { allowed: true, remaining, retryAfterMs: 0 }
  }

  /** Record a request (call AFTER check confirms allowed). */
  record(key: string): void {
    const timestamps = this.windows.get(key) ?? []
    timestamps.push(Date.now())
    this.windows.set(key, timestamps)
  }

  /** Prune keys with no timestamps in the current window. */
  private maybeCleanup(): void {
    const now = Date.now()
    if (now - this.lastCleanup < this.cleanupIntervalMs) return
    this.lastCleanup = now
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.windows) {
      const active = timestamps.filter((t) => t > cutoff)
      if (active.length === 0) this.windows.delete(key)
      else this.windows.set(key, active)
    }
  }
}
