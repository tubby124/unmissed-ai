/**
 * voice-resolution.test.ts
 *
 * Tests for resolveVoiceId() in lib/ultravox.ts and voice_id passthrough
 * in lib/intake-transform.ts.
 *
 * Run: npx tsx --test src/lib/__tests__/voice-resolution.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveVoiceId } from '../ultravox.js'
import { toIntakePayload } from '../intake-transform.js'

// ── Constants (mirrors ultravox.ts / niche-config.ts) ─────────────────────────

const JACQUELINE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a' // DEFAULT_VOICE (female)
const MARK       = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae' // VOICE_MALE

// ── resolveVoiceId ─────────────────────────────────────────────────────────────

describe('resolveVoiceId', () => {
  describe('directVoiceId — highest priority', () => {
    test('directVoiceId set → returns it directly', () => {
      assert.equal(resolveVoiceId('abc123', null, null), 'abc123')
    })

    test('directVoiceId + gender both set → directVoiceId wins', () => {
      assert.equal(resolveVoiceId('custom-id', 'male', 'plumbing'), 'custom-id')
    })

    test('directVoiceId with surrounding whitespace → trimmed and returned', () => {
      assert.equal(resolveVoiceId('  abc123  ', null, null), 'abc123')
    })

    test('empty string directVoiceId → falls through to gender', () => {
      assert.equal(resolveVoiceId('', 'male', null), MARK)
    })

    test('whitespace-only directVoiceId → falls through to gender', () => {
      assert.equal(resolveVoiceId('   ', 'male', null), MARK)
    })
  })

  describe('gender fallback — when no directVoiceId', () => {
    test('gender=male → returns MARK', () => {
      assert.equal(resolveVoiceId(null, 'male', null), MARK)
    })

    test('gender=female → returns JACQUELINE', () => {
      assert.equal(resolveVoiceId(null, 'female', null), JACQUELINE)
    })

    test('gender=Male (wrong case) → falls through to niche default', () => {
      // resolveVoiceId checks === 'male', so 'Male' does not match
      const result = resolveVoiceId(null, 'Male', 'plumbing')
      assert.equal(result, MARK) // plumbing niche default = Mark
    })
  })

  describe('niche default — when no directVoiceId and no gender', () => {
    test('niche=plumbing → MARK', () => {
      assert.equal(resolveVoiceId(null, null, 'plumbing'), MARK)
    })

    test('niche=dental → JACQUELINE', () => {
      assert.equal(resolveVoiceId(null, null, 'dental'), JACQUELINE)
    })

    test('niche=null → other default (MARK)', () => {
      assert.equal(resolveVoiceId(null, null, null), MARK)
    })

    test('unknown niche → other default (MARK)', () => {
      assert.equal(resolveVoiceId(null, null, 'unknown_niche'), MARK)
    })
  })
})

// ── toIntakePayload voice_id passthrough ──────────────────────────────────────

// Minimal OnboardingData-compatible object for testing
function makeData(overrides: Record<string, unknown> = {}): Parameters<typeof toIntakePayload>[0] {
  return {
    niche: 'plumbing',
    businessName: 'Test Plumbing Co',
    streetAddress: '',
    city: 'Edmonton',
    state: 'AB',
    agentName: 'Dave',
    callbackPhone: '+17801234567',
    ownerName: 'Bob',
    contactEmail: 'bob@example.com',
    websiteUrl: '',
    businessHoursText: '',
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
    afterHoursBehavior: 'take_message',
    emergencyPhone: '',
    nicheAnswers: {},
    notificationMethod: 'telegram',
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
    selectedPlan: null,
    ...overrides,
  } as Parameters<typeof toIntakePayload>[0]
}

describe('toIntakePayload — voice_id passthrough', () => {
  test('voice_id passes through when voiceId is set', () => {
    const payload = toIntakePayload(makeData({ voiceId: MARK }))
    assert.equal(payload.voice_id, MARK)
  })

  test('voice_id is null when voiceId is null', () => {
    const payload = toIntakePayload(makeData({ voiceId: null }))
    assert.equal(payload.voice_id, null)
  })

  test('voice_id passes through custom voiceId (non-default)', () => {
    const custom = '87edb04c-06d4-47c2-bd94-683bc47e8fbe' // Monika
    const payload = toIntakePayload(makeData({ voiceId: custom }))
    assert.equal(payload.voice_id, custom)
  })
})
