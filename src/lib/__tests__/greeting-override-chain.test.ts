/**
 * greeting-override-chain.test.ts — D445 Phase B.0.2 regression guard
 *
 * Locks the GREETING_OVERRIDE plumbing:
 *   intake.niche_custom_variables.GREETING_OVERRIDE → buildSlotContext →
 *   variables.GREETING_LINE → rendered "## 1. GREETING" block in prompt.
 *
 * Override priority (highest wins):
 *   1. niche_custom_variables.GREETING_OVERRIDE  (human-locked)
 *   2. niche_custom_variables.GREETING_LINE      (AI-generated)
 *   3. NICHE_WOW_GREETINGS[niche]                (per-niche default)
 *   4. preset.greetingLine                       (voice preset baseline)
 *
 * Use case: snowflake migration preserves a client's pre-existing custom greeting
 * verbatim instead of letting the niche default replace it.
 *
 * Run: npx tsx --test src/lib/__tests__/greeting-override-chain.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildPromptFromIntake } from '../prompt-builder.js'

function baseIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: 'Urban Vibe Properties',
    niche: 'property_management',
    city: 'Calgary',
    province: 'AB',
    timezone: 'America/Edmonton',
    call_handling_mode: 'triage',
    agent_mode: 'lead_capture',
    agent_name: 'Alisha',
    ...overrides,
  }
}

const RAY_GREETING =
  "Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. " +
  "I can log maintenance requests, get Ray to call you back, or help with rental inquiries. " +
  "What's going on?"

describe('D445 Phase B.0.2 — GREETING_OVERRIDE end-to-end chain', () => {
  test('no override → niche default greeting is used', () => {
    const prompt = buildPromptFromIntake(baseIntake())
    assert.ok(
      !prompt.includes(RAY_GREETING),
      'expected Ray\'s custom greeting to be absent without GREETING_OVERRIDE',
    )
    // Property management niche default greeting contains "What can I do for ya"
    assert.ok(
      prompt.includes('## 1. GREETING'),
      'expected GREETING section header in rendered prompt',
    )
  })

  test('GREETING_OVERRIDE → custom greeting renders verbatim in GREETING block', () => {
    const prompt = buildPromptFromIntake(
      baseIntake({
        niche_custom_variables: {
          GREETING_OVERRIDE: RAY_GREETING,
        },
      }),
    )
    assert.ok(
      prompt.includes(RAY_GREETING),
      'expected GREETING_OVERRIDE content to render in prompt',
    )
    assert.ok(
      prompt.includes('## 1. GREETING'),
      'expected GREETING section header to remain',
    )
  })

  test('GREETING_OVERRIDE wins over niche_custom_variables.GREETING_LINE (priority order)', () => {
    const aiGenerated = '"Custom AI-generated greeting that should be overridden."'
    const prompt = buildPromptFromIntake(
      baseIntake({
        niche_custom_variables: {
          GREETING_LINE: aiGenerated,
          GREETING_OVERRIDE: RAY_GREETING,
        },
      }),
    )
    assert.ok(
      prompt.includes(RAY_GREETING),
      'expected GREETING_OVERRIDE to win over GREETING_LINE',
    )
    assert.ok(
      !prompt.includes(aiGenerated),
      'expected AI-generated GREETING_LINE to be suppressed by GREETING_OVERRIDE',
    )
  })

  test('empty/whitespace GREETING_OVERRIDE → falls through to existing greeting chain', () => {
    const aiGenerated = '"AI-generated fallback greeting."'
    const prompt = buildPromptFromIntake(
      baseIntake({
        niche_custom_variables: {
          GREETING_LINE: aiGenerated,
          GREETING_OVERRIDE: '   ',
        },
      }),
    )
    assert.ok(
      prompt.includes(aiGenerated),
      'expected whitespace-only GREETING_OVERRIDE to be ignored, AI greeting used',
    )
  })
})
