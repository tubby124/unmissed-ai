/**
 * agent-context-hours.test.ts — Wave 1a unit tests
 *
 * Tests for detectAfterHours(), buildAfterHoursBehaviorNote(),
 * and null-hours pattern (always-available niches).
 *
 * Run: npx tsx --test src/lib/__tests__/agent-context-hours.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectAfterHours,
  buildAfterHoursBehaviorNote,
  buildAgentContext,
  type ClientRow,
} from '../agent-context.js'

// ── Fixed timestamps for deterministic testing ──────────────────────────────
// America/Regina = CST (UTC-6), no DST

// Wednesday Mar 18 2026, 2:00 PM CST = UTC 20:00
const duringHoursWed = new Date('2026-03-18T20:00:00Z')

// Wednesday Mar 18 2026, 10:00 PM CST = UTC Mar 19 04:00
const afterHoursWed = new Date('2026-03-19T04:00:00Z')

// Saturday Mar 21 2026, 2:00 PM CST = UTC 20:00
const saturdayAfternoon = new Date('2026-03-21T20:00:00Z')

// Sunday Mar 22 2026, 2:00 PM CST = UTC 20:00
const sundayAfternoon = new Date('2026-03-22T20:00:00Z')

// ── detectAfterHours() ──────────────────────────────────────────────────────

describe('detectAfterHours()', () => {
  test('during business hours → false', () => {
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', '9am to 5pm', null),
      false,
    )
  })

  test('after business hours → true', () => {
    assert.equal(
      detectAfterHours(afterHoursWed, 'America/Regina', '9am to 5pm', null),
      true,
    )
  })

  test('null weekday hours → false (always available)', () => {
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', null, null),
      false,
    )
  })

  test('null weekend hours on weekend → false (always available)', () => {
    assert.equal(
      detectAfterHours(saturdayAfternoon, 'America/Regina', '9am to 5pm', null),
      false,
    )
  })

  test('"closed" on weekday → true', () => {
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', 'closed', null),
      true,
    )
  })

  test('"closed" on weekend → true', () => {
    assert.equal(
      detectAfterHours(saturdayAfternoon, 'America/Regina', '9am to 5pm', 'closed'),
      true,
    )
  })

  test('"n/a" on weekday → true', () => {
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', 'n/a', null),
      true,
    )
  })

  test('24h format hours work (9:00 to 17:00)', () => {
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', '9:00 to 17:00', null),
      false,
    )
    assert.equal(
      detectAfterHours(afterHoursWed, 'America/Regina', '9:00 to 17:00', null),
      true,
    )
  })

  test('extended hours: 8am to 9pm', () => {
    assert.equal(
      detectAfterHours(afterHoursWed, 'America/Regina', '8am to 9pm', null),
      true,
      '10 PM is after 9 PM close',
    )
    assert.equal(
      detectAfterHours(duringHoursWed, 'America/Regina', '8am to 9pm', null),
      false,
      '2 PM is during 8am-9pm',
    )
  })

  test('Sunday uses weekend hours', () => {
    assert.equal(
      detectAfterHours(sundayAfternoon, 'America/Regina', '9am to 5pm', 'closed'),
      true,
      'Sunday with weekend=closed is after hours',
    )
  })
})

// ── buildAfterHoursBehaviorNote() ───────────────────────────────────────────

describe('buildAfterHoursBehaviorNote()', () => {
  test('take_message → office closed note without transfer', () => {
    const note = buildAfterHoursBehaviorNote('take_message', null)
    assert.ok(note.includes('office is currently closed'), 'should mention closed')
    assert.ok(note.includes('collect their info'), 'should mention collecting info')
    assert.ok(!note.includes('transfer'), 'should NOT mention transfer')
  })

  test('route_emergency with phone → includes transfer instruction', () => {
    const note = buildAfterHoursBehaviorNote('route_emergency', '+13061234567')
    assert.ok(note.includes('emergency'), 'should mention emergency')
    assert.ok(note.includes('+13061234567'), 'should include emergency phone')
    assert.ok(note.includes('transfer'), 'should mention transfer')
  })

  test('route_emergency without phone → no transfer instruction', () => {
    const note = buildAfterHoursBehaviorNote('route_emergency', null)
    assert.ok(note.includes('office is currently closed'))
    assert.ok(!note.includes('transfer'))
  })

  test('custom behavior string → included in note', () => {
    const note = buildAfterHoursBehaviorNote('Please call back tomorrow morning', null)
    assert.ok(note.includes('Please call back tomorrow morning'))
  })
})

// ── Null-hours pattern (always-available niches) ─────────────────────────────

describe('Null-hours pattern (always-available niches)', () => {
  const reClient: ClientRow = {
    id: 're-id',
    slug: 'hasan-sharif',
    niche: 'real_estate',
    business_hours_weekday: null,
    business_hours_weekend: null,
  }

  test('null hours → never after hours at midnight', () => {
    const midnight = new Date('2026-03-19T06:00:00Z') // midnight CST
    const ctx = buildAgentContext(reClient, '+15551234567', [], midnight)
    assert.equal(ctx.caller.isAfterHours, false)
    assert.equal(ctx.caller.afterHoursBehaviorNote, null)
  })

  test('null hours → never after hours at noon', () => {
    const noon = new Date('2026-03-19T18:00:00Z') // noon CST
    const ctx = buildAgentContext(reClient, '+15551234567', [], noon)
    assert.equal(ctx.caller.isAfterHours, false)
    assert.equal(ctx.caller.afterHoursBehaviorNote, null)
  })

  test('null hours → never after hours on weekend', () => {
    const ctx = buildAgentContext(reClient, '+15551234567', [], saturdayAfternoon)
    assert.equal(ctx.caller.isAfterHours, false)
  })
})

// ── Emergency routing via after-hours ────────────────────────────────────────

describe('Emergency routing via after-hours behavior', () => {
  test('route_emergency note includes both emergency and non-emergency paths', () => {
    const note = buildAfterHoursBehaviorNote('route_emergency', '+13061234567')
    assert.ok(note.includes('emergency'), 'must mention emergency path')
    assert.ok(note.includes('Otherwise'), 'must have non-emergency fallback')
  })

  test('after-hours with take_message does NOT include emergency transfer', () => {
    const note = buildAfterHoursBehaviorNote('take_message', '+13061234567')
    assert.ok(!note.includes('transfer'), 'take_message should not transfer even if phone is set')
  })
})

// ── Office hours block injection ─────────────────────────────────────────────

describe('Office hours in callerContext', () => {
  test('configured hours appear in callerContextBlock', () => {
    const client: ClientRow = {
      id: 'test',
      slug: 'test',
      business_hours_weekday: '9am to 5pm',
      business_hours_weekend: '10am to 3pm',
    }
    const ctx = buildAgentContext(client, '+15551234567', [], duringHoursWed)
    assert.ok(ctx.assembled.callerContextBlock.includes('9am to 5pm'))
    assert.ok(ctx.assembled.callerContextBlock.includes('10am to 3pm'))
  })

  test('null hours → no office hours block in callerContext', () => {
    const client: ClientRow = {
      id: 'test',
      slug: 'test',
      business_hours_weekday: null,
      business_hours_weekend: null,
    }
    const ctx = buildAgentContext(client, '+15551234567', [], duringHoursWed)
    assert.ok(!ctx.assembled.callerContextBlock.includes('OFFICE HOURS'))
  })
})
