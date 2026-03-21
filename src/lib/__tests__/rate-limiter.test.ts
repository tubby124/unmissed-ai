import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { SlidingWindowRateLimiter } from '../rate-limiter'

describe('SlidingWindowRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = new SlidingWindowRateLimiter(5, 60_000)
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('slug-a')
      assert.equal(result.allowed, true, `request ${i} should be allowed`)
      assert.equal(result.remaining, 5 - i)
      limiter.record('slug-a')
    }
  })

  it('blocks requests at the limit', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) {
      limiter.check('slug-b')
      limiter.record('slug-b')
    }
    const result = limiter.check('slug-b')
    assert.equal(result.allowed, false)
    assert.equal(result.remaining, 0)
    assert.ok(result.retryAfterMs > 0, 'retryAfterMs should be positive')
  })

  it('different keys are independent', () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000)
    limiter.check('key-1')
    limiter.record('key-1')
    limiter.check('key-1')
    limiter.record('key-1')

    const blocked = limiter.check('key-1')
    assert.equal(blocked.allowed, false)

    const other = limiter.check('key-2')
    assert.equal(other.allowed, true)
    assert.equal(other.remaining, 2)
  })

  it('window slides: old entries expire', async () => {
    const limiter = new SlidingWindowRateLimiter(2, 100) // 100ms window
    limiter.check('slug-c')
    limiter.record('slug-c')
    limiter.check('slug-c')
    limiter.record('slug-c')

    assert.equal(limiter.check('slug-c').allowed, false)

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 150))

    const result = limiter.check('slug-c')
    assert.equal(result.allowed, true, 'should allow after window expires')
    assert.equal(result.remaining, 2)
  })

  it('remaining count is accurate', () => {
    const limiter = new SlidingWindowRateLimiter(5, 60_000)
    assert.equal(limiter.check('slug-d').remaining, 5)
    limiter.record('slug-d')
    assert.equal(limiter.check('slug-d').remaining, 4)
    limiter.record('slug-d')
    assert.equal(limiter.check('slug-d').remaining, 3)
  })

  it('retryAfterMs is 0 when allowed', () => {
    const limiter = new SlidingWindowRateLimiter(5, 60_000)
    assert.equal(limiter.check('slug-e').retryAfterMs, 0)
  })

  it('cleanup removes stale keys', async () => {
    // cleanupInterval = 50ms, window = 50ms
    const limiter = new SlidingWindowRateLimiter(10, 50, 50)
    limiter.check('stale-key')
    limiter.record('stale-key')

    await new Promise((r) => setTimeout(r, 120))

    // Trigger cleanup by checking any key
    limiter.check('trigger')
    // Stale key should be cleaned up — check returns full remaining
    const result = limiter.check('stale-key')
    assert.equal(result.remaining, 10)
  })
})
