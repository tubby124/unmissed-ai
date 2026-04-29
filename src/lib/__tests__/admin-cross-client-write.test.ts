/**
 * admin-cross-client-write.test.ts — Phase 0.5.5 smoke test
 *
 * Phase 3 Wave B gate: PATCH a known field on a scoped client via admin scope,
 * read back, assert match. Without this, the Settings page migration could
 * silently mutate the wrong client's prompt.
 *
 * Run: npx tsx --test src/lib/__tests__/admin-cross-client-write.test.ts
 *
 * Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)
 * Cold-start: NEXT-CHAT-Admin-Redesign-Phase-3-Wave-B.md
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '../admin-scope-helpers.js'
import { evaluateAdminScopeGuard } from '../admin-scope-guard.js'

// ── Fakes ─────────────────────────────────────────────────────────────────────

interface FakeClientRow {
  id: string
  business_name: string | null
  injected_note: string | null
}

function fakeReq(headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null
      },
    },
  } as unknown as Parameters<typeof evaluateAdminScopeGuard>[0]['req']
}

interface FakeSupaState {
  authUser: { id: string; email: string } | null
  clientUsers: { user_id: string; role: string; client_id: string }[]
  clients: FakeClientRow[]
}

function makeFakeSupa(state: FakeSupaState) {
  return {
    auth: {
      async getUser() {
        if (!state.authUser) return { data: { user: null }, error: { message: 'no auth' } }
        return { data: { user: state.authUser }, error: null }
      },
    },
    from(table: string) {
      if (table === 'client_users') {
        let userId = ''
        return {
          select() { return this },
          eq(col: string, val: string) {
            if (col === 'user_id') userId = val
            return this
          },
          order() { return this },
          limit() { return this },
          async maybeSingle() {
            const row = state.clientUsers.find(c => c.user_id === userId)
            return { data: row ?? null }
          },
        }
      }
      if (table === 'clients') {
        let clientId = ''
        let updatePayload: Record<string, unknown> | null = null
        return {
          select() { return this },
          update(payload: Record<string, unknown>) {
            updatePayload = payload
            return this
          },
          eq(col: string, val: string) {
            if (col === 'id') clientId = val
            return this
          },
          async single() {
            const row = state.clients.find(c => c.id === clientId)
            return { data: row ?? null, error: null }
          },
          async maybeSingle() {
            const row = state.clients.find(c => c.id === clientId)
            return { data: row ?? null }
          },
          // Apply pending update on `then` resolution (Supabase mock pattern).
          then(resolve: (r: { error: null | { message: string } }) => unknown) {
            if (updatePayload) {
              const idx = state.clients.findIndex(c => c.id === clientId)
              if (idx >= 0) {
                state.clients[idx] = { ...state.clients[idx], ...updatePayload as Partial<FakeClientRow> }
              }
            }
            return Promise.resolve(resolve({ error: null }))
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as Parameters<typeof resolveAdminScope>[0]['supabase']
}

const ORIGINAL_FLAG = process.env.ADMIN_REDESIGN_ENABLED

describe('Phase 0.5.5 — admin cross-client write smoke', () => {
  beforeEach(() => { process.env.ADMIN_REDESIGN_ENABLED = '1' })
  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.ADMIN_REDESIGN_ENABLED
    else process.env.ADMIN_REDESIGN_ENABLED = ORIGINAL_FLAG
  })

  test('admin acts on another client with edit_mode_confirmed: scope resolves to target, write lands on target row', async () => {
    const state: FakeSupaState = {
      authUser: { id: 'admin-user', email: 'admin@unmissed.ai' },
      clientUsers: [{ user_id: 'admin-user', role: 'admin', client_id: 'client-A' }],
      clients: [
        { id: 'client-A', business_name: 'Admin Co', injected_note: null },
        { id: 'client-B', business_name: 'Other Co', injected_note: 'before' },
      ],
    }
    const supa = makeFakeSupa(state)
    const body = { client_id: 'client-B', injected_note: 'after', edit_mode_confirmed: true }

    const resolved = await resolveAdminScope({ supabase: supa, req: fakeReq(), body })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const { scope } = resolved
    assert.equal(scope.role, 'admin')
    assert.equal(scope.ownClientId, 'client-A')
    assert.equal(scope.targetClientId, 'client-B')
    assert.equal(scope.guard.allowed, true)
    assert.equal(scope.guard.isCrossClient, true)
    assert.equal(rejectIfEditModeRequired(scope), null)

    // Simulate the route applying the update.
    await supa.from('clients').update({ injected_note: 'after' }).eq('id', scope.targetClientId)

    // Read back: Other Co (client-B) was mutated, Admin Co (client-A) untouched.
    const a = state.clients.find(c => c.id === 'client-A')!
    const b = state.clients.find(c => c.id === 'client-B')!
    assert.equal(a.injected_note, null, 'admin\'s own client must not be touched')
    assert.equal(b.injected_note, 'after', 'target client must reflect the new value')
  })

  test('admin acts on another client WITHOUT edit_mode signal: 403 (read-only mode preserved)', async () => {
    const state: FakeSupaState = {
      authUser: { id: 'admin-user', email: 'admin@unmissed.ai' },
      clientUsers: [{ user_id: 'admin-user', role: 'admin', client_id: 'client-A' }],
      clients: [
        { id: 'client-A', business_name: 'Admin Co', injected_note: null },
        { id: 'client-B', business_name: 'Other Co', injected_note: 'before' },
      ],
    }
    const supa = makeFakeSupa(state)
    const body = { client_id: 'client-B', injected_note: 'should-not-write' }

    const resolved = await resolveAdminScope({ supabase: supa, req: fakeReq(), body })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const denial = rejectIfEditModeRequired(resolved.scope)
    assert.notEqual(denial, null, 'read-only default must reject without edit-mode signal')
    assert.equal(denial!.status, 403)
    // Confirm the target row is unchanged.
    const b = state.clients.find(c => c.id === 'client-B')!
    assert.equal(b.injected_note, 'before')
  })

  test('owner self-write: bypasses guard entirely', async () => {
    const state: FakeSupaState = {
      authUser: { id: 'owner-user', email: 'owner@example.com' },
      clientUsers: [{ user_id: 'owner-user', role: 'owner', client_id: 'client-A' }],
      clients: [{ id: 'client-A', business_name: 'My Co', injected_note: null }],
    }
    const supa = makeFakeSupa(state)
    const body = { injected_note: 'hello' }
    const resolved = await resolveAdminScope({ supabase: supa, req: fakeReq(), body })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.scope.guard.isCrossClient, false)
    assert.equal(resolved.scope.guard.allowed, true)
    assert.equal(rejectIfEditModeRequired(resolved.scope), null)
  })

  test('admin scope override via x-admin-edit-mode header: write allowed', async () => {
    const state: FakeSupaState = {
      authUser: { id: 'admin-user', email: 'admin@unmissed.ai' },
      clientUsers: [{ user_id: 'admin-user', role: 'admin', client_id: 'client-A' }],
      clients: [
        { id: 'client-A', business_name: 'Admin Co', injected_note: null },
        { id: 'client-B', business_name: 'Other Co', injected_note: 'before' },
      ],
    }
    const supa = makeFakeSupa(state)
    const body = { client_id: 'client-B', injected_note: 'header-allowed' }
    const resolved = await resolveAdminScope({
      supabase: supa,
      req: fakeReq({ 'x-admin-edit-mode': '1' }),
      body,
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.scope.guard.allowed, true)
    assert.equal(resolved.scope.targetClientId, 'client-B')
  })

  test('auditAdminWrite is non-blocking (returns even when audit insert is impossible)', async () => {
    // Self-scope: no audit row should be attempted (recordAdminAudit short-circuits).
    const state: FakeSupaState = {
      authUser: { id: 'owner-user', email: 'owner@example.com' },
      clientUsers: [{ user_id: 'owner-user', role: 'owner', client_id: 'client-A' }],
      clients: [{ id: 'client-A', business_name: 'My Co', injected_note: null }],
    }
    const supa = makeFakeSupa(state)
    const resolved = await resolveAdminScope({ supabase: supa, req: fakeReq(), body: {} })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    // Should resolve without throwing even though we have no audit-log table.
    await auditAdminWrite({
      scope: resolved.scope,
      route: '/api/dashboard/test',
      method: 'POST',
      payload: { ok: true },
    })
  })

  test('feature flag OFF: cross-client writes preserve current behavior (allowed without signal)', async () => {
    delete process.env.ADMIN_REDESIGN_ENABLED
    const state: FakeSupaState = {
      authUser: { id: 'admin-user', email: 'admin@unmissed.ai' },
      clientUsers: [{ user_id: 'admin-user', role: 'admin', client_id: 'client-A' }],
      clients: [
        { id: 'client-A', business_name: 'Admin Co', injected_note: null },
        { id: 'client-B', business_name: 'Other Co', injected_note: 'before' },
      ],
    }
    const supa = makeFakeSupa(state)
    const body = { client_id: 'client-B', injected_note: 'flag-off-write' }
    const resolved = await resolveAdminScope({ supabase: supa, req: fakeReq(), body })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.scope.guard.allowed, true, 'flag off → guard returns allowed=true')
    assert.equal(resolved.scope.guard.isCrossClient, true)
    assert.equal(rejectIfEditModeRequired(resolved.scope), null)
  })
})
