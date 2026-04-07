/**
 * call-scenarios.test.ts — Prompt coverage test suite
 *
 * NOT a live call simulation. Tests that the built prompt contains the specific
 * text fragments that would handle each caller intent. A prompt missing "Fair Housing"
 * on the FHA scenario IS a real bug — this catches content regressions that structural
 * tests miss.
 *
 * Run: npm run test:scenarios
 * Run + Obsidian report: npm run test:scenarios:report
 *
 * Phases:
 *   Phase 1  — PM hero niche (15 scenarios)
 *   Phase 2  — PM "field empty" variants (5 scenarios — the dangerous case)
 *   Phase 3  — Cross-mode tests: message_only vs triage vs voicemail niche
 *   Phase 4  — HVAC (6 scenarios)
 *   Phase 5  — Plumbing (6 scenarios)
 *   Phase 6  — Auto glass (6 scenarios)
 *   Phase 7  — Outbound ISA realtor (5 scenarios)
 *   Phase 8  — General / other niche (4 scenarios)
 *   Phase 9  — Voicemail niche (4 scenarios)
 *   Phase 10 — Universal safety (cross-niche assertions)
 *   Phase 11 — Prompt length guard (all registered niches)
 */

import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildPromptFromIntake } from '../prompt-builder.js'
import { PROMPT_CHAR_HARD_MAX } from '../knowledge-summary.js'
import { getRegisteredNiches } from '../prompt-builder.js'

// ── Result tracking ───────────────────────────────────────────────────────────

interface ScenarioResult {
  id: string
  niche: string
  fragment: string
  passed: boolean
  anti?: boolean   // true = mustNotContain assertion
}

const _results: ScenarioResult[] = []

function track(id: string, niche: string, fragment: string, passed: boolean, anti = false) {
  _results.push({ id, niche, fragment, passed, anti })
}

function writeReport() {
  const dir = path.resolve(process.cwd(), '.test-artifacts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const total = _results.length
  const passed = _results.filter(r => r.passed).length
  const failed = _results.filter(r => !r.passed)

  const byNiche: Record<string, { pass: number; total: number }> = {}
  for (const r of _results) {
    if (!byNiche[r.niche]) byNiche[r.niche] = { pass: 0, total: 0 }
    byNiche[r.niche].total++
    if (r.passed) byNiche[r.niche].pass++
  }

  const report = {
    date: new Date().toISOString(),
    total,
    passed,
    failed: failed.map(r => ({ id: r.id, niche: r.niche, fragment: r.fragment, anti: r.anti })),
    byNiche,
  }

  fs.writeFileSync(path.join(dir, 'call-scenarios.json'), JSON.stringify(report, null, 2))
}

// Write report on process exit (fires after all tests complete)
process.on('exit', writeReport)

// ── Intake builder ────────────────────────────────────────────────────────────

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

function makeIntake(niche: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...makeMinimalIntake(niche), ...overrides }
}

// ── Scenario interface ────────────────────────────────────────────────────────

interface Scenario {
  id: string
  niche: string
  callerType: 'tenant' | 'property_owner' | 'prospect' | 'emergency' | 'unknown' | 'spam' | 'hiring'
  intentSummary: string
  intakeOverrides?: Record<string, unknown>
  expectedContains: string[]
  mustNotContain?: string[]
}

// ── Scenario driver ───────────────────────────────────────────────────────────

