/**
 * build-client-agent-config.test.ts — Phase 1 unit tests
 *
 * Verifies buildClientAgentConfig() produces correct normalized output
 * with no DB calls, no side effects, deterministic from input alone.
 *
 * Run: npx tsx --test src/lib/__tests__/build-client-agent-config.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildClientAgentConfig,
  type ClientsRow,
} from '../build-client-agent-config.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXED_NOW = new Date('2026-03-24T12:00:00Z')

const MINIMAL_ROW: ClientsRow = {
  id: 'uuid-minimal',
  slug: 'test-co',
  business_name: 'Test Co',
}

const FULL_ROW: ClientsRow = {
  id: 'uuid-full',
  slug: 'windshield-hub',
  business_name: 'Windshield Hub',
  niche: 'auto_glass',
  timezone: 'America/Vancouver',
  city: 'Vancouver',
  website_url: 'https://windshieldhub.ca',
  callback_phone: '+17806001234',
  contact_email: 'fix@windshieldhub.ca',
  owner_name: 'Mark',
  agent_voice_id: 'b28f7f08',
  agent_name: 'Blake',
  voice_style_preset: 'professional_warm',
  business_hours_weekday: '8am to 6pm',
  business_hours_weekend: 'closed',
  after_hours_behavior: 'route_emergency',
  after_hours_emergency_phone: '+17801234567',
  forwarding_number: '+17801234567',
  transfer_conditions: 'Caller requests human',
  booking_enabled: false,
  sms_enabled: true,
  ivr_enabled: false,
  knowledge_backend: 'pgvector',
  business_facts: 'Licensed auto glass tech.\nFree mobile service.',
  extra_qa: [
    { q: 'Do you do chips?', a: 'Yes, chips and full replacements.' },
    { q: '', a: 'Should be filtered out.' },
  ],
  services_offered: 'Windshield replacement, chip repair',
  website_scrape_status: 'complete',
  setup_complete: true,
  subscription_status: 'active',
  selected_plan: 'pro',
  trial_expires_at: null,
  monthly_minute_limit: 300,
}

// Trial expires 7 days after FIXED_NOW → isTrialActive = true
const TRIAL_ROW: ClientsRow = {
  id: 'uuid-trial',
  slug: 'urban-vibe',
  business_name: 'Urban Vibe Salon',
  subscription_status: 'trial',
  trial_expires_at: '2026-03-31T00:00:00Z',
  setup_complete: false,
  booking_enabled: true,
  call_handling_mode: 'full_service',
}

// ── Tests: minimal row (all defaults) ────────────────────────────────────────

describe('buildClientAgentConfig', () => {
  describe('minimal row — all defaults', () => {
    const config = buildClientAgentConfig(MINIMAL_ROW, FIXED_NOW)

    test('clientId and slug pass through', () => {
      assert.equal(config.clientId, 'uuid-minimal')
      assert.equal(config.slug, 'test-co')
    })

    test('businessName passes through', () => {
      assert.equal(config.business.businessName, 'Test Co')
    })

    test('niche defaults to other', () => {
      assert.equal(config.business.niche, 'other')
    })

    test('timezone defaults to America/Edmonton', () => {
      assert.equal(config.business.timezone, 'America/Edmonton')
    })

    test('stateCode is null in Phase 1', () => {
      assert.equal(config.business.stateCode, null)
    })

    test('agentName defaults to Sam', () => {
      assert.equal(config.persona.agentName, 'Sam')
    })

    test('voicePreset defaults to casual_friendly', () => {
      assert.equal(config.persona.voicePreset, 'casual_friendly')
    })

    test('_voicePresetIsDefault true for minimal row', () => {
      assert.equal(config.persona._voicePresetIsDefault, true)
    })

    test('afterHoursBehavior defaults to take_message', () => {
      assert.equal(config.hours.afterHoursBehavior, 'take_message')
    })

    test('scheduleMode defaults to business_hours when no hours set', () => {
      assert.equal(config.hours.scheduleMode, 'business_hours')
    })

    test('callForwardingEnabled false when forwarding_number null', () => {
      assert.equal(config.routing.callForwardingEnabled, false)
      assert.equal(config.routing.forwardingNumber, null)
    })

    test('callHandlingMode defaults to triage', () => {
      assert.equal(config.routing.callHandlingMode, 'triage')
    })

    test('all capabilities false', () => {
      assert.equal(config.capabilities.smsEnabled, false)
      assert.equal(config.capabilities.bookingEnabled, false)
      assert.equal(config.capabilities.ivrEnabled, false)
      assert.equal(config.capabilities.knowledgeEnabled, false)
    })

    test('extraQa defaults to empty array', () => {
      assert.deepEqual(config.knowledge.extraQa, [])
    })

    test('scrapeStatus defaults to none', () => {
      assert.equal(config.knowledge.scrapeStatus, 'none')
    })

    test('monthlyMinuteLimit defaults to 500', () => {
      assert.equal(config.trial.monthlyMinuteLimit, 500)
    })

    test('isTrialActive false when no trial_expires_at', () => {
      assert.equal(config.trial.isTrialActive, false)
    })

    test('setupComplete false when null', () => {
      assert.equal(config.auth.setupComplete, false)
    })

    test('isFirstVisit true when setup_complete null', () => {
      assert.equal(config.auth.isFirstVisit, true)
    })
  })

  // ── Tests: full row ─────────────────────────────────────────────────────────

  describe('full row', () => {
    const config = buildClientAgentConfig(FULL_ROW, FIXED_NOW)

    test('voicePreset reads from column', () => {
      assert.equal(config.persona.voicePreset, 'professional_warm')
      assert.equal(config.persona._voicePresetIsDefault, false)
    })

    test('voiceId from agent_voice_id', () => {
      assert.equal(config.persona.voiceId, 'b28f7f08')
    })

    test('scheduleMode is business_hours for normal hours string', () => {
      assert.equal(config.hours.scheduleMode, 'business_hours')
    })

    test('callForwardingEnabled true when forwarding_number set', () => {
      assert.equal(config.routing.callForwardingEnabled, true)
      assert.equal(config.routing.forwardingNumber, '+17801234567')
    })

    test('transferEnabled true when transfer_conditions set', () => {
      assert.equal(config.routing.transferEnabled, true)
    })

    test('callHandlingMode triage when booking_enabled false', () => {
      assert.equal(config.routing.callHandlingMode, 'triage')
    })

    test('knowledgeEnabled true when knowledge_backend is pgvector', () => {
      assert.equal(config.capabilities.knowledgeEnabled, true)
    })

    test('smsEnabled true', () => {
      assert.equal(config.capabilities.smsEnabled, true)
    })

    test('extraQa filters empty q pairs', () => {
      assert.equal(config.knowledge.extraQa.length, 1)
      assert.equal(config.knowledge.extraQa[0].q, 'Do you do chips?')
    })

    test('scrapeStatus is complete', () => {
      assert.equal(config.knowledge.scrapeStatus, 'complete')
    })

    test('trialConverted true when subscription_status is active', () => {
      assert.equal(config.trial.trialConverted, true)
    })

    test('isTrialActive false when already converted', () => {
      assert.equal(config.trial.isTrialActive, false)
    })

    test('monthlyMinuteLimit from column', () => {
      assert.equal(config.trial.monthlyMinuteLimit, 300)
    })

    test('setupComplete true', () => {
      assert.equal(config.auth.setupComplete, true)
      assert.equal(config.auth.isFirstVisit, false)
    })
  })

  // ── Tests: trial row ────────────────────────────────────────────────────────

  describe('trial row', () => {
    test('isTrialActive true for active trial', () => {
      const config = buildClientAgentConfig(TRIAL_ROW, FIXED_NOW)
      assert.equal(config.trial.isTrialActive, true)
      assert.equal(config.trial.trialConverted, false)
    })

    test('callHandlingMode full_service when booking_enabled true', () => {
      const config = buildClientAgentConfig(TRIAL_ROW, FIXED_NOW)
      assert.equal(config.routing.callHandlingMode, 'full_service')
      assert.equal(config.capabilities.bookingEnabled, true)
    })

    test('isFirstVisit true when setup_complete false', () => {
      const config = buildClientAgentConfig(TRIAL_ROW, FIXED_NOW)
      assert.equal(config.auth.isFirstVisit, true)
    })

    test('isTrialActive false for expired trial', () => {
      const expiredRow: ClientsRow = {
        ...TRIAL_ROW,
        trial_expires_at: '2026-03-20T00:00:00Z', // 4 days before FIXED_NOW
      }
      const config = buildClientAgentConfig(expiredRow, FIXED_NOW)
      assert.equal(config.trial.isTrialActive, false)
    })
  })

  // ── Tests: scheduleMode derivation ─────────────────────────────────────────

  describe('scheduleMode derivation', () => {
    test('contains "24" -> 24_7', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, business_hours_weekday: '24/7, always available' },
        FIXED_NOW,
      )
      assert.equal(config.hours.scheduleMode, '24_7')
    })

    test('"always" keyword -> 24_7', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, business_hours_weekday: 'Always open' },
        FIXED_NOW,
      )
      assert.equal(config.hours.scheduleMode, '24_7')
    })

    test('normal hours string -> business_hours', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, business_hours_weekday: '9am to 5pm' },
        FIXED_NOW,
      )
      assert.equal(config.hours.scheduleMode, 'business_hours')
    })

    test('null hours -> business_hours (default)', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, business_hours_weekday: null },
        FIXED_NOW,
      )
      assert.equal(config.hours.scheduleMode, 'business_hours')
    })
  })

  // ── Tests: scrapeStatus derivation ─────────────────────────────────────────

  describe('scrapeStatus derivation', () => {
    test('null -> none', () => {
      const config = buildClientAgentConfig({ ...MINIMAL_ROW }, FIXED_NOW)
      assert.equal(config.knowledge.scrapeStatus, 'none')
    })

    test('in_progress -> pending', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, website_scrape_status: 'in_progress' },
        FIXED_NOW,
      )
      assert.equal(config.knowledge.scrapeStatus, 'pending')
    })

    test('pending -> pending', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, website_scrape_status: 'pending' },
        FIXED_NOW,
      )
      assert.equal(config.knowledge.scrapeStatus, 'pending')
    })

    test('failed -> error', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, website_scrape_status: 'failed' },
        FIXED_NOW,
      )
      assert.equal(config.knowledge.scrapeStatus, 'error')
    })
  })

  // ── Tests: voicePreset derivation ───────────────────────────────────────────

  describe('voicePreset derivation', () => {
    test('invalid preset falls back to casual_friendly with isDefault=true', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, voice_style_preset: 'not_a_real_preset' },
        FIXED_NOW,
      )
      assert.equal(config.persona.voicePreset, 'casual_friendly')
      assert.equal(config.persona._voicePresetIsDefault, true)
    })

    test('empathetic_care is recognized', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, voice_style_preset: 'empathetic_care' },
        FIXED_NOW,
      )
      assert.equal(config.persona.voicePreset, 'empathetic_care')
      assert.equal(config.persona._voicePresetIsDefault, false)
    })

    test('direct_efficient is recognized', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, voice_style_preset: 'direct_efficient' },
        FIXED_NOW,
      )
      assert.equal(config.persona.voicePreset, 'direct_efficient')
    })
  })

  // ── Tests: forwarding derivation ────────────────────────────────────────────

  describe('forwarding derivation', () => {
    test('whitespace-only forwarding_number -> disabled', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, forwarding_number: '   ' },
        FIXED_NOW,
      )
      assert.equal(config.routing.callForwardingEnabled, false)
      assert.equal(config.routing.forwardingNumber, null)
    })

    test('valid forwarding number -> enabled', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, forwarding_number: '+17801234567' },
        FIXED_NOW,
      )
      assert.equal(config.routing.callForwardingEnabled, true)
      assert.equal(config.routing.forwardingNumber, '+17801234567')
    })

    test('empty transfer_conditions -> transferEnabled false', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, transfer_conditions: '' },
        FIXED_NOW,
      )
      assert.equal(config.routing.transferEnabled, false)
    })

    test('whitespace transfer_conditions -> transferEnabled false', () => {
      const config = buildClientAgentConfig(
        { ...MINIMAL_ROW, transfer_conditions: '   ' },
        FIXED_NOW,
      )
      assert.equal(config.routing.transferEnabled, false)
    })
  })
})
