/**
 * knowledge-retrieval.test.ts — Phase 4: Retrieval for Business Knowledge tests
 *
 * Run: npx tsx --test src/lib/__tests__/knowledge-retrieval.test.ts
 *
 * Tests for:
 * - Retrieval gating on capability flags + corpus availability
 * - Prompt instruction generation
 * - Knowledge truncation detection
 * - Safety boundaries: emergency/booking/after-hours/tone NOT in retrieval
 * - Property management separation
 * - AgentContext integration
 * - Hard-max guard behavior
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRetrievalConfig,
  buildRetrievalInstruction,
  countFullFacts,
  type RetrievalConfig,
} from '@/lib/knowledge-retrieval'
import type { AgentCapabilities } from '@/lib/niche-capabilities'
import { getCapabilities } from '@/lib/niche-capabilities'
import { buildKnowledgeSummary, type KnowledgeSummary } from '@/lib/knowledge-summary'
import type { BusinessConfig } from '@/lib/agent-context'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeCapabilities(overrides: Partial<AgentCapabilities> = {}): AgentCapabilities {
  return {
    takeMessages: true,
    bookAppointments: false,
    transferCalls: false,
    useKnowledgeLookup: false,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
    ...overrides,
  }
}

function makeBusiness(overrides: Partial<BusinessConfig> = {}): BusinessConfig {
  return {
    clientId: 'test-id',
    slug: 'test-slug',
    niche: 'other',
    businessName: 'Test Business',
    timezone: 'America/Regina',
    hoursWeekday: '9am to 5pm',
    hoursWeekend: null,
    afterHoursBehavior: 'take_message',
    afterHoursEmergencyPhone: null,
    businessFacts: null,
    extraQa: [],
    contextData: null,
    contextDataLabel: 'Reference Data',
    ...overrides,
  }
}

function makeKnowledge(business: BusinessConfig): KnowledgeSummary {
  return buildKnowledgeSummary(business)
}

function makeClientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 'test-id',
    slug: 'test-slug',
    ...overrides,
  }
}

// ── Retrieval gating tests ───────────────────────────────────────────────────

describe('buildRetrievalConfig — gating', () => {
  test('disabled when useKnowledgeLookup=false and no pgvector backend', () => {
    const caps = makeCapabilities({ useKnowledgeLookup: false })
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true) // no backend = null
    assert.equal(result.enabled, false)
    assert.equal(result.nicheSupportsLookup, false)
    assert.equal(result.corpusAvailable, true)
    assert.equal(result.promptInstruction, '')
  })

  test('enabled when pgvector backend even if useKnowledgeLookup=false (niche gate bypassed)', () => {
    const caps = makeCapabilities({ useKnowledgeLookup: false })
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true, 'pgvector')
    assert.equal(result.enabled, true)
    assert.equal(result.nicheSupportsLookup, false)
    assert.ok(result.promptInstruction.length > 0)
  })

  test('disabled when corpus not available, even if capability enabled', () => {
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, false)
    assert.equal(result.enabled, false)
    assert.equal(result.nicheSupportsLookup, true)
    assert.equal(result.corpusAvailable, false)
    assert.equal(result.promptInstruction, '')
  })

  test('disabled when both capability and corpus are false', () => {
    const caps = makeCapabilities({ useKnowledgeLookup: false })
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, false)
    assert.equal(result.enabled, false)
    assert.equal(result.promptInstruction, '')
  })

  test('enabled when capability=true AND corpus available', () => {
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, true)
    assert.equal(result.nicheSupportsLookup, true)
    assert.equal(result.corpusAvailable, true)
    assert.ok(result.promptInstruction.length > 0)
  })
})

// ── Prompt instruction content tests ─────────────────────────────────────────

describe('buildRetrievalInstruction — content', () => {
  test('mentions queryKnowledge tool by default (pgvector universal)', () => {
    const instruction = buildRetrievalInstruction(false)
    assert.ok(instruction.includes('queryKnowledge'))
  })

  test('starts with KNOWLEDGE LOOKUP header', () => {
    const instruction = buildRetrievalInstruction(false)
    assert.ok(instruction.startsWith('## KNOWLEDGE LOOKUP'))
  })

  test('includes truncation note when knowledge was truncated', () => {
    const instruction = buildRetrievalInstruction(true)
    assert.ok(instruction.includes('summary'))
    assert.ok(instruction.includes('more detail'))
  })

  test('no truncation note when knowledge fits', () => {
    const instruction = buildRetrievalInstruction(false)
    assert.ok(!instruction.includes('summary'))
    assert.ok(!instruction.includes('more detail'))
  })

  test('instruction is concise (under 700 chars)', () => {
    const instruction = buildRetrievalInstruction(true)
    assert.ok(instruction.length < 700, `Instruction too long: ${instruction.length} chars`)
  })
})

// ── Safety boundary tests ────────────────────────────────────────────────────

describe('buildRetrievalInstruction — safety boundaries', () => {
  const instruction = buildRetrievalInstruction(true)

  test('does NOT contain emergency keywords', () => {
    const emergencyWords = ['911', 'bleeding', 'heart attack', 'fire', 'suicidal', 'stabbed']
    for (const word of emergencyWords) {
      assert.ok(
        !instruction.toLowerCase().includes(word),
        `Retrieval instruction must not contain emergency keyword "${word}"`,
      )
    }
  })

  test('does NOT contain booking logic keywords', () => {
    // "booking" appears in "Do NOT use queryCorpus for... booking" — that's a correct boundary, not booking logic.
    // These keywords would indicate actual booking instructions leaking into retrieval:
    const bookingLogicWords = ['appointment', 'calendar', 'schedule', 'bookAppointment', 'checkCalendar']
    for (const word of bookingLogicWords) {
      assert.ok(
        !instruction.toLowerCase().includes(word.toLowerCase()),
        `Retrieval instruction must not contain booking logic keyword "${word}"`,
      )
    }
  })

  test('does NOT contain after-hours keywords', () => {
    const afterHoursWords = ['after hours', 'business hours', 'closed', 'next business day']
    for (const word of afterHoursWords) {
      assert.ok(
        !instruction.toLowerCase().includes(word),
        `Retrieval instruction must not contain after-hours keyword "${word}"`,
      )
    }
  })

  test('does NOT contain tone/turn-taking keywords', () => {
    const toneWords = ['gonna', 'kinda', 'wanna', 'filler', 'interrupt', 'backchannel', 'mmhmm']
    for (const word of toneWords) {
      assert.ok(
        !instruction.toLowerCase().includes(word),
        `Retrieval instruction must not contain tone keyword "${word}"`,
      )
    }
  })

  test('mentions NOT using for emergencies', () => {
    assert.ok(instruction.toLowerCase().includes('emergenc'))
  })

  test('mentions NOT using for booking', () => {
    assert.ok(instruction.toLowerCase().includes('booking'))
  })
})

// ── Knowledge truncation detection ──────────────────────────────────────────

describe('countFullFacts', () => {
  test('returns 0 for empty knowledge', () => {
    const knowledge = makeKnowledge(makeBusiness())
    assert.equal(countFullFacts(knowledge), 0)
  })

  test('counts text facts correctly', () => {
    const business = makeBusiness({ businessFacts: 'Fact one\nFact two\nFact three' })
    const knowledge = makeKnowledge(business)
    assert.equal(countFullFacts(knowledge), 3)
  })

  test('counts QA facts correctly', () => {
    const business = makeBusiness({
      extraQa: [
        { q: 'Q1', a: 'A1' },
        { q: 'Q2', a: 'A2' },
      ],
    })
    const knowledge = makeKnowledge(business)
    assert.equal(countFullFacts(knowledge), 2)
  })

  test('counts combined text + QA facts', () => {
    const business = makeBusiness({
      businessFacts: 'Fact A\nFact B',
      extraQa: [{ q: 'Q1', a: 'A1' }],
    })
    const knowledge = makeKnowledge(business)
    assert.equal(countFullFacts(knowledge), 3)
  })

  test('skips markdown headings in text facts', () => {
    const business = makeBusiness({ businessFacts: '# Heading\nFact A\n## Subheading\nFact B' })
    const knowledge = makeKnowledge(business)
    assert.equal(countFullFacts(knowledge), 2)
  })

  test('skips empty QA pairs', () => {
    const business = makeBusiness({
      extraQa: [
        { q: 'Q1', a: 'A1' },
        { q: '', a: 'A2' },
        { q: 'Q3', a: '' },
      ],
    })
    const knowledge = makeKnowledge(business)
    assert.equal(countFullFacts(knowledge), 1)
  })
})

describe('buildRetrievalConfig — truncation detection', () => {
  test('knowledgeTruncated=false when all facts fit in summary (under 15)', () => {
    const business = makeBusiness({ businessFacts: 'Fact 1\nFact 2\nFact 3' })
    const knowledge = makeKnowledge(business)
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.knowledgeTruncated, false)
  })

  test('knowledgeTruncated=true when more facts exist than fit in summary', () => {
    // Create 20 facts — KnowledgeSummary caps at 15
    const facts = Array.from({ length: 20 }, (_, i) => `Fact number ${i + 1}`).join('\n')
    const business = makeBusiness({ businessFacts: facts })
    const knowledge = makeKnowledge(business)
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.knowledgeTruncated, true)
  })

  test('truncation note appears in instruction when truncated', () => {
    const facts = Array.from({ length: 20 }, (_, i) => `Fact number ${i + 1}`).join('\n')
    const business = makeBusiness({ businessFacts: facts })
    const knowledge = makeKnowledge(business)
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.ok(result.promptInstruction.includes('more detail'))
  })

  test('no truncation note in instruction when not truncated', () => {
    const business = makeBusiness({ businessFacts: 'One fact' })
    const knowledge = makeKnowledge(business)
    const caps = makeCapabilities({ useKnowledgeLookup: true })
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.ok(!result.promptInstruction.includes('more detail'))
  })
})

// ── Per-niche retrieval gating ──────────────────────────────────────────────

describe('per-niche retrieval capability', () => {
  test('voicemail: useKnowledgeLookup=false — no retrieval even with corpus', () => {
    const caps = getCapabilities('voicemail')
    assert.equal(caps.useKnowledgeLookup, false)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, false)
  })

  test('auto_glass: useKnowledgeLookup=true — retrieval available with corpus', () => {
    const caps = getCapabilities('auto_glass')
    assert.equal(caps.useKnowledgeLookup, true)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, true)
  })

  test('real_estate: useKnowledgeLookup=true — retrieval available with corpus', () => {
    const caps = getCapabilities('real_estate')
    assert.equal(caps.useKnowledgeLookup, true)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, true)
  })

  test('property_management: useKnowledgeLookup=true — retrieval for policies/FAQs', () => {
    const caps = getCapabilities('property_management')
    assert.equal(caps.useKnowledgeLookup, true)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, true)
  })

  test('other: useKnowledgeLookup=false — no retrieval', () => {
    const caps = getCapabilities('other')
    assert.equal(caps.useKnowledgeLookup, false)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, false)
  })

  test('barbershop: useKnowledgeLookup=false — no retrieval', () => {
    const caps = getCapabilities('barbershop')
    assert.equal(caps.useKnowledgeLookup, false)
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(caps, knowledge, true)
    assert.equal(result.enabled, false)
  })
})

// ── Property management separation ──────────────────────────────────────────

describe('property management knowledge separation', () => {
  const pmCaps = getCapabilities('property_management')

  test('PM has useKnowledgeLookup=true (retrieval for policies/docs)', () => {
    assert.equal(pmCaps.useKnowledgeLookup, true)
  })

  test('PM has useTenantLookup=true (structured records via contextData)', () => {
    assert.equal(pmCaps.useTenantLookup, true)
  })

  test('PM has updateTenantRequests=true (Phase 7 enabled write ops)', () => {
    assert.equal(pmCaps.updateTenantRequests, true)
  })

  test('PM retrieval instruction does not mention tenant records or maintenance', () => {
    const knowledge = makeKnowledge(makeBusiness())
    const result = buildRetrievalConfig(pmCaps, knowledge, true)
    assert.ok(!result.promptInstruction.toLowerCase().includes('tenant'))
    assert.ok(!result.promptInstruction.toLowerCase().includes('maintenance'))
  })
})

// ── AgentContext integration ─────────────────────────────────────────────────

describe('AgentContext — retrieval field', () => {
  test('retrieval field exists in AgentContext', () => {
    const client = makeClientRow()
    const ctx = buildAgentContext(client, '+15551234567')
    assert.ok('retrieval' in ctx)
    assert.ok('enabled' in ctx.retrieval)
    assert.ok('promptInstruction' in ctx.retrieval)
  })

  test('retrieval disabled by default (corpusAvailable defaults to false)', () => {
    const client = makeClientRow({ niche: 'auto_glass' })
    const ctx = buildAgentContext(client, '+15551234567')
    assert.equal(ctx.retrieval.enabled, false)
    assert.equal(ctx.retrieval.corpusAvailable, false)
    assert.equal(ctx.retrieval.promptInstruction, '')
  })

  test('retrieval enabled when corpusAvailable=true and niche supports lookup', () => {
    const client = makeClientRow({ niche: 'auto_glass' })
    const ctx = buildAgentContext(client, '+15551234567', [], new Date(), true)
    assert.equal(ctx.retrieval.enabled, true)
    assert.ok(ctx.retrieval.promptInstruction.includes('queryKnowledge'))
  })

  test('retrieval disabled for voicemail even with corpusAvailable=true', () => {
    const client = makeClientRow({ niche: 'voicemail' })
    const ctx = buildAgentContext(client, '+15551234567', [], new Date(), true)
    assert.equal(ctx.retrieval.enabled, false)
    assert.equal(ctx.retrieval.promptInstruction, '')
  })

  test('retrieval disabled for other niche when no pgvector backend set', () => {
    // useKnowledgeLookup=false on 'other' niche; no knowledge_backend = no pgvector bypass
    const client = makeClientRow({ niche: 'other' }) // knowledge_backend defaults to null
    const ctx = buildAgentContext(client, '+15551234567', [], new Date(), true)
    assert.equal(ctx.retrieval.enabled, false)
  })

  test('knowledge summary still present regardless of retrieval state', () => {
    const client = makeClientRow({
      niche: 'auto_glass',
      business_facts: 'We fix chips and cracks',
    })
    const ctx = buildAgentContext(client, '+15551234567', [], new Date(), false)
    assert.ok(ctx.knowledge.facts.length > 0)
    assert.equal(ctx.retrieval.enabled, false) // corpus not available
  })
})

// ── Instruction does not duplicate KnowledgeSummary content ──────────────────

describe('retrieval instruction independence', () => {
  test('instruction references Key Business Facts as authoritative (not duplicating them)', () => {
    const instruction = buildRetrievalInstruction(false)
    // Instruction may reference "Key Business Facts" to direct the agent, but should not contain actual fact lines
    assert.ok(!instruction.includes('- '), 'Should not contain bullet-point fact lines')
  })

  test('instruction does not contain fact lines', () => {
    const instruction = buildRetrievalInstruction(true)
    // Should not contain bullet-point facts
    assert.ok(!instruction.includes('- We '))
    assert.ok(!instruction.includes('- Our '))
  })
})
