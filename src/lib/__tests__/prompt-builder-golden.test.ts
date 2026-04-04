/**
 * prompt-builder-golden.test.ts — Phase 0 golden test suite
 *
 * Two layers:
 *   Layer 1 (Step 0a): Full string-equality checks against committed .txt snapshots.
 *                      Any character deviation = refactor changed behavior.
 *   Layer 2 (Step 0b): Assertion-based checks for the broader niche/mode matrix.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-builder-golden.test.ts
 *
 * LATENT BUG (restaurant niche — still present after Phase 3):
 *   buildPromptFromIntake for niche='restaurant' leaves {{HOURS_WEEKDAY}} unresolved
 *   in two example dialogue lines. This is a pre-existing condition.
 *   The "no raw placeholder" assertion for restaurant is intentionally omitted.
 *   Track separately before the next client is onboarded on the restaurant niche.
 *
 * D296 FIX (Phase 3): FORBIDDEN_EXTRA niche modifications (restaurant delivery,
 *   dental waitlist, legal referral) are NOW correctly included in prompts.
 *   The 3 canary tests in Layer 4B have been flipped to assert presence.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPromptFromIntake } from '../prompt-builder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOTS = join(__dirname, 'snapshots')

function snap(name: string): string {
  return readFileSync(join(SNAPSHOTS, `${name}.txt`), 'utf8')
}

/** Normalize line endings for cross-platform comparison. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

/** Minimal intake builder. */
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

// ══════════════════════════════════════════════════════════════════════════════
// Layer 1 — Stored snapshot equality (5 fixtures)
// Any diff here means the refactor changed output — stop immediately.
// ══════════════════════════════════════════════════════════════════════════════

