import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { routeTelegramMessage, _resetRateLimiterForTests, type TelegramMessage } from '../telegram/router'

interface FakeRow {
  id: string
  slug: string
  business_name: string | null
  monthly_minute_limit: number | null
  bonus_minutes: number | null
  seconds_used_this_month: number | null
}

interface FakeCall {
  id: string
  client_id: string
  started_at: string | null
  caller_phone: string | null
  caller_name: string | null
  ai_summary: string | null
  call_status: string | null
  lead_status: string | null
  service_type: string | null
  duration_seconds: number | null
  next_steps: string | null
  callback_preference: string | null
  recording_url: string | null
  ultravox_call_id: string | null
}

interface FakeState {
  clientByChatId: Map<number, FakeRow>
  calls: FakeCall[]
  seen: Set<number>
  callsQueriedFor: string[]
}

function makeFakeSupa(state: FakeState) {
  return {
    from(table: string) {
      if (table === 'clients') {
        return {
          select() { return this },
          eq(_col: string, val: string) {
            this._chatId = Number(val); return this
          },
          limit() { return this },
          maybeSingle() {
            const row = state.clientByChatId.get(this._chatId) ?? null
            return Promise.resolve({ data: row })
          },
          _chatId: 0,
        }
      }
      if (table === 'call_logs') {
        const filters: Record<string, unknown> = {}
        return {
          select() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          in() { return this },
          gte() { return this },
          or() { return this },
          order() { return this },
          limit() {
            const cid = filters.client_id as string | undefined
            if (cid) state.callsQueriedFor.push(cid)
            const matched = state.calls.filter((c) => c.client_id === cid)
            return Promise.resolve({ data: matched })
          },
        }
      }
      if (table === 'telegram_updates_seen') {
        return {
          insert(row: { update_id: number }) {
            if (state.seen.has(row.update_id)) {
              return Promise.resolve({ error: { code: '23505' } })
            }
            state.seen.add(row.update_id)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  } as unknown as Parameters<typeof routeTelegramMessage>[1]['supa']
}

function makeMsg(over: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    update_id: Math.floor(Math.random() * 1_000_000_000),
    text: '/help',
    chatId: 12345,
    chatType: 'private',
    firstName: 'Brian',
    ...over,
  }
}

describe('routeTelegramMessage — Tier 1 slash router', () => {
  let state: FakeState

  beforeEach(() => {
    _resetRateLimiterForTests()
    state = {
      clientByChatId: new Map([
        [12345, {
          id: 'client-1',
          slug: 'brian-co',
          business_name: 'Brian Co',
          monthly_minute_limit: 200,
          bonus_minutes: 50,
          seconds_used_this_month: 1800, // 30 min
        }],
      ]),
      calls: [
        {
          id: 'call-1', client_id: 'client-1', started_at: new Date().toISOString(),
          caller_phone: '+14035550142', caller_name: 'John Doe',
          ai_summary: 'wants AC tune-up tuesday', call_status: 'HOT',
          lead_status: 'new', service_type: 'booking', duration_seconds: 134,
          next_steps: 'confirm tuesday slot', callback_preference: null,
          recording_url: null, ultravox_call_id: 'uv-1',
        },
      ],
      seen: new Set(),
      callsQueriedFor: [],
    }
  })

  it('blocks group chats (data leak guard)', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ chatType: 'group', text: '/calls' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(result.kind, 'noop')
  })

  it('returns fallthrough for /start so existing handler runs', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ text: '/start abc-token' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(result.kind, 'fallthrough')
  })

  it('rejects unregistered chat_ids', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ chatId: 99999, text: '/calls' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(result.kind, 'reply')
    if (result.kind !== 'reply') return
    assert.match(result.text, /clients of unmissed/i)
  })

  it('responds to /help', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ text: '/help' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(result.kind, 'reply')
    if (result.kind !== 'reply') return
    assert.match(result.text, /\/calls/)
  })

  it('returns table for /calls and scopes to client_id', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ text: '/calls' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(result.kind, 'reply')
    if (result.kind !== 'reply') return
    assert.match(result.text, /<pre>/)
    assert.match(result.text, /John/)
    assert.deepEqual(state.callsQueriedFor, ['client-1'])
  })

  it('multi-tenant: never returns calls from a different client', async () => {
    state.calls.push({
      id: 'call-2', client_id: 'OTHER-CLIENT', started_at: new Date().toISOString(),
      caller_phone: '+14035559999', caller_name: 'Leak',
      ai_summary: 'should never appear', call_status: 'HOT', lead_status: 'new',
      service_type: 'leak', duration_seconds: 60, next_steps: null,
      callback_preference: null, recording_url: null, ultravox_call_id: 'uv-2',
    })
    const result = await routeTelegramMessage(
      makeMsg({ text: '/calls' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    if (result.kind !== 'reply') throw new Error('expected reply')
    assert.doesNotMatch(result.text, /Leak/)
    assert.doesNotMatch(result.text, /14035559999/)
  })

  it('handles empty calls with friendly message', async () => {
    state.calls = []
    const result = await routeTelegramMessage(
      makeMsg({ text: '/calls' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    if (result.kind !== 'reply') throw new Error('expected reply')
    assert.match(result.text, /No calls yet/i)
  })

  it('formats /minutes with usage and remaining', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ text: '/minutes' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    if (result.kind !== 'reply') throw new Error('expected reply')
    assert.match(result.text, /30 \/ 250 min/)
    assert.match(result.text, /220 min remaining/)
  })

  it('idempotent on duplicate update_id', async () => {
    const update_id = 777
    const r1 = await routeTelegramMessage(
      makeMsg({ update_id, text: '/help' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(r1.kind, 'reply')
    const r2 = await routeTelegramMessage(
      makeMsg({ update_id, text: '/help' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    assert.equal(r2.kind, 'noop')
  })

  it('rate limits at 11th message in a minute', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await routeTelegramMessage(
        makeMsg({ text: '/help', update_id: 1000 + i }),
        { supa: makeFakeSupa(state), timezone: 'America/Regina' }
      )
      assert.equal(r.kind, 'reply')
    }
    const blocked = await routeTelegramMessage(
      makeMsg({ text: '/help', update_id: 2000 }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    if (blocked.kind !== 'reply') throw new Error('expected rate-limit reply')
    assert.match(blocked.text, /Slow down/i)
  })

  it('unknown command points back to /help', async () => {
    const result = await routeTelegramMessage(
      makeMsg({ text: 'yo whats up' }),
      { supa: makeFakeSupa(state), timezone: 'America/Regina' }
    )
    if (result.kind !== 'reply') throw new Error('expected reply')
    assert.match(result.text, /\/help/)
  })
})
