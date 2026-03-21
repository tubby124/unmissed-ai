import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'

// We test the exported functions by importing them after setting env
const TEST_SECRET = 'test-webhook-secret-abc123'

// Dynamic import helper — must set env BEFORE importing the module
async function loadModule() {
  // Clear module cache to pick up fresh env
  const modulePath = require.resolve('../ultravox')
  delete require.cache[modulePath]
  const mod = await import('../ultravox')
  return mod
}

describe('S13b — webhook signing', () => {
  let originalSecret: string | undefined

  beforeEach(() => {
    originalSecret = process.env.WEBHOOK_SIGNING_SECRET
    process.env.WEBHOOK_SIGNING_SECRET = TEST_SECRET
  })

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.WEBHOOK_SIGNING_SECRET = originalSecret
    } else {
      delete process.env.WEBHOOK_SIGNING_SECRET
    }
  })

  describe('signCallbackUrl', () => {
    it('appends sig, nonce, and ts query params', async () => {
      const { signCallbackUrl } = await loadModule()
      const url = signCallbackUrl('https://example.com/api/webhook/test-slug/completed', 'test-slug')
      const parsed = new URL(url)
      assert.ok(parsed.searchParams.has('sig'), 'missing sig param')
      assert.ok(parsed.searchParams.has('nonce'), 'missing nonce param')
      assert.ok(parsed.searchParams.has('ts'), 'missing ts param')
    })

    it('generates unique nonces per call', async () => {
      const { signCallbackUrl } = await loadModule()
      const base = 'https://example.com/api/webhook/test-slug/completed'
      const url1 = new URL(signCallbackUrl(base, 'test-slug'))
      const url2 = new URL(signCallbackUrl(base, 'test-slug'))
      assert.notEqual(
        url1.searchParams.get('nonce'),
        url2.searchParams.get('nonce'),
        'nonces should be unique per invocation'
      )
    })

    it('returns bare URL when no secret configured', async () => {
      delete process.env.WEBHOOK_SIGNING_SECRET
      const { signCallbackUrl } = await loadModule()
      const base = 'https://example.com/api/webhook/test-slug/completed'
      assert.equal(signCallbackUrl(base, 'test-slug'), base)
    })

    it('handles URLs with existing query params', async () => {
      const { signCallbackUrl } = await loadModule()
      const base = 'https://example.com/api/webhook/test-slug/completed?existing=true'
      const url = signCallbackUrl(base, 'test-slug')
      assert.ok(url.includes('existing=true'), 'existing param preserved')
      assert.ok(url.includes('&sig='), 'sig appended with &')
    })
  })

  describe('verifyCallbackSig', () => {
    it('roundtrip: sign then verify succeeds', async () => {
      const { signCallbackUrl, verifyCallbackSig } = await loadModule()
      const base = 'https://example.com/api/webhook/my-slug/completed'
      const signed = new URL(signCallbackUrl(base, 'my-slug'))
      const sig = signed.searchParams.get('sig')!
      const nonce = signed.searchParams.get('nonce')!
      const ts = signed.searchParams.get('ts')!

      const result = verifyCallbackSig('my-slug', sig, nonce, ts)
      assert.equal(result.valid, true, 'roundtrip should verify')
      assert.equal(result.legacy, false, 'should use new format')
    })

    it('rejects tampered sig', async () => {
      const { signCallbackUrl, verifyCallbackSig } = await loadModule()
      const signed = new URL(signCallbackUrl('https://example.com/completed', 'slug-a'))
      const nonce = signed.searchParams.get('nonce')!
      const ts = signed.searchParams.get('ts')!

      const result = verifyCallbackSig('slug-a', 'deadbeef'.repeat(8), nonce, ts)
      assert.equal(result.valid, false, 'tampered sig should fail')
    })

    it('rejects wrong slug', async () => {
      const { signCallbackUrl, verifyCallbackSig } = await loadModule()
      const signed = new URL(signCallbackUrl('https://example.com/completed', 'slug-a'))
      const sig = signed.searchParams.get('sig')!
      const nonce = signed.searchParams.get('nonce')!
      const ts = signed.searchParams.get('ts')!

      const result = verifyCallbackSig('slug-b', sig, nonce, ts)
      assert.equal(result.valid, false, 'wrong slug should fail')
    })

    it('rejects expired timestamp (>30 min)', async () => {
      const { verifyCallbackSig } = await loadModule()
      const oldTs = (Date.now() - 31 * 60 * 1000).toString()
      const nonce = crypto.randomBytes(16).toString('hex')
      const sig = crypto.createHmac('sha256', TEST_SECRET).update(`test:${nonce}:${oldTs}`).digest('hex')

      const result = verifyCallbackSig('test', sig, nonce, oldTs)
      assert.equal(result.valid, false, 'expired timestamp should fail')
    })

    it('accepts timestamp within 30 min window', async () => {
      const { verifyCallbackSig } = await loadModule()
      const recentTs = (Date.now() - 20 * 60 * 1000).toString() // 20 min ago
      const nonce = crypto.randomBytes(16).toString('hex')
      const sig = crypto.createHmac('sha256', TEST_SECRET).update(`test:${nonce}:${recentTs}`).digest('hex')

      const result = verifyCallbackSig('test', sig, nonce, recentTs)
      assert.equal(result.valid, true, 'recent timestamp should pass')
      assert.equal(result.legacy, false)
    })
  })

  describe('legacy format backward compat', () => {
    it('accepts old slug-only HMAC when no nonce/ts', async () => {
      const { verifyCallbackSig } = await loadModule()
      // Old format: HMAC(secret, slug)
      const legacySig = crypto.createHmac('sha256', TEST_SECRET).update('old-slug').digest('hex')

      const result = verifyCallbackSig('old-slug', legacySig, null, null)
      assert.equal(result.valid, true, 'legacy sig should verify')
      assert.equal(result.legacy, true, 'should flag as legacy')
    })

    it('rejects wrong legacy sig', async () => {
      const { verifyCallbackSig } = await loadModule()
      const result = verifyCallbackSig('old-slug', 'badbadbadbad'.repeat(5) + 'aa', null, null)
      assert.equal(result.valid, false, 'wrong legacy sig should fail')
    })
  })

  describe('no secret configured', () => {
    it('verifyCallbackSig returns valid when no secret', async () => {
      delete process.env.WEBHOOK_SIGNING_SECRET
      const { verifyCallbackSig } = await loadModule()
      const result = verifyCallbackSig('any-slug', 'any-sig', 'any-nonce', 'any-ts')
      assert.equal(result.valid, true, 'should pass when no secret configured')
    })
  })
})
