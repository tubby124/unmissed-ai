/**
 * agent-identity.test.ts
 *
 * Tests for agentNameIsAutoSet() — the guard that decides whether
 * a GBP import or niche change is allowed to overwrite the current agent name.
 *
 * Run: npx tsx --test src/lib/__tests__/agent-identity.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { agentNameIsAutoSet, toIntakePayload } from '../intake-transform.js'

// ── agentNameIsAutoSet ─────────────────────────────────────────────────────────

describe('agentNameIsAutoSet — GBP import / niche-change overwrite guard', () => {

  describe('empty name — always auto-settable', () => {
    test('empty string → auto-set allowed', () => {
      assert.equal(agentNameIsAutoSet('', 'plumbing'), true)
    })

    test('null niche + empty name → auto-set allowed', () => {
      assert.equal(agentNameIsAutoSet('', null), true)
    })
  })

  describe('name matches CURRENT niche default — auto-settable (system-set, not user-typed)', () => {
    test('plumbing default "Dave" + plumbing niche → auto-set allowed (niche change safe)', () => {
      assert.equal(agentNameIsAutoSet('Dave', 'plumbing'), true)
    })

    test('dental default "Ashley" + dental niche → auto-set allowed', () => {
      assert.equal(agentNameIsAutoSet('Ashley', 'dental'), true)
    })

    test('other default "Sam" + other niche → auto-set allowed', () => {
      assert.equal(agentNameIsAutoSet('Sam', 'other'), true)
    })
  })

  describe('name does NOT match current niche default — user-typed, must preserve', () => {
    test('"Sam" on plumbing niche (plumbing default = Dave) → NOT auto-settable', () => {
      // User typed "Sam" while on plumbing niche — should be preserved
      assert.equal(agentNameIsAutoSet('Sam', 'plumbing'), false)
    })

    test('"Mark" on dental niche (dental default = Ashley) → NOT auto-settable', () => {
      // "Mark" is plumbing/auto_glass default but user is on dental — preserve it
      assert.equal(agentNameIsAutoSet('Mark', 'dental'), false)
    })

    test('custom name "Bob" on any niche → NOT auto-settable', () => {
      assert.equal(agentNameIsAutoSet('Bob', 'hvac'), false)
    })

    test('"Ashley" typed while on plumbing niche → NOT auto-settable', () => {
      // Ashley is dental default but user is on plumbing — they typed it explicitly
      assert.equal(agentNameIsAutoSet('Ashley', 'plumbing'), false)
    })
  })

  describe('null niche edge cases', () => {
    test('non-empty name + null niche → NOT auto-settable', () => {
      assert.equal(agentNameIsAutoSet('Sam', null), false)
    })

    test('any user name + null niche → NOT auto-settable', () => {
      assert.equal(agentNameIsAutoSet('Dave', null), false)
    })
  })
})

// ── toIntakePayload — agent_name passthrough ───────────────────────────────────

describe('toIntakePayload — agent_name uses data.agentName, falls back to niche default', () => {
  function makeData(overrides: Record<string, unknown> = {}) {
    return {
      niche: 'plumbing',
      businessName: 'Test Plumbing',
      streetAddress: '', city: 'Edmonton', state: 'AB',
      agentName: 'Dave',
      callbackPhone: '+17801234567',
      ownerName: 'Bob', contactEmail: 'bob@example.com',
      websiteUrl: '', businessHoursText: '', servicesOffered: '',
      hours: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '', close: '', closed: true },
        sunday: { open: '', close: '', closed: true },
      },
      afterHoursBehavior: 'take_message', emergencyPhone: '',
      nicheAnswers: {}, notificationMethod: 'telegram',
      notificationPhone: '', notificationEmail: '',
      callerAutoText: false, callerAutoTextMessage: '',
      callerFAQ: '', agentRestrictions: '', agentTone: 'casual',
      primaryGoal: '', completionFields: '', pricingPolicy: '',
      unknownAnswerBehavior: '', commonObjections: [],
      voiceId: null, voiceName: '',
      callHandlingMode: 'triage', faqPairs: [], knowledgeDocs: [],
      timezone: 'America/Edmonton', websiteScrapeResult: null,
      ivrEnabled: false, ivrPrompt: '',
      scheduleMode: 'business_hours', callForwardingEnabled: false,
      selectedPlan: null,
      ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  test('user-typed agent name passes through to agent_name', () => {
    const payload = toIntakePayload(makeData({ agentName: 'Bob' }))
    assert.equal(payload.agent_name, 'Bob')
  })

  test('empty agentName falls back to niche default in payload', () => {
    const payload = toIntakePayload(makeData({ agentName: '', niche: 'plumbing' }))
    assert.equal(payload.agent_name, 'Dave') // plumbing default
  })

  test('business_name in payload matches businessName from data', () => {
    const payload = toIntakePayload(makeData({ businessName: 'Plumbing & Parts Home Centre' }))
    assert.equal(payload.business_name, 'Plumbing & Parts Home Centre')
  })
})
