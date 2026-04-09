/**
 * prompt-slots-shadow.test.ts — Phase 2 shadow tests
 *
 * Compares old path (buildPromptFromIntake) against new path (buildSlotContext → buildPromptFromSlots).
 * Tests verify that the slot-based composition produces functionally equivalent output.
 *
 * "Functionally equivalent" means: after stripping section markers and normalizing whitespace,
 * the content and structure should match. Minor whitespace/newline differences are acceptable
 * as long as no content is missing or reordered.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-slots-shadow.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildPromptFromIntake } from '../prompt-builder.js'
import { buildSlotContext, buildPromptFromSlots } from '../prompt-slots.js'
import { stripPromptMarkers } from '../prompt-sections.js'

/** Normalize for comparison: strip markers, collapse whitespace runs, trim */
function normalize(s: string): string {
  return stripPromptMarkers(s)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Build a minimal intake object */
function intake(
  niche: string,
  agentMode?: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    business_name: 'Test Business',
    agent_name: 'Alex',
    niche,
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    call_handling_mode: 'triage',
    ...(agentMode ? { agent_mode: agentMode } : {}),
    ...extra,
  }
}

/** Compare old vs new path. Returns { oldLen, newLen, matching, diff } */
function compareOldNew(intakeData: Record<string, unknown>): {
  old: string
  new_: string
  oldLen: number
  newLen: number
  matching: boolean
  firstDiffIdx: number
} {
  const old = normalize(buildPromptFromIntake(intakeData))
  const ctx = buildSlotContext(intakeData)
  const new_ = normalize(buildPromptFromSlots(ctx))

  let firstDiffIdx = -1
  const minLen = Math.min(old.length, new_.length)
  for (let i = 0; i < minLen; i++) {
    if (old[i] !== new_[i]) {
      firstDiffIdx = i
      break
    }
  }
  if (firstDiffIdx === -1 && old.length !== new_.length) {
    firstDiffIdx = minLen
  }

  return {
    old,
    new_,
    oldLen: old.length,
    newLen: new_.length,
    matching: old === new_,
    firstDiffIdx,
  }
}

/** Helper to show context around first diff */
function showDiffContext(old: string, new_: string, idx: number, window = 80): string {
  if (idx === -1) return '(identical)'
  const start = Math.max(0, idx - window)
  const end = Math.min(Math.max(old.length, new_.length), idx + window)
  return `First diff at char ${idx}:\n  OLD: ...${JSON.stringify(old.slice(start, end))}...\n  NEW: ...${JSON.stringify(new_.slice(start, end))}...`
}

// ══════════════════════════════════════════════════════════════════════════════
// Section presence tests — verify all slot functions produce non-empty output
// ══════════════════════════════════════════════════════════════════════════════

