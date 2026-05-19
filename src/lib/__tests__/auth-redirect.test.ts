import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { safeAuthNext } from '../auth-redirect'

describe('safeAuthNext', () => {
  test('allows same-origin relative dashboard paths', () => {
    assert.equal(safeAuthNext('/dashboard/go-live'), '/dashboard/go-live')
    assert.equal(safeAuthNext('/auth/set-password'), '/auth/set-password')
  })

  test('rejects missing or external redirects', () => {
    assert.equal(safeAuthNext(null), '/dashboard')
    assert.equal(safeAuthNext('https://evil.test/dashboard'), '/dashboard')
    assert.equal(safeAuthNext('//evil.test/dashboard'), '/dashboard')
    assert.equal(safeAuthNext('dashboard/go-live'), '/dashboard')
  })

  test('supports explicit fallback for password setup flows', () => {
    assert.equal(safeAuthNext('https://evil.test', '/auth/set-password'), '/auth/set-password')
  })
})
