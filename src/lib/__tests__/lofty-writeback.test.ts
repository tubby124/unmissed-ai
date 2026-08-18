import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  LOFTY_WRITEBACK_FAILURE_PREFIX,
  LOFTY_WRITEBACK_MARKER_PREFIX,
  resolveLoftyWritebackDisposition,
  shouldAttemptLoftyWriteback,
  writeCompletedCallToLofty,
} from '../lofty-writeback.js'
import { REALTOR_LOFTY_REVIVAL_MODE } from '../realtor-outbound-prompt.js'

type LeadRow = Record<string, any>

function createSupabaseMock(initialLead: LeadRow | null) {
  const updates: Array<Record<string, unknown>> = []
  let lead = initialLead ? { ...initialLead } : null
  const calls: string[] = []

  return {
    updates,
    calls,
    get lead() { return lead },
    from(table: string) {
      assert.equal(table, 'campaign_leads')
      const builder: any = {
        select(_cols: string) { calls.push('select'); return builder },
        eq(_col: string, _value: string) { return builder },
        maybeSingle() { return Promise.resolve({ data: lead, error: null }) },
        update(values: Record<string, unknown>) {
          calls.push('update')
          updates.push(values)
          if (lead) lead = { ...lead, ...values }
          return {
            eq(_col: string, _value: string) {
              return Promise.resolve({ data: lead ? [lead] : [], error: null })
            },
          }
        },
      }
      return builder
    },
  }
}

const baseInput = {
  client: { id: 'client-1', slug: 'hasan-sharif', niche: 'real_estate', business_name: 'Hasan Sharif' },
  metadata: { call_mode: REALTOR_LOFTY_REVIVAL_MODE, source: 'scheduled_callback', lead_id: 'lead-1' },
  campaignLeadId: 'lead-1',
  callLogId: 'call-log-1',
  callId: '11111111-1111-4111-8111-111111111111',
  endedAt: '2026-08-18T20:00:00.000Z',
  classification: { status: 'WARM', summary: 'Lead is considering a move in spring.', next_steps: 'Hasan should follow up next week.' },
  now: () => new Date('2026-08-18T20:01:00.000Z'),
}

