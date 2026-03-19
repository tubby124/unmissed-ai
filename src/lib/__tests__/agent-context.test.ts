/**
 * agent-context.test.ts — Phase 1B unit tests
 *
 * Verifies buildAgentContext() produces correct normalized output.
 * Run: npx tsx --test src/lib/__tests__/agent-context.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAgentContext,
  detectAfterHours,
  buildAfterHoursBehaviorNote,
  type ClientRow,
  type PriorCall,
  type AgentContext,
} from '../agent-context.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_WEEKDAY = new Date('2026-03-18T15:00:00Z') // Wednesday 9AM MST = "in hours" for 9am-5pm
const FIXED_AFTER_HOURS = new Date('2026-03-18T04:00:00Z') // Wednesday 10PM MST = after hours

const BASE_CLIENT: ClientRow = {
  id: 'client-uuid-001',
  slug: 'hasan-sharif',
  niche: 'real_estate',
  business_name: 'Hasan Sharif Realty',
  timezone: 'America/Edmonton',
  business_hours_weekday: '9am to 5pm',
  business_hours_weekend: 'closed',
  after_hours_behavior: 'take_message',
  after_hours_emergency_phone: null,
  business_facts: 'Licensed in Saskatchewan and Alberta.',
  extra_qa: [
    { q: 'Do you do commercial?', a: 'Residential only.' },
    { q: 'Where are you based?', a: 'Saskatoon SK.' },
  ],
  context_data: null,
  context_data_label: null,
}

const PRIOR_CALLS: PriorCall[] = [
  {
    started_at: '2026-03-10T14:00:00Z',
    call_status: 'WARM',
    ai_summary: 'Caller asked about listing on Stensrud Rd.',
    caller_name: 'Ahmed Khan',
    ultravox_call_id: 'uv-call-abc123',
  },
  {
    started_at: '2026-03-05T12:00:00Z',
    call_status: 'COLD',
    ai_summary: null,
    caller_name: null,
    ultravox_call_id: 'uv-call-def456',
  },
]

// ── Required fields ───────────────────────────────────────────────────────────

describe('buildAgentContext() — required fields present', () => {
  const ctx: AgentContext = buildAgentContext(
    BASE_CLIENT,
    '+13068507687',
    [],
    FIXED_WEEKDAY,
  )

  test('business.clientId matches client.id', () => {
    assert.equal(ctx.business.clientId, 'client-uuid-001')
  })

  test('business.slug matches client.slug', () => {
    assert.equal(ctx.business.slug, 'hasan-sharif')
  })

  test('business.niche resolved from client.niche', () => {
    assert.equal(ctx.business.niche, 'real_estate')
  })

  test('business.businessName resolved from client.business_name', () => {
    assert.equal(ctx.business.businessName, 'Hasan Sharif Realty')
  })

  test('business.timezone defaults or matches client.timezone', () => {
    assert.equal(ctx.business.timezone, 'America/Edmonton')
  })

  test('caller.todayIso is a YYYY-MM-DD string', () => {
    assert.match(ctx.caller.todayIso, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('caller.dayOfWeek is a non-empty string', () => {
    assert.ok(ctx.caller.dayOfWeek.length > 0)
  })

  test('caller.timeNow is a non-empty string', () => {
    assert.ok(ctx.caller.timeNow.length > 0)
  })

  test('capabilities is an object with all 8 boolean fields', () => {
    const fields = [
      'takeMessages', 'bookAppointments', 'transferCalls', 'useKnowledgeLookup',
      'usePropertyLookup', 'useTenantLookup', 'updateTenantRequests', 'emergencyRouting',
    ] as const
    for (const f of fields) {
      assert.equal(typeof ctx.capabilities[f], 'boolean', `capabilities.${f} must be boolean`)
    }
  })

  test('assembled blocks are all strings (never undefined)', () => {
    assert.equal(typeof ctx.assembled.callerContextBlock, 'string')
    assert.equal(typeof ctx.assembled.businessFactsBlock, 'string')
    assert.equal(typeof ctx.assembled.extraQaBlock, 'string')
    assert.equal(typeof ctx.assembled.contextDataBlock, 'string')
  })
})

// ── Default/fallback behavior ─────────────────────────────────────────────────

describe('buildAgentContext() — fallback/default behavior', () => {
  test('niche defaults to "other" when client.niche is null', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: null }, 'unknown')
    assert.equal(ctx.business.niche, 'other')
  })

  test('businessName falls back to slug when client.business_name is null', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'fallback-slug', business_name: null }, 'unknown')
    assert.equal(ctx.business.businessName, 'fallback-slug')
  })

  test('timezone defaults to America/Regina when not set', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', timezone: null }, 'unknown')
    assert.equal(ctx.business.timezone, 'America/Regina')
  })

  test('afterHoursBehavior defaults to take_message when not set', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', after_hours_behavior: null }, 'unknown')
    assert.equal(ctx.business.afterHoursBehavior, 'take_message')
  })

  test('contextDataLabel defaults to Reference Data when not set', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', context_data_label: null }, 'unknown')
    assert.equal(ctx.business.contextDataLabel, 'Reference Data')
  })

  test('extraQa filters out pairs with empty q or a', () => {
    const ctx = buildAgentContext({
      id: 'x', slug: 'x',
      extra_qa: [
        { q: 'Real question?', a: 'Real answer.' },
        { q: '', a: 'orphan answer' },
        { q: 'orphan question', a: '' },
      ],
    }, 'unknown')
    assert.equal(ctx.business.extraQa.length, 1)
    assert.equal(ctx.business.extraQa[0].q, 'Real question?')
  })

  test('caller.callerPhone is null when callerPhone is "unknown"', () => {
    const ctx = buildAgentContext(BASE_CLIENT, 'unknown')
    assert.equal(ctx.caller.callerPhone, null)
  })

  test('caller.isReturningCaller is false with no prior calls', () => {
    const ctx = buildAgentContext(BASE_CLIENT, '+13068507687', [])
    assert.equal(ctx.caller.isReturningCaller, false)
    assert.equal(ctx.caller.priorCallCount, 0)
  })

  test('businessFactsBlock is empty string when business_facts is null', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', business_facts: null }, 'unknown')
    assert.equal(ctx.assembled.businessFactsBlock, '')
  })

  test('extraQaBlock is empty string when extra_qa is null', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', extra_qa: null }, 'unknown')
    assert.equal(ctx.assembled.extraQaBlock, '')
  })

  test('contextDataBlock is empty string when context_data is null', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', context_data: null }, 'unknown')
    assert.equal(ctx.assembled.contextDataBlock, '')
  })
})

// ── Niche-specific capability mapping ─────────────────────────────────────────

describe('buildAgentContext() — niche-specific capability mapping', () => {
  test('real_estate: booking + property lookup enabled', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: 'real_estate' }, 'unknown')
    assert.equal(ctx.capabilities.bookAppointments, true)
    assert.equal(ctx.capabilities.usePropertyLookup, true)
  })

  test('voicemail: no booking, no transfer, no knowledge lookup', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: 'voicemail' }, 'unknown')
    assert.equal(ctx.capabilities.bookAppointments, false)
    assert.equal(ctx.capabilities.transferCalls, false)
    assert.equal(ctx.capabilities.useKnowledgeLookup, false)
  })

  test('property_management: no transfer, tenant lookup, update requests enabled (Phase 7)', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: 'property_management' }, 'unknown')
    assert.equal(ctx.capabilities.transferCalls, false)
    assert.equal(ctx.capabilities.useTenantLookup, true)
    assert.equal(ctx.capabilities.updateTenantRequests, true)
  })

  test('hvac: emergency routing enabled', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: 'hvac' }, 'unknown')
    assert.equal(ctx.capabilities.emergencyRouting, true)
  })

  test('unknown niche falls back to conservative defaults', () => {
    const ctx = buildAgentContext({ id: 'x', slug: 'x', niche: 'not_a_real_niche' }, 'unknown')
    assert.equal(ctx.capabilities.bookAppointments, false)
    assert.equal(ctx.capabilities.transferCalls, false)
    assert.equal(ctx.capabilities.takeMessages, true)
  })
})

// ── After-hours detection ─────────────────────────────────────────────────────

describe('detectAfterHours()', () => {
  const tz = 'America/Edmonton'

  test('returns false when in hours (9am to 5pm, Wednesday 9AM MST)', () => {
    // FIXED_WEEKDAY = 2026-03-18T15:00:00Z = 9:00 AM MST
    assert.equal(detectAfterHours(FIXED_WEEKDAY, tz, '9am to 5pm', null), false)
  })

  test('returns true when after hours (9am to 5pm, Wednesday 10PM MST)', () => {
    // FIXED_AFTER_HOURS = 2026-03-18T04:00:00Z = 10:00 PM MST previous day
    assert.equal(detectAfterHours(FIXED_AFTER_HOURS, tz, '9am to 5pm', null), true)
  })

  test('returns true when weekend hours are "closed"', () => {
    // Saturday in any timezone
    const saturday = new Date('2026-03-21T15:00:00Z')
    assert.equal(detectAfterHours(saturday, tz, '9am to 5pm', 'closed'), true)
  })

  test('returns false when hoursStr is null (no hours configured)', () => {
    assert.equal(detectAfterHours(FIXED_WEEKDAY, tz, null, null), false)
  })

  test('returns true when hoursStr is "n/a"', () => {
    assert.equal(detectAfterHours(FIXED_WEEKDAY, tz, 'n/a', null), true)
  })
})

describe('buildAgentContext() — after-hours fields', () => {
  test('isAfterHours=false and afterHoursBehaviorNote=null during business hours', () => {
    const ctx = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekday: '9am to 5pm' },
      '+13068507687',
      [],
      FIXED_WEEKDAY,
    )
    assert.equal(ctx.caller.isAfterHours, false)
    assert.equal(ctx.caller.afterHoursBehaviorNote, null)
  })

  test('isAfterHours=true and afterHoursBehaviorNote is non-null string after hours', () => {
    const ctx = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekday: '9am to 5pm' },
      '+13068507687',
      [],
      FIXED_AFTER_HOURS,
    )
    assert.equal(ctx.caller.isAfterHours, true)
    assert.ok(typeof ctx.caller.afterHoursBehaviorNote === 'string')
    assert.ok((ctx.caller.afterHoursBehaviorNote as string).startsWith('AFTER HOURS:'))
  })

  test('after-hours note includes emergency phone when behavior=route_emergency', () => {
    const note = buildAfterHoursBehaviorNote('route_emergency', '+13065551234')
    assert.ok(note.includes('+13065551234'))
    assert.ok(note.includes('emergency'))
  })

  test('after-hours note omits phone transfer when behavior=route_emergency but no phone configured', () => {
    // Without a phone, falls through to custom-behavior case — returns behavior string verbatim.
    // This matches inbound/route.ts behavior faithfully (no take_message fallback in that branch).
    const note = buildAfterHoursBehaviorNote('route_emergency', null)
    assert.ok(note.startsWith('AFTER HOURS:'))
    assert.ok(!note.includes('transfer to'), 'should not include a phone transfer line without a phone')
  })

  test('after-hours note for take_message behavior', () => {
    const note = buildAfterHoursBehaviorNote('take_message', null)
    assert.ok(note.includes('Still help the caller'))
    assert.ok(note.includes('next business day'))
  })
})

// ── Returning caller fields ───────────────────────────────────────────────────

describe('buildAgentContext() — returning caller', () => {
  const ctx = buildAgentContext(BASE_CLIENT, '+13068507687', PRIOR_CALLS, FIXED_WEEKDAY)

  test('isReturningCaller=true with prior calls', () => {
    assert.equal(ctx.caller.isReturningCaller, true)
  })

  test('priorCallCount matches number of prior calls', () => {
    assert.equal(ctx.caller.priorCallCount, 2)
  })

  test('returningCallerName taken from first prior call with caller_name set', () => {
    assert.equal(ctx.caller.returningCallerName, 'Ahmed Khan')
  })

  test('lastCallSummary truncated to 120 chars', () => {
    assert.ok(ctx.caller.lastCallSummary !== null)
    assert.ok((ctx.caller.lastCallSummary as string).length <= 120)
    assert.ok((ctx.caller.lastCallSummary as string).includes('Stensrud Rd'))
  })

  test('firstPriorCallId is from the most recent call', () => {
    assert.equal(ctx.caller.firstPriorCallId, 'uv-call-abc123')
  })

  test('lastCallDate is non-null and human-readable', () => {
    assert.ok(ctx.caller.lastCallDate !== null)
    // e.g. "Mar 10"
    assert.match(ctx.caller.lastCallDate as string, /[A-Z][a-z]+ \d+/)
  })

  test('isReturningCaller=false when callerPhone is unknown even with prior calls', () => {
    const ctx2 = buildAgentContext(BASE_CLIENT, 'unknown', PRIOR_CALLS, FIXED_WEEKDAY)
    assert.equal(ctx2.caller.isReturningCaller, false)
    assert.equal(ctx2.caller.priorCallCount, 0)
  })
})

// ── Assembled blocks ──────────────────────────────────────────────────────────

describe('buildAgentContext() — assembled blocks', () => {
  const ctx = buildAgentContext(BASE_CLIENT, '+13068507687', [], FIXED_WEEKDAY)

  test('callerContextBlock starts with "[TODAY:"', () => {
    assert.ok(ctx.assembled.callerContextBlock.startsWith('[TODAY:'))
    assert.ok(ctx.assembled.callerContextBlock.endsWith(']'))
  })

  test('callerContextBlock includes CALLER PHONE when known', () => {
    assert.ok(ctx.assembled.callerContextBlock.includes('CALLER PHONE: +13068507687'))
  })

  test('callerContextBlock does NOT include CALLER PHONE when unknown', () => {
    const ctx2 = buildAgentContext(BASE_CLIENT, 'unknown', [], FIXED_WEEKDAY)
    assert.ok(!ctx2.assembled.callerContextBlock.includes('CALLER PHONE'))
  })

  test('businessFactsBlock contains business facts content', () => {
    assert.ok(ctx.assembled.businessFactsBlock.includes('Licensed in Saskatchewan'))
    assert.ok(ctx.assembled.businessFactsBlock.includes('Business Facts'))
  })

  test('extraQaBlock contains Q&A pairs', () => {
    assert.ok(ctx.assembled.extraQaBlock.includes('Do you do commercial?'))
    assert.ok(ctx.assembled.extraQaBlock.includes('Residential only.'))
  })

  test('callerContextBlock includes RETURNING CALLER when prior calls exist', () => {
    const ctx2 = buildAgentContext(BASE_CLIENT, '+13068507687', PRIOR_CALLS, FIXED_WEEKDAY)
    assert.ok(ctx2.assembled.callerContextBlock.includes('RETURNING CALLER'))
    assert.ok(ctx2.assembled.callerContextBlock.includes('Ahmed Khan'))
  })

  test('callerContextBlock includes AFTER HOURS note when after hours', () => {
    const ctx3 = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekday: '9am to 5pm' },
      '+13068507687',
      [],
      FIXED_AFTER_HOURS,
    )
    assert.ok(ctx3.assembled.callerContextBlock.includes('AFTER HOURS'))
  })

  test('callerContextBlock includes CURRENT BUSINESS HOURS block when weekday hours are set', () => {
    const ctx2 = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekday: '9am to 5pm' },
      '+13068507687', [], FIXED_WEEKDAY,
    )
    assert.ok(ctx2.assembled.callerContextBlock.includes('CURRENT BUSINESS HOURS:'))
    assert.ok(ctx2.assembled.callerContextBlock.includes('- Weekdays: 9am to 5pm'))
  })

  test('callerContextBlock includes weekend hours in dedicated block when set', () => {
    const ctx2 = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekend: 'Saturday 10am to 2pm' },
      '+13068507687', [], FIXED_WEEKDAY,
    )
    assert.ok(ctx2.assembled.callerContextBlock.includes('CURRENT BUSINESS HOURS:'))
    assert.ok(ctx2.assembled.callerContextBlock.includes('- Weekends: Saturday 10am to 2pm'))
  })

  test('callerContextBlock does NOT include CURRENT BUSINESS HOURS when hours are null', () => {
    const ctx2 = buildAgentContext(
      { ...BASE_CLIENT, business_hours_weekday: null, business_hours_weekend: null },
      '+13068507687', [], FIXED_WEEKDAY,
    )
    assert.ok(!ctx2.assembled.callerContextBlock.includes('CURRENT BUSINESS HOURS'))
  })

  test('contextDataBlock uses custom label when context_data_label is set', () => {
    const ctx4 = buildAgentContext({
      id: 'x', slug: 'x',
      context_data: 'some data',
      context_data_label: 'Tenant List',
    }, 'unknown')
    assert.ok(ctx4.assembled.contextDataBlock.includes('Tenant List'))
  })
})
