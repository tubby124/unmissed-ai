import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveWebsiteApproveSourceUrl } from '../website-source-attribution'

describe('resolveWebsiteApproveSourceUrl', () => {
  test('uses explicit sourceUrl when it matches a known website source', () => {
    const result = resolveWebsiteApproveSourceUrl({
      bodySourceUrl: 'https://example.com/service',
      primaryWebsiteUrl: 'https://example.com',
      knownSourceUrls: ['https://example.com', 'https://example.com/service'],
    })

    assert.deepEqual(result, { ok: true, sourceUrl: 'https://example.com/service' })
  })

  test('rejects explicit sourceUrl that is not registered for the client', () => {
    const result = resolveWebsiteApproveSourceUrl({
      bodySourceUrl: 'https://other.test',
      primaryWebsiteUrl: 'https://example.com',
      knownSourceUrls: ['https://example.com'],
    })

    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /must match/)
  })

  test('requires sourceUrl when multiple website sources exist', () => {
    const result = resolveWebsiteApproveSourceUrl({
      primaryWebsiteUrl: 'https://example.com',
      knownSourceUrls: ['https://example.com', 'https://example.com/service'],
    })

    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /multiple website sources/)
  })

  test('falls back for legacy single-source callers', () => {
    const result = resolveWebsiteApproveSourceUrl({
      primaryWebsiteUrl: 'https://example.com',
      knownSourceUrls: ['https://example.com'],
    })

    assert.deepEqual(result, { ok: true, sourceUrl: 'https://example.com' })
  })

  test('falls back to client website_url when no source registry row exists yet', () => {
    const result = resolveWebsiteApproveSourceUrl({
      primaryWebsiteUrl: 'https://example.com',
      knownSourceUrls: [],
    })

    assert.deepEqual(result, { ok: true, sourceUrl: 'https://example.com' })
  })
})
