/**
 * prompt-patches.test.ts — Unit tests for applyPromptPatches()
 *
 * applyPromptPatches() is a pure synchronous function that applies prompt
 * mutations based on a ClientPatchData record — no DB, no side effects.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-patches.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyPromptPatches, type ClientPatchData } from '../prompt-patches.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseClient: ClientPatchData = {
  agent_name: null,
  intake_agent_name: null,
  niche: null,
  booking_enabled: false,
  sms_enabled: false,
  voice_style_preset: null,
}

const basePrompt =
  '# IDENTITY\nYou are Zara, a friendly voice agent.\n\n# TONE AND STYLE\nBe warm and concise.'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyPromptPatches()', () => {
  test('no features enabled — prompt returned unchanged', () => {
    const result = applyPromptPatches(basePrompt, baseClient)
    assert.equal(result, basePrompt)
  })

  test('booking_enabled → calendar block appended', () => {
    const client: ClientPatchData = { ...baseClient, booking_enabled: true }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(result.includes('# CALENDAR BOOKING FLOW'), 'should include calendar heading')
  })

  test('booking_enabled=false → no calendar block', () => {
    const client: ClientPatchData = { ...baseClient, booking_enabled: false }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(!result.includes('# CALENDAR BOOKING FLOW'), 'should not include calendar heading')
  })

  test('sms_enabled → SMS block appended', () => {
    const client: ClientPatchData = { ...baseClient, sms_enabled: true }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(result.includes('# SMS FOLLOW-UP'), 'should include SMS heading')
  })

  test('sms_enabled=false → no SMS block', () => {
    const client: ClientPatchData = { ...baseClient, sms_enabled: false }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(!result.includes('# SMS FOLLOW-UP'), 'should not include SMS heading')
  })

  test('agent_name rename → name replaced in prompt', () => {
    const client: ClientPatchData = {
      ...baseClient,
      agent_name: 'Alex',
      intake_agent_name: 'Zara',
    }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(result.includes('Alex'), 'should contain new name')
    assert.ok(!result.includes('Zara'), 'should not contain old name')
  })

  test('agent_name same as intake → no rename', () => {
    const client: ClientPatchData = {
      ...baseClient,
      agent_name: 'Zara',
      intake_agent_name: 'Zara',
    }
    const result = applyPromptPatches(basePrompt, client)
    assert.ok(result.includes('Zara'), 'name should still be present')
  })

  test('voice_style_preset set to valid preset → voice section modified', () => {
    // casual_friendly is always a valid key — confirmed from voice-presets.ts
    const client: ClientPatchData = {
      ...baseClient,
      voice_style_preset: 'casual_friendly',
    }
    const result = applyPromptPatches(basePrompt, client)
    assert.notEqual(result, basePrompt, 'prompt should be modified when valid preset is set')
  })

  test('voice_style_preset set to unknown key → no change', () => {
    const client: ClientPatchData = {
      ...baseClient,
      voice_style_preset: 'nonexistent_preset',
    }
    const result = applyPromptPatches(basePrompt, client)
    assert.equal(result, basePrompt, 'prompt should be unchanged for unknown preset')
  })
})
