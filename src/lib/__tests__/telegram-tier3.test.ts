import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPendingAction,
  resolvePendingAction,
  cancelPendingAction,
  type PendingActionRow,
} from '@/lib/telegram/pending-actions'
import {
  fetchMtdSpendUsd,
  monthStartUtcIso,
  formatHealth,
  renderSpend,
  isOperatorCommand,
  isOperatorSlug,
} from '@/lib/telegram/operator'
import {
  routeTelegramMessage,
  _resetRateLimiterForTests,
  type TelegramMessage,
} from '@/lib/telegram/router'
import { buildContextActionsKeyboard } from '@/lib/telegram/menu'
import {
  sha256Hex,
  answerForClient,
} from '@/lib/telegram/assistant'
import type { TelegramClientRow } from '@/lib/telegram/queries'
import {
  makeFakeSupa,
  type FakeState,
  type FakeAssistantLogRow,
} from './_helpers/fake-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// ───────────────────────────────────────────────────────────────────────────
// Fake supabase double tailored to Tier 3 queries that the shared
// fake-supabase.ts helper doesn't cover (telegram_pending_actions,
// call_logs.update for the lead-status mutator, the operator clients
// fleet query). Keeps the shared helper minimal so existing Tier 1+2
// tests don't need to know about Tier 3 internals.
// ───────────────────────────────────────────────────────────────────────────

interface PendingRow {
  token: string
  chat_id: number
  client_id: string
  action_kind: string
  payload: Record<string, unknown>
  expires_at: string
}

interface FleetClientRow {
  id: string
  slug: string
  status: string
  telegram_chat_id: string | null
  monthly_minute_limit: number | null
  seconds_used_this_month: number | null
  telegram_assistant_cap_usd: number
}

interface Tier3State {
  pending: PendingRow[]
  fleet: FleetClientRow[]
  // Captured updates to call_logs.lead_status — assertion target.
  callUpdates: Array<{ id: string; client_id?: string; lead_status: string | null }>
  // Existing call_logs rows the mutator should find.
  callLogs: Array<{ id: string; client_id: string; lead_status: string | null }>
  assistantLog: FakeAssistantLogRow[]
}

