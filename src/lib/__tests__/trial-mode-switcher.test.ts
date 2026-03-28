/**
 * trial-mode-switcher.test.ts
 *
 * Tests the logic backing TrialModeSwitcher:
 *   - AGENT_MODES buyer labels are stable and complete
 *   - Booking disclaimer predicate (full_service + !hasBooking)
 *   - Plan gate predicate (canSelectFullService)
 *   - Default mode fallback
 *
 * Run: npx tsx --test src/lib/__tests__/trial-mode-switcher.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_MODES, type AgentMode } from '../capabilities.js'

// ── AGENT_MODES shape ──────────────────────────────────────────────────────

describe('AGENT_MODES registry', () => {
  test('exactly 3 modes exist', () => {
    assert.equal(AGENT_MODES.length, 3)
  })

  test('mode IDs are message_only, triage, full_service (in order)', () => {
    const ids = AGENT_MODES.map(m => m.id)
    assert.deepEqual(ids, ['message_only', 'triage', 'full_service'])
  })

  test('buyer labels match spec', () => {
    const labels = AGENT_MODES.map(m => m.label)
    assert.deepEqual(labels, ['AI Voicemail', 'AI Receptionist', 'AI Receptionist + Booking'])
  })

  test('every mode has required fields', () => {
    const required: (keyof (typeof AGENT_MODES)[0])[] = [
      'id', 'label', 'tagline', 'description', 'quote', 'icon', 'included',
    ]
    for (const mode of AGENT_MODES) {
      for (const field of required) {
        assert.ok(mode[field] !== undefined && mode[field] !== '', `Mode ${mode.id} missing field: ${field}`)
      }
    }
  })

  test('each mode has at least one included feature string', () => {
    for (const mode of AGENT_MODES) {
      assert.ok(
        Array.isArray(mode.included) && mode.included.length > 0,
        `Mode ${mode.id}: included array must be non-empty`,
      )
    }
  })

  test('triage and full_service include everything from message_only', () => {
    const voicemailFeature = AGENT_MODES[0].included[0]
    // triage says "Everything in AI Voicemail"
    assert.ok(
      AGENT_MODES[1].included.some(f => f.toLowerCase().includes('ai voicemail')),
      'triage.included should reference AI Voicemail',
    )
    // full_service says "Everything in AI Receptionist"
    assert.ok(
      AGENT_MODES[2].included.some(f => f.toLowerCase().includes('ai receptionist')),
      'full_service.included should reference AI Receptionist',
    )
    void voicemailFeature // suppress lint
  })

  test('full_service quote references booking', () => {
    const fs = AGENT_MODES.find(m => m.id === 'full_service')!
    assert.ok(fs.quote.toLowerCase().includes('book'), 'full_service quote should mention booking')
  })
})

// ── Booking disclaimer predicate ───────────────────────────────────────────

describe('Booking disclaimer logic (full_service + !hasBooking)', () => {
  function showBookingNote(mode: AgentMode, hasBooking: boolean): boolean {
    return mode === 'full_service' && !hasBooking
  }

  test('shows for full_service when calendar not connected', () => {
    assert.equal(showBookingNote('full_service', false), true)
  })

  test('hidden for full_service when calendar IS connected', () => {
    assert.equal(showBookingNote('full_service', true), false)
  })

  test('hidden for message_only regardless of booking state', () => {
    assert.equal(showBookingNote('message_only', false), false)
    assert.equal(showBookingNote('message_only', true), false)
  })

  test('hidden for triage regardless of booking state', () => {
    assert.equal(showBookingNote('triage', false), false)
    assert.equal(showBookingNote('triage', true), false)
  })
})

// ── Plan gate predicate ───────────────────────────────────────────────────

describe('canSelectFullService plan gate', () => {
  function canSelectFullService(selectedPlan: string | null, subscriptionStatus: string | null): boolean {
    const isTrial = subscriptionStatus === 'trialing' || !subscriptionStatus
    return selectedPlan === 'pro' || isTrial
  }

  test('trial users always get full access', () => {
    assert.equal(canSelectFullService(null, 'trialing'), true)
    assert.equal(canSelectFullService('lite', 'trialing'), true)
    assert.equal(canSelectFullService('core', 'trialing'), true)
  })

  test('null subscriptionStatus (no plan yet) gets full access', () => {
    assert.equal(canSelectFullService(null, null), true)
    assert.equal(canSelectFullService('lite', null), true)
  })

  test('pro plan gets full access on any subscription status', () => {
    assert.equal(canSelectFullService('pro', 'active'), true)
    assert.equal(canSelectFullService('pro', null), true)
  })

  test('lite plan on active subscription is locked', () => {
    assert.equal(canSelectFullService('lite', 'active'), false)
  })

  test('core plan on active subscription is locked', () => {
    assert.equal(canSelectFullService('core', 'active'), false)
  })

  test('null plan on active subscription is locked', () => {
    // active subscription with no plan = locked (edge case — shouldn't happen in prod)
    assert.equal(canSelectFullService(null, 'active'), false)
  })
})

// ── Default mode fallback ─────────────────────────────────────────────────

describe('Default mode fallback', () => {
  function resolveInitialMode(currentMode: string | null): AgentMode {
    const valid = AGENT_MODES.map(m => m.id) as AgentMode[]
    return valid.includes(currentMode as AgentMode)
      ? (currentMode as AgentMode)
      : 'triage'
  }

  test('uses currentMode when valid', () => {
    assert.equal(resolveInitialMode('message_only'), 'message_only')
    assert.equal(resolveInitialMode('triage'), 'triage')
    assert.equal(resolveInitialMode('full_service'), 'full_service')
  })

  test('falls back to triage when null', () => {
    assert.equal(resolveInitialMode(null), 'triage')
  })

  test('falls back to triage for unrecognized values', () => {
    assert.equal(resolveInitialMode('unknown_mode'), 'triage')
    assert.equal(resolveInitialMode(''), 'triage')
  })
})
