/**
 * prompt-version-audit.test.ts — S8b
 *
 * Verifies that insertPromptVersion() produces correct audit trail columns
 * (triggered_by_user_id, triggered_by_role, char_count, prev_char_count).
 *
 * Uses a mock SupabaseClient to verify the insert payload without hitting
 * a real database. This is the contract test — the canary eval harness
 * checks real DB state.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-version-audit.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { insertPromptVersion, type InsertPromptVersionParams } from '../prompt-version-utils.js'

// ── Mock Supabase builder ────────────────────────────────────────────────────

interface MockCall {
  table: string
  method: string
  args: unknown[]
}

function createMockSupabase(opts: {
  latestVersion?: number | null
  insertResult?: { id: string } | null
} = {}) {
  const calls: MockCall[] = []
  const { latestVersion = null, insertResult = { id: 'mock-version-id' } } = opts

  const mockSupa = {
    _calls: calls,
    from(table: string) {
      return {
        select(...args: unknown[]) {
          calls.push({ table, method: 'select', args })
          return {
            eq(...eqArgs: unknown[]) {
              calls.push({ table, method: 'select.eq', args: eqArgs })
              return {
                order(...orderArgs: unknown[]) {
                  return {
                    limit(...limitArgs: unknown[]) {
                      return {
                        async single() {
                          // Return latest version for auto-increment query
                          if (latestVersion !== null) {
                            return { data: { version: latestVersion }, error: null }
                          }
                          return { data: null, error: { code: 'PGRST116' } }
                        },
                      }
                    },
                  }
                },
                async single() {
                  return { data: null, error: null }
                },
              }
            },
          }
        },
        update(data: unknown) {
          calls.push({ table, method: 'update', args: [data] })
          return {
            eq(...eqArgs: unknown[]) {
              calls.push({ table, method: 'update.eq', args: eqArgs })
              return { data: null, error: null }
            },
          }
        },
        insert(data: unknown) {
          calls.push({ table, method: 'insert', args: [data] })
          return {
            select(...args: unknown[]) {
              return {
                async single() {
                  return { data: insertResult, error: null }
                },
              }
            },
          }
        },
      }
    },
  }

  return mockSupa as any
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInsertCall(supa: any): Record<string, unknown> | null {
  const insertCall = supa._calls.find(
    (c: MockCall) => c.table === 'prompt_versions' && c.method === 'insert'
  )
  return insertCall ? (insertCall.args[0] as Record<string, unknown>) : null
}

function getUpdateCalls(supa: any): MockCall[] {
  return supa._calls.filter(
    (c: MockCall) => c.table === 'prompt_versions' && c.method === 'update'
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('S8b: insertPromptVersion audit trail contract', () => {
  test('insert includes all S6d audit columns', async () => {
    const supa = createMockSupabase({ latestVersion: 3 })
    const params: InsertPromptVersionParams = {
      clientId: 'client-123',
      content: 'You are Aisha, the virtual receptionist.',
      changeDescription: 'Test version',
      triggeredByUserId: 'user-456',
      triggeredByRole: 'admin',
      prevCharCount: 100,
    }

    const result = await insertPromptVersion(supa, params)

    assert.ok(result, 'must return a result')
    assert.equal(result!.id, 'mock-version-id')
    assert.equal(result!.version, 4, 'auto-increment from 3 → 4')

    const inserted = getInsertCall(supa)
    assert.ok(inserted, 'must have an insert call')
    assert.equal(inserted!.client_id, 'client-123')
    assert.equal(inserted!.version, 4)
    assert.equal(inserted!.is_active, true)
    assert.equal(inserted!.triggered_by_user_id, 'user-456', 'audit: user ID')
    assert.equal(inserted!.triggered_by_role, 'admin', 'audit: role')
    assert.equal(inserted!.char_count, params.content.length, 'audit: char_count')
    assert.equal(inserted!.prev_char_count, 100, 'audit: prev_char_count')
    assert.equal(inserted!.change_description, 'Test version')
  })

  test('auto-increments version from latest', async () => {
    const supa = createMockSupabase({ latestVersion: 7 })
    const result = await insertPromptVersion(supa, {
      clientId: 'c1',
      content: 'prompt text',
      changeDescription: 'test',
      triggeredByUserId: 'u1',
      triggeredByRole: 'owner',
      prevCharCount: null,
    })
    assert.equal(result!.version, 8, 'should be 7 + 1 = 8')
  })

  test('first version (no existing rows) → version 1', async () => {
    const supa = createMockSupabase({ latestVersion: null })
    const result = await insertPromptVersion(supa, {
      clientId: 'new-client',
      content: 'first prompt',
      changeDescription: 'initial',
      triggeredByUserId: null,
      triggeredByRole: 'system',
      prevCharCount: null,
    })
    assert.equal(result!.version, 1, 'first version should be 1')
  })

  test('explicit version number overrides auto-increment', async () => {
    const supa = createMockSupabase({ latestVersion: 10 })
    const result = await insertPromptVersion(supa, {
      clientId: 'c1',
      content: 'prompt',
      changeDescription: 'explicit version',
      triggeredByUserId: 'u1',
      triggeredByRole: 'admin',
      prevCharCount: 50,
      version: 42,
    })
    assert.equal(result!.version, 42, 'explicit version takes precedence')
  })

  test('deactivates existing versions before insert', async () => {
    const supa = createMockSupabase({ latestVersion: 5 })
    await insertPromptVersion(supa, {
      clientId: 'c1',
      content: 'new prompt',
      changeDescription: 'deactivation test',
      triggeredByUserId: 'u1',
      triggeredByRole: 'admin',
      prevCharCount: 100,
    })

    const updateCalls = getUpdateCalls(supa)
    assert.ok(updateCalls.length > 0, 'must deactivate existing versions')
    const updatePayload = updateCalls[0].args[0] as Record<string, unknown>
    assert.deepEqual(updatePayload, { is_active: false }, 'update payload must set is_active=false')
  })

  test('system-triggered action: triggeredByUserId=null + role=system', async () => {
    const supa = createMockSupabase({ latestVersion: 0 })
    await insertPromptVersion(supa, {
      clientId: 'c1',
      content: 'auto-generated prompt',
      changeDescription: 'Stripe checkout auto-creation',
      triggeredByUserId: null,
      triggeredByRole: 'system',
      prevCharCount: null,
    })

    const inserted = getInsertCall(supa)
    assert.ok(inserted)
    assert.equal(inserted!.triggered_by_user_id, null, 'system actions have null user ID')
    assert.equal(inserted!.triggered_by_role, 'system', 'role must be system')
  })

  test('char_count matches actual content length', async () => {
    const content = 'A'.repeat(2500) // 2500 chars
    const supa = createMockSupabase({ latestVersion: 1 })
    await insertPromptVersion(supa, {
      clientId: 'c1',
      content,
      changeDescription: 'char count test',
      triggeredByUserId: 'u1',
      triggeredByRole: 'owner',
      prevCharCount: 2000,
    })

    const inserted = getInsertCall(supa)
    assert.equal(inserted!.char_count, 2500, 'char_count must equal content.length')
    assert.equal(inserted!.prev_char_count, 2000, 'prev_char_count preserved')
  })

  test('insert failure returns null', async () => {
    const supa = createMockSupabase({ latestVersion: 1, insertResult: null })
    const result = await insertPromptVersion(supa, {
      clientId: 'c1',
      content: 'prompt',
      changeDescription: 'will fail',
      triggeredByUserId: 'u1',
      triggeredByRole: 'admin',
      prevCharCount: null,
    })
    assert.equal(result, null, 'should return null on insert failure')
  })
})
