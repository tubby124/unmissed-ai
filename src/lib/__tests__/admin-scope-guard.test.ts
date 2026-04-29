/**
 * admin-scope-guard.test.ts — Phase 0.5.5 smoke test
 *
 * Validates the read-only-by-default cross-client guard so that the Phase 3
 * wave B settings/go-live migration cannot silently mutate the wrong client.
 *
 * Run: npx tsx --test src/lib/__tests__/admin-scope-guard.test.ts
 *
 * Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAdminScopeGuard } from '../admin-scope-guard.js'

// Minimal stand-in for Next.js Request — the guard only needs `.headers.get()`.
function fakeReq(headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null
      },
    },
  } as unknown as Parameters<typeof evaluateAdminScopeGuard>[0]['req']
}

const ORIGINAL_FLAG = process.env.ADMIN_REDESIGN_ENABLED

describe('evaluateAdminScopeGuard — feature flag OFF (current behavior preserved)', () => {
  beforeEach(() => { delete process.env.ADMIN_REDESIGN_ENABLED })
  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.ADMIN_REDESIGN_ENABLED
    else process.env.ADMIN_REDESIGN_ENABLED = ORIGINAL_FLAG
  })

  test('admin cross-client write allowed (no edit-mode signal needed)', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'other-client',
      req: fakeReq(),
    })
    assert.equal(r.allowed, true)
    assert.equal(r.isCrossClient, true)
  })
})

describe('evaluateAdminScopeGuard — feature flag ON', () => {
  beforeEach(() => { process.env.ADMIN_REDESIGN_ENABLED = '1' })
  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.ADMIN_REDESIGN_ENABLED
    else process.env.ADMIN_REDESIGN_ENABLED = ORIGINAL_FLAG
  })

  test('owner self-write: not cross-client, always allowed', () => {
    const r = evaluateAdminScopeGuard({
      role: 'owner',
      ownClientId: 'c1',
      targetClientId: 'c1',
      req: fakeReq(),
    })
    assert.equal(r.allowed, true)
    assert.equal(r.isCrossClient, false)
  })

  test('admin self-scope (own client): not cross-client, always allowed', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'admin-client',
      req: fakeReq(),
    })
    assert.equal(r.allowed, true)
    assert.equal(r.isCrossClient, false)
  })

  test('admin cross-client without edit signal: BLOCKED', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'other-client',
      req: fakeReq(),
    })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'EDIT_MODE_REQUIRED')
    assert.equal(r.isCrossClient, true)
  })

  test('admin cross-client with x-admin-edit-mode header: ALLOWED', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'other-client',
      req: fakeReq({ 'x-admin-edit-mode': '1' }),
    })
    assert.equal(r.allowed, true)
    assert.equal(r.isCrossClient, true)
  })

  test('admin cross-client with edit_mode_confirmed body: ALLOWED', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'other-client',
      req: fakeReq(),
      body: { edit_mode_confirmed: true },
    })
    assert.equal(r.allowed, true)
  })

  test('admin cross-client with edit_mode_confirmed=false body: BLOCKED', () => {
    const r = evaluateAdminScopeGuard({
      role: 'admin',
      ownClientId: 'admin-client',
      targetClientId: 'other-client',
      req: fakeReq(),
      body: { edit_mode_confirmed: false },
    })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'EDIT_MODE_REQUIRED')
  })

  test('non-admin with mismatched targetClientId: not cross-client (the API will reject scope independently)', () => {
    // Non-admins can't scope at all in the upstream PATCH route — body.client_id
    // is ignored unless cu.role === 'admin'. The guard treats this as not cross-client.
    const r = evaluateAdminScopeGuard({
      role: 'owner',
      ownClientId: 'c1',
      targetClientId: 'c2',
      req: fakeReq(),
    })
    assert.equal(r.allowed, true)
    assert.equal(r.isCrossClient, false)
  })
})
