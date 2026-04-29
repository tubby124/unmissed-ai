/**
 * admin-scope.test.ts — Phase 1 helper tests
 *
 * Validates the localStorage persistence layer of the shared scope primitive.
 * The hook itself (useClientScope) requires a React renderer and is exercised
 * via the dashboard build + manual smoke; this file covers the pure helpers.
 *
 * Run: npx tsx --test src/lib/__tests__/admin-scope.test.ts
 *
 * Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 1)
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readLastClientId, writeLastClientId } from '../admin-scope.js'

describe('admin-scope helpers — no window (SSR / Node)', () => {
  test('readLastClientId returns null', () => {
    assert.equal(readLastClientId(), null)
  })

  test('writeLastClientId is a no-op (no throw)', () => {
    writeLastClientId('client-abc')
    writeLastClientId(null)
    writeLastClientId('all')
    assert.equal(readLastClientId(), null)
  })
})

describe('admin-scope helpers — with mock window.localStorage', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    const fakeStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    }
    // @ts-expect-error mocking window for test-only
    globalThis.window = { localStorage: fakeStorage }
  })

  afterEach(() => {
    // @ts-expect-error cleanup test-only mock
    delete globalThis.window
  })

  test('writeLastClientId persists a real client UUID and readLastClientId returns it', () => {
    writeLastClientId('11111111-2222-3333-4444-555555555555')
    assert.equal(readLastClientId(), '11111111-2222-3333-4444-555555555555')
  })

  test('writeLastClientId(null) clears the stored value', () => {
    writeLastClientId('client-xyz')
    assert.equal(readLastClientId(), 'client-xyz')
    writeLastClientId(null)
    assert.equal(readLastClientId(), null)
  })

  test("writeLastClientId('all') clears storage (sentinel = no scope)", () => {
    writeLastClientId('client-xyz')
    assert.equal(readLastClientId(), 'client-xyz')
    writeLastClientId('all')
    assert.equal(readLastClientId(), null)
  })

  test('readLastClientId returns null when nothing has been written', () => {
    assert.equal(readLastClientId(), null)
  })

  test('readLastClientId swallows getItem throw (private mode etc.)', () => {
    globalThis.window = {
      localStorage: {
        getItem: () => { throw new Error('private mode') },
        setItem: () => {},
        removeItem: () => {},
      },
    } as unknown as Window & typeof globalThis
    assert.equal(readLastClientId(), null)
  })

  test('writeLastClientId swallows setItem throw (quota exceeded etc.)', () => {
    globalThis.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded') },
        removeItem: () => {},
      },
    } as unknown as Window & typeof globalThis
    // No throw expected
    writeLastClientId('client-abc')
  })
})
