/**
 * voice-tone-presets.test.ts — Phase E Wave 4
 *
 * Unit tests for the founding-4 voice tone presets
 * (src/lib/prompt-config/voice-tone-presets.ts).
 *
 * Legacy presets in src/lib/voice-presets.ts are covered elsewhere — this file
 * only asserts the new additive set. Also asserts that buildSlotContext prefers
 * the new presets when the intake names one.
 *
 * Run: npx tsx --test src/lib/__tests__/voice-tone-presets.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { VOICE_TONE_PRESETS } from '../prompt-config/voice-tone-presets.js'
import { VOICE_PRESETS } from '../voice-presets.js'
import { buildSlotContext } from '../prompt-slots.js'

const EXPECTED_KEYS = [
  'casual_confident',
  'polished_professional',
  'alert_relaxed',
  'upbeat_confident',
] as const

describe('VOICE_TONE_PRESETS — founding-4 extraction', () => {
  test('all 4 expected keys exist', () => {
    for (const key of EXPECTED_KEYS) {
      assert.ok(VOICE_TONE_PRESETS[key], `missing preset: ${key}`)
    }
    assert.equal(Object.keys(VOICE_TONE_PRESETS).length, EXPECTED_KEYS.length,
      'unexpected number of founding-4 presets')
  })

  for (const key of EXPECTED_KEYS) {
    test(`${key}: every required field is non-empty`, () => {
      const p = VOICE_TONE_PRESETS[key]
      assert.ok(p.id.trim().length > 0, 'id empty')
      assert.ok(p.label.trim().length > 0, 'label empty')
      assert.ok(p.description.trim().length > 0, 'description empty')
      assert.ok(p.personalityLine.trim().length > 0, 'personalityLine empty')
      assert.ok(p.toneStyleBlock.trim().length > 0, 'toneStyleBlock empty')
      assert.ok(p.fillerStyle.trim().length > 0, 'fillerStyle empty')
      assert.ok(p.greetingLine.trim().length > 0, 'greetingLine empty')
      assert.ok(p.closingLine.trim().length > 0, 'closingLine empty')
    })

    test(`${key}: preset.id matches object key (no copy-paste bug)`, () => {
      assert.equal(VOICE_TONE_PRESETS[key].id, key)
    })

    test(`${key}: toneStyleBlock + fillerStyle under 400 chars (bloat guard)`, () => {
      const p = VOICE_TONE_PRESETS[key]
      const combined = p.toneStyleBlock.length + p.fillerStyle.length
      assert.ok(combined < 400,
        `${key}: toneStyleBlock(${p.toneStyleBlock.length}) + fillerStyle(${p.fillerStyle.length}) = ${combined} >= 400`)
    })
  }

  test('no overlap with legacy VOICE_PRESETS keys', () => {
    for (const key of EXPECTED_KEYS) {
      assert.ok(!(key in VOICE_PRESETS),
        `${key} collides with legacy VOICE_PRESETS — rename to avoid ambiguity`)
    }
  })
})

describe('buildSlotContext — voice tone preset resolution', () => {
  test('casual_confident intake resolves to founding-4 preset, not legacy casual_friendly', () => {
    const ctx = buildSlotContext({
      niche: 'auto_glass',
      business_name: 'Test Auto Glass',
      agent_name: 'Sam',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      voice_style_preset: 'casual_confident',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_TONE_PRESETS.casual_confident.toneStyleBlock)
    assert.notEqual(ctx.toneStyleBlock, VOICE_PRESETS.casual_friendly.toneStyleBlock)
    assert.equal(ctx.fillerStyle, VOICE_TONE_PRESETS.casual_confident.fillerStyle)
    assert.equal(ctx.personalityLine, VOICE_TONE_PRESETS.casual_confident.personalityLine)
  })

  test('polished_professional intake resolves to founding-4 preset', () => {
    const ctx = buildSlotContext({
      niche: 'real_estate',
      business_name: 'Test Realty',
      agent_name: 'Fatema',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      voice_style_preset: 'polished_professional',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_TONE_PRESETS.polished_professional.toneStyleBlock)
    assert.equal(ctx.personalityLine, VOICE_TONE_PRESETS.polished_professional.personalityLine)
  })

  test('alert_relaxed intake resolves to founding-4 preset', () => {
    const ctx = buildSlotContext({
      niche: 'property_management',
      business_name: 'Urban Vibe Properties',
      agent_name: 'Alisha',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      voice_style_preset: 'alert_relaxed',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_TONE_PRESETS.alert_relaxed.toneStyleBlock)
    assert.equal(ctx.fillerStyle, VOICE_TONE_PRESETS.alert_relaxed.fillerStyle)
  })

  test('upbeat_confident intake resolves to founding-4 preset', () => {
    const ctx = buildSlotContext({
      niche: 'auto_glass',
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      voice_style_preset: 'upbeat_confident',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_TONE_PRESETS.upbeat_confident.toneStyleBlock)
    assert.equal(ctx.personalityLine, VOICE_TONE_PRESETS.upbeat_confident.personalityLine)
  })

  test('legacy casual_friendly intake still resolves to legacy preset (no regression)', () => {
    const ctx = buildSlotContext({
      niche: 'auto_glass',
      business_name: 'Mountain View Auto Glass',
      agent_name: 'Sam',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      voice_style_preset: 'casual_friendly',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_PRESETS.casual_friendly.toneStyleBlock)
  })

  test('unknown preset falls back to legacy casual_friendly (default behaviour)', () => {
    const ctx = buildSlotContext({
      niche: 'auto_glass',
      business_name: 'Test',
      agent_name: 'Sam',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      voice_style_preset: 'nonexistent_preset_xyz',
    })
    assert.equal(ctx.toneStyleBlock, VOICE_PRESETS.casual_friendly.toneStyleBlock)
  })
})