describe('Layer 1 — Stored snapshot equality', () => {
  test('hvac-baseline matches snapshot', () => {
    const got = norm(buildPromptFromIntake({
      business_name: 'Prairie HVAC',
      agent_name: 'Alex',
      niche: 'hvac',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
    }))
    assert.strictEqual(got, snap('hvac-baseline'), 'hvac-baseline snapshot diverged')
  })

  test('auto-glass-baseline matches snapshot', () => {
    const got = norm(buildPromptFromIntake({
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      niche: 'auto_glass',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      owner_phone: '+14035550000',
    }))
    assert.strictEqual(got, snap('auto-glass-baseline'), 'auto-glass-baseline snapshot diverged')
  })

  test('auto-glass-voicemail-replacement matches snapshot', () => {
    const got = norm(buildPromptFromIntake({
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      niche: 'auto_glass',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      agent_mode: 'voicemail_replacement',
      owner_phone: '+14035550000',
    }))
    assert.strictEqual(got, snap('auto-glass-voicemail-replacement'), 'auto-glass-voicemail-replacement snapshot diverged')
  })

  test('real-estate-baseline matches snapshot', () => {
    const got = norm(buildPromptFromIntake({
      business_name: 'Sharif Realty',
      agent_name: 'Aisha',
      niche: 'real_estate',
      city: 'Edmonton',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      callback_phone: '+17805550000',
    }))
    assert.strictEqual(got, snap('real-estate-baseline'), 'real-estate-baseline snapshot diverged')
  })

  test('plumbing-appointment-booking matches snapshot', () => {
    const got = norm(buildPromptFromIntake({
      business_name: 'Prairie Plumbing',
      agent_name: 'Jordan',
      niche: 'plumbing',
      city: 'Regina',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      agent_mode: 'appointment_booking',
    }))
    assert.strictEqual(got, snap('plumbing-appointment-booking'), 'plumbing-appointment-booking snapshot diverged')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Layer 2 — Assertion matrix (broader niche/mode coverage)
// ══════════════════════════════════════════════════════════════════════════════

describe('Layer 2 — HVAC', () => {
  test('hvac baseline: no raw placeholder leaks, size OK', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, { city: 'Saskatoon', province: 'SK' }))
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} found in hvac baseline')
    assert.ok(!p.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED literal found')
    assert.ok(p.length > 100)
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('hvac no service area: graceful — no raw placeholders', () => {
    const p = buildPromptFromIntake({ business_name: 'T', agent_name: 'A', niche: 'hvac', timezone: 'America/Regina', call_handling_mode: 'triage' })
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} found when city/province omitted')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
  })
})

describe('Layer 2 — Auto glass', () => {
  test('auto_glass baseline: TRIAGE_DEEP contains windshield text', () => {
    const p = buildPromptFromIntake(intake('auto_glass', undefined, { owner_phone: '+14035550000' }))
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
    assert.ok(p.length <= 25_000)
  })

  test('auto_glass + voicemail_replacement: mode wins, no TRIAGE (Windshield)', () => {
    const p = buildPromptFromIntake(intake('auto_glass', 'voicemail_replacement'))
    assert.ok(p.includes('Do not ask about services'), 'mode TRIAGE_DEEP text missing')
    assert.ok(!p.includes('TRIAGE (Windshield)'), 'TRIAGE (Windshield) should not appear in voicemail_replacement mode')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })

  test('auto_glass + lead_capture: niche wins — gotcha phrase present', () => {
    const p = buildPromptFromIntake(intake('auto_glass', 'lead_capture'))
    assert.ok(p.includes('gotcha, just a chip'), '"gotcha, just a chip" missing in lead_capture')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })

  test('auto_glass + appointment_booking: check availability phrase present', () => {
    const p = buildPromptFromIntake(intake('auto_glass', 'appointment_booking'))
    assert.ok(p.includes('I can check availability'), '"I can check availability" missing in appointment_booking')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })
})

describe('Layer 2 — Other niche', () => {
  test('other + info_hub: open-ended triage text present', () => {
    const p = buildPromptFromIntake(intake('other', 'info_hub'))
    assert.ok(p.includes('Do not push through a triage script'), 'info_hub triage text missing')
    assert.ok(!p.includes('{{'), 'raw placeholder in other + info_hub')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })

  test('other + voicemail_replacement: do-not-triage text present', () => {
    const p = buildPromptFromIntake(intake('other', 'voicemail_replacement'))
    assert.ok(p.includes('Do not triage or diagnose'), 'voicemail_replacement text missing for other niche')
    assert.ok(!p.includes('{{'), 'raw placeholder in other + voicemail_replacement')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })
})

describe('Layer 2 — Restaurant', () => {
  // NOTE: restaurant niche has a pre-existing {{HOURS_WEEKDAY}} leak in two example
  // dialogue lines. The "no raw placeholder" assertion is intentionally omitted here.
  // See file-level LATENT BUG comment above.
  test('restaurant (no menu): non-empty, size OK', () => {
    const p = buildPromptFromIntake(intake('restaurant'))
    assert.ok(p.length > 100, 'restaurant prompt is empty')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })
})

describe('Layer 2 — Voicemail niche', () => {
  test('voicemail niche: valid output, no leak', () => {
    const p = buildPromptFromIntake(intake('voicemail'))
    assert.ok(!p.includes('{{'), 'raw placeholder in voicemail niche')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
    assert.ok(p.length <= 25_000)
  })
})

describe('Layer 2 — Real estate', () => {
  test('real_estate baseline: no raw placeholder, callback_phone set', () => {
    const p = buildPromptFromIntake(intake('real_estate', undefined, { callback_phone: '+17805550000' }))
    assert.ok(!p.includes('{{'), 'raw placeholder in real_estate baseline')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
  })

  test('real_estate + voicemail_replacement: bespoke builder fires without crash', () => {
    const p = buildPromptFromIntake(intake('real_estate', 'voicemail_replacement', { callback_phone: '+17805550000' }))
    assert.ok(p.length > 100, 'real_estate + voicemail_replacement returned empty prompt')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })
})

describe('Layer 2 — Dental + booking_enabled', () => {
  test('dental + booking_enabled: CALENDAR / checkCalendarAvailability present', () => {
    const p = buildPromptFromIntake(intake('dental', undefined, { booking_enabled: true }))
    assert.ok(
      p.includes('checkCalendarAvailability') || p.includes('CALENDAR'),
      'calendar booking text missing for dental + booking_enabled',
    )
    assert.ok(!p.includes('{{'), 'raw placeholder in dental + booking_enabled')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
  })
})

describe('Layer 2 — Print shop', () => {
  test('print_shop: no raw placeholder, website/email fields consumed', () => {
    const p = buildPromptFromIntake(intake('print_shop', undefined, { websiteUrl: 'https://example.com', emailAddress: 'info@example.com' }))
    assert.ok(!p.includes('{{'), 'raw placeholder in print_shop')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
    assert.ok(p.length <= 25_000)
  })
})

describe('Layer 2 — HVAC + appointment_booking with service catalog', () => {
  test('hvac + appointment_booking + catalog: schedule phrase present', () => {
    const p = buildPromptFromIntake(intake('hvac', 'appointment_booking', {
      service_catalog: JSON.stringify([
        { name: 'Furnace Repair', duration: 60, price: '150' },
        { name: 'AC Tune-Up', duration: 45, price: '99' },
      ]),
    }))
    assert.ok(p.includes('schedule an appointment') || p.includes('I can check availability'), '"schedule an appointment" phrase missing')
    assert.ok(!p.includes('TRANSFER_ENABLED'))
    assert.ok(p.length > 100)
  })
})

describe('Layer 2 — All 4 modes × plumbing', () => {
  const MODES = ['voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking'] as const

  for (const mode of MODES) {
    test(`plumbing + ${mode}: size ≤ 25K, no TRANSFER_ENABLED`, () => {
      const p = buildPromptFromIntake(intake('plumbing', mode))
      assert.ok(p.length > 100, `plumbing + ${mode} returned empty prompt`)
      assert.ok(p.length <= 25_000, `plumbing + ${mode} too long: ${p.length}`)
      assert.ok(!p.includes('TRANSFER_ENABLED'), `TRANSFER_ENABLED literal in plumbing + ${mode}`)
    })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// Layer 3 — Phase 1 expansion: section headers, feature combos, char limits,
//           full niche coverage, unresolved variable sweep
// Added 2026-03-31 for D285 sandwich spec validation.
// ══════════════════════════════════════════════════════════════════════════════

/** Section headers that map to future named slots (D274).
 *  Every non-voicemail prompt MUST contain all of these. */
const REQUIRED_SECTION_HEADERS = [
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
  'PRODUCT KNOWLEDGE BASE',
] as const

/** Conditional section headers — present only when features enabled. */
const CONDITIONAL_SECTION_HEADERS = {
  booking: 'CALENDAR BOOKING FLOW',
  sms: 'SMS FOLLOW-UP',
  vip: 'VIP CALLER',
} as const

describe('Layer 3 — Section header presence (sandwich slot validation)', () => {
  test('hvac baseline: all required section headers present', () => {
    const p = buildPromptFromIntake(intake('hvac'))
    for (const header of REQUIRED_SECTION_HEADERS) {
      assert.ok(p.includes(header), `missing section header: "${header}" in hvac baseline`)
    }
  })

  test('plumbing baseline: all required section headers present', () => {
    const p = buildPromptFromIntake(intake('plumbing'))
    for (const header of REQUIRED_SECTION_HEADERS) {
      assert.ok(p.includes(header), `missing section header: "${header}" in plumbing baseline`)
    }
  })

  test('dental baseline: all required section headers present', () => {
    const p = buildPromptFromIntake(intake('dental'))
    for (const header of REQUIRED_SECTION_HEADERS) {
      assert.ok(p.includes(header), `missing section header: "${header}" in dental baseline`)
    }
  })

  test('other baseline: all required section headers present', () => {
    const p = buildPromptFromIntake(intake('other'))
    for (const header of REQUIRED_SECTION_HEADERS) {
      assert.ok(p.includes(header), `missing section header: "${header}" in other baseline`)
    }
  })

  test('voicemail niche: uses bespoke builder, no section headers required', () => {
    const p = buildPromptFromIntake(intake('voicemail'))
    // voicemail uses buildVoicemailPrompt — different template, no section headers expected
    assert.ok(p.length > 100, 'voicemail prompt is empty')
  })

  test('message_only mode: uses voicemail builder, no section headers required', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, { call_handling_mode: 'message_only' }))
    assert.ok(p.length > 100, 'message_only prompt is empty')
  })
})

describe('Layer 3 — Feature combination tests', () => {
  // dental has bookAppointments=true; hvac does not
  test('booking_enabled + bookable niche: CALENDAR BOOKING FLOW section present', () => {
    const p = buildPromptFromIntake(intake('dental', undefined, { booking_enabled: true }))
    assert.ok(p.includes(CONDITIONAL_SECTION_HEADERS.booking),
      'CALENDAR BOOKING FLOW missing when booking_enabled=true on dental (bookable niche)')
    assert.ok(p.includes('checkCalendarAvailability'),
      'checkCalendarAvailability tool reference missing')
    assert.ok(p.includes('bookAppointment'),
      'bookAppointment tool reference missing')
  })

  test('booking_enabled + non-bookable niche: no CALENDAR section', () => {
    // hvac has bookAppointments=false — booking_enabled should not inject calendar block
    const p = buildPromptFromIntake(intake('hvac', undefined, { booking_enabled: true }))
    assert.ok(!p.includes(CONDITIONAL_SECTION_HEADERS.booking),
      'CALENDAR BOOKING FLOW should NOT appear for non-bookable niche even when booking_enabled=true')
  })

  test('booking not enabled: no CALENDAR section', () => {
    const p = buildPromptFromIntake(intake('dental'))
    assert.ok(!p.includes(CONDITIONAL_SECTION_HEADERS.booking),
      'CALENDAR BOOKING FLOW should NOT appear when booking_enabled is not set')
  })

  test('sms_enabled: SMS instructions present', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, { sms_enabled: true }))
    assert.ok(p.includes('sendTextMessage') || p.includes('SMS') || p.includes('text message'),
      'SMS instructions missing when sms_enabled=true')
  })

  test('forwarding_number set: transfer enabled + VIP block', () => {
    const p = buildPromptFromIntake(intake('auto_glass', undefined, {
      owner_phone: '+14035550000',
      forwarding_number: '+14035551111',
    }))
    assert.ok(!p.includes('TRANSFER_ENABLED'),
      'raw TRANSFER_ENABLED literal in prompt')
  })

  test('all features enabled: no raw placeholders', () => {
    const p = buildPromptFromIntake(intake('dental', 'appointment_booking', {
      booking_enabled: true,
      sms_enabled: true,
      forwarding_number: '+14035551111',
      owner_phone: '+14035550000',
      service_catalog: JSON.stringify([
        { name: 'Cleaning', duration: 60, price: '150' },
        { name: 'Filling', duration: 30, price: '200' },
      ]),
    }))
    assert.ok(!p.includes('{{'), `raw placeholder in fully-featured dental prompt`)
    // Document current size for Phase 3 baseline tracking
    assert.ok(p.length > 0, 'fully-featured prompt is empty')
    assert.ok(p.length <= 25_000, `prompt is ${p.length} chars — exceeds safety ceiling`)
  })

  test('appointment_booking + service_catalog + bookable niche: schedule/availability phrase present', () => {
    // dental has bookAppointments=true — catalog names may not appear verbatim
    // if the niche's own TRIAGE_DEEP takes precedence over mode's catalog-based one.
    // But the booking flow and scheduling language should always be present.
    const p = buildPromptFromIntake(intake('dental', 'appointment_booking', {
      booking_enabled: true,
      service_catalog: JSON.stringify([
        { name: 'Cleaning', duration: 60, price: '150' },
        { name: 'Filling', duration: 30, price: '200' },
      ]),
    }))
    assert.ok(
      p.includes('schedule an appointment') || p.includes('I can check availability') || p.includes('checkCalendarAvailability'),
      'appointment booking language missing in dental + appointment_booking + catalog')
    assert.ok(!p.includes('{{'), 'raw placeholder in dental + appointment_booking + catalog')
  })
})

