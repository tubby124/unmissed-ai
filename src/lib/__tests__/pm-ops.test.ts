/**
 * pm-ops.test.ts — Phase 7: Property Management Structured Ops
 *
 * Tests for PM data model validation, capability gating, urgency classification,
 * and cross-niche safety invariants.
 *
 * Run: npx tsx --test src/lib/__tests__/pm-ops.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAINTENANCE_CATEGORIES,
  URGENCY_TIERS,
  REQUEST_STATUSES,
  PM_WRITE_OPS,
  PM_READ_OPS,
  isValidCategory,
  isValidUrgencyTier,
  validateMaintenanceRequest,
  isWriteActionAllowed,
  getAllowedPmOps,
  isPmNiche,
  classifyUrgency,
  buildMaintenanceRequestPayload,
  type MaintenanceRequestInput,
} from '../pm-ops.js'
import { NICHE_CAPABILITIES, getCapabilities } from '../niche-capabilities.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function validInput(overrides: Partial<MaintenanceRequestInput> = {}): MaintenanceRequestInput {
  return {
    clientId: 'client-123',
    unitNumber: '4705B',
    tenantName: 'John Smith',
    callerPhone: '+13065551234',
    category: 'plumbing',
    description: 'Kitchen faucet is dripping constantly',
    urgencyTier: 'routine',
    preferredAccessWindow: 'Tuesday afternoon',
    entryPermission: true,
    callLogId: 'call-456',
    ...overrides,
  }
}

// ── Suite 1: MaintenanceCategory validation ─────────────────────────────────

describe('MaintenanceCategory validation', () => {
  test('all defined categories are accepted', () => {
    for (const cat of MAINTENANCE_CATEGORIES) {
      assert.ok(isValidCategory(cat), `expected "${cat}" to be valid`)
    }
  })

  test('invalid category is rejected', () => {
    assert.equal(isValidCategory('roofing'), false)
    assert.equal(isValidCategory('HVAC'), false) // case-sensitive
    assert.equal(isValidCategory(''), false)
  })

  test('has expected categories', () => {
    assert.ok(MAINTENANCE_CATEGORIES.includes('plumbing'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('hvac'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('electrical'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('appliance'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('structural'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('pest'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('lockout'))
    assert.ok(MAINTENANCE_CATEGORIES.includes('other'))
    assert.equal(MAINTENANCE_CATEGORIES.length, 8)
  })
})

// ── Suite 2: UrgencyTier validation ─────────────────────────────────────────

describe('UrgencyTier validation', () => {
  test('all defined tiers are accepted', () => {
    for (const tier of URGENCY_TIERS) {
      assert.ok(isValidUrgencyTier(tier), `expected "${tier}" to be valid`)
    }
  })

  test('invalid tier is rejected', () => {
    assert.equal(isValidUrgencyTier('critical'), false)
    assert.equal(isValidUrgencyTier('URGENT'), false)
    assert.equal(isValidUrgencyTier(''), false)
  })

  test('has exactly 3 tiers', () => {
    assert.equal(URGENCY_TIERS.length, 3)
    assert.ok(URGENCY_TIERS.includes('emergency_911'))
    assert.ok(URGENCY_TIERS.includes('urgent'))
    assert.ok(URGENCY_TIERS.includes('routine'))
  })
})

// ── Suite 3: MaintenanceRequest validation ──────────────────────────────────

describe('validateMaintenanceRequest', () => {
  test('valid complete input passes', () => {
    const result = validateMaintenanceRequest(validInput())
    assert.equal(result.valid, true)
    assert.equal(result.errors.length, 0)
  })

  test('missing unitNumber fails', () => {
    const result = validateMaintenanceRequest(validInput({ unitNumber: undefined }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('unitNumber')))
  })

  test('empty unitNumber fails', () => {
    const result = validateMaintenanceRequest(validInput({ unitNumber: '  ' }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('unitNumber')))
  })

  test('missing tenantName fails', () => {
    const result = validateMaintenanceRequest(validInput({ tenantName: undefined }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('tenantName')))
  })

  test('missing category fails', () => {
    const result = validateMaintenanceRequest(validInput({ category: undefined }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('category')))
  })

  test('invalid category fails with helpful message', () => {
    const result = validateMaintenanceRequest(validInput({ category: 'roofing' }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('roofing') && e.includes('must be one of')))
  })

  test('missing description fails', () => {
    const result = validateMaintenanceRequest(validInput({ description: undefined }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('description')))
  })

  test('too-short description fails', () => {
    const result = validateMaintenanceRequest(validInput({ description: 'drip' }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('at least 10 characters')))
  })

  test('missing urgencyTier fails', () => {
    const result = validateMaintenanceRequest(validInput({ urgencyTier: undefined }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('urgencyTier')))
  })

  test('invalid urgencyTier fails', () => {
    const result = validateMaintenanceRequest(validInput({ urgencyTier: 'critical' }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('critical')))
  })

  test('emergency_911 urgencyTier rejected for request creation', () => {
    const result = validateMaintenanceRequest(validInput({ urgencyTier: 'emergency_911' }))
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('emergency_911') && e.includes('911 redirect')))
  })

  test('multiple errors returned together', () => {
    const result = validateMaintenanceRequest({
      clientId: 'client-123',
      // all other fields missing
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.length >= 4, `expected 4+ errors, got ${result.errors.length}`)
  })

  test('optional fields can be null', () => {
    const result = validateMaintenanceRequest(validInput({
      callerPhone: null,
      preferredAccessWindow: null,
      entryPermission: null,
      callLogId: null,
    }))
    assert.equal(result.valid, true)
  })

  test('urgent tier accepted for request creation', () => {
    const result = validateMaintenanceRequest(validInput({ urgencyTier: 'urgent' }))
    assert.equal(result.valid, true)
  })

  test('routine tier accepted for request creation', () => {
    const result = validateMaintenanceRequest(validInput({ urgencyTier: 'routine' }))
    assert.equal(result.valid, true)
  })
})

// ── Suite 4: Capability gating ──────────────────────────────────────────────

describe('Capability gating', () => {
  test('isWriteActionAllowed returns true for property_management', () => {
    const caps = getCapabilities('property_management')
    assert.equal(isWriteActionAllowed(caps), true)
  })

  test('isWriteActionAllowed returns false for all non-PM niches', () => {
    const nonPmNiches = Object.keys(NICHE_CAPABILITIES).filter(n => n !== 'property_management')
    for (const niche of nonPmNiches) {
      const caps = getCapabilities(niche)
      assert.equal(isWriteActionAllowed(caps), false, `expected false for "${niche}"`)
    }
  })

  test('isWriteActionAllowed returns false for unknown niche', () => {
    const caps = getCapabilities('unknown_niche_xyz')
    assert.equal(isWriteActionAllowed(caps), false)
  })

  test('getAllowedPmOps returns read + write ops for property_management', () => {
    const caps = getCapabilities('property_management')
    const ops = getAllowedPmOps(caps)
    assert.ok(ops.length > 0)
    assert.ok(ops.some(o => o.name === 'lookupTenant'))
    assert.ok(ops.some(o => o.name === 'lookupExistingRequests'))
    assert.ok(ops.some(o => o.name === 'createMaintenanceRequest'))
    assert.ok(ops.some(o => o.name === 'appendRequestNote'))
  })

  test('getAllowedPmOps returns empty for niches without tenant lookup or write', () => {
    const caps = getCapabilities('voicemail')
    const ops = getAllowedPmOps(caps)
    assert.equal(ops.length, 0)
  })

  test('getAllowedPmOps returns read-only for niche with useTenantLookup but no write', () => {
    // Hypothetical: manually construct caps with lookup but no write
    const caps = { ...getCapabilities('property_management'), updateTenantRequests: false }
    const ops = getAllowedPmOps(caps)
    assert.ok(ops.some(o => o.name === 'lookupTenant'))
    assert.ok(!ops.some(o => o.name === 'createMaintenanceRequest'))
  })

  test('isPmNiche returns true for property_management', () => {
    assert.equal(isPmNiche('property_management'), true)
  })

  test('isPmNiche returns false for other niches', () => {
    assert.equal(isPmNiche('auto_glass'), false)
    assert.equal(isPmNiche('real_estate'), false)
    assert.equal(isPmNiche('other'), false)
  })
})

// ── Suite 5: Urgency classification ─────────────────────────────────────────

describe('classifyUrgency', () => {
  test('gas leak → emergency_911', () => {
    assert.equal(classifyUrgency('I smell gas in my kitchen'), 'emergency_911')
  })

  test('fire → emergency_911', () => {
    assert.equal(classifyUrgency('There is a fire in the building'), 'emergency_911')
  })

  test('carbon monoxide → emergency_911', () => {
    assert.equal(classifyUrgency('My CO detector is going off'), 'emergency_911')
  })

  test('break-in → emergency_911', () => {
    assert.equal(classifyUrgency('Someone is breaking in to my unit'), 'emergency_911')
  })

  test('no heat → urgent', () => {
    assert.equal(classifyUrgency('We have no heat and it is freezing'), 'urgent')
  })

  test('burst pipe → urgent', () => {
    assert.equal(classifyUrgency('A pipe burst in the bathroom'), 'urgent')
  })

  test('sewage backup → urgent', () => {
    assert.equal(classifyUrgency('There is a sewage backup in my unit'), 'urgent')
  })

  test('water heater → urgent', () => {
    assert.equal(classifyUrgency('My water heater is leaking everywhere'), 'urgent')
  })

  test('no hot water → urgent', () => {
    assert.equal(classifyUrgency('We have no hot water at all'), 'urgent')
  })

  test('no electricity → urgent', () => {
    assert.equal(classifyUrgency('There is no electricity in the unit'), 'urgent')
  })

  test('flooding → urgent', () => {
    assert.equal(classifyUrgency('There is flooding in the laundry room'), 'urgent')
  })

  test('dripping faucet → routine', () => {
    assert.equal(classifyUrgency('The kitchen faucet is dripping'), 'routine')
  })

  test('broken appliance → routine', () => {
    assert.equal(classifyUrgency('The dishwasher is not working properly'), 'routine')
  })

  test('cosmetic damage → routine', () => {
    assert.equal(classifyUrgency('There is a crack in the wall plaster'), 'routine')
  })

  test('vague description → routine (safe default)', () => {
    assert.equal(classifyUrgency('I need something fixed'), 'routine')
  })

  test('empty description → routine', () => {
    assert.equal(classifyUrgency(''), 'routine')
  })

  test('emergency_911 takes priority over urgent keywords', () => {
    // "gas smell" is 911, even though "pipe" might match urgent
    assert.equal(classifyUrgency('I smell gas near the pipe'), 'emergency_911')
  })
})

// ── Suite 6: Request payload builder ────────────────────────────────────────

describe('buildMaintenanceRequestPayload', () => {
  test('valid input returns complete MaintenanceRequest', () => {
    const req = buildMaintenanceRequestPayload(validInput())
    assert.ok(req.id, 'should have UUID id')
    assert.equal(req.clientId, 'client-123')
    assert.equal(req.unitNumber, '4705B')
    assert.equal(req.tenantName, 'John Smith')
    assert.equal(req.callerPhone, '+13065551234')
    assert.equal(req.category, 'plumbing')
    assert.equal(req.description, 'Kitchen faucet is dripping constantly')
    assert.equal(req.urgencyTier, 'routine')
    assert.equal(req.preferredAccessWindow, 'Tuesday afternoon')
    assert.equal(req.entryPermission, true)
    assert.equal(req.status, 'new')
    assert.equal(req.createdBy, 'voice_agent')
    assert.equal(req.callLogId, 'call-456')
    assert.deepEqual(req.notes, [])
    assert.ok(req.createdAt, 'should have ISO createdAt')
  })

  test('trims whitespace from string fields', () => {
    const req = buildMaintenanceRequestPayload(validInput({
      unitNumber: '  4705B  ',
      tenantName: '  John Smith  ',
      description: '  Kitchen faucet is dripping  ',
    }))
    assert.equal(req.unitNumber, '4705B')
    assert.equal(req.tenantName, 'John Smith')
    assert.equal(req.description, 'Kitchen faucet is dripping')
  })

  test('null optional fields default correctly', () => {
    const req = buildMaintenanceRequestPayload(validInput({
      callerPhone: null,
      preferredAccessWindow: null,
      entryPermission: null,
      callLogId: null,
    }))
    assert.equal(req.callerPhone, null)
    assert.equal(req.preferredAccessWindow, null)
    assert.equal(req.entryPermission, null)
    assert.equal(req.callLogId, null)
  })

  test('throws on invalid input', () => {
    assert.throws(
      () => buildMaintenanceRequestPayload({ clientId: 'x' }),
      (err: Error) => err.message.includes('Invalid maintenance request'),
    )
  })

  test('throws on emergency_911', () => {
    assert.throws(
      () => buildMaintenanceRequestPayload(validInput({ urgencyTier: 'emergency_911' })),
      (err: Error) => err.message.includes('emergency_911'),
    )
  })
})

// ── Suite 7: Cross-niche safety ─────────────────────────────────────────────

describe('Cross-niche safety', () => {
  test('only property_management has updateTenantRequests=true', () => {
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      if (niche === 'property_management') {
        assert.equal(caps.updateTenantRequests, true, `expected true for ${niche}`)
      } else {
        assert.equal(caps.updateTenantRequests, false, `expected false for ${niche}`)
      }
    }
  })

  test('only property_management has useTenantLookup=true', () => {
    for (const [niche, caps] of Object.entries(NICHE_CAPABILITIES)) {
      if (niche === 'property_management') {
        assert.equal(caps.useTenantLookup, true, `expected true for ${niche}`)
      } else {
        assert.equal(caps.useTenantLookup, false, `expected false for ${niche}`)
      }
    }
  })

  test('no non-PM niche gets write ops from getAllowedPmOps', () => {
    const nonPmNiches = Object.keys(NICHE_CAPABILITIES).filter(n => n !== 'property_management')
    for (const niche of nonPmNiches) {
      const ops = getAllowedPmOps(getCapabilities(niche))
      const writeOps = ops.filter(o => PM_WRITE_OPS.some(w => w.name === o.name))
      assert.equal(writeOps.length, 0, `niche "${niche}" should have no write ops`)
    }
  })

  test('PM_WRITE_OPS and PM_READ_OPS have required fields defined', () => {
    for (const op of [...PM_WRITE_OPS, ...PM_READ_OPS]) {
      assert.ok(op.name, 'op must have a name')
      assert.ok(op.description, 'op must have a description')
      assert.ok(op.requiredFields.length > 0, `op "${op.name}" must have required fields`)
    }
  })

  test('REQUEST_STATUSES includes expected lifecycle', () => {
    assert.ok(REQUEST_STATUSES.includes('new'))
    assert.ok(REQUEST_STATUSES.includes('acknowledged'))
    assert.ok(REQUEST_STATUSES.includes('completed'))
    assert.ok(REQUEST_STATUSES.includes('cancelled'))
  })
})
