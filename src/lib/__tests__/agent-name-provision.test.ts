/**
 * agent-name-provision.test.ts
 *
 * Locks the contract that every `clients.insert()` provisioning path writes `agent_name`.
 *
 * Bug history: 2026-04-30 — Velly Remodeling (niche='other', concierge-provisioned via
 * /api/dashboard/generate-prompt) had `agent_name = NULL` in DB. Root cause: two of four
 * `clients.insert()` payloads (admin generate-prompt + admin test-activate) omitted the
 * field entirely. Niche-agnostic path-parity bug — only surfaced as niche='other' because
 * Velly was the first concierge client routed through that admin path.
 *
 * Tracker: CALLINGAGENTS/Tracker/D-NEW-agent-name-provision-write.md
 *          CALLINGAGENTS/Tracker/D-NEW-provision-field-completeness-test.md (this file
 *          satisfies the meta-fix for that one too — locks all four insert paths).
 *
 * Run: npx tsx --test src/lib/__tests__/agent-name-provision.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toIntakePayload } from '../intake-transform.js'
import { defaultAgentNames } from '../niche-registry.js'
import type { OnboardingData } from '../../types/onboarding.js'

// ── Shared base intake (matches intake-transform.test.ts pattern) ──────────────

function base(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    niche: 'other',
    businessName: 'Test Business',
    streetAddress: '',
    city: 'Edmonton',
    state: 'AB',
    agentName: '',
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
    calendarMode: '',
    businessNotes: '',
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
    ...overrides,
  }
}

// ── Case A — happy path: niche='other' + intake agent_name ──────────────────────

describe('agent_name — Case A — happy path (niche=other + user-supplied name)', () => {
  test('user-supplied agentName flows into intakePayload.agent_name', () => {
    const r = toIntakePayload(base({ niche: 'other', agentName: 'TestAgent' }))
    assert.strictEqual(r.agent_name, 'TestAgent')
  })

  test('user-supplied agentName takes priority over niche default', () => {
    const r = toIntakePayload(base({ niche: 'other', agentName: 'CustomName' }))
    assert.notStrictEqual(r.agent_name, defaultAgentNames.other)
    assert.strictEqual(r.agent_name, 'CustomName')
  })
})

// ── Case B — fallback default for niche='other' ─────────────────────────────────

describe('agent_name — Case B — fallback default (niche=other, blank intake)', () => {
  test('blank agentName falls back to defaultAgentNames.other', () => {
    const r = toIntakePayload(base({ niche: 'other', agentName: '' }))
    assert.strictEqual(r.agent_name, defaultAgentNames.other)
    assert.strictEqual(r.agent_name, 'Sam')
  })

  test('defaultAgentNames.other is non-null (registry contract)', () => {
    assert.ok(defaultAgentNames.other, 'Registry must define default name for niche=other')
    assert.notStrictEqual(defaultAgentNames.other, '')
  })
})

// ── Case C — control niche (regression guard for working path) ─────────────────

describe('agent_name — Case C — control (niche=auto_glass still works)', () => {
  test('user-supplied agentName flows for auto_glass', () => {
    const r = toIntakePayload(base({ niche: 'auto_glass', agentName: 'Avery' }))
    assert.strictEqual(r.agent_name, 'Avery')
  })

  test('blank agentName falls back to auto_glass registry default', () => {
    const r = toIntakePayload(base({ niche: 'auto_glass', agentName: '' }))
    assert.strictEqual(r.agent_name, defaultAgentNames.auto_glass)
  })
})

// ── Case D — every niche has a non-null registry default (parity guard) ───────

describe('agent_name — Case D — registry coverage parity', () => {
  test('every niche in defaultAgentNames has a non-empty default', () => {
    for (const [niche, name] of Object.entries(defaultAgentNames)) {
      assert.ok(name && typeof name === 'string' && name.length > 0,
        `Niche ${niche} has invalid default: ${JSON.stringify(name)}`)
    }
  })

  test('toIntakePayload emits non-null agent_name for every niche when input is blank', () => {
    for (const niche of Object.keys(defaultAgentNames)) {
      const r = toIntakePayload(base({
        niche: niche as OnboardingData['niche'],
        agentName: '',
      }))
      assert.ok(r.agent_name && (r.agent_name as string).length > 0,
        `niche=${niche}: intakePayload.agent_name was empty`)
    }
  })
})

// ── Path-completeness regression — closes D-NEW-provision-field-completeness-test ─
//
// Static check: every route that runs `clients.insert(...)` MUST write `agent_name`.
// This is the meta-fix that prevents the same path-parity bug class from recurring.
// If you add a new clients.insert() call site, add it to PROVISION_INSERT_PATHS below.
//
// How it works: read each route file, find the FIRST `from('clients').insert({...})`
// block, regex-extract the object literal, assert it contains `agent_name:`.

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, '../../..')

const PROVISION_INSERT_PATHS = [
  'src/app/api/provision/trial/route.ts',
  'src/app/api/stripe/create-public-checkout/route.ts',
  'src/app/api/dashboard/generate-prompt/route.ts',
  'src/app/api/admin/test-activate/route.ts',
] as const

describe('agent_name — path-completeness (regression guard)', () => {
  for (const relPath of PROVISION_INSERT_PATHS) {
    test(`${relPath} writes agent_name in clients.insert()`, () => {
      const fullPath = resolve(REPO_ROOT, relPath)
      const src = readFileSync(fullPath, 'utf8')

      // Find ALL `from('clients').insert({...})` blocks (some files have multiple
      // — e.g. test-activate has insert + update branches).
      const insertRegex = /from\(\s*['"]clients['"]\s*\)\s*\.insert\s*\(\s*\{([\s\S]*?)\}\s*\)/g
      const matches = [...src.matchAll(insertRegex)]

      assert.ok(matches.length > 0,
        `No clients.insert({...}) found in ${relPath}. Update PROVISION_INSERT_PATHS or fix the regex.`)

      for (const [i, match] of matches.entries()) {
        const body = match[1]
        assert.match(body, /\bagent_name\s*:/,
          `${relPath} clients.insert() block #${i + 1} does not write agent_name. ` +
          `This is the bug from Velly 2026-04-30 — every provisioning path must set agent_name ` +
          `or future first-time provisions will silently land NULL.\n\nInsert body:\n${body}`)
      }
    })
  }
})
