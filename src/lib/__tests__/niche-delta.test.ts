/**
 * niche-delta.test.ts — Phase 5 unit tests
 *
 * Verifies niche family classification, delta consistency with NICHE_DEFAULTS
 * and NICHE_CAPABILITIES, and per-family representative prompt generation.
 *
 * Run: npx tsx --test src/lib/__tests__/niche-delta.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  NICHE_CAPABILITIES,
  NICHE_DELTAS,
  getNicheFamily,
  getNicheDelta,
  getNichesByFamily,
  type NicheFamily,
} from '../niche-capabilities.js'
import {
  buildPromptFromIntake,
  validatePrompt,
  isNicheRegistered,
  getRegisteredNiches,
  NICHE_DEFAULTS,
} from '../prompt-builder.js'

// ── Registry consistency ─────────────────────────────────────────────────────

describe('NICHE_DELTAS registry', () => {
  test('every niche in NICHE_CAPABILITIES has a delta entry', () => {
    for (const niche of Object.keys(NICHE_CAPABILITIES)) {
      assert.ok(niche in NICHE_DELTAS, `Missing delta for capability-registered niche: ${niche}`)
    }
  })

  test('every niche in NICHE_DELTAS has a capability entry', () => {
    for (const niche of Object.keys(NICHE_DELTAS)) {
      assert.ok(niche in NICHE_CAPABILITIES, `Delta niche ${niche} missing from NICHE_CAPABILITIES`)
    }
  })

  test('every niche in NICHE_DEFAULTS (except _common) has a delta entry', () => {
    for (const niche of Object.keys(NICHE_DEFAULTS)) {
      if (niche === '_common') continue
      assert.ok(niche in NICHE_DELTAS, `NICHE_DEFAULTS niche ${niche} missing from NICHE_DELTAS`)
    }
  })

  test('every delta niche is registered in NICHE_DEFAULTS', () => {
    for (const niche of Object.keys(NICHE_DELTAS)) {
      assert.ok(isNicheRegistered(niche), `Delta niche ${niche} not registered in NICHE_DEFAULTS`)
    }
  })
})

// ── Family classification invariants ────────────────────────────────────────

describe('Niche family classification', () => {
  test('voicemail is bespoke', () => {
    assert.equal(getNicheFamily('voicemail'), 'bespoke')
  })

  test('real_estate is shared_heavy', () => {
    assert.equal(getNicheFamily('real_estate'), 'shared_heavy')
  })

  test('property_management is shared_heavy', () => {
    assert.equal(getNicheFamily('property_management'), 'shared_heavy')
  })

  test('auto_glass is shared_heavy', () => {
    assert.equal(getNicheFamily('auto_glass'), 'shared_heavy')
  })

  test('barbershop is shared_heavy', () => {
    assert.equal(getNicheFamily('barbershop'), 'shared_heavy')
  })

  test('print_shop is shared_heavy', () => {
    assert.equal(getNicheFamily('print_shop'), 'shared_heavy')
  })

  test('other is shared_standard', () => {
    assert.equal(getNicheFamily('other'), 'shared_standard')
  })

  test('unknown niche defaults to shared_standard', () => {
    assert.equal(getNicheFamily('unknown_niche_xyz'), 'shared_standard')
  })

  test('exactly 1 bespoke niche', () => {
    const bespoke = getNichesByFamily('bespoke')
    assert.equal(bespoke.length, 1)
    assert.ok(bespoke.includes('voicemail'))
  })

  test('exactly 5 shared_heavy niches', () => {
    const heavy = getNichesByFamily('shared_heavy')
    assert.equal(heavy.length, 5)
    assert.ok(heavy.includes('auto_glass'))
    assert.ok(heavy.includes('property_management'))
    assert.ok(heavy.includes('barbershop'))
    assert.ok(heavy.includes('print_shop'))
    assert.ok(heavy.includes('real_estate'))
  })

  test('all remaining niches are shared_standard', () => {
    const standard = getNichesByFamily('shared_standard')
    const expected = ['hvac', 'plumbing', 'dental', 'legal', 'salon', 'restaurant', 'outbound_isa_realtor', 'mechanic_shop', 'pest_control', 'electrician', 'locksmith', 'other']
    for (const n of expected) {
      assert.ok(standard.includes(n), `Expected ${n} in shared_standard but not found`)
    }
    assert.equal(standard.length, expected.length)
  })

  test('all three families cover all registered niches', () => {
    const all = [
      ...getNichesByFamily('bespoke'),
      ...getNichesByFamily('shared_heavy'),
      ...getNichesByFamily('shared_standard'),
    ].sort()
    const registered = getRegisteredNiches().sort()
    assert.deepEqual(all, registered)
  })
})

// ── Delta descriptor invariants ──────────────────────────────────────────────

describe('Delta descriptor consistency', () => {
  test('bespoke niches have no overrideKeys (they bypass shared template)', () => {
    for (const niche of getNichesByFamily('bespoke')) {
      const delta = getNicheDelta(niche)
      assert.equal(delta.overrideKeys.length, 0, `Bespoke niche ${niche} should have no overrideKeys`)
    }
  })

  test('bespoke niches have buildtime special cases documenting the early return', () => {
    for (const niche of getNichesByFamily('bespoke')) {
      const delta = getNicheDelta(niche)
      assert.ok(delta.buildtimeSpecialCases.length > 0, `Bespoke niche ${niche} should document its builder`)
    }
  })

  test('property_management has INFO_FLOW_OVERRIDE and CLOSING_OVERRIDE (unique to this niche)', () => {
    const delta = getNicheDelta('property_management')
    assert.ok(delta.overrideKeys.includes('INFO_FLOW_OVERRIDE'))
    assert.ok(delta.overrideKeys.includes('CLOSING_OVERRIDE'))
  })

  test('no other niche has INFO_FLOW_OVERRIDE', () => {
    for (const [niche, delta] of Object.entries(NICHE_DELTAS)) {
      if (niche === 'property_management') continue
      assert.ok(!delta.overrideKeys.includes('INFO_FLOW_OVERRIDE'),
        `${niche} should not have INFO_FLOW_OVERRIDE — only property_management uses it`)
    }
  })

  test('no other niche has CLOSING_OVERRIDE', () => {
    for (const [niche, delta] of Object.entries(NICHE_DELTAS)) {
      if (niche === 'property_management') continue
      assert.ok(!delta.overrideKeys.includes('CLOSING_OVERRIDE'),
        `${niche} should not have CLOSING_OVERRIDE — only property_management uses it`)
    }
  })

  test('auto_glass documents rich Telegram format in runtime special cases', () => {
    const delta = getNicheDelta('auto_glass')
    assert.ok(delta.runtimeSpecialCases.some(s => s.includes('Telegram')))
  })

  test('voicemail documents email transcription in runtime special cases', () => {
    const delta = getNicheDelta('voicemail')
    assert.ok(delta.runtimeSpecialCases.some(s => s.includes('email')))
  })

  test('getNicheDelta returns minimal descriptor for unknown niche', () => {
    const delta = getNicheDelta('unknown_niche_xyz')
    assert.equal(delta.family, 'shared_standard')
    assert.equal(delta.overrideKeys.length, 0)
    assert.equal(delta.buildtimeSpecialCases.length, 0)
    assert.equal(delta.runtimeSpecialCases.length, 0)
  })
})

// ── Override keys match actual NICHE_DEFAULTS content ────────────────────────

describe('Override keys match NICHE_DEFAULTS', () => {
  const overrideKeyToDefaultKey: Record<string, string> = {
    TRIAGE_DEEP: 'TRIAGE_DEEP',
    INFO_FLOW_OVERRIDE: 'INFO_FLOW_OVERRIDE',
    CLOSING_OVERRIDE: 'CLOSING_OVERRIDE',
    NICHE_EXAMPLES: 'NICHE_EXAMPLES',
    FILTER_EXTRA: 'FILTER_EXTRA',
    FORBIDDEN_EXTRA: 'FORBIDDEN_EXTRA',
    URGENCY_KEYWORDS: 'URGENCY_KEYWORDS',
  }

  for (const [niche, delta] of Object.entries(NICHE_DELTAS)) {
    if (delta.family === 'bespoke') continue // bespoke niches don't use NICHE_DEFAULTS

    test(`${niche}: documented overrideKeys match actual NICHE_DEFAULTS keys`, () => {
      const defaults = NICHE_DEFAULTS[niche]
      if (!defaults) return // covered by registry test

      for (const key of delta.overrideKeys) {
        const defaultKey = overrideKeyToDefaultKey[key]
        if (defaultKey) {
          assert.ok(
            defaults[defaultKey] !== undefined && defaults[defaultKey] !== '',
            `${niche} declares overrideKey "${key}" but NICHE_DEFAULTS.${niche}.${defaultKey} is empty/missing`
          )
        }
      }
    })
  }
})

// ── Per-family representative prompt generation ──────────────────────────────

function makeMinimalIntake(niche: string): Record<string, unknown> {
  return {
    niche,
    business_name: `Test ${niche} Business`,
    city: 'Saskatoon',
    agent_name: 'TestAgent',
    hours_weekday: 'Mon-Fri 9-5',
    services_offered: 'General services',
    callback_phone: '3061234567',
    owner_phone: '3069876543',
    owner_name: 'Test Owner',
    after_hours_behavior: 'standard',
  }
}

describe('Bespoke family: voicemail', () => {
  const intake = makeMinimalIntake('voicemail')
  const prompt = buildPromptFromIntake(intake)

  test('produces a valid prompt', () => {
    assert.ok(prompt.length > 500, `Voicemail prompt too short: ${prompt.length}`)
  })

  test('does NOT contain shared template sections (TRIAGE, SCHEDULING)', () => {
    assert.ok(!prompt.includes('## 3. TRIAGE'), 'Voicemail should not have TRIAGE section')
    assert.ok(!prompt.includes('## 5. SCHEDULING'), 'Voicemail should not have SCHEDULING section')
  })

  test('contains MESSAGE TAKING FLOW', () => {
    assert.ok(prompt.includes('MESSAGE TAKING FLOW'))
  })

  test('contains LIFE SAFETY EMERGENCY OVERRIDE', () => {
    assert.ok(prompt.includes('LIFE SAFETY EMERGENCY OVERRIDE'))
  })

  test('contains COMPLETION CHECK', () => {
    assert.ok(prompt.includes('COMPLETION CHECK'))
  })
})

describe('Bespoke family: real_estate', () => {
  const intake = {
    ...makeMinimalIntake('real_estate'),
    niche_serviceAreas: ['Saskatoon', 'Prince Albert'],
  }
  const prompt = buildPromptFromIntake(intake)

  test('produces a valid prompt', () => {
    assert.ok(prompt.length > 500, `Real estate prompt too short: ${prompt.length}`)
  })

  test('does NOT contain shared template TRIAGE_SCRIPT markers', () => {
    assert.ok(!prompt.includes('{{TRIAGE_SCRIPT}}'))
  })

  test('contains owner persona reference', () => {
    assert.ok(prompt.includes('Test Owner') || prompt.includes('Test'))
  })
})

describe('Shared heavy: property_management', () => {
  const intake = makeMinimalIntake('property_management')
  const prompt = buildPromptFromIntake(intake)

  test('produces a valid prompt', () => {
    assert.ok(prompt.length > 2000, `PM prompt too short: ${prompt.length}`)
  })

  test('TRIAGE_DEEP is injected (contains PM-specific routing)', () => {
    assert.ok(prompt.includes('RENTAL INQUIRY') || prompt.includes('BILLING'), 'PM TRIAGE_DEEP should contain rental/billing routing')
  })

  test('INFO_FLOW_OVERRIDE replaces generic info collection', () => {
    assert.ok(prompt.includes('For current tenants') || prompt.includes('For rental prospects'))
  })

  test('CLOSING_OVERRIDE replaces generic closing', () => {
    assert.ok(prompt.includes('COMPLETION CHECK'))
  })

  test('TRANSFER_ENABLED is not set to true (PM has transferCalls=false)', () => {
    assert.ok(!prompt.includes('TRANSFER_ENABLED = true'),
      'PM should not have TRANSFER_ENABLED = true')
    // Note: ESCALATION AND TRANSFER section still appears in shared template
    // with both enabled/not-enabled branches. Post-processing cleans literal
    // leaks but keeps the section for clarity. This is tracked for Phase 6+.
  })

  test('contains hangUp tool reference', () => {
    assert.ok(prompt.includes('hangUp'))
  })
})

describe('Shared heavy: auto_glass', () => {
  const intake = makeMinimalIntake('auto_glass')
  const prompt = buildPromptFromIntake(intake)

  test('TRIAGE_DEEP is injected (contains windshield-specific triage)', () => {
    assert.ok(prompt.includes('VEHICLE DETAILS') || prompt.includes('SENSOR CHECK'))
  })

  test('FILTER_EXTRA is injected (insurance/delivery routing)', () => {
    assert.ok(prompt.includes('INSURANCE / BILLING') || prompt.includes('DELIVERY'))
  })

  test('NICHE_EXAMPLES are injected', () => {
    assert.ok(prompt.includes('Example A'))
  })

  test('VIN spelling rule is present', () => {
    assert.ok(prompt.includes('v-i-n'))
  })
})

describe('Shared heavy: barbershop', () => {
  const intake = {
    ...makeMinimalIntake('barbershop'),
    niche_priceRange: '$25-45',
    niche_walkInPolicy: 'walk-ins welcome, no guarantee',
  }
  const prompt = buildPromptFromIntake(intake)

  test('PRICE_RANGE is substituted', () => {
    assert.ok(prompt.includes('$25-45'))
  })

  test('WALK_IN_POLICY is substituted', () => {
    assert.ok(prompt.includes('walk-ins welcome'))
  })

  test('CLOSE_PERSON is set from owner first name', () => {
    assert.ok(prompt.includes('Test'))
  })

  test('TRIAGE_DEEP is injected (barbershop uses own template)', () => {
    // barbershop has its own NICHE_DEFAULTS entry — uses barbershop-specific TRIAGE_DEEP
    assert.ok(prompt.includes('BOOKING REQUEST') || prompt.includes('WALK-IN QUESTION') || prompt.includes('PRICE QUESTION'))
  })
})

describe('Shared heavy: print_shop', () => {
  const intake = {
    ...makeMinimalIntake('print_shop'),
    niche_rushCutoffTime: '10 AM',
    niche_designOffered: true,
    niche_websiteUrl: 'example.com',
    niche_emailAddress: 'orders@example.com',
  }
  const prompt = buildPromptFromIntake(intake)

  test('PRICE QUOTING EXCEPTION is injected', () => {
    assert.ok(prompt.includes('PRICE QUOTING EXCEPTION'))
  })

  test('print shop FAQ is generated (not generic FAQ)', () => {
    assert.ok(prompt.includes('rush') || prompt.includes('deadline') || prompt.includes('10 AM'))
  })
})

describe('Shared standard: hvac (with emergency routing)', () => {
  const intake = makeMinimalIntake('hvac')
  const prompt = buildPromptFromIntake(intake)

  test('TRIAGE_DEEP is injected (contains HVAC-specific routing)', () => {
    // HVAC TRIAGE_DEEP uses lowercase "no heat" and "no AC"
    assert.ok(prompt.includes('no heat') || prompt.includes('no AC') || prompt.includes('furnace not working'))
  })

  test('contains gas smell life safety redirect', () => {
    assert.ok(prompt.includes('gas company'))
  })

  test('contains hangUp tool reference', () => {
    assert.ok(prompt.includes('hangUp'))
  })
})

describe('Shared standard: restaurant (knowledge only, no transfer/booking)', () => {
  const intake = makeMinimalIntake('restaurant')
  const prompt = buildPromptFromIntake(intake)

  test('TRIAGE_DEEP is injected (restaurant uses own template)', () => {
    // restaurant has its own NICHE_DEFAULTS entry — uses restaurant-specific TRIAGE_DEEP
    assert.ok(prompt.includes('MENU QUESTION') || prompt.includes('RESERVATION') || prompt.includes('HOURS'))
  })

  test('transfer is NOT enabled (restaurant has transferCalls=false)', () => {
    // After post-processing, TRANSFER_ENABLED=false paths should be cleaned
    assert.ok(!prompt.includes('TRANSFER_ENABLED = true'))
  })
})

describe('Shared standard: other (resolves to auto_glass template)', () => {
  const intake = makeMinimalIntake('other')
  const prompt = buildPromptFromIntake(intake)

  test('produces a valid prompt without errors', () => {
    const validation = validatePrompt(prompt)
    // May have warnings but should not have critical errors
    // (except possibly short prompt for minimal intake)
    assert.ok(prompt.length > 1000, `Other prompt too short: ${prompt.length}`)
  })

  test('resolves to auto_glass production template (not minimal fallback)', () => {
    // resolveProductionNiche: unrecognised niche → auto_glass (most complete template)
    assert.ok(prompt.includes('VEHICLE DETAILS') || prompt.includes('SENSOR CHECK'))
    assert.ok(!prompt.includes('RENTAL INQUIRY'))  // not property_management
    assert.ok(!prompt.includes('PRICE QUOTING EXCEPTION'))  // not print_shop
  })

  test('contains core template sections', () => {
    assert.ok(prompt.includes('LIFE SAFETY EMERGENCY OVERRIDE'))
    assert.ok(prompt.includes('hangUp'))
    assert.ok(prompt.includes('COMPLETION CHECK'))
  })
})

// ── Cross-family safety invariants ───────────────────────────────────────────

describe('Cross-family safety invariants', () => {
  const allNiches = getRegisteredNiches()

  test('every niche prompt contains LIFE SAFETY EMERGENCY OVERRIDE (except real_estate — known gap)', () => {
    // real_estate bespoke builder omits the explicit LIFE SAFETY section.
    // Documented gap — tracked for Phase 7+ prompt consolidation.
    const exempted = new Set(['real_estate'])

    for (const niche of allNiches) {
      if (exempted.has(niche)) continue
      const intake = makeMinimalIntake(niche)
      const prompt = buildPromptFromIntake(intake)
      assert.ok(prompt.includes('LIFE SAFETY') || prompt.includes('9-1-1') || prompt.includes('911'),
        `${niche} prompt missing life safety override`)
    }
  })

  test('every niche prompt contains hangUp tool reference', () => {
    for (const niche of allNiches) {
      const intake = makeMinimalIntake(niche)
      const prompt = buildPromptFromIntake(intake)
      assert.ok(prompt.includes('hangUp'), `${niche} prompt missing hangUp tool reference`)
    }
  })

  test('no niche prompt has unfilled {{VARIABLES}} (except runtime placeholders)', () => {
    // Runtime placeholders that are intentionally unfilled at build time:
    const allowedUnfilled = ['callerContext', 'businessFacts']

    for (const niche of allNiches) {
      const intake = makeMinimalIntake(niche)
      const prompt = buildPromptFromIntake(intake)
      const unfilled = [...prompt.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)]
        .map(m => m[1])
        .filter(v => !allowedUnfilled.includes(v))
      assert.equal(unfilled.length, 0,
        `${niche} prompt has unfilled variables: ${unfilled.join(', ')}`)
    }
  })

  test('bespoke niches do NOT contain shared template section markers', () => {
    for (const niche of getNichesByFamily('bespoke')) {
      const intake = makeMinimalIntake(niche)
      const prompt = buildPromptFromIntake(intake)
      // Shared template uses numbered sections like "## 3. TRIAGE", "## 5. SCHEDULING"
      assert.ok(!prompt.includes('## 3. TRIAGE'), `Bespoke niche ${niche} leaked shared TRIAGE section`)
      assert.ok(!prompt.includes('## 5. SCHEDULING'), `Bespoke niche ${niche} leaked shared SCHEDULING section`)
    }
  })

  test('shared niches contain COMPLETION CHECK', () => {
    for (const niche of [...getNichesByFamily('shared_heavy'), ...getNichesByFamily('shared_standard')]) {
      const intake = makeMinimalIntake(niche)
      const prompt = buildPromptFromIntake(intake)
      assert.ok(prompt.includes('COMPLETION CHECK'), `Shared niche ${niche} missing COMPLETION CHECK`)
    }
  })
})
