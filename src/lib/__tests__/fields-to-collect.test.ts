/**
 * fields-to-collect.test.ts — Phase E.5 Wave 1 regression guard
 *
 * Verifies that intake.fields_to_collect (text[] column populated by the
 * Day-1 edit panel from Phase E Wave 3) overrides the legacy
 * completion_fields string AND the niche-default COMPLETION_FIELDS.
 *
 * Before E.5, fields_to_collect was phantom data: UI + DB + save handler
 * shipped, but no slot consumer read it. This test locks in the override.
 *
 * Run: npx tsx --test src/lib/__tests__/fields-to-collect.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildPromptFromIntake } from '../prompt-builder.js'

const AUTO_GLASS_DEFAULT = 'vehicle year, make, model, and preferred timing'

function baseIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: 'Test Auto Glass',
    niche: 'auto_glass',
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    call_handling_mode: 'triage',
    agent_mode: 'lead_capture',
    ...overrides,
  }
}

describe('Phase E.5 Wave 1 — fields_to_collect slot consumer', () => {
  test('empty fields_to_collect → niche default is used', () => {
    const prompt = buildPromptFromIntake(baseIntake())
    assert.ok(
      prompt.includes(AUTO_GLASS_DEFAULT),
      `expected niche default "${AUTO_GLASS_DEFAULT}" in prompt`,
    )
  })

  test('populated fields_to_collect → array joined list overrides niche default', () => {
    const prompt = buildPromptFromIntake(
      baseIntake({
        fields_to_collect: ['name', 'phone', 'vehicle year'],
      }),
    )
    assert.ok(
      prompt.includes('name, phone, vehicle year'),
      'expected joined fields_to_collect in prompt',
    )
    // The legacy niche default should NOT appear — override replaces it.
    assert.ok(
      !prompt.includes(AUTO_GLASS_DEFAULT),
      `niche default "${AUTO_GLASS_DEFAULT}" should have been replaced`,
    )
  })

  test('populated fields_to_collect → GOAL slot contains the fields', () => {
    const prompt = buildPromptFromIntake(
      baseIntake({
        fields_to_collect: ['name', 'phone', 'vehicle year', 'damage type'],
      }),
    )
    // Render check: Primary goal slot uses "Collect ${completionFields} so ${closePerson} can ${closeAction}"
    // Also appears in COMPLETION CHECK. Look for both.
    assert.ok(
      prompt.includes('Collect name, phone, vehicle year, damage type'),
      'expected GOAL slot to contain "Collect " + joined fields',
    )
    assert.ok(
      prompt.includes('collected name, phone, vehicle year, damage type'),
      'expected COMPLETION CHECK to reference the joined fields',
    )
  })

  test('empty array → does not override (falls through to niche default)', () => {
    const prompt = buildPromptFromIntake(
      baseIntake({
        fields_to_collect: [],
      }),
    )
    assert.ok(
      prompt.includes(AUTO_GLASS_DEFAULT),
      'empty array should not override niche default',
    )
  })

  test('array of whitespace-only strings → does not override', () => {
    const prompt = buildPromptFromIntake(
      baseIntake({
        fields_to_collect: ['  ', '', '   '],
      }),
    )
    assert.ok(
      prompt.includes(AUTO_GLASS_DEFAULT),
      'all-whitespace array should not override niche default',
    )
  })
})
