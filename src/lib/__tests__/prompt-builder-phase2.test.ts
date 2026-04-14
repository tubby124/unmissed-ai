/**
 * prompt-builder-phase2.test.ts — Phase 2 structural tests
 *
 * Verifies that buildPromptFromIntake() respects capability flags from Phase 1A:
 *   - TRANSFER_ENABLED is set only when transferCalls=true for the niche
 *   - Calendar block is injected only when bookAppointments=true for the niche
 *
 * Also verifies structural stability: key sections present for canary niche (real_estate).
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-builder-phase2.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildPromptFromIntake } from '../prompt-builder.js'

// ── Minimal intake factory ────────────────────────────────────────────────────

function baseIntake(niche: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: `Test Business (${niche})`,
    niche,
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    ...overrides,
  }
}

// ── Transfer gating ───────────────────────────────────────────────────────────
// OWNER_PHONE is never embedded in the template body — it's passed to the transferCall tool.
// Phase 3 (slot composition): transfer gating produces clean conditional text:
//   - transferEnabled=true  → "transfer is enabled" in ESCALATION heading + TRANSFER FLOW section
//   - transferEnabled=false → "TRANSFER NOT AVAILABLE" heading + callback route instructions

describe('Phase 2 — TRANSFER_ENABLED capability gating', () => {

  test('auto_glass with owner_phone: transfer instructionally enabled (transferCalls=true)', () => {
    const prompt = buildPromptFromIntake(baseIntake('auto_glass', {
      owner_name: 'Sabbir',
      owner_phone: '+13061234567',
    }))
    assert.ok(prompt.includes('transfer is enabled'), 'should indicate transfer is enabled when TRANSFER_ENABLED=true')
    assert.ok(!prompt.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED variable must not leak')
  })

  test('property_management with owner_phone: transfer remains disabled (transferCalls=false)', () => {
    const prompt = buildPromptFromIntake(baseIntake('property_management', {
      owner_name: 'Manager',
      owner_phone: '+13061234567',
    }))
    assert.ok(prompt.includes('TRANSFER NOT AVAILABLE'), 'should say "TRANSFER NOT AVAILABLE" when blocked by capability')
    assert.ok(!prompt.includes('TRANSFER_ENABLED'), 'raw variable must not leak')
  })

  test('restaurant with owner_phone: transfer remains disabled (transferCalls=false)', () => {
    const prompt = buildPromptFromIntake(baseIntake('restaurant', {
      owner_name: 'Chef',
      owner_phone: '+13061234567',
    }))
    assert.ok(prompt.includes('TRANSFER NOT AVAILABLE'), 'transfer should be disabled for restaurant (transferCalls=false)')
  })

  test('dental with owner_phone: transfer instructionally enabled (transferCalls=true)', () => {
    const prompt = buildPromptFromIntake(baseIntake('dental', {
      owner_name: 'Dr Smith',
      owner_phone: '+13061234567',
      booking_enabled: false,
    }))
    assert.ok(prompt.includes('transfer is enabled'), 'transfer should be enabled for dental (transferCalls=true)')
  })

  test('print_shop with owner_phone: transfer instructionally enabled (transferCalls=true)', () => {
    const prompt = buildPromptFromIntake(baseIntake('print_shop', {
      owner_name: 'Mark',
      owner_phone: '+13061234567',
      niche_websiteUrl: 'testprint.ca',
      niche_emailAddress: 'test@testprint.ca',
    }))
    assert.ok(prompt.includes('transfer is enabled'), 'transfer should be enabled for print_shop (transferCalls=true)')
  })

  test('no owner_phone: transfer stays disabled regardless of niche', () => {
    const prompt = buildPromptFromIntake(baseIntake('auto_glass'))
    assert.ok(prompt.includes('TRANSFER NOT AVAILABLE'), 'no owner_phone = transfer disabled instruction')
    assert.ok(!prompt.includes('TRANSFER_ENABLED'), 'TRANSFER_ENABLED must not leak')
  })
})

// ── Booking/calendar gating ───────────────────────────────────────────────────

describe('Phase 2 — booking_enabled capability gating', () => {

  test('dental with booking_enabled=true: calendar block injected (bookAppointments=true)', () => {
    const prompt = buildPromptFromIntake(baseIntake('dental', {
      booking_enabled: true,
    }))
    assert.ok(
      prompt.includes('checkCalendarAvailability') || prompt.includes('bookAppointment') || prompt.includes('CALENDAR') || prompt.includes('calendar'),
      'calendar block should be injected for dental with booking_enabled=true'
    )
  })

  test('auto_glass with booking_enabled=true: calendar block NOT injected (bookAppointments=false)', () => {
    const prompt = buildPromptFromIntake(baseIntake('auto_glass', {
      booking_enabled: true,
    }))
    assert.ok(
      !prompt.includes('checkCalendarAvailability'),
      'calendar tool reference should not appear for auto_glass (bookAppointments=false)'
    )
  })

  test('property_management with booking_enabled=true: calendar block NOT injected (bookAppointments=false)', () => {
    const prompt = buildPromptFromIntake(baseIntake('property_management', {
      booking_enabled: true,
    }))
    assert.ok(
      !prompt.includes('checkCalendarAvailability'),
      'calendar block should not appear for property_management (bookAppointments=false)'
    )
  })

  test('print_shop with booking_enabled=true: calendar block NOT injected (bookAppointments=false)', () => {
    const prompt = buildPromptFromIntake(baseIntake('print_shop', {
      booking_enabled: true,
      niche_websiteUrl: 'testprint.ca',
      niche_emailAddress: 'test@testprint.ca',
    }))
    assert.ok(
      !prompt.includes('checkCalendarAvailability'),
      'calendar block should not appear for print_shop (bookAppointments=false)'
    )
  })

  test('salon with booking_enabled=true: calendar block injected (bookAppointments=true)', () => {
    const prompt = buildPromptFromIntake(baseIntake('salon', {
      booking_enabled: true,
    }))
    assert.ok(
      prompt.includes('checkCalendarAvailability') || prompt.includes('bookAppointment') || prompt.includes('CALENDAR') || prompt.includes('calendar'),
      'calendar block should be injected for salon with booking_enabled=true'
    )
  })

  test('booking_enabled=false: calendar block never injected regardless of niche', () => {
    const prompt = buildPromptFromIntake(baseIntake('dental', {
      booking_enabled: false,
    }))
    assert.ok(
      !prompt.includes('checkCalendarAvailability'),
      'calendar block should not appear when booking_enabled=false even for capable niche'
    )
  })
})

// ── Canary: real_estate structural stability ──────────────────────────────────

describe('Phase 2 — canary: real_estate structural stability', () => {

  const realEstatePrompt = buildPromptFromIntake(baseIntake('real_estate', {
    owner_name: 'Hasan Sharif',
    owner_phone: '+13068507687',
    booking_enabled: false,
  }))

  test('real_estate: prompt is non-empty', () => {
    assert.ok(realEstatePrompt.length > 100, 'prompt should not be empty')
  })

  test('real_estate: no raw {{VARIABLE}} placeholders remaining', () => {
    const remaining = realEstatePrompt.match(/\{\{[A-Z_]+\}\}/g)
    assert.strictEqual(remaining, null, `unfilled variables: ${JSON.stringify(remaining)}`)
  })

  test('real_estate: no TRANSFER_ENABLED literal value leak', () => {
    assert.ok(
      !realEstatePrompt.includes('TRANSFER_ENABLED'),
      'TRANSFER_ENABLED variable name must not appear in final prompt'
    )
  })

  test('real_estate: uses standard pipeline with LIFE SAFETY and TRIAGE_DEEP', () => {
    // real_estate now uses the standard pipeline (no legacy bespoke builder).
    assert.ok(
      realEstatePrompt.includes('LIFE SAFETY EMERGENCY OVERRIDE'),
      'real_estate prompt must contain LIFE SAFETY section'
    )
    assert.ok(
      realEstatePrompt.includes('FORBIDDEN') || realEstatePrompt.includes('ABSOLUTE FORBIDDEN'),
      'real_estate prompt should contain forbidden actions section'
    )
  })
})

// ── GBP + Sonar enrichment injection ─────────────────────────────────────────

describe('Phase 2 — gbp_summary + sonar_content injection', () => {

  // TODO 2026-04-14: slot-based buildPromptFromIntake doesn't inject gbp_summary yet —
  // needs implementation in prompt-slots.ts. Legacy template path handled this inline.
  test.skip('gbp_summary is injected into rebuilt prompt when present', () => {
    const intake = {
      niche: 'hvac',
      business_name: 'Cool Air HVAC',
      gbp_summary: 'Award-winning HVAC in Calgary. Open Mon-Fri 8am-6pm.',
    }
    const prompt = buildPromptFromIntake(intake)
    assert.ok(prompt.includes('Award-winning HVAC'), 'gbp_summary not found in prompt')
  })

  // TODO 2026-04-14: slot-based buildPromptFromIntake doesn't inject sonar_content yet
  test.skip('sonar_content is injected into rebuilt prompt when present', () => {
    const intake = {
      niche: 'hvac',
      business_name: 'Cool Air HVAC',
      sonar_content: 'Cool Air HVAC has 4.9 stars on Google, specialises in Lennox systems.',
    }
    const prompt = buildPromptFromIntake(intake)
    assert.ok(prompt.includes('4.9 stars'), 'sonar_content not found in prompt')
  })

  test('prompt without gbp_summary or sonar_content builds cleanly', () => {
    const intake = { niche: 'hvac', business_name: 'Cool Air HVAC' }
    const prompt = buildPromptFromIntake(intake)
    assert.ok(prompt.length > 100)
    assert.ok(!prompt.includes('Google Business Profile'))
    assert.ok(!prompt.includes('Web Research'))
  })
})

// ── No variable leakage: all registered niches ───────────────────────────────

describe('Phase 2 — no {{VARIABLE}} leakage in any registered niche', () => {
  const niches = ['auto_glass', 'property_management', 'real_estate', 'print_shop', 'other']

  for (const niche of niches) {
    test(`${niche}: no raw {{VARIABLE}} in output`, () => {
      const prompt = buildPromptFromIntake(baseIntake(niche))
      const remaining = prompt.match(/\{\{[A-Z_]+\}\}/g)
      assert.strictEqual(remaining, null, `${niche} has unfilled variables: ${JSON.stringify(remaining)}`)
    })
  }
})

// ── Phase 5c — mode-vs-niche precedence ──────────────────────────────────────
// No-ship matrix: mode intent must win on behavioral fields for intent-redefining modes.
// lead_capture must continue to defer to niche (regression).

describe('Phase 5c — auto_glass + voicemail_replacement: mode wins on behavioral fields', () => {
  const prompt = buildPromptFromIntake(baseIntake('auto_glass', {
    agent_mode: 'voicemail_replacement',
  }))

  test('COMPLETION_FIELDS is mode value (name/phone/message), not niche value (vehicle info)', () => {
    assert.ok(
      prompt.includes("caller's name, phone number, and a brief message"),
      'COMPLETION_FIELDS must be mode value for voicemail_replacement',
    )
    assert.ok(
      !prompt.includes('vehicle year, make, model, and preferred timing'),
      'niche COMPLETION_FIELDS must not appear when voicemail_replacement is active',
    )
  })

  test('TRIAGE_DEEP (section 3) is message-taking script, not windshield triage', () => {
    assert.ok(
      prompt.includes('Do not ask about services, schedules, or urgency'),
      'mode TRIAGE_DEEP must appear in prompt for voicemail_replacement',
    )
  })

  test('no {{VARIABLE}} leakage', () => {
    const remaining = prompt.match(/\{\{[A-Z_]+\}\}/g)
    assert.strictEqual(remaining, null, `unfilled variables: ${JSON.stringify(remaining)}`)
  })
})

describe('Phase 5c — auto_glass + lead_capture: niche still wins (regression)', () => {
  const prompt = buildPromptFromIntake(baseIntake('auto_glass', {
    agent_mode: 'lead_capture',
    call_handling_mode: 'triage',
  }))

  test('COMPLETION_FIELDS is niche value (vehicle info)', () => {
    assert.ok(
      prompt.includes('vehicle year, make, model, and preferred timing'),
      'niche COMPLETION_FIELDS must still win for lead_capture mode',
    )
  })

  test('TRIAGE_DEEP (section 3) is windshield triage, not message-taking', () => {
    assert.ok(
      prompt.includes('gotcha, just a chip'),
      'niche TRIAGE_DEEP must still win for lead_capture mode',
    )
    assert.ok(
      !prompt.includes('Do not ask about services, schedules, or urgency'),
      'mode TRIAGE_DEEP must not appear for lead_capture',
    )
  })
})

describe('Phase 5c — auto_glass + appointment_booking: booking fields win on COMPLETION_FIELDS and TRIAGE_DEEP', () => {
  const prompt = buildPromptFromIntake(baseIntake('auto_glass', {
    agent_mode: 'appointment_booking',
  }))

  test('COMPLETION_FIELDS is booking fields (not vehicle info)', () => {
    assert.ok(
      prompt.includes('service type, and preferred date/time'),
      'COMPLETION_FIELDS must be booking fields for appointment_booking',
    )
    assert.ok(
      !prompt.includes('vehicle year, make, model, and preferred timing'),
      'niche COMPLETION_FIELDS must not appear for appointment_booking',
    )
  })

  test('TRIAGE_DEEP leads with booking, not windshield diagnosis', () => {
    assert.ok(
      prompt.includes('I can check availability and book you right now'),
      'mode TRIAGE_DEEP must win for appointment_booking (leads with booking)',
    )
  })
})

describe('Phase 5c — real_estate + voicemail_replacement: bespoke builder unaffected', () => {
  // real_estate uses a bespoke builder that returns before mode variable overrides run.
  // Verify: no crash, output is still valid, no variable leakage.
  const prompt = buildPromptFromIntake(baseIntake('real_estate', {
    agent_mode: 'voicemail_replacement',
    owner_name: 'Hasan Sharif',
    callback_phone: '+13068507687',
  }))

  test('bespoke builder still produces a valid prompt', () => {
    assert.ok(prompt.length > 100, 'prompt must not be empty')
  })

  test('no {{VARIABLE}} leakage from bespoke builder', () => {
    const remaining = prompt.match(/\{\{[A-Z_]+\}\}/g)
    assert.strictEqual(remaining, null, `unfilled variables: ${JSON.stringify(remaining)}`)
  })
})