describe('lofty-writeback numeric Lofty adapter', () => {
  const originalKey = process.env.LOFTY_API_KEY
  const originalBase = process.env.LOFTY_API_BASE_URL

  beforeEach(() => {
    process.env.LOFTY_API_KEY = 'server-only-test-key'
    process.env.LOFTY_API_BASE_URL = 'https://lofty.test'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.LOFTY_API_KEY
    else process.env.LOFTY_API_KEY = originalKey
    if (originalBase === undefined) delete process.env.LOFTY_API_BASE_URL
    else process.env.LOFTY_API_BASE_URL = originalBase
  })

  it('writes one concise idempotent note to numeric Lofty lead IDs only', async () => {
    const supabase = createSupabaseMock({ id: 'lead-1', lofty_lead_id: '123456789', external_ref: 'website-uuid', notes: 'Existing local note' })
    const httpCalls: Array<{ url: string; init: RequestInit; body?: any }> = []
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const parsed = init?.body ? JSON.parse(String(init.body)) : undefined
      httpCalls.push({ url: String(url), init: init ?? {}, body: parsed })
      if (init?.method === 'GET') return new Response(JSON.stringify({ notes: 'Remote note' }), { status: 200 })
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    const result = await writeCompletedCallToLofty({ ...baseInput, supabase, fetchImpl })

    assert.deepEqual(result, { ok: true, skipped: false, loftyLeadId: '123456789', disposition: 'answered' })
    assert.equal(httpCalls.length, 2)
    assert.equal(httpCalls[0].url, 'https://lofty.test/v1/leads/123456789')
    assert.equal(httpCalls[0].init.method, 'GET')
    assert.equal(httpCalls[1].init.method, 'PATCH')
    assert.match(httpCalls[1].body.notes, /Remote note/)
    assert.match(httpCalls[1].body.notes, new RegExp(`${LOFTY_WRITEBACK_MARKER_PREFIX} ${baseInput.callId}`))
    assert.match(httpCalls[1].body.notes, /Attempted: 2026-08-18T20:01:00.000Z/)
    assert.match(httpCalls[1].body.notes, /Disposition: answered/)
    assert.match(httpCalls[1].body.notes, /Summary: Lead is considering a move in spring\./)
    assert.match(httpCalls[1].body.notes, /Next step: Hasan should follow up next week\./)
    assert.match(httpCalls[1].body.notes, /Call ID: 11111111-1111-4111-8111-111111111111/)
    assert.doesNotMatch(httpCalls[1].body.notes, /transcript/i)
    assert.equal(httpCalls[1].init.headers && (httpCalls[1].init.headers as any).Authorization, 'Bearer server-only-test-key')
    assert.equal(supabase.updates.at(-1)?.disposition, 'answered')
  })

  it('keeps website UUID/external_ref path separate from numeric lofty_lead_id', async () => {
    const supabase = createSupabaseMock({ id: 'lead-1', lofty_lead_id: null, external_ref: '550e8400-e29b-41d4-a716-446655440000', notes: null })
    let fetchCount = 0
    const fetchImpl = (async () => { fetchCount++; return new Response('{}') }) as typeof fetch

    const result = await writeCompletedCallToLofty({ ...baseInput, supabase, fetchImpl })

    assert.deepEqual(result, { ok: true, skipped: true, reason: 'missing_numeric_lofty_lead_id' })
    assert.equal(fetchCount, 0)
    assert.equal(supabase.updates.length, 0)
  })

  it('is idempotent when the local or remote note marker already exists', async () => {
    const local = createSupabaseMock({ id: 'lead-1', lofty_lead_id: '987654321', notes: `${LOFTY_WRITEBACK_MARKER_PREFIX} ${baseInput.callId}` })
    let localFetchCount = 0
    const localResult = await writeCompletedCallToLofty({
      ...baseInput,
      supabase: local,
      fetchImpl: (async () => { localFetchCount++; return new Response('{}') }) as typeof fetch,
    })
    assert.deepEqual(localResult, { ok: true, skipped: true, reason: 'already_written' })
    assert.equal(localFetchCount, 0)

    const remote = createSupabaseMock({ id: 'lead-1', lofty_lead_id: '987654321', notes: null })
    const httpMethods: string[] = []
    const remoteResult = await writeCompletedCallToLofty({
      ...baseInput,
      supabase: remote,
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        httpMethods.push(init?.method ?? 'GET')
        return new Response(JSON.stringify({ notes: `${LOFTY_WRITEBACK_MARKER_PREFIX} ${baseInput.callId}` }), { status: 200 })
      }) as typeof fetch,
    })
    assert.deepEqual(remoteResult, { ok: true, skipped: true, reason: 'already_written_remote' })
    assert.deepEqual(httpMethods, ['GET'])
    assert.match(String(remote.updates.at(-1)?.notes), new RegExp(`${LOFTY_WRITEBACK_MARKER_PREFIX} ${baseInput.callId}`))
  })

  it('persists DNC/wrong-number suppression before any successful Lofty write so later enqueue is blocked', async () => {
    const supabase = createSupabaseMock({ id: 'lead-1', lofty_lead_id: '222333444', notes: 'start', status: 'queued', scheduled_callback_at: '2026-08-19T00:00:00.000Z' })
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') return new Response(JSON.stringify({ notes: '' }), { status: 200 })
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    const result = await writeCompletedCallToLofty({
      ...baseInput,
      supabase,
      fetchImpl,
      classification: { status: 'JUNK', summary: 'Caller said wrong number and to remove them.', next_steps: 'Do not call again.' },
    })

    assert.equal(result.ok, true)
    assert.equal(supabase.updates[0].status, 'dnc')
    assert.equal(supabase.updates[0].lead_status, 'closed')
    assert.equal(supabase.updates[0].scheduled_callback_at, null)
    assert.equal(supabase.updates[0].disposition, 'do_not_call')
    assert.equal(supabase.updates.at(-1)?.status, 'dnc')
  })

  it('makes writeback errors visible and retryable instead of pretending success', async () => {
    const supabase = createSupabaseMock({ id: 'lead-1', lofty_lead_id: '123123123', notes: 'local' })
    const result = await writeCompletedCallToLofty({
      ...baseInput,
      supabase,
      fetchImpl: (async () => new Response('bad gateway', { status: 502 })) as typeof fetch,
    })

    assert.deepEqual(result, { ok: false, retryable: true, reason: 'Lofty read failed: 502', loftyLeadId: '123123123' })
    const notes = String(supabase.updates.at(-1)?.notes)
    assert.match(notes, new RegExp(LOFTY_WRITEBACK_FAILURE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(notes, /call_id=11111111-1111-4111-8111-111111111111/)
    assert.equal(supabase.updates.at(-1)?.disposition, 'answered')
  })

  it('gates completed webhook invocation to strict Hasan Realtor Lofty campaign calls', () => {
    assert.equal(shouldAttemptLoftyWriteback({ ...baseInput, campaignLeadId: 'lead-1' }), true)
    assert.equal(shouldAttemptLoftyWriteback({ ...baseInput, campaignLeadId: 'lead-1', metadata: { call_mode: 'generic' } }), false)
    assert.equal(shouldAttemptLoftyWriteback({ ...baseInput, campaignLeadId: 'lead-1', client: { slug: 'other', niche: 'real_estate' } }), false)
    assert.equal(shouldAttemptLoftyWriteback({ ...baseInput, campaignLeadId: 'lead-1', client: { slug: 'hasan-sharif', niche: 'voicemail' } }), false)
    assert.equal(shouldAttemptLoftyWriteback({ ...baseInput, campaignLeadId: null }), false)
  })

  it('uses conservative outcome mapping without invented stage names', () => {
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'MISSED' }, endReason: 'unjoined' }), 'no_answer')
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'VOICEMAIL' } }), 'voicemail')
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'WARM', summary: 'future timeline, later this year' } }), 'future_timeline')
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'HOT', caller_data: { booked: true } } }), 'active_now')
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'JUNK', summary: 'wrong number' } }), 'wrong_number')
    // Summary quoting the opener “should I close the loop?” must not downgrade
    // a lead that actually booked — concrete booking evidence wins.
    assert.equal(resolveLoftyWritebackDisposition({ classification: { status: 'HOT', summary: 'They asked to close the loop', caller_data: { booked: true, appointment_time: '2026-08-20T15:00:00.000Z' } } }), 'active_now')
  })
})