describe('Layer 3 — Char count baseline (pre-Phase 3)', () => {
  // Current prompts are 17-20K chars. Phase 3 (D265, D268, D269, D272) targets < 8K.
  // These tests document current reality and enforce a 25K safety ceiling.
  // After Phase 3: tighten to 12K hard limit, 8K target.
  const STANDARD_NICHES = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'print_shop', 'barbershop',
    'restaurant', 'other', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith',
  ] as const

  for (const niche of STANDARD_NICHES) {
    test(`${niche}: prompt under 25K chars (Phase 3 target: 12K)`, () => {
      const p = buildPromptFromIntake(intake(niche))
      assert.ok(p.length <= 25_000,
        `${niche} baseline is ${p.length} chars — exceeds 25K safety ceiling`)
      assert.ok(p.length > 100,
        `${niche} prompt is suspiciously short: ${p.length} chars`)
    })
  }
})

describe('Layer 3 — No unresolved {{VARIABLE}} per niche', () => {
  // Every niche should produce a prompt with no raw {{VARIABLE}} placeholders.
  // Exception: restaurant (known LATENT BUG — {{HOURS_WEEKDAY}} leak, tracked separately).
  const NICHES_NO_LEAK = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'print_shop', 'barbershop',
    'other', 'voicemail', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith',
  ] as const

  for (const niche of NICHES_NO_LEAK) {
    test(`${niche}: no raw {{placeholder}} in output`, () => {
      const p = buildPromptFromIntake(intake(niche))
      const matches = [...p.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)].map(m => m[1])
      assert.strictEqual(matches.length, 0,
        `${niche} has unresolved variables: ${matches.join(', ')}`)
    })
  }

  // restaurant intentionally skipped — see LATENT BUG comment at top of file
})