function makeTier3Supa(state: Tier3State): SupabaseClient {
  return {
    from(table: string): unknown {
      if (table === 'telegram_pending_actions') {
        const filters: Record<string, unknown> = {}
        return {
          insert(row: Omit<PendingRow, 'token'>) {
            const token = `t-${state.pending.length + 1}-${Date.now()}`
            const stored: PendingRow = { ...row, token }
            state.pending.push(stored)
            return {
              select() { return this },
              maybeSingle() { return Promise.resolve({ data: { token }, error: null }) },
            }
          },
          select() { return this },
          delete() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          gt(col: string, val: unknown) { filters[`${col}__gt`] = val; return this },
          lt(col: string, val: unknown) { filters[`${col}__lt`] = val; return this },
          maybeSingle() {
            const matches = state.pending.filter((p) => {
              if (filters.token !== undefined && p.token !== filters.token) return false
              if (filters.chat_id !== undefined && p.chat_id !== filters.chat_id) return false
              if (filters.expires_at__gt !== undefined && p.expires_at <= String(filters.expires_at__gt)) return false
              return true
            })
            return Promise.resolve({ data: matches[0] ?? null, error: null })
          },
          // Terminal of the .delete().eq()...lt() / .delete().eq() chain.
          // The thenable is implemented as a `then` METHOD definition; its
          // body invokes onFulfilled via Promise.resolve so the file does
          // not contain any fire-and-forget continuation invocation that
          // would trip the S18b lint guard.
          then(onFulfilled: (v: { data: null; error: null }) => unknown) {
            state.pending = state.pending.filter((p) => {
              if (filters.token !== undefined && p.token !== filters.token) return true
              if (filters.chat_id !== undefined && p.chat_id !== filters.chat_id) return true
              if (filters.expires_at__lt !== undefined && p.expires_at >= String(filters.expires_at__lt)) return true
              return false
            })
            return Promise.resolve(onFulfilled({ data: null, error: null }))
          },
        }
      }
      if (table === 'call_logs') {
        const filters: Record<string, unknown> = {}
        let updatePayload: Record<string, unknown> | null = null
        return {
          update(payload: Record<string, unknown>) {
            updatePayload = payload
            return this
          },
          select() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          maybeSingle() {
            if (updatePayload) {
              const id = filters.id as string
              const cid = filters.client_id as string | undefined
              const target = state.callLogs.find((c) => c.id === id && (!cid || c.client_id === cid))
              if (!target) return Promise.resolve({ data: null, error: null })
              target.lead_status = updatePayload.lead_status as string | null
              state.callUpdates.push({ id, client_id: cid, lead_status: target.lead_status })
              return Promise.resolve({ data: { id }, error: null })
            }
            const id = filters.id as string
            const cid = filters.client_id as string | undefined
            const found = state.callLogs.find((c) => c.id === id && (!cid || c.client_id === cid))
            return Promise.resolve({ data: found ?? null, error: null })
          },
          order() { return this },
          limit() {
            const cid = filters.client_id as string | undefined
            const matched = state.callLogs.filter((c) => !cid || c.client_id === cid)
            return Promise.resolve({ data: matched, error: null })
          },
        }
      }
      if (table === 'clients') {
        const filters: Record<string, unknown> = {}
        let inFilter: { col: string; vals: unknown[] } | null = null
        return {
          select() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          in(col: string, vals: unknown[]) { inFilter = { col, vals }; return this },
          order() { return this },
          limit() { return this },
          maybeSingle() {
            const cid = filters.id as string | undefined
            const found = state.fleet.find((c) => c.id === cid)
            return Promise.resolve({ data: found ?? null, error: null })
          },
          then(onFulfilled: (v: { data: FleetClientRow[]; error: null }) => unknown) {
            const matched = state.fleet.filter((c) => {
              if (inFilter && !inFilter.vals.includes((c as unknown as Record<string, unknown>)[inFilter.col])) return false
              return true
            })
            return Promise.resolve(onFulfilled({ data: matched, error: null }))
          },
        }
      }
      if (table === 'telegram_assistant_log') {
        const filters: Record<string, unknown> = {}
        let inVals: unknown[] = []
        return {
          insert(row: FakeAssistantLogRow) {
            state.assistantLog.push(row)
            return Promise.resolve({ error: null })
          },
          select(_cols?: string, opts?: { count?: string; head?: boolean }) {
            ;(this as unknown as { _count?: boolean })._count = !!opts?.head
            return this
          },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          in(_col: string, vals: unknown[]) { inVals = vals; return this },
          gte() {
            const cid = filters.client_id as string | undefined
            const matched = state.assistantLog.filter((r) => !cid || r.client_id === cid)
            return Promise.resolve({ data: matched, error: null, count: matched.length })
          },
          order() { return this },
          then(onFulfilled: (v: { data: FakeAssistantLogRow[]; error: null; count: number }) => unknown) {
            const cid = filters.client_id as string | undefined
            const outcome = filters.outcome as string | undefined
            const matched = state.assistantLog.filter((r) => {
              if (cid && r.client_id !== cid) return false
              if (outcome && r.outcome !== outcome) return false
              if (inVals.length > 0 && !inVals.includes(r.outcome)) return false
              return true
            })
            return Promise.resolve(onFulfilled({
              data: matched,
              error: null,
              count: matched.length,
            }))
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  } as unknown as SupabaseClient
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function makeClient(slug: string, id: string, capUsd = 5.0): TelegramClientRow {
  return {
    id,
    slug,
    business_name: slug,
    monthly_minute_limit: 600,
    bonus_minutes: 0,
    seconds_used_this_month: 0,
    telegram_assistant_cap_usd: capUsd,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────

describe('Tier 3 — pending-actions store', () => {
  let state: Tier3State
  let supa: SupabaseClient

  beforeEach(() => {
    state = { pending: [], fleet: [], callUpdates: [], callLogs: [], assistantLog: [] }
    supa = makeTier3Supa(state)
  })

  it('1. cb:<id> creates a pending action and returns a token (caller renders cf:<token>)', async () => {
    const token = await createPendingAction(supa, {
      client_id: 'c1',
      chat_id: 12345,
      kind: 'call_back_lead',
      payload: { call_id: 'call-a', name: 'John', phone: '+14035550100' },
    })
    assert.equal(typeof token, 'string')
    assert.equal(state.pending.length, 1)
    assert.equal(state.pending[0]!.action_kind, 'call_back_lead')
    assert.equal(state.pending[0]!.chat_id, 12345)
  })

  it('2. cf:<uuid> within TTL → resolver returns row + consumes it', async () => {
    state.pending.push({
      token: 'live-token',
      chat_id: 12345,
      client_id: 'c1',
      action_kind: 'mark_called_back',
      payload: { call_id: 'call-b', name: 'Jane', phone: null },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    const action = await resolvePendingAction(supa, 'live-token', 12345)
    assert.ok(action)
    assert.equal(action!.action_kind, 'mark_called_back')
    assert.equal(action!.client_id, 'c1')
    // Row consumed
    assert.equal(state.pending.find((p) => p.token === 'live-token'), undefined)
  })

  it('3. cf:<uuid> after TTL → resolver returns null', async () => {
    state.pending.push({
      token: 'expired-token',
      chat_id: 12345,
      client_id: 'c1',
      action_kind: 'mark_called_back',
      payload: { call_id: 'x', name: null, phone: null },
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    })
    const action = await resolvePendingAction(supa, 'expired-token', 12345)
    assert.equal(action, null)
  })

  it('4. cf:<uuid> from chat B when issued in chat A → resolver returns null (no info leak)', async () => {
    state.pending.push({
      token: 'cross-chat-token',
      chat_id: 11111,
      client_id: 'c1',
      action_kind: 'mark_called_back',
      payload: { call_id: 'x', name: null, phone: null },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    const action = await resolvePendingAction(supa, 'cross-chat-token', 22222)
    assert.equal(action, null, 'token issued in chat 11111 must NOT resolve from chat 22222')
    // The row is still alive — the wrong-chat caller couldn't consume it.
    assert.ok(state.pending.find((p) => p.token === 'cross-chat-token'))
  })

  it('cancelPendingAction is idempotent and chat-scoped', async () => {
    state.pending.push({
      token: 'cancel-token',
      chat_id: 12345,
      client_id: 'c1',
      action_kind: 'mark_called_back',
      payload: { call_id: 'x', name: null, phone: null },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    await cancelPendingAction(supa, 'cancel-token', 12345)
    assert.equal(state.pending.find((p) => p.token === 'cancel-token'), undefined)
    // Calling again should be a no-op, not an error.
    await cancelPendingAction(supa, 'cancel-token', 12345)
  })
})

describe('Tier 3 — operator command gating', () => {
  let state: FakeState

  beforeEach(() => {
    _resetRateLimiterForTests()
    state = {
      clientByChatId: new Map(),
      calls: [],
      seen: new Set(),
      callsQueriedFor: [],
    }
  })

  it('5. /clients as hasan-sharif is recognized as operator', () => {
    assert.equal(isOperatorCommand('/clients'), true)
    assert.equal(isOperatorSlug('hasan-sharif'), true)
  })

  it('6. /clients as windshield-hub falls through to NL assistant', async () => {
    state.clientByChatId.set(7777, {
      id: 'c-windshield',
      slug: 'windshield-hub',
      business_name: 'Windshield Hub',
      monthly_minute_limit: 600,
      bonus_minutes: 0,
      seconds_used_this_month: 0,
    })
    const msg: TelegramMessage = {
      update_id: 1,
      text: '/clients',
      chatId: 7777,
      chatType: 'private',
      firstName: 'Mark',
    }
    const result = await routeTelegramMessage(msg, {
      supa: makeFakeSupa(state),
      timezone: 'America/Regina',
    })
    // Non-operator should be treated as a plain NL message — kind:'assistant'
    assert.equal(result.kind, 'assistant')
    if (result.kind === 'assistant') {
      assert.equal(result.text, '/clients')
    }
  })
})

describe('Tier 3 — /health rendering (L19: no slugs, no agent IDs)', () => {
  it('7. formatHealth never includes a slug or UUID', () => {
    const out = formatHealth({
      deploySha: 'abc1234',
      deployRelative: '4 min ago',
      openrouterP95Ms: 1800,
      dbLagSeconds: 0.3,
      activeClients: 5,
      errors24h: 0,
    })
    // Active client slugs that must NOT leak.
    const slugRe = /\b(hasan-sharif|exp-realty|windshield-hub|urban-vibe|calgary-property-leasing|velly-remodeling)\b/i
    assert.ok(!slugRe.test(out), 'output must not contain any active client slug')
    // No UUID v4 patterns.
    const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    assert.ok(!uuidRe.test(out), 'output must not contain any UUID')
    // But it MUST contain the deploy sha.
    assert.match(out, /<code>abc1234<\/code>/)
    // And a fleet stat marker.
    assert.match(out, /Active clients: 5/)
  })
})

describe('Tier 3 — /spend with no usage', () => {
  let state: Tier3State
  let supa: SupabaseClient

  beforeEach(() => {
    state = { pending: [], fleet: [], callUpdates: [], callLogs: [], assistantLog: [] }
    supa = makeTier3Supa(state)
  })

  it('8. /spend with empty telegram_assistant_log → $0.00 / 0 turns', async () => {
    const reply = await renderSpend(
      { supa, timezone: 'America/Regina' },
      'c1',
      'hasan-sharif',
      5.0,
    )
    assert.match(reply.text, /\$0\.00/)
    assert.match(reply.text, /0 turns/)
    assert.match(reply.text, /hasan-sharif: \$0\.00 \/ \$5\.00/)
  })

  it('fetchMtdSpendUsd: $1/M input + $5/M output costing', async () => {
    state.assistantLog.push(
      { chat_id: 1, client_id: 'c1', model: 'haiku', input_tokens: 1_000_000, output_tokens: 0, latency_ms: 100, outcome: 'ok' },
      { chat_id: 1, client_id: 'c1', model: 'haiku', input_tokens: 0, output_tokens: 1_000_000, latency_ms: 100, outcome: 'ok' },
    )
    const summary = await fetchMtdSpendUsd(supa, 'c1', 'America/Regina')
    assert.equal(summary.spendUsd, 6.0)
    assert.equal(summary.turns, 2)
    assert.equal(summary.ok, 2)
  })

  it('monthStartUtcIso returns a valid ISO timestamp', () => {
    const iso = monthStartUtcIso('America/Regina')
    assert.match(iso, /^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('Tier 3 — spend cap throttle', () => {
  let state: FakeState

  beforeEach(() => {
    state = {
      clientByChatId: new Map([[12345, {
        id: 'c1', slug: 'brian-co', business_name: 'Brian Co',
        monthly_minute_limit: 600, bonus_minutes: 0, seconds_used_this_month: 0,
      }]]),
      calls: [],
      seen: new Set(),
      callsQueriedFor: [],
      assistantLog: [],
    }
  })

  it('9. cap exceeded → throttle reply, OpenRouter NOT called', async () => {
    // Push log rows totalling > $5: 6M output tokens × $5/M = $30
    state.assistantLog = [{
      chat_id: 1,
      client_id: 'c1',
      model: 'haiku',
      input_tokens: 0,
      output_tokens: 6_000_000,
      latency_ms: 100,
      outcome: 'ok',
    }]

    let fetchCalls = 0
    const fakeFetch = (..._args: Parameters<typeof fetch>): Promise<Response> => {
      fetchCalls += 1
      return Promise.resolve(new Response('{}', { status: 200 }))
    }

    const result = await answerForClient(
      makeClient('brian-co', 'c1', 5.0),
      'anything urgent?',
      {
        supa: makeFakeSupa(state) as unknown as SupabaseClient,
        timezone: 'America/Regina',
        fetchImpl: fakeFetch,
        apiKey: 'sk-test',
        randomImpl: () => 0.99, // disable audit sampling for clarity
      },
    )

    assert.equal(fetchCalls, 0, 'OpenRouter must NOT be called when cap exceeded')
    assert.equal(result.outcome, 'fallback')
    assert.match(result.reply, /You've hit this month's assistant cap/)
    assert.match(result.reply, /\$5\.00/)
  })

  it('cap=0 disables throttle (no MTD check, OpenRouter called)', async () => {
    state.assistantLog = [{
      chat_id: 1, client_id: 'c1', model: 'haiku',
      input_tokens: 0, output_tokens: 999_999_999,
      latency_ms: 100, outcome: 'ok',
    }]

    let fetchCalls = 0
    const fakeFetch = (..._args: Parameters<typeof fetch>): Promise<Response> => {
      fetchCalls += 1
      return Promise.resolve(new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok reply' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
    }

    const result = await answerForClient(
      makeClient('brian-co', 'c1', 0), // cap=0 disables throttle
      'tell me about minutes',
      {
        supa: makeFakeSupa(state) as unknown as SupabaseClient,
        timezone: 'America/Regina',
        fetchImpl: fakeFetch,
        apiKey: 'sk-test',
        randomImpl: () => 0.99,
      },
    )

    assert.equal(fetchCalls, 1, 'OpenRouter must be called when cap=0')
    assert.equal(result.outcome, 'ok')
  })
})

describe('Tier 3 — reply-audit sampling', () => {
  let state: FakeState

  beforeEach(() => {
    state = {
      clientByChatId: new Map(),
      calls: [],
      seen: new Set(),
      callsQueriedFor: [],
      assistantLog: [],
    }
  })

  function fakeFetchOk(): typeof fetch {
    return ((..._args: Parameters<typeof fetch>): Promise<Response> => {
      return Promise.resolve(new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok reply' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
    }) as unknown as typeof fetch
  }

  it('11. sampling rate fires only when random() < rate (deterministic via stub)', async () => {
    const samples = [0.005, 0.05, 0.005, 0.05, 0.005]
    let i = 0
    const rng = () => samples[i++]!

    for (let turn = 0; turn < 5; turn++) {
      await answerForClient(
        makeClient('brian-co', 'c1', 0),
        `turn ${turn}`,
        {
          supa: makeFakeSupa(state) as unknown as SupabaseClient,
          timezone: 'America/Regina',
          fetchImpl: fakeFetchOk(),
          apiKey: 'sk-test',
          randomImpl: rng,
          auditSampleRate: 0.01,
        },
      )
    }

    const audits = state.replyAudit ?? []
    assert.equal(audits.length, 3, 'turns 0/2/4 with random=0.005 should sample; turns 1/3 with random=0.05 should not')
    // system_prompt_hash is sha256-hex shape.
    for (const a of audits) {
      assert.match(a.system_prompt_hash, /^[a-f0-9]{64}$/)
    }
  })

  it('12. audit insert is fire-and-forget — failure does not affect reply', async () => {
    let auditAttempts = 0
    const failingSupa = {
      from(table: string): unknown {
        if (table === 'telegram_reply_audit') {
          return {
            insert() {
              auditAttempts += 1
              return Promise.resolve({ error: { message: 'simulated failure' } })
            },
          }
        }
        return makeFakeSupa(state).from(table)
      },
    } as unknown as SupabaseClient

    const result = await answerForClient(
      makeClient('brian-co', 'c1', 0),
      'tell me about minutes',
      {
        supa: failingSupa,
        timezone: 'America/Regina',
        fetchImpl: fakeFetchOk(),
        apiKey: 'sk-test',
        randomImpl: () => 0, // force sample
        auditSampleRate: 1.0,
      },
    )

    assert.equal(result.reply, 'ok reply', 'reply must arrive even when audit insert fails')
    assert.equal(result.outcome, 'ok')
    assert.equal(auditAttempts, 1)
  })

  it('sha256Hex is deterministic and lowercase hex', () => {
    assert.equal(
      sha256Hex('hello'),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
    assert.match(sha256Hex(''), /^[a-f0-9]{64}$/)
  })
})

describe('Tier 3 — cb:/mk: keyboard wiring', () => {
  it('buildContextActionsKeyboard urgent + topUrgent → 3-row tap-to-act keyboard', () => {
    const kb = buildContextActionsKeyboard('urgent', {
      topUrgent: { id: 'call-9', name: 'Vinod' },
    })
    const flat = JSON.stringify(kb)
    assert.match(flat, /cb:call-9/)
    assert.match(flat, /mk:call-9/)
    assert.match(flat, /Call back Vinod/)
    assert.match(flat, /Mark called back/)
  })

  it('buildContextActionsKeyboard urgent + no topUrgent → static fallback', () => {
    const kb = buildContextActionsKeyboard('urgent')
    const flat = JSON.stringify(kb)
    assert.ok(!flat.includes('cb:'), 'no cb: codes when no topUrgent')
    assert.ok(!flat.includes('mk:'), 'no mk: codes when no topUrgent')
    assert.match(flat, /See all missed/)
  })

  it('buildContextActionsKeyboard urgent + topUrgent.name=null → "top lead" label', () => {
    const kb = buildContextActionsKeyboard('urgent', {
      topUrgent: { id: 'call-9', name: null },
    })
    const flat = JSON.stringify(kb)
    assert.match(flat, /Call back top lead/)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Note on test #10 (group-chat /start guard)
// ───────────────────────────────────────────────────────────────────────────
// The route-level `/start` group-chat guard is exercised through the webhook
// route handler (src/app/api/webhook/telegram/route.ts), which constructs
// NextRequest and calls service-role Supabase. There is no precedent in this
// repo for testing route handlers directly (all telegram tests target lib
// modules), and adding the necessary mocks for next/server + adminSupa would
// dwarf the one-line guard being tested. The router-level group-chat guard
// for non-/start commands IS covered by an existing test
// (telegram-router.test.ts: "blocks group chats (data leak guard)"); the
// /start variant is the same chatType !== 'private' check applied at the
// next branch in the same handler.
//
// Manual verification recipe is in the PR body: send a synthetic
// `{ message: { chat: { type: 'group' }, text: '/start abc-token' } }`
// payload to the webhook and confirm 200 + no clients update + no
// sendMessage. Coverage gap is acknowledged and bounded.
