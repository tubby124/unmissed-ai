/**
 * intake-transform.test.ts
 *
 * Tests for toIntakePayload() — the function that maps OnboardingData (camelCase wizard state)
 * to snake_case intake payload written to intake_json + used to provision clients.
 *
 * Key concern: callForwardingEnabled + emergencyPhone must produce the correct owner_phone
 * value, which is what provision/trial/route.ts uses to set clients.forwarding_number.
 *
 * Run: npx tsx --test src/lib/__tests__/intake-transform.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { toIntakePayload } from '../intake-transform.js'
import type { OnboardingData } from '../../types/onboarding.js'

function base(): OnboardingData {
  return {
    niche: 'plumbing',
    businessName: 'Test Plumbing',
    streetAddress: '',
    city: 'Edmonton',
    state: 'AB',
    agentName: 'Sam',
    callbackPhone: '7805551234',
    ownerName: 'Test Owner',
    contactEmail: 'test@example.com',
    websiteUrl: '',
    businessHoursText: 'Mon-Fri 9am-5pm',
    servicesOffered: '',
    hours: {
      monday:    { open: '09:00', close: '17:00', closed: false },
      tuesday:   { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday:  { open: '09:00', close: '17:00', closed: false },
      friday:    { open: '09:00', close: '17:00', closed: false },
      saturday:  { open: '', close: '', closed: true },
      sunday:    { open: '', close: '', closed: true },
    },
    afterHoursBehavior: 'take_message',
    emergencyPhone: '',
    nicheAnswers: {},
    notificationMethod: 'email',
    notificationPhone: '',
    notificationEmail: '',
    callerAutoText: false,
    callerAutoTextMessage: '',
    callerFAQ: '',
    agentRestrictions: '',
    agentTone: 'casual_friendly',
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
    timezone: 'America/Edmonton',
    websiteScrapeResult: null,
    ivrEnabled: false,
    ivrPrompt: '',
    scheduleMode: 'business_hours',
    callForwardingEnabled: false,
    agentJob: 'receptionist',
    selectedPlan: 'core',
  }
}

// ── owner_phone — forwarding number truth path ─────────────────────────────
// provision/trial uses owner_phone from this payload to set clients.forwarding_number.
// The gate: callForwardingEnabled=true AND emergencyPhone has a value.

describe('owner_phone — callForwardingEnabled + emergencyPhone gate', () => {
  test('forwarding disabled + phone set → owner_phone empty', () => {
    const result = toIntakePayload({
      ...base(),
      callForwardingEnabled: false,
      emergencyPhone: '+15551234567',
    })
    assert.strictEqual(result.owner_phone, '', 'Should be empty when forwarding is disabled')
  })

  test('forwarding enabled + phone empty → owner_phone empty', () => {
    const result = toIntakePayload({
      ...base(),
      callForwardingEnabled: true,
      emergencyPhone: '',
    })
    assert.strictEqual(result.owner_phone, '', 'Should be empty when phone is blank')
  })

  test('forwarding enabled + phone whitespace only → owner_phone empty', () => {
    const result = toIntakePayload({
      ...base(),
      callForwardingEnabled: true,
      emergencyPhone: '   ',
    })
    assert.strictEqual(result.owner_phone, '', 'Should be empty when phone is whitespace only')
  })

  test('forwarding enabled + phone set → owner_phone = trimmed phone', () => {
    const result = toIntakePayload({
      ...base(),
      callForwardingEnabled: true,
      emergencyPhone: ' +15551234567 ',
    })
    assert.strictEqual(result.owner_phone, '+15551234567', 'Should return trimmed phone number')
  })

  test('forwarding enabled + 10-digit phone → preserved as-is', () => {
    const result = toIntakePayload({
      ...base(),
      callForwardingEnabled: true,
      emergencyPhone: '5551234567',
    })
    assert.strictEqual(result.owner_phone, '5551234567')
  })
})

// ── real_estate niche — context_data + booking_enabled ────────────────────

function realEstateBase(): OnboardingData {
  return {
    ...base(),
    niche: 'real_estate',
    businessName: 'Hasan Sharif Real Estate',
    ownerName: 'Hasan Sharif',
    nicheAnswers: {
      brokerage: 'eXp Realty',
      serviceAreas: ['Calgary', 'Airdrie'],
      focus: 'commercial',
      calendarIntent: true,
    },
    selectedPlan: null,
    callHandlingMode: 'triage',
  }
}

describe('real_estate — context_data', () => {
  test('includes Brokerage line', () => {
    const r = toIntakePayload(realEstateBase())
    assert.ok(
      (r.context_data as string).includes('Brokerage: eXp Realty'),
      `context_data missing brokerage: ${r.context_data}`
    )
  })

  test('includes Service areas line', () => {
    const r = toIntakePayload(realEstateBase())
    assert.ok(
      (r.context_data as string).includes('Service areas: Calgary, Airdrie'),
      `context_data missing service areas: ${r.context_data}`
    )
  })

  test('includes Specialty for commercial focus', () => {
    const r = toIntakePayload(realEstateBase())
    assert.ok(
      (r.context_data as string).includes('Specialty: Commercial real estate'),
      `context_data missing specialty: ${r.context_data}`
    )
  })

  test('omits Specialty when focus=both', () => {
    const r = toIntakePayload({
      ...realEstateBase(),
      nicheAnswers: { brokerage: 'eXp Realty', serviceAreas: ['Calgary'], focus: 'both', calendarIntent: false },
    })
    assert.ok(!(r.context_data as string).includes('Specialty'), `Unexpected Specialty line: ${r.context_data}`)
  })

  test('context_data_label = AGENT CONTEXT', () => {
    const r = toIntakePayload(realEstateBase())
    assert.equal(r.context_data_label, 'AGENT CONTEXT')
  })

  test('no context_data when brokerage and serviceAreas are both empty', () => {
    const r = toIntakePayload({
      ...realEstateBase(),
      nicheAnswers: { brokerage: '', serviceAreas: [], calendarIntent: false },
    })
    assert.equal(r.context_data, undefined)
    assert.equal(r.context_data_label, undefined)
  })
})

describe('real_estate — booking_enabled', () => {
  test('true when calendarIntent=true', () => {
    const r = toIntakePayload(realEstateBase())
    assert.equal(r.booking_enabled, true)
  })

  test('false when calendarIntent=false and no full_service plan', () => {
    const r = toIntakePayload({
      ...realEstateBase(),
      nicheAnswers: { brokerage: 'eXp Realty', serviceAreas: ['Calgary'], calendarIntent: false },
      selectedPlan: null,
      callHandlingMode: 'triage',
    })
    assert.equal(r.booking_enabled, false)
  })
})

describe('real_estate — niche field passthrough', () => {
  test('niche_brokerage present in payload', () => {
    const r = toIntakePayload(realEstateBase())
    assert.equal(r.niche_brokerage, 'eXp Realty')
  })

  test('niche_focus present in payload', () => {
    const r = toIntakePayload(realEstateBase())
    assert.equal(r.niche_focus, 'commercial')
  })
})

// ── slugify edge cases ─────────────────────────────────────────────────────
import { slugify } from '../intake-transform.js'

describe('slugify', () => {
  test('basic slug', () => {
    assert.strictEqual(slugify('Test Business'), 'test-business')
  })

  test('strips leading/trailing hyphens', () => {
    assert.strictEqual(slugify('  !Acme Inc.  '), 'acme-inc')
  })

  test('collapses multiple separators', () => {
    assert.strictEqual(slugify('Hasan & Sharif — Real Estate'), 'hasan-sharif-real-estate')
  })
})
