import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldRedirectRailwayPublicHost } from '../host-canonicalization.js'

describe('Railway public host canonicalization', () => {
  test('redirects public GET pages on Railway default host', () => {
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/pricing'),
      true
    )
  })

  test('redirects public HEAD requests on Railway default host', () => {
    assert.equal(
      shouldRedirectRailwayPublicHost('HEAD', 'unmissed-ai-production.up.railway.app', '/'),
      true
    )
  })

  test('does not redirect canonical End Voicemail host', () => {
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'endvoicemail.ai', '/pricing'),
      false
    )
  })

  test('does not redirect webhook/API traffic on Railway host', () => {
    assert.equal(
      shouldRedirectRailwayPublicHost('POST', 'unmissed-ai-production.up.railway.app', '/api/webhook/test/inbound'),
      false
    )
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/api/health'),
      false
    )
  })

  test('does not redirect dashboard/auth/assets on Railway host', () => {
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/dashboard'),
      false
    )
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/auth/callback'),
      false
    )
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/_next/image'),
      false
    )
    assert.equal(
      shouldRedirectRailwayPublicHost('GET', 'unmissed-ai-production.up.railway.app', '/robots.txt'),
      false
    )
  })
})