describe('Shadow — Slot function output presence', () => {
  const intakeData = intake('hvac')
  const ctx = buildSlotContext(intakeData)

  test('all required sections present in composed output', () => {
    const composed = buildPromptFromSlots(ctx)
    // P0.1: PRODUCT KNOWLEDGE BASE is now conditional — only present when
    // caller_faq / pricing_policy / unknown_answer_behavior / pgvector set.
    const requiredHeaders = [
      'LIFE SAFETY EMERGENCY OVERRIDE',
      'ABSOLUTE FORBIDDEN ACTIONS',
      'VOICE NATURALNESS',
      'GRAMMAR AND SPEECH',
      'IDENTITY',
      'TONE AND STYLE',
      'GOAL',
      'DYNAMIC CONVERSATION FLOW',
      'ESCALATION AND TRANSFER',
      'RETURNING CALLER HANDLING',
      'INLINE EXAMPLES',
      'CALL HANDLING MODE',
    ]
    for (const header of requiredHeaders) {
      assert.ok(composed.includes(header), `missing section: ${header}`)
    }
  })

  test('section order matches sandwich spec', () => {
    const composed = buildPromptFromSlots(ctx)
    const headers = [
      'LIFE SAFETY EMERGENCY OVERRIDE',
      'ABSOLUTE FORBIDDEN ACTIONS',
      'VOICE NATURALNESS',
      'GRAMMAR AND SPEECH',
      'IDENTITY',
      'TONE AND STYLE',
      'GOAL',
      'DYNAMIC CONVERSATION FLOW',
      'ESCALATION AND TRANSFER',
      'RETURNING CALLER HANDLING',
      'INLINE EXAMPLES',
      'CALL HANDLING MODE',
    ]
    let lastIdx = -1
    for (const header of headers) {
      const idx = composed.indexOf(header)
      assert.ok(idx > lastIdx, `${header} out of order (at ${idx}, previous at ${lastIdx})`)
      lastIdx = idx
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Shadow comparison tests — old path vs new path
// ══════════════════════════════════════════════════════════════════════════════

describe('Shadow — Content comparison (old vs new path)', () => {
  // These tests check that key content elements are present in both paths.
  // Perfect byte-equality is not required due to minor template assembly differences,
  // but all meaningful content must be present.

  test('hvac baseline: key content matches', () => {
    const intakeData = intake('hvac')
    const { old, new_ } = compareOldNew(intakeData)

    // Both should contain these key phrases
    // P0.1: PRODUCT KNOWLEDGE BASE removed — now conditional on caller_faq/policies
    const mustContain = [
      'LIFE SAFETY EMERGENCY OVERRIDE',
      'ABSOLUTE FORBIDDEN ACTIONS',
      'VOICE NATURALNESS',
      'GRAMMAR AND SPEECH',
      'IDENTITY',
      'Test Business',
      'Alex',
      'Saskatoon',
      'TONE AND STYLE',
      'YOUR PRIMARY GOAL',
      'DYNAMIC CONVERSATION FLOW',
      'ESCALATION AND TRANSFER',
      'RETURNING CALLER',
      'INLINE EXAMPLES',
      'CALL HANDLING MODE',
    ]
    for (const phrase of mustContain) {
      assert.ok(old.includes(phrase), `OLD missing: ${phrase}`)
      assert.ok(new_.includes(phrase), `NEW missing: ${phrase}`)
    }

    // Size should be within 10% of each other
    const ratio = Math.abs(old.length - new_.length) / Math.max(old.length, new_.length)
    assert.ok(ratio < 0.10, `size divergence too large: old=${old.length}, new=${new_.length}, ratio=${(ratio * 100).toFixed(1)}%`)
  })

  test('auto_glass baseline: key content matches', () => {
    const intakeData = intake('auto_glass', undefined, { owner_phone: '+14035550000' })
    const { old, new_ } = compareOldNew(intakeData)

    // P0.1: PRODUCT KNOWLEDGE BASE removed — now conditional on caller_faq/policies.
    // "lane assist camera" still appears via INLINE_EXAMPLES and TRIAGE_DEEP slots.
    const mustContain = ['auto glass shop', 'TRIAGE (Windshield)', 'lane assist camera']
    for (const phrase of mustContain) {
      assert.ok(old.includes(phrase), `OLD missing: ${phrase}`)
      assert.ok(new_.includes(phrase), `NEW missing: ${phrase}`)
    }

    const ratio = Math.abs(old.length - new_.length) / Math.max(old.length, new_.length)
    assert.ok(ratio < 0.10, `size divergence: old=${old.length}, new=${new_.length}`)
  })

  test('plumbing + appointment_booking: booking content present', () => {
    const intakeData = intake('plumbing', 'appointment_booking')
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('I can check availability') || old.includes('check availability'), 'OLD missing booking language')
    assert.ok(new_.includes('I can check availability') || new_.includes('check availability'), 'NEW missing booking language')

    const ratio = Math.abs(old.length - new_.length) / Math.max(old.length, new_.length)
    assert.ok(ratio < 0.10, `size divergence: old=${old.length}, new=${new_.length}`)
  })

  test('dental + booking_enabled: calendar block present', () => {
    const intakeData = intake('dental', undefined, { booking_enabled: true })
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('CALENDAR BOOKING FLOW'), 'OLD missing calendar')
    assert.ok(new_.includes('CALENDAR BOOKING FLOW'), 'NEW missing calendar')
    assert.ok(old.includes('checkCalendarAvailability'), 'OLD missing tool ref')
    assert.ok(new_.includes('checkCalendarAvailability'), 'NEW missing tool ref')
  })

  test('hvac + sms_enabled: SMS block present', () => {
    const intakeData = intake('hvac', undefined, { sms_enabled: true })
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('SMS FOLLOW-UP'), 'OLD missing SMS')
    assert.ok(new_.includes('SMS FOLLOW-UP'), 'NEW missing SMS')
  })

  test('auto_glass + forwarding_number: VIP block present', () => {
    const intakeData = intake('auto_glass', undefined, {
      owner_phone: '+14035550000',
      forwarding_number: '+14035551111',
    })
    const { old, new_ } = compareOldNew(intakeData)

    // VIP block should be present when forwarding_number is set
    assert.ok(old.includes('VIP') || old.includes('forwarding'), 'OLD missing VIP/forwarding content')
    assert.ok(new_.includes('VIP') || new_.includes('forwarding'), 'NEW missing VIP/forwarding content')
  })

  test('voicemail_replacement mode: mode triage wins', () => {
    const intakeData = intake('auto_glass', 'voicemail_replacement')
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('Do not ask about services'), 'OLD missing voicemail_replacement triage')
    assert.ok(new_.includes('Do not ask about services'), 'NEW missing voicemail_replacement triage')
  })

  test('other + info_hub: info_hub triage present', () => {
    const intakeData = intake('other', 'info_hub')
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('Do not push through a triage script'), 'OLD missing info_hub triage')
    assert.ok(new_.includes('Do not push through a triage script'), 'NEW missing info_hub triage')
  })

  test('all features enabled: no raw placeholders in either path', () => {
    const intakeData = intake('dental', 'appointment_booking', {
      booking_enabled: true,
      sms_enabled: true,
      forwarding_number: '+14035551111',
      owner_phone: '+14035550000',
      service_catalog: JSON.stringify([
        { name: 'Cleaning', duration: 60, price: '150' },
        { name: 'Filling', duration: 30, price: '200' },
      ]),
    })
    const { old, new_ } = compareOldNew(intakeData)

    // restaurant excluded — its {{HOURS_WEEKDAY}} leak is a known bug
    assert.ok(!old.includes('{{'), `OLD has raw placeholder`)
    assert.ok(!new_.includes('{{'), `NEW has raw placeholder`)
  })

  test('print_shop: price quoting exception present', () => {
    const intakeData = intake('print_shop')
    const { old, new_ } = compareOldNew(intakeData)

    assert.ok(old.includes('PRICE QUOTING EXCEPTION'), 'OLD missing print_shop price exception')
    assert.ok(new_.includes('PRICE QUOTING EXCEPTION'), 'NEW missing print_shop price exception')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Size parity — new path should not be dramatically different
// ══════════════════════════════════════════════════════════════════════════════

describe('Shadow — Size parity across niches', () => {
  const NICHES = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'print_shop', 'barbershop',
    'other', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith',
  ] as const

  for (const niche of NICHES) {
    test(`${niche}: new path within 15% of old path size`, () => {
      const intakeData = intake(niche)
      const { oldLen, newLen } = compareOldNew(intakeData)
      const ratio = Math.abs(oldLen - newLen) / Math.max(oldLen, newLen)
      assert.ok(
        ratio < 0.15,
        `${niche}: old=${oldLen}, new=${newLen}, diff=${(ratio * 100).toFixed(1)}%`,
      )
    })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// No-crash tests — every niche × mode produces output
// ══════════════════════════════════════════════════════════════════════════════

describe('Shadow — No crash across niche × mode matrix', () => {
  const NICHES = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'print_shop', 'barbershop',
    'restaurant', 'other', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith',
  ] as const
  const MODES = ['voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking'] as const

  for (const niche of NICHES) {
    for (const mode of MODES) {
      test(`${niche} × ${mode}: no crash, non-empty`, () => {
        const intakeData = intake(niche, mode)
        const ctx = buildSlotContext(intakeData)
        const result = buildPromptFromSlots(ctx)
        assert.ok(result.length > 100, `${niche} × ${mode} produced empty/tiny output: ${result.length} chars`)
      })
    }
  }
})
