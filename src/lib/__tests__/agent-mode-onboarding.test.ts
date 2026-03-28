/**
 * agent-mode-onboarding.test.ts — Phase 3 onboarding verification
 *
 * Verifies:
 *   1. toIntakePayload derives call_handling_mode correctly from agent_mode
 *   2. agent_mode is passed through to the payload
 *   3. booking_enabled is NOT auto-enabled by appointment_booking
 *   4. voicemail_replacement → message_only derivation
 *   5. Default (no agentMode) → lead_capture + triage
 *
 * Run: npx tsx --test src/lib/__tests__/agent-mode-onboarding.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { toIntakePayload } from '../intake-transform.js'

// Minimal intake fixture — only fields needed for the tested derivations
function baseIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    niche: 'other',
    businessName: 'Test Co',
    city: 'Saskatoon',
    state: 'SK',
    agentName: 'Sam',
    callbackPhone: '3065551234',
    ownerName: '',
    contactEmail: '',
    websiteUrl: '',
    streetAddress: '',
    businessHoursText: 'Mon-Fri 9am-5pm',
    servicesOffered: '',
    hours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '', close: '', closed: true },
      sunday: { open: '', close: '', closed: true },
    },
    afterHoursBehavior: 'standard',
    emergencyPhone: '',
    nicheAnswers: {},
    notificationMethod: 'telegram',
    notificationPhone: '',
    notificationEmail: '',
    callerAutoText: false,
    callerAutoTextMessage: '',
    callerFAQ: '',
    agentRestrictions: '',
    agentTone: 'casual',
    primaryGoal: '',
    completionFields: '',
    pricingPolicy: '',
    unknownAnswerBehavior: '',
    commonObjections: [],
    voiceId: null,
    voiceName: '',
    callHandlingMode: 'triage',
    faqPairs: [],
    knowledgeDocs: [],
    timezone: 'America/Regina',
    websiteScrapeResult: null,
    ivrEnabled: false,
    ivrPrompt: '',
    scheduleMode: 'business_hours',
    callForwardingEnabled: false,
    selectedPlan: null,
    ...overrides,
  }
}

// ── 1. call_handling_mode derivation from agent_mode ─────────────────────────

describe('1. call_handling_mode derivation from agent_mode', () => {
  test('voicemail_replacement → call_handling_mode message_only', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'voicemail_replacement' }) as any)
    assert.equal(payload.call_handling_mode, 'message_only',
      'voicemail_replacement must derive message_only for call_handling_mode')
  })

  test('lead_capture → call_handling_mode triage', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'lead_capture' }) as any)
    assert.equal(payload.call_handling_mode, 'triage',
      'lead_capture must keep call_handling_mode as triage')
  })

  test('info_hub → call_handling_mode triage', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'info_hub' }) as any)
    assert.equal(payload.call_handling_mode, 'triage',
      'info_hub must keep call_handling_mode as triage')
  })

  test('appointment_booking → call_handling_mode triage (NOT full_service)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'appointment_booking' }) as any)
    assert.equal(payload.call_handling_mode, 'triage',
      'appointment_booking must NOT derive full_service — keeps triage to avoid booking_enabled coupling')
  })

  test('no agentMode → call_handling_mode triage (default)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake() as any)
    assert.equal(payload.call_handling_mode, 'triage',
      'missing agent_mode must default to triage')
  })
})

// ── 2. agent_mode pass-through ────────────────────────────────────────────────

describe('2. agent_mode pass-through to payload', () => {
  test('voicemail_replacement is preserved in payload', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'voicemail_replacement' }) as any)
    assert.equal(payload.agent_mode, 'voicemail_replacement')
  })

  test('info_hub is preserved in payload', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'info_hub' }) as any)
    assert.equal(payload.agent_mode, 'info_hub')
  })

  test('appointment_booking is preserved in payload', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'appointment_booking' }) as any)
    assert.equal(payload.agent_mode, 'appointment_booking')
  })

  test('no agentMode defaults to lead_capture in payload', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake() as any)
    assert.equal(payload.agent_mode, 'lead_capture',
      'missing agentMode must default to lead_capture')
  })
})

// ── 3. booking_enabled isolation ──────────────────────────────────────────────

describe('3. booking_enabled is NOT auto-enabled by agent_mode', () => {
  test('appointment_booking does not set booking_enabled=true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'appointment_booking' }) as any)
    assert.equal(payload.booking_enabled, false,
      'appointment_booking must NOT auto-enable booking_enabled — user must connect calendar separately')
  })

  test('voicemail_replacement does not set booking_enabled=true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'voicemail_replacement' }) as any)
    assert.equal(payload.booking_enabled, false)
  })

  test('info_hub does not set booking_enabled=true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = toIntakePayload(baseIntake({ agentMode: 'info_hub' }) as any)
    assert.equal(payload.booking_enabled, false)
  })
})

// ── 4. lead_capture regression — no-op ───────────────────────────────────────

describe('4. lead_capture is a no-op relative to omitting agent_mode', () => {
  test('lead_capture and missing agentMode produce identical call_handling_mode', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withLeadCapture = toIntakePayload(baseIntake({ agentMode: 'lead_capture' }) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withNoMode = toIntakePayload(baseIntake() as any)
    assert.equal(withLeadCapture.call_handling_mode, withNoMode.call_handling_mode,
      'lead_capture and no agentMode must produce the same call_handling_mode')
  })
})