function runScenarios(scenarios: Scenario[]) {
  for (const scenario of scenarios) {
    describe(scenario.id, () => {
      const intake = makeIntake(scenario.niche, scenario.intakeOverrides ?? {})
      const prompt = buildPromptFromIntake(intake)

      for (const fragment of scenario.expectedContains) {
        const label = fragment.length > 60 ? fragment.slice(0, 57) + '...' : fragment
        test(`contains: "${label}"`, () => {
          const passed = prompt.includes(fragment)
          track(scenario.id, scenario.niche, fragment, passed)
          assert.ok(passed, `[${scenario.id}] Missing fragment: "${fragment}"`)
        })
      }

      for (const anti of (scenario.mustNotContain ?? [])) {
        const label = anti.length > 60 ? anti.slice(0, 57) + '...' : anti
        test(`must NOT contain: "${label}"`, () => {
          const passed = !prompt.includes(anti)
          track(scenario.id, scenario.niche, anti, passed, true)
          assert.ok(passed, `[${scenario.id}] Prompt should NOT contain: "${anti}"`)
        })
      }
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — PM Hero Niche (15 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 1 — PM hero niche', () => {
  runScenarios([
    {
      id: 'pm-01-burst-pipe',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Tenant reports burst pipe / active flooding',
      expectedContains: [
        'flag [P1 URGENT]',
        '9-1-1 right now',
        'name and unit',
      ],
    },
    {
      id: 'pm-02-no-heat-winter',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Furnace stopped in winter',
      expectedContains: [
        'No heat = always URGENT',
        'flag [URGENT]',
      ],
    },
    {
      id: 'pm-03-gas-smell',
      niche: 'property_management',
      callerType: 'emergency',
      intentSummary: 'Tenant smells gas in apartment',
      expectedContains: [
        '9-1-1 right now',
        'gas company emergency line',
        'flag [URGENT]',
      ],
    },
    {
      id: 'pm-04-dripping-faucet',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Kitchen faucet has been dripping — routine repair',
      expectedContains: [
        'flag [P3 ROUTINE]',
        'ROUTINE',
      ],
    },
    {
      id: 'pm-05-rental-inquiry',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Prospective tenant saw listing on Kijiji',
      expectedContains: [
        'SHOWING REQUEST',
        'RENTAL INQUIRY',
        'NEVER answer questions about availability, pricing',
      ],
    },
    {
      id: 'pm-06-rent-amount-question',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Caller asks how much the rent is',
      expectedContains: [
        'NEVER confirm or deny rent amounts, unit availability, pet policy',
      ],
    },
    {
      id: 'pm-07-pet-policy-question',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Caller asks if pets are allowed',
      expectedContains: [
        'NEVER confirm or deny rent amounts, unit availability, pet policy',
      ],
    },
    {
      id: 'pm-08-fha-demographic-probe',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Caller asks "is it a quiet building, mostly professionals?"',
      expectedContains: [
        'Fair Housing Act violations carry penalties up to $150,000',
        'demographic language',
      ],
    },
    {
      id: 'pm-09-esa-service-animal',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Caller says they have a service dog',
      expectedContains: [
        'NEVER reject or question service animal or ESA requests',
      ],
    },
    {
      id: 'pm-10-bedbug-report',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Tenant reports bedbugs in unit',
      expectedContains: [
        'do NOT downplay',
        'flag as [P1 URGENT] immediately',
      ],
    },
    {
      id: 'pm-11-lease-renewal',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Tenant asks about lease renewal options',
      expectedContains: [
        'NEVER discuss specific renewal terms',
        'LEASE RENEWAL',
      ],
    },
    {
      id: 'pm-12-property-owner-financials',
      niche: 'property_management',
      callerType: 'property_owner',
      intentSummary: 'Property owner calls about financials on their building',
      expectedContains: [
        'NEVER discuss specific financial figures',
        'PROPERTY OWNER',
      ],
    },
    {
      id: 'pm-13-move-in-keys',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Incoming tenant asks when to pick up keys',
      expectedContains: [
        'NEVER confirm dates',
        'MOVE-IN',
      ],
    },
    {
      id: 'pm-14-spam-robocall',
      niche: 'property_management',
      callerType: 'spam',
      intentSummary: 'Extended warranty robocall',
      expectedContains: [
        'hangUp',
        'thanks, not interested',
      ],
    },
    {
      id: 'pm-15-legal-eviction-question',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Tenant asks if they can be evicted for late rent',
      expectedContains: [
        'NEVER give legal advice',
        'RTA',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — PM "field empty" variants
// The dangerous case: optional intake fields not filled. Prompt must still route correctly.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 2 — PM field-empty variants', () => {
  runScenarios([
    {
      id: 'pm-e1-burst-pipe-no-shutoff',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Burst pipe — client never filled in shut-off valve location',
      intakeOverrides: { niche_shutOffValveLocation: undefined },
      expectedContains: [
        'flag [P1 URGENT]',   // routing must still work
        '9-1-1 right now',
      ],
      mustNotContain: [
        'SHUT-OFF VALVE: Main water shut-off is at:',  // field empty → slot NOT injected
      ],
    },
    {
      id: 'pm-e2-pet-deposit-not-set',
      niche: 'property_management',
      callerType: 'prospect',
      intentSummary: 'Pet policy question — client never filled in deposit amount',
      intakeOverrides: { niche_petPolicy: 'cats_dogs', niche_petDepositAmount: undefined },
      expectedContains: [
        'NEVER confirm or deny rent amounts, unit availability, pet policy',
      ],
      mustNotContain: [
        'Pet deposit:',   // no deposit amount → not injected
      ],
    },
    {
      id: 'pm-e3-no-maintenance-contacts',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'Emergency call — client left maintenance contacts blank',
      intakeOverrides: { niche_maintenanceContacts: undefined },
      expectedContains: [
        'flag [P1 URGENT]',
        'name and unit',
      ],
    },
    {
      id: 'pm-e4-minimal-intake-only',
      niche: 'property_management',
      callerType: 'unknown',
      intentSummary: 'Bare minimum intake — no niche fields at all',
      intakeOverrides: {},
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
        'property management',
      ],
    },
    {
      id: 'pm-e5-message-only-mode',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'PM client on message_only plan — should get voicemail prompt, not TRIAGE_DEEP',
      intakeOverrides: { call_handling_mode: 'message_only' },
      expectedContains: [
        'MESSAGE TAKING FLOW',
        'LIFE SAFETY EMERGENCY OVERRIDE',
      ],
      mustNotContain: [
        'flag [P1 URGENT]',    // TRIAGE_DEEP not present in voicemail prompt
        'SHOWING REQUEST',
        'RENTAL INQUIRY',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Cross-mode: message_only vs triage vs voicemail niche
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 3 — Cross-mode tests', () => {
  runScenarios([
    {
      id: 'cross-01-pm-triage-has-triage-deep',
      niche: 'property_management',
      callerType: 'tenant',
      intentSummary: 'PM client on triage mode — TRIAGE_DEEP must be present',
      intakeOverrides: { call_handling_mode: 'triage' },
      expectedContains: [
        'flag [P1 URGENT]',
        'SHOWING REQUEST',
        'Fair Housing Act violations carry penalties up to $150,000',
      ],
      mustNotContain: [
        'MESSAGE TAKING FLOW',
      ],
    },
    {
      id: 'cross-02-voicemail-niche-no-triage',
      niche: 'voicemail',
      callerType: 'unknown',
      intentSummary: 'Voicemail niche — must NOT have inbound triage sections',
      expectedContains: [
        'MESSAGE TAKING FLOW',
        'LIFE SAFETY EMERGENCY OVERRIDE',
        'COMPLETION CHECK',
      ],
      mustNotContain: [
        '## 3. TRIAGE',
        '## 5. SCHEDULING',
      ],
    },
    {
      id: 'cross-03-hvac-message-only',
      niche: 'hvac',
      callerType: 'unknown',
      intentSummary: 'HVAC client on message_only — voicemail prompt, no TRIAGE_DEEP',
      intakeOverrides: { call_handling_mode: 'message_only' },
      expectedContains: [
        'MESSAGE TAKING FLOW',
      ],
      mustNotContain: [
        '[SAFETY CHECK — RUNS FIRST ON EVERY CALL]',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — HVAC (6 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 4 — HVAC', () => {
  runScenarios([
    {
      id: 'hvac-01-no-heat-winter',
      niche: 'hvac',
      callerType: 'tenant',
      intentSummary: 'No heat in winter',
      expectedContains: [
        'no heat in winter, ALWAYS flag as [URGENT]',
      ],
    },
    {
      id: 'hvac-02-gas-smell',
      niche: 'hvac',
      callerType: 'emergency',
      intentSummary: 'Caller smells gas near furnace',
      expectedContains: [
        '[SAFETY CHECK — RUNS FIRST ON EVERY CALL]',
        'gas company / 9-1-1',
      ],
    },
    {
      id: 'hvac-03-furnace-noise',
      niche: 'hvac',
      callerType: 'unknown',
      intentSummary: 'Furnace making banging noise — routine',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'hvac-04-ac-not-cooling-summer',
      niche: 'hvac',
      callerType: 'unknown',
      intentSummary: 'AC not cooling in summer',
      expectedContains: [
        'no AC',
      ],
    },
    {
      id: 'hvac-05-maintenance-tuneup',
      niche: 'hvac',
      callerType: 'unknown',
      intentSummary: 'Annual maintenance / furnace tune-up request',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'hvac-06-spam-warranty',
      niche: 'hvac',
      callerType: 'spam',
      intentSummary: 'Extended warranty robocall',
      expectedContains: [
        'hangUp',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — Plumbing (6 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 5 — Plumbing', () => {
  runScenarios([
    {
      id: 'plumb-01-active-flooding',
      niche: 'plumbing',
      callerType: 'emergency',
      intentSummary: 'Active flooding in basement',
      expectedContains: [
        'turn off the main water shut-off valve',
        'flag [URGENT]',
      ],
    },
    {
      id: 'plumb-02-sewage-backup',
      niche: 'plumbing',
      callerType: 'unknown',
      intentSummary: 'Sewage backing up into basement',
      expectedContains: [
        'ALWAYS flag as [URGENT]',
      ],
    },
    {
      id: 'plumb-03-water-heater-leak',
      niche: 'plumbing',
      callerType: 'unknown',
      intentSummary: 'Water heater leaking',
      expectedContains: [
        'flag [URGENT]',
        'name and address',
      ],
    },
    {
      id: 'plumb-04-clogged-drain-routine',
      niche: 'plumbing',
      callerType: 'unknown',
      intentSummary: 'Slow drain in bathroom — not urgent',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'plumb-05-reno-quote',
      niche: 'plumbing',
      callerType: 'unknown',
      intentSummary: 'Bathroom renovation quote request',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'plumb-06-shut-off-instructions',
      niche: 'plumbing',
      callerType: 'emergency',
      intentSummary: 'Caller needs to know how to shut off water',
      expectedContains: [
        'turn off the main water shut-off valve',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — Auto glass (6 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 6 — Auto glass', () => {
  runScenarios([
    {
      id: 'ag-01-windshield-crack',
      niche: 'auto_glass',
      callerType: 'unknown',
      intentSummary: 'Windshield crack — needs repair or replacement',
      expectedContains: [
        'TRIAGE (Windshield)',
        'VEHICLE DETAILS',
      ],
    },
    {
      id: 'ag-02-insurance-claim',
      niche: 'auto_glass',
      callerType: 'unknown',
      intentSummary: 'Caller has SGI insurance claim',
      expectedContains: [
        'INSURANCE / BILLING QUESTION',
      ],
    },
    {
      id: 'ag-03-mobile-vs-shop',
      niche: 'auto_glass',
      callerType: 'unknown',
      intentSummary: 'Caller asks if they come to the car or need to drive in',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'ag-04-adas-calibration',
      niche: 'auto_glass',
      callerType: 'unknown',
      intentSummary: 'Caller has ADAS camera behind windshield — needs recalibration',
      expectedContains: [
        'SENSOR CHECK',
      ],
    },
    {
      id: 'ag-05-spam',
      niche: 'auto_glass',
      callerType: 'spam',
      intentSummary: 'Robocall spam',
      expectedContains: [
        'hangUp',
      ],
    },
    {
      id: 'ag-06-quote-request',
      niche: 'auto_glass',
      callerType: 'unknown',
      intentSummary: 'Caller wants a quote for windshield replacement',
      expectedContains: [
        'VEHICLE DETAILS',
        'hangUp',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — Outbound ISA realtor (5 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 7 — Outbound ISA realtor', () => {
  runScenarios([
    {
      id: 'isa-01-interested-lead',
      niche: 'outbound_isa_realtor',
      callerType: 'prospect',
      intentSummary: 'Warm lead interested in buying',
      expectedContains: [
        'TRIAGE (Outbound ISA)',
        'hangUp',
      ],
    },
    {
      id: 'isa-02-not-interested',
      niche: 'outbound_isa_realtor',
      callerType: 'prospect',
      intentSummary: 'Prospect says not interested',
      expectedContains: [
        'REMOVE FROM LIST',
      ],
    },
    {
      id: 'isa-03-callback-requested',
      niche: 'outbound_isa_realtor',
      callerType: 'prospect',
      intentSummary: 'Prospect asks for agent callback',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'isa-04-wrong-person',
      niche: 'outbound_isa_realtor',
      callerType: 'unknown',
      intentSummary: 'Wrong number / wrong person answers',
      expectedContains: [
        'WRONG PERSON',   // uppercase in TRIAGE_DEEP: "NOT INTERESTED / WRONG PERSON:"
        'hangUp',
      ],
    },
    {
      id: 'isa-05-triage-structure-present',
      niche: 'outbound_isa_realtor',
      callerType: 'prospect',
      intentSummary: 'ISA outbound triage section is present and structured',
      // ISA has no niche-specific FORBIDDEN_EXTRA — only _common applies.
      // Test that the core outbound structure exists instead.
      expectedContains: [
        'TRIAGE (Outbound ISA)',
        'INTERESTED — BUYING:',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8 — General / other niche (4 scenarios)
// Exercises the fallback for any business without a specific niche.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 8 — General / other niche', () => {
  runScenarios([
    {
      id: 'gen-01-basic-inquiry',
      niche: 'other',
      callerType: 'unknown',
      intentSummary: 'Generic inbound business inquiry',
      expectedContains: [
        'hangUp',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'gen-02-resolves-to-auto-glass',
      niche: 'other',
      callerType: 'unknown',
      intentSummary: "'other' niche resolves to auto_glass production template (per resolveProductionNiche)",
      // resolveProductionNiche maps unknown niches → auto_glass (most complete template)
      // So 'other' gets auto_glass content, not a generic fallback.
      expectedContains: [
        'VEHICLE DETAILS',
      ],
      mustNotContain: [
        'RENTAL INQUIRY',  // not PM
      ],
    },
    {
      id: 'gen-03-spam',
      niche: 'other',
      callerType: 'spam',
      intentSummary: 'Spam call',
      expectedContains: [
        'hangUp',
      ],
    },
    {
      id: 'gen-04-prompt-is-valid',
      niche: 'other',
      callerType: 'unknown',
      intentSummary: 'General niche prompt meets minimum structural requirements',
      expectedContains: [
        'CALLER ENDS CALL',
        'COMPLETION CHECK',
        'hangUp',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 9 — Voicemail niche (4 scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9 — Voicemail niche', () => {
  runScenarios([
    {
      id: 'vm-01-message-taking-flow',
      niche: 'voicemail',
      callerType: 'unknown',
      intentSummary: 'Standard voicemail — takes name + reason + callback',
      expectedContains: [
        'MESSAGE TAKING FLOW',
        'COMPLETION CHECK',
      ],
    },
    {
      id: 'vm-02-life-safety-override',
      niche: 'voicemail',
      callerType: 'emergency',
      intentSummary: 'Emergency call on voicemail-only line',
      expectedContains: [
        'LIFE SAFETY EMERGENCY OVERRIDE',
      ],
    },
    {
      id: 'vm-03-no-inbound-triage',
      niche: 'voicemail',
      callerType: 'unknown',
      intentSummary: 'Voicemail should not have inbound triage headings',
      expectedContains: [],
      mustNotContain: [
        '## 3. TRIAGE',
        '## 5. SCHEDULING',
      ],
    },
    {
      id: 'vm-04-pm-voicemail-fha',
      niche: 'voicemail',
      callerType: 'prospect',
      intentSummary: 'PM client on voicemail — FHA compliance still present in voicemail builder',
      intakeOverrides: { niche: 'property_management', call_handling_mode: 'message_only' },
      expectedContains: [
        'FHA',
        'LIFE SAFETY EMERGENCY OVERRIDE',
      ],
    },
  ])
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 10 — Universal safety cross-niche
// Critical invariants that must hold across ALL niches, not just PM
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 10 — Universal safety (cross-niche)', () => {
  const nichesWithTriage = ['property_management', 'hvac', 'plumbing', 'auto_glass', 'outbound_isa_realtor', 'real_estate', 'other']

  for (const niche of nichesWithTriage) {
    describe(`universal/${niche}`, () => {
      const prompt = buildPromptFromIntake(makeMinimalIntake(niche))

      test('has hangUp tool reference', () => {
        const passed = prompt.includes('hangUp')
        track(`universal-hangup/${niche}`, niche, 'hangUp', passed)
        assert.ok(passed, `[${niche}] Missing hangUp tool reference`)
      })

      test('has COMPLETION CHECK', () => {
        const passed = prompt.includes('COMPLETION CHECK')
        track(`universal-completion/${niche}`, niche, 'COMPLETION CHECK', passed)
        assert.ok(passed, `[${niche}] Missing COMPLETION CHECK`)
      })

      test('has CALLER ENDS CALL handler', () => {
        const passed = prompt.includes('CALLER ENDS CALL')
        track(`universal-caller-ends/${niche}`, niche, 'CALLER ENDS CALL', passed)
        assert.ok(passed, `[${niche}] Missing CALLER ENDS CALL handler`)
      })

      test('no unfilled {{VARIABLES}}', () => {
        const unfilled = [...prompt.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)].map(m => m[1])
        const passed = unfilled.length === 0
        track(`universal-unfilled/${niche}`, niche, '{{VARIABLES}}', passed)
        assert.equal(unfilled.length, 0, `[${niche}] Unfilled template variables: ${unfilled.join(', ')}`)
      })
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 11 — Prompt length guard
// Every registered niche must stay under PROMPT_CHAR_HARD_MAX (25,000)
// with ALL optional niche fields filled (the worst case, not the default case)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 11 — Prompt length guard (hard max)', () => {
  // Data-rich PM intake — all optional slots filled → largest possible PM prompt
  const pmFull = makeIntake('property_management', {
    niche_shutOffValveLocation: 'Basement utility room, behind the water heater',
    niche_petPolicy: 'cats_dogs',
    niche_petDepositAmount: '$500',
    niche_parkingPolicy: 'assigned',
    niche_packagePolicy: 'locked_room',
    niche_maintenanceContacts: 'Emergency plumber: Mike 306-555-1234\nEmergency HVAC: Sarah 306-555-5678',
    niche_tenantRoster: 'Unit 101: Jane Smith\nUnit 102: Bob Jones\nUnit 103: Carol White',
    niche_messageRecipient: 'owner',
  })

  // PM length: treated as WARNING in production (S12-V18-BUG7 demoted hard max to warning).
  // PM prompt is legitimately large due to TRIAGE_DEEP + FORBIDDEN_EXTRA + EXAMPLES.
  // Test reports length but does not fail — matches prod behavior.
  // Track against a 35K hard ceiling (absolute limit for any GLM-4.6 context window safety).
  const PM_LENGTH_CEILING = 35000

  test('PM full-fields prompt under absolute ceiling (35K)', () => {
    const prompt = buildPromptFromIntake(pmFull)
    const passed = prompt.length <= PM_LENGTH_CEILING
    track('length-pm-full', 'property_management', `length <= ${PM_LENGTH_CEILING}`, passed)
    if (prompt.length > PROMPT_CHAR_HARD_MAX) {
      console.warn(`[WARN] PM full-fields prompt: ${prompt.length} chars (over 25K target — tracked per S12-V18-BUG7)`)
    }
    assert.ok(passed, `PM full-fields prompt dangerously long: ${prompt.length} chars (ceiling ${PM_LENGTH_CEILING})`)
  })

  const nichesToCheck = getRegisteredNiches().filter(n => n !== 'voicemail' && n !== 'property_management')

  for (const niche of nichesToCheck) {
    test(`${niche} minimal intake under hard max`, () => {
      const prompt = buildPromptFromIntake(makeMinimalIntake(niche))
      const passed = prompt.length <= PROMPT_CHAR_HARD_MAX
      track(`length-${niche}`, niche, `length <= ${PROMPT_CHAR_HARD_MAX}`, passed)
      assert.ok(
        passed,
        `[${niche}] Prompt too long: ${prompt.length} chars (hard max ${PROMPT_CHAR_HARD_MAX})`
      )
    })
  }

  // PM minimal is excluded from hard max (see PM_LENGTH_CEILING above — S12-V18-BUG7)
  test('PM minimal intake — log length for monitoring', () => {
    const prompt = buildPromptFromIntake(makeMinimalIntake('property_management'))
    track('length-pm-minimal', 'property_management', `length <= ${PM_LENGTH_CEILING}`, prompt.length <= PM_LENGTH_CEILING)
    if (prompt.length > PROMPT_CHAR_HARD_MAX) {
      console.warn(`[WARN] PM minimal prompt: ${prompt.length} chars (over 25K target — S12-V18-BUG7)`)
    }
    assert.ok(prompt.length <= PM_LENGTH_CEILING, `PM minimal prompt dangerously long: ${prompt.length} chars`)
  })

  test('voicemail prompt under hard max', () => {
    const prompt = buildPromptFromIntake(makeMinimalIntake('voicemail'))
    const passed = prompt.length <= PROMPT_CHAR_HARD_MAX
    track('length-voicemail', 'voicemail', `length <= ${PROMPT_CHAR_HARD_MAX}`, passed)
    assert.ok(
      passed,
      `Voicemail prompt too long: ${prompt.length} chars (hard max ${PROMPT_CHAR_HARD_MAX})`
    )
  })
})
