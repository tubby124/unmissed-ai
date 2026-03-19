/**
 * prompt-patcher.test.ts — Wave 1a unit tests
 *
 * Tests for patchCalendarBlock(), getServiceType(), getClosePerson().
 * TEMPORARY — remove when runtime injection replaces prompt mutation.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-patcher.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { patchCalendarBlock, getServiceType, getClosePerson } from '../prompt-patcher.js'

// ── patchCalendarBlock() ────────────────────────────────────────────────────

describe('patchCalendarBlock()', () => {
  const basePrompt = '# IDENTITY\nYou are Mark.\n\n# CONVERSATION FLOW\nGreet the caller.'

  test('enabled=true + no block → block appended (Omar bug class)', () => {
    const result = patchCalendarBlock(basePrompt, true, 'service appointment', 'Mark')
    assert.ok(result.includes('# CALENDAR BOOKING FLOW'), 'should contain calendar heading')
    assert.ok(result.includes('service appointment'), 'should include service type')
    assert.ok(result.includes('Mark will reach out'), 'should include close person')
    assert.ok(result.startsWith('# IDENTITY'), 'original content preserved')
  })

  test('enabled=false + block present → block removed (clean teardown)', () => {
    const withBlock = patchCalendarBlock(basePrompt, true)
    const result = patchCalendarBlock(withBlock, false)
    assert.ok(!result.includes('# CALENDAR BOOKING FLOW'), 'block should be removed')
    assert.ok(result.includes('# IDENTITY'), 'original content preserved')
    assert.ok(result.includes('# CONVERSATION FLOW'), 'other sections preserved')
  })

  test('enabled=true + block exists → no-op (idempotent)', () => {
    const withBlock = patchCalendarBlock(basePrompt, true, 'appointment', 'the team')
    const result = patchCalendarBlock(withBlock, true, 'appointment', 'the team')
    assert.equal(result, withBlock, 'should return identical prompt')
  })

  test('enabled=false + no block → no-op', () => {
    const result = patchCalendarBlock(basePrompt, false)
    assert.equal(result, basePrompt, 'should return original prompt')
  })

  test('calendar block is last section → clean removal', () => {
    const withBlock = patchCalendarBlock(basePrompt, true, 'appointment', 'the team')
    assert.ok(withBlock.includes('close as normal.'), 'calendar block should end with close as normal')
    const removed = patchCalendarBlock(withBlock, false)
    assert.ok(!removed.includes('# CALENDAR BOOKING FLOW'))
    assert.ok(removed.includes('# CONVERSATION FLOW'))
  })

  test('calendar block between sections → clean removal preserves following section', () => {
    const prompt = basePrompt + '\n\n# CALENDAR BOOKING FLOW\nsome booking content\n\n# VOICE NATURALNESS\nBe natural.'
    const result = patchCalendarBlock(prompt, false)
    assert.ok(!result.includes('# CALENDAR BOOKING FLOW'), 'calendar removed')
    assert.ok(result.includes('# VOICE NATURALNESS'), 'following section preserved')
    assert.ok(result.includes('Be natural.'), 'following section content preserved')
  })

  test('uses correct serviceType and closePerson in generated block', () => {
    const result = patchCalendarBlock(basePrompt, true, 'consultation', 'Hasan')
    assert.ok(result.includes('book a consultation'), 'service type in instruction')
    assert.ok(result.includes('Hasan will reach out'), 'close person in confirmation')
  })

  test('default serviceType is "appointment" and closePerson is "the team"', () => {
    const result = patchCalendarBlock(basePrompt, true)
    assert.ok(result.includes('book a appointment'), 'default service type')
    assert.ok(result.includes('the team will reach out'), 'default close person')
  })
})

// ── getServiceType() ────────────────────────────────────────────────────────

describe('getServiceType()', () => {
  test('null → appointment (default)', () => {
    assert.equal(getServiceType(null), 'appointment')
  })

  test('undefined → appointment (default)', () => {
    assert.equal(getServiceType(undefined), 'appointment')
  })

  test('auto_glass → service appointment', () => {
    assert.equal(getServiceType('auto_glass'), 'service appointment')
  })

  test('auto-glass (kebab case) → service appointment', () => {
    assert.equal(getServiceType('auto-glass'), 'service appointment')
  })

  test('plumbing → service call', () => {
    assert.equal(getServiceType('plumbing'), 'service call')
  })

  test('hvac → service call', () => {
    assert.equal(getServiceType('hvac'), 'service call')
  })

  test('real_estate → consultation', () => {
    assert.equal(getServiceType('real_estate'), 'consultation')
  })

  test('restaurant → reservation', () => {
    assert.equal(getServiceType('restaurant'), 'reservation')
  })

  test('dental → appointment', () => {
    assert.equal(getServiceType('dental'), 'appointment')
  })

  test('salon → appointment', () => {
    assert.equal(getServiceType('salon'), 'appointment')
  })

  test('unknown niche → appointment (fallback)', () => {
    assert.equal(getServiceType('totally_unknown'), 'appointment')
  })
})

// ── getClosePerson() ────────────────────────────────────────────────────────

describe('getClosePerson()', () => {
  test('extracts from "i\'ll get Mark to call" pattern', () => {
    const prompt = "if they need a callback, say i'll get Mark to call ya back"
    assert.equal(getClosePerson(prompt), 'Mark')
  })

  test('extracts from RE template "You are Aisha, Hasan\'s assistant"', () => {
    const prompt = "You are Aisha, Hasan's assistant at ABC Realty. You work for a real estate team."
    assert.equal(getClosePerson(prompt), 'Hasan')
  })

  test('smart quotes fall back to agentName (regex only matches straight quotes)', () => {
    // getClosePerson regex uses straight apostrophe — smart quotes don't match
    const prompt = "You are Aisha, Hasan\u2019s assistant at ABC Realty."
    assert.equal(getClosePerson(prompt, 'Hasan'), 'Hasan')
  })

  test('falls back to agentName when no patterns match', () => {
    assert.equal(getClosePerson('generic prompt with nothing', 'Bob'), 'Bob')
  })

  test('falls back to "the team" when no match and null agentName', () => {
    assert.equal(getClosePerson('generic prompt', null), 'the team')
  })

  test('falls back to "the team" when no match and undefined agentName', () => {
    assert.equal(getClosePerson('generic prompt'), 'the team')
  })
})