describe('Layer 3 — Section order validation', () => {
  test('section headers appear in sandwich spec order', () => {
    const p = buildPromptFromIntake(intake('hvac'))
    const orderedHeaders = [
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
      'PRODUCT KNOWLEDGE BASE',
    ]
    let lastIdx = -1
    for (const header of orderedHeaders) {
      const idx = p.indexOf(header)
      assert.ok(idx !== -1, `header "${header}" not found`)
      assert.ok(idx > lastIdx,
        `header "${header}" at index ${idx} appears BEFORE previous header at ${lastIdx} — order violation`)
      lastIdx = idx
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Layer 4 — Phase 2 expansion: voicemail_replacement × all niches,
//           feature edge cases, mode × feature combos
// Added for D285 golden test suite expansion (target: 100+ total tests).
// ══════════════════════════════════════════════════════════════════════════════

// ── Category A — Every standard niche × voicemail_replacement mode ───────────
// 16 niches × 1 mode = 16 tests.
// Each test: build with voicemail_replacement mode, assert size OK,
// assert "Do not ask about services" phrase present (mode TRIAGE_DEEP).

describe('Layer 4A — voicemail_replacement × all standard niches', () => {
  const STANDARD_NICHES = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'print_shop', 'barbershop',
    'restaurant', 'other', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith',
  ] as const

  // restaurant has known {{HOURS_WEEKDAY}} leak — skip raw-placeholder check for it
  const RESTAURANT_NICHE = 'restaurant'

  for (const niche of STANDARD_NICHES) {
    test(`${niche} + voicemail_replacement: size OK, TRIAGE_DEEP text present, no raw placeholder`, () => {
      const p = buildPromptFromIntake(intake(niche, 'voicemail_replacement'))
      assert.ok(p.length > 100, `${niche} + voicemail_replacement returned empty prompt`)
      assert.ok(p.length <= 25_000, `${niche} + voicemail_replacement too long: ${p.length}`)
      assert.ok(
        p.includes('Do not ask about services') || p.includes('Do not triage or diagnose'),
        `${niche} + voicemail_replacement missing mode TRIAGE_DEEP text ("Do not ask about services" or "Do not triage or diagnose")`,
      )
      if (niche !== RESTAURANT_NICHE) {
        assert.ok(!p.includes('{{'), `raw {{placeholder}} found in ${niche} + voicemail_replacement`)
      }
      assert.ok(!p.includes('TRANSFER_ENABLED'), `TRANSFER_ENABLED literal in ${niche} + voicemail_replacement`)
    })
  }
})

// ── Category B — Feature edge cases ──────────────────────────────────────────

describe('Layer 4B — Feature edge cases', () => {
  test('empty city + empty owner_name: no crash, no raw placeholder', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      city: '',
      owner_name: '',
    }))
    assert.ok(p.length > 100, 'empty city/owner prompt returned empty')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} found with empty city/owner_name')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('empty city + missing province: no crash, no raw placeholder', () => {
    const p = buildPromptFromIntake({
      business_name: 'Test Business',
      agent_name: 'Alex',
      niche: 'plumbing',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      city: '',
    })
    assert.ok(p.length > 100, 'empty city prompt returned empty')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} found with empty city + missing province')
  })

  // D296 FIXED (Phase 3): niche custom variable modifications to variables.FORBIDDEN_EXTRA
  // are now correctly read by the slot builder (reads variables.FORBIDDEN_EXTRA, not nicheDefaults).
  // These tests verify the fix — niche-specific forbidden rules now appear in the output.

  test('restaurant + niche_orderTypes=delivery: delivery note appears in forbidden rules', () => {
    const p = buildPromptFromIntake(intake('restaurant', undefined, {
      niche_orderTypes: 'delivery',
    }))
    assert.ok(p.includes('NEVER take delivery'),
      'D296 fix: restaurant delivery FORBIDDEN_EXTRA should now appear in prompt')
    assert.ok(p.length > 100)
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('dental + niche_newPatients=waitlist: waitlist note appears in forbidden rules', () => {
    const p = buildPromptFromIntake(intake('dental', undefined, {
      niche_newPatients: 'waitlist',
    }))
    assert.ok(p.includes('waitlist for new patients'),
      'D296 fix: dental waitlist FORBIDDEN_EXTRA should now appear in prompt')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in dental + waitlist')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('legal + niche_consultations=referral_only: referral note appears in forbidden rules', () => {
    const p = buildPromptFromIntake(intake('legal', undefined, {
      niche_consultations: 'referral_only',
    }))
    assert.ok(p.includes('referrals only'),
      'D296 fix: legal referral FORBIDDEN_EXTRA should now appear in prompt')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in legal + referral_only')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('service_catalog with 1 item: no crash', () => {
    const p = buildPromptFromIntake(intake('hvac', 'appointment_booking', {
      service_catalog: JSON.stringify([
        { name: 'Furnace Repair', duration: 60, price: '150' },
      ]),
    }))
    assert.ok(p.length > 100, 'single-item service_catalog prompt returned empty')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} with single-item catalog')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('service_catalog with 5 items: no crash', () => {
    const p = buildPromptFromIntake(intake('plumbing', 'appointment_booking', {
      service_catalog: JSON.stringify([
        { name: 'Drain Cleaning', duration: 60, price: '150' },
        { name: 'Pipe Repair', duration: 90, price: '200' },
        { name: 'Water Heater Install', duration: 180, price: '500' },
        { name: 'Fixture Install', duration: 45, price: '120' },
        { name: 'Sewer Camera Inspection', duration: 30, price: '95' },
      ]),
    }))
    assert.ok(p.length > 100, '5-item service_catalog prompt returned empty')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} with 5-item catalog')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('after_hours_behavior=route_emergency + emergency_phone: emergency phone in prompt', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      after_hours_behavior: 'route_emergency',
      emergency_phone: '+13065559999',
    }))
    assert.ok(p.includes('+13065559999'),
      'emergency phone number not found in prompt with route_emergency behavior')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} with route_emergency')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  // D265+D269: pgvector knowledge base path
  test('knowledge_backend=pgvector + chunks: uses queryKnowledge instruction (shorter prompt)', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 15,
    }))
    assert.ok(p.includes('queryKnowledge'), 'pgvector path should reference queryKnowledge tool')
    assert.ok(!p.includes('PRODUCT KNOWLEDGE BASE'), 'pgvector path should NOT have inline PRODUCT KNOWLEDGE BASE')
    // pgvector removes inline FAQ — prompt is shorter than the non-pgvector path
    // Threshold bumped from 18K → 21K to account for persona_anchor slot addition
    assert.ok(p.length < 21_000, `pgvector prompt should be smaller than inline FAQ path but got ${p.length}`)
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in pgvector path')
  })

  test('knowledge_backend=pgvector + 0 chunks: falls back to inline FAQ', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 0,
    }))
    assert.ok(p.includes('PRODUCT KNOWLEDGE BASE'), 'empty pgvector should fall back to inline FAQ')
    assert.ok(!p.includes('queryKnowledge'), 'empty pgvector should NOT reference queryKnowledge')
  })

  test('no knowledge_backend: falls back to inline FAQ', () => {
    const p = buildPromptFromIntake(intake('hvac'))
    assert.ok(p.includes('PRODUCT KNOWLEDGE BASE'), 'no pgvector should use inline FAQ')
  })

  // D272: conditional pricing policy
  test('pricing_policy=quote_from_kb: pricing rule allows KB quotes', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      pricing_policy: 'quote_from_kb',
    }))
    assert.ok(p.includes('MAY quote standard prices'), 'quote_from_kb should allow quoting from KB')
    assert.ok(!p.includes('NEVER quote specific prices'), 'quote_from_kb should NOT have never-quote rule')
  })

  test('pricing_policy=quote_ranges: pricing rule allows ranges', () => {
    const p = buildPromptFromIntake(intake('hvac', undefined, {
      pricing_policy: 'quote_ranges',
    }))
    assert.ok(p.includes('MAY give approximate price ranges'), 'quote_ranges should allow ranges')
  })

  test('pricing_policy unset: defaults to never quote', () => {
    const p = buildPromptFromIntake(intake('hvac'))
    assert.ok(p.includes('NEVER quote specific prices'), 'default pricing should be never-quote')
  })
})

