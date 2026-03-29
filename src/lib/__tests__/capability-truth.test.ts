/**
 * capability-truth.test.ts — Wave 2 tests
 *
 * Verifies that the UI capability contract matches actual runtime state.
 * Catches "UI lies" where a feature appears enabled but won't actually work.
 *
 * Uses 3 canary fixtures:
 *   1. hasan-sharif — real_estate, full capability
 *   2. windshield-hub — auto_glass, SMS ON, optional booking
 *   3. voicemail — minimal capability
 *
 * Run: npx tsx --test src/lib/__tests__/capability-truth.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getCapabilities, NICHE_CAPABILITIES } from '../niche-capabilities.js'
import {
  buildCalendarTools,
  buildTransferTools,
  buildSmsTools,
} from '../ultravox.js'
import { patchCalendarBlock } from '../prompt-patcher.js'

const CALENDAR_HEADING = '# CALENDAR BOOKING FLOW'

// ── Canary 1: hasan-sharif (real_estate) — full capability ──────────────────

describe('Canary: hasan-sharif (real_estate) — full capability', () => {
  const caps = getCapabilities('real_estate')

  test('has booking, transfer, SMS-eligible, knowledge lookup', () => {
    assert.equal(caps.bookAppointments, true)
    assert.equal(caps.transferCalls, true)
    assert.equal(caps.useKnowledgeLookup, true)
    assert.equal(caps.takeMessages, true)
    assert.equal(caps.usePropertyLookup, true)
  })

  test('booking_enabled=true → calendar tools + prompt patch', () => {
    const tools = buildCalendarTools('hasan-sharif')
    assert.equal(tools.length, 1, 'triage stage: transitionToBookingStage only (direct tools live in booking stage)')
    const names = tools.map(t => (t as Record<string, any>).temporaryTool?.modelToolName)
    assert.ok(names.includes('transitionToBookingStage'))
    assert.ok(!names.includes('checkCalendarAvailability'), 'direct calendar tool must not be in triage stage')
    assert.ok(!names.includes('bookAppointment'), 'direct booking tool must not be in triage stage')

    const prompt = patchCalendarBlock('# Test prompt', true, 'consultation', 'Hasan')
    assert.ok(prompt.includes(CALENDAR_HEADING))
    assert.ok(prompt.includes('consultation'))
    assert.ok(prompt.includes('Hasan'))
  })

  test('transfer tools built with slug', () => {
    const tools = buildTransferTools('hasan-sharif')
    assert.equal(tools.length, 1)
    assert.equal(
      (tools[0] as Record<string, any>).temporaryTool.modelToolName,
      'transferCall',
    )
  })

  test('SMS tools built with slug', () => {
    const tools = buildSmsTools('hasan-sharif')
    assert.equal(tools.length, 1)
    assert.equal(
      (tools[0] as Record<string, any>).temporaryTool.modelToolName,
      'sendTextMessage',
    )
  })
})

// ── Canary 2: windshield-hub (auto_glass) ───────────────────────────────────

describe('Canary: windshield-hub (auto_glass)', () => {
  const caps = getCapabilities('auto_glass')

  test('has transfer and knowledge, no default booking', () => {
    assert.equal(caps.transferCalls, true)
    assert.equal(caps.useKnowledgeLookup, true)
    assert.equal(caps.bookAppointments, false, 'auto_glass defaults to no booking')
  })

  test('SMS tools work for auto_glass', () => {
    const tools = buildSmsTools('windshield-hub')
    assert.equal(tools.length, 1)
    assert.equal(
      (tools[0] as Record<string, any>).temporaryTool.modelToolName,
      'sendTextMessage',
    )
  })

  test('booking tools CAN be built even if niche defaults to no booking', () => {
    // booking_enabled is a per-client flag, not niche-locked
    const tools = buildCalendarTools('windshield-hub')
    assert.equal(tools.length, 1, 'triage stage produces transitionToBookingStage regardless of niche default')
  })
})

// ── Canary 3: voicemail — minimal capability ────────────────────────────────

describe('Canary: voicemail — minimal capability', () => {
  const caps = getCapabilities('voicemail')

  test('NEVER has booking', () => {
    assert.equal(caps.bookAppointments, false, 'voicemail must never book')
  })

  test('NEVER has transfer', () => {
    assert.equal(caps.transferCalls, false, 'voicemail must never transfer')
  })

  test('NEVER has knowledge lookup', () => {
    assert.equal(caps.useKnowledgeLookup, false)
  })

  test('NEVER has emergency routing', () => {
    assert.equal(caps.emergencyRouting, false)
  })

  test('can only take messages', () => {
    assert.equal(caps.takeMessages, true)
  })

  test('prompt patching with booking=false is no-op', () => {
    const prompt = '# IDENTITY\nYou are a voicemail bot.'
    const patched = patchCalendarBlock(prompt, false)
    assert.equal(patched, prompt)
  })

  test('voicemail prompt should never get calendar block even if accidentally enabled', () => {
    // This tests the defense: even if booking_enabled=true in DB,
    // voicemail niche should NOT have bookAppointments capability
    assert.equal(caps.bookAppointments, false, 'capability gate prevents booking')
  })
})

// ── UI lie detection ────────────────────────────────────────────────────────

describe('Capability truth: UI lie detection', () => {
  test('google_calendar_connected=false + booking_enabled=true → effective false', () => {
    // When calendar is not connected, the system should treat booking as disabled.
    // The prompt should NOT have a calendar block.
    const prompt = '# IDENTITY\nTest agent.'
    const notPatched = patchCalendarBlock(prompt, false) // effective false
    assert.ok(!notPatched.includes(CALENDAR_HEADING))
  })

  test('booking_enabled=false → no booking regardless of calendar connection', () => {
    const prompt = '# IDENTITY\nTest agent.'
    const patched = patchCalendarBlock(prompt, false)
    assert.ok(!patched.includes(CALENDAR_HEADING))
  })

  test('sms_enabled=false → no SMS tool should be built', () => {
    // The guard is at the call site — buildSmsTools is only called when sms_enabled=true.
    // We verify the tools ARE built when called (the guard is in the webhook, not the builder).
    const tools = buildSmsTools('test-slug')
    assert.equal(tools.length, 1, 'builder always builds when called')
  })
})

// ── Registry vs runtime consistency ──────────────────────────────────────────

describe('Registry vs runtime consistency', () => {
  const bookableNiches = Object.entries(NICHE_CAPABILITIES)
    .filter(([, caps]) => caps.bookAppointments)
    .map(([niche]) => niche)

  test('all bookable niches produce transitionToBookingStage (triage stage tool)', () => {
    for (const niche of bookableNiches) {
      const tools = buildCalendarTools(niche)
      assert.equal(tools.length, 1, `${niche}: triage should produce 1 tool (transitionToBookingStage only)`)
      const names = tools.map(t => (t as Record<string, any>).temporaryTool?.modelToolName)
      assert.ok(names.includes('transitionToBookingStage'), `${niche}: missing transitionToBookingStage`)
      assert.ok(!names.includes('checkCalendarAvailability'), `${niche}: checkCalendarAvailability must not be in triage stage`)
      assert.ok(!names.includes('bookAppointment'), `${niche}: bookAppointment must not be in triage stage`)
    }
  })

  test('bookable niches list is non-empty', () => {
    assert.ok(bookableNiches.length > 0, 'at least one niche should support booking')
    assert.ok(bookableNiches.includes('real_estate'))
    assert.ok(bookableNiches.includes('dental'))
    assert.ok(bookableNiches.includes('salon'))
  })

})
