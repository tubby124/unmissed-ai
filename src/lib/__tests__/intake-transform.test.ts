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