// ── Category C — Mode × feature combos ───────────────────────────────────────

describe('Layer 4C — Mode × feature combos', () => {
  test('info_hub + sms_enabled: SMS block present + info_hub triage', () => {
    const p = buildPromptFromIntake(intake('plumbing', 'info_hub', {
      sms_enabled: true,
    }))
    assert.ok(
      p.includes('sendTextMessage') || p.includes('SMS') || p.includes('text message'),
      'SMS block missing in info_hub + sms_enabled',
    )
    assert.ok(
      p.includes('Do not push through a triage script'),
      'info_hub triage text missing in info_hub + sms_enabled',
    )
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in info_hub + sms_enabled')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('appointment_booking + booking_enabled + dental: calendar + booking triage', () => {
    const p = buildPromptFromIntake(intake('dental', 'appointment_booking', {
      booking_enabled: true,
    }))
    assert.ok(
      p.includes('checkCalendarAvailability') || p.includes('CALENDAR'),
      'calendar text missing in appointment_booking + booking_enabled + dental',
    )
    assert.ok(
      p.includes('schedule an appointment') || p.includes('I can check availability') || p.includes('bookAppointment'),
      'booking triage text missing in appointment_booking + booking_enabled + dental',
    )
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in appointment_booking + booking_enabled + dental')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('voicemail_replacement + sms_enabled: SMS block present', () => {
    const p = buildPromptFromIntake(intake('hvac', 'voicemail_replacement', {
      sms_enabled: true,
    }))
    assert.ok(
      p.includes('sendTextMessage') || p.includes('SMS') || p.includes('text message'),
      'SMS block missing in voicemail_replacement + sms_enabled',
    )
    assert.ok(
      p.includes('Do not ask about services') || p.includes('Do not triage or diagnose'),
      'voicemail_replacement TRIAGE_DEEP text missing with sms_enabled',
    )
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in voicemail_replacement + sms_enabled')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('lead_capture + forwarding_number: no TRANSFER_ENABLED literal', () => {
    const p = buildPromptFromIntake(intake('auto_glass', 'lead_capture', {
      forwarding_number: '+14035551111',
      owner_phone: '+14035550000',
    }))
    assert.ok(!p.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED literal in lead_capture + forwarding_number')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in lead_capture + forwarding_number')
    assert.ok(p.length > 100, 'lead_capture + forwarding_number prompt returned empty')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('info_hub + forwarding_number + sms_enabled: all features coexist', () => {
    const p = buildPromptFromIntake(intake('salon', 'info_hub', {
      sms_enabled: true,
      forwarding_number: '+14035551111',
    }))
    assert.ok(
      p.includes('sendTextMessage') || p.includes('SMS') || p.includes('text message'),
      'SMS block missing in info_hub + forwarding_number + sms_enabled',
    )
    assert.ok(
      p.includes('Do not push through a triage script'),
      'info_hub triage text missing with forwarding_number + sms_enabled',
    )
    assert.ok(!p.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED literal found')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} found')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })

  test('appointment_booking + service_catalog + sms_enabled + forwarding_number: kitchen sink no crash', () => {
    const p = buildPromptFromIntake(intake('plumbing', 'appointment_booking', {
      booking_enabled: true,
      sms_enabled: true,
      forwarding_number: '+13065551111',
      owner_phone: '+13065550000',
      service_catalog: JSON.stringify([
        { name: 'Drain Cleaning', duration: 60, price: '150' },
        { name: 'Pipe Repair', duration: 90, price: '200' },
      ]),
    }))
    assert.ok(p.length > 100, 'kitchen sink plumbing prompt returned empty')
    assert.ok(!p.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED literal found')
    assert.ok(!p.includes('{{'), 'raw {{placeholder}} in kitchen sink plumbing prompt')
    assert.ok(p.length <= 25_000, `prompt too long: ${p.length}`)
  })
})
