/**
 * capabilities.test.ts — Phase 1A unit tests
 *
 * Verifies capability flags per niche.
 * Run: npx tsx --test src/lib/__tests__/capabilities.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  NICHE_CAPABILITIES,
  getCapabilities,
  hasCapability,
  type AgentCapabilities,
} from '../niche-capabilities.js'

// ── Invariant: required niches are present ─────────────────────────────────

describe('NICHE_CAPABILITIES registry', () => {
  const requiredNiches = [
    'auto_glass', 'hvac', 'plumbing', 'dental', 'legal', 'salon',
    'real_estate', 'property_management', 'outbound_isa_realtor',
    'voicemail', 'print_shop', 'barbershop', 'restaurant', 'other',
  ]

  test('all expected niches are registered', () => {
    for (const niche of requiredNiches) {
      assert.ok(niche in NICHE_CAPABILITIES, `Missing niche: ${niche}`)
    }
  })

  test('all registered niches have all 8 capability fields', () => {
    const fields: (keyof AgentCapabilities)[] = [
      'takeMessages', 'bookAppointments', 'transferCalls', 'useKnowledgeLookup',
      'usePropertyLookup', 'useTenantLookup', 'updateTenantRequests', 'emergencyRouting',
    ]
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      for (const field of fields) {
        assert.equal(
          typeof caps[field], 'boolean',
          `Niche ${niche}: ${field} must be boolean`,
        )
      }
    }
  })
})

// ── Runbook-specified invariants ───────────────────────────────────────────

describe('Runbook-specified capability invariants', () => {
  test('voicemail: message yes, booking no', () => {
    assert.equal(getCapabilities('voicemail').takeMessages, true)
    assert.equal(getCapabilities('voicemail').bookAppointments, false)
  })

  test('real_estate: message yes, booking yes, property lookup yes', () => {
    const caps = getCapabilities('real_estate')
    assert.equal(caps.takeMessages, true)
    assert.equal(caps.bookAppointments, true)
    assert.equal(caps.usePropertyLookup, true)
  })

  test('property_management: message yes, tenant lookup yes, update requests yes (Phase 7)', () => {
    const caps = getCapabilities('property_management')
    assert.equal(caps.takeMessages, true)
    assert.equal(caps.useTenantLookup, true)
    assert.equal(caps.updateTenantRequests, true, 'Phase 7 enabled — PM can create maintenance requests')
  })
})

// ── Critical: things that must NOT be enabled ──────────────────────────────

describe('Disabled capability guards', () => {
  test('voicemail has no transfer, no booking, no knowledge lookup', () => {
    const caps = getCapabilities('voicemail')
    assert.equal(caps.transferCalls, false, 'voicemail must not allow transfer')
    assert.equal(caps.bookAppointments, false, 'voicemail must not allow booking')
    assert.equal(caps.useKnowledgeLookup, false, 'voicemail must not use knowledge lookup')
  })

  test('property_management has no transfer (callback-only service)', () => {
    assert.equal(
      getCapabilities('property_management').transferCalls,
      false,
      'PM explicitly forbids transfer — must be false',
    )
  })

  test('only property_management has updateTenantRequests=true (Phase 7)', () => {
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      if (niche === 'property_management') {
        assert.equal(caps.updateTenantRequests, true, `${niche}: Phase 7 enabled write ops`)
      } else {
        assert.equal(caps.updateTenantRequests, false, `${niche}: must not have write ops`)
      }
    }
  })

  test('only property_management and real_estate have specialized lookup flags', () => {
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      if (niche !== 'property_management') {
        assert.equal(
          caps.useTenantLookup,
          false,
          `Niche ${niche}: only property_management should have useTenantLookup`,
        )
      }
      if (niche !== 'real_estate') {
        assert.equal(
          caps.usePropertyLookup,
          false,
          `Niche ${niche}: only real_estate should have usePropertyLookup`,
        )
      }
    }
  })
})

// ── Booking capability: niches with active calendar tools ─────────────────

describe('Booking capability — calendar-enabled niches', () => {
  const bookableNiches = ['dental', 'salon', 'real_estate', 'barbershop', 'outbound_isa_realtor']
  const nonBookableNiches = [
    'auto_glass', 'hvac', 'plumbing', 'legal', 'property_management',
    'voicemail', 'print_shop', 'restaurant', 'other',
  ]

  test('bookable niches have bookAppointments=true', () => {
    for (const niche of bookableNiches) {
      assert.equal(
        getCapabilities(niche).bookAppointments,
        true,
        `${niche} should have bookAppointments=true`,
      )
    }
  })

  test('non-bookable niches have bookAppointments=false', () => {
    for (const niche of nonBookableNiches) {
      assert.equal(
        getCapabilities(niche).bookAppointments,
        false,
        `${niche} should NOT have bookAppointments (routes to callback only)`,
      )
    }
  })
})

// ── Emergency routing niches ───────────────────────────────────────────────

describe('Emergency routing', () => {
  const emergencyNiches = ['hvac', 'plumbing', 'property_management']
  const nonEmergencyNiches = [
    'auto_glass', 'dental', 'legal', 'salon', 'real_estate',
    'outbound_isa_realtor', 'voicemail', 'print_shop', 'barbershop', 'restaurant', 'other',
  ]

  test('emergency-capable niches have emergencyRouting=true', () => {
    for (const niche of emergencyNiches) {
      assert.equal(
        getCapabilities(niche).emergencyRouting,
        true,
        `${niche} should have emergencyRouting=true`,
      )
    }
  })

  test('non-emergency niches have emergencyRouting=false', () => {
    for (const niche of nonEmergencyNiches) {
      assert.equal(
        getCapabilities(niche).emergencyRouting,
        false,
        `${niche} should have emergencyRouting=false`,
      )
    }
  })
})

// ── getCapabilities() fallback ─────────────────────────────────────────────

describe('getCapabilities() unknown niche fallback', () => {
  test('returns conservative defaults for unknown niche', () => {
    const caps = getCapabilities('not_a_real_niche')
    assert.equal(caps.takeMessages, true, 'unknown niche should still take messages')
    assert.equal(caps.bookAppointments, false, 'unknown niche must not book')
    assert.equal(caps.transferCalls, false, 'unknown niche must not transfer')
    assert.equal(caps.useKnowledgeLookup, false)
    assert.equal(caps.usePropertyLookup, false)
    assert.equal(caps.useTenantLookup, false)
    assert.equal(caps.updateTenantRequests, false)
    assert.equal(caps.emergencyRouting, false)
  })
})

// ── hasCapability() helper ─────────────────────────────────────────────────

describe('hasCapability() helper', () => {
  test('returns correct value for known capability', () => {
    assert.equal(hasCapability('real_estate', 'bookAppointments'), true)
    assert.equal(hasCapability('voicemail', 'bookAppointments'), false)
    assert.equal(hasCapability('property_management', 'transferCalls'), false)
    assert.equal(hasCapability('hvac', 'emergencyRouting'), true)
  })

  test('returns false for unknown niche', () => {
    assert.equal(hasCapability('unknown_niche', 'bookAppointments'), false)
    assert.equal(hasCapability('unknown_niche', 'transferCalls'), false)
  })
})

// ── All niches take messages ───────────────────────────────────────────────

describe('Universal invariant', () => {
  test('every registered niche can take messages', () => {
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      assert.equal(
        caps.takeMessages,
        true,
        `Niche ${niche}: takeMessages must always be true`,
      )
    }
  })
})
