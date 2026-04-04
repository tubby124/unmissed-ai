/**
 * knowledge-summary.test.ts — Phase 3: KnowledgeSummary tests
 *
 * Run: npx tsx --test src/lib/__tests__/knowledge-summary.test.ts
 *
 * Tests for:
 * - Fact extraction from businessFacts text
 * - Fact extraction from extraQa pairs
 * - Fact truncation
 * - Summary char limit enforcement
 * - MAX_SUMMARY_FACTS cap
 * - Empty/null input handling
 * - buildKnowledgeSummary integration
 * - Prompt length measurement
 * - KnowledgeSummary in AgentContext
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractFactsFromText,
  extractFactsFromQa,
  truncateFact,
  buildKnowledgeSummary,
  measurePromptLength,
  MAX_SUMMARY_FACTS,
  MAX_FACT_CHARS,
  SUMMARY_CHAR_LIMIT,
  PROMPT_CHAR_TARGET,
  PROMPT_CHAR_HARD_MAX,
} from '../knowledge-summary.js'
import {
  buildAgentContext,
  type ClientRow,
  type BusinessConfig,
} from '../agent-context.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeBusinessConfig(overrides: Partial<BusinessConfig> = {}): BusinessConfig {
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

function makeClientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 'test-id',
    slug: 'test-slug',
    niche: 'auto_glass',
    business_name: 'Test Auto Glass',
    timezone: 'America/Regina',
    business_hours_weekday: '9am to 5pm',
    business_hours_weekend: null,
    after_hours_behavior: 'take_message',
    after_hours_emergency_phone: null,
    business_facts: null,
    extra_qa: null,
    context_data: null,
    context_data_label: null,
    ...overrides,
  }
}

// ── extractFactsFromText ────────────────────────────────────────────────────

describe('extractFactsFromText', () => {
  test('returns empty array for null input', () => {
    assert.deepStrictEqual(extractFactsFromText(null), [])
  })

  test('returns empty array for empty string', () => {
    assert.deepStrictEqual(extractFactsFromText(''), [])
  })

  test('returns empty array for whitespace-only input', () => {
    assert.deepStrictEqual(extractFactsFromText('   \n  \n  '), [])
  })

  test('splits on newlines and trims', () => {
    const text = 'We offer chip repair\n  Full windshield replacement\nADAS calibration available'
    const facts = extractFactsFromText(text)
    assert.deepStrictEqual(facts, [
      'We offer chip repair',
      'Full windshield replacement',
      'ADAS calibration available',
    ])
  })

  test('filters empty lines', () => {
    const text = 'Fact one\n\nFact two\n\n\nFact three'
    assert.deepStrictEqual(extractFactsFromText(text), ['Fact one', 'Fact two', 'Fact three'])
  })

  test('skips markdown headings', () => {
    const text = '# Business Info\nWe are open 7 days\n## Services\nChip repair\nFull replacement'
    assert.deepStrictEqual(extractFactsFromText(text), [
      'We are open 7 days',
      'Chip repair',
      'Full replacement',
    ])
  })
})

// ── extractFactsFromQa ─────────────────────────────────────────────────────

describe('extractFactsFromQa', () => {
  test('returns empty array for empty input', () => {
    assert.deepStrictEqual(extractFactsFromQa([]), [])
  })

  test('converts Q&A pairs to fact lines', () => {
    const qa = [
      { q: 'Do you do chip repair?', a: 'Yes, chips smaller than a quarter.' },
      { q: 'Open weekends?', a: 'Saturdays only.' },
    ]
    assert.deepStrictEqual(extractFactsFromQa(qa), [
      'Q: Do you do chip repair? → Yes, chips smaller than a quarter.',
      'Q: Open weekends? → Saturdays only.',
    ])
  })

  test('filters pairs with empty question or answer', () => {
    const qa = [
      { q: '', a: 'answer' },
      { q: 'question', a: '' },
      { q: 'Valid question?', a: 'Valid answer.' },
    ]
    assert.deepStrictEqual(extractFactsFromQa(qa), ['Q: Valid question? → Valid answer.'])
  })
})

// ── truncateFact ────────────────────────────────────────────────────────────

describe('truncateFact', () => {
  test('returns fact unchanged if within limit', () => {
    assert.strictEqual(truncateFact('Short fact', 100), 'Short fact')
  })

  test('truncates and adds ellipsis at limit', () => {
    const longFact = 'A'.repeat(120)
    const result = truncateFact(longFact, 100)
    assert.strictEqual(result.length, 100)
    assert.ok(result.endsWith('...'))
  })

  test('uses MAX_FACT_CHARS as default', () => {
    const longFact = 'X'.repeat(200)
    const result = truncateFact(longFact)
    assert.strictEqual(result.length, MAX_FACT_CHARS)
    assert.ok(result.endsWith('...'))
  })

  test('handles fact exactly at limit', () => {
    const exact = 'A'.repeat(MAX_FACT_CHARS)
    assert.strictEqual(truncateFact(exact), exact)
  })
})

// ── buildKnowledgeSummary ───────────────────────────────────────────────────

describe('buildKnowledgeSummary', () => {
  test('returns empty summary for no knowledge', () => {
    const biz = makeBusinessConfig()
    const summary = buildKnowledgeSummary(biz)
    assert.deepStrictEqual(summary.facts, [])
    assert.strictEqual(summary.block, '')
    assert.strictEqual(summary.charCount, 0)
    assert.strictEqual(summary.fullBusinessFacts, null)
    assert.deepStrictEqual(summary.fullExtraQa, [])
  })

  test('extracts facts from businessFacts', () => {
    const biz = makeBusinessConfig({
      businessFacts: ['SGI approved shop', 'Open Monday to Saturday', 'Free mobile service'],
    })
    const summary = buildKnowledgeSummary(biz)
    assert.deepStrictEqual(summary.facts, [
      'SGI approved shop',
      'Open Monday to Saturday',
      'Free mobile service',
    ])
    assert.ok(summary.block.includes('## Key Business Facts'))
    assert.ok(summary.block.includes('- SGI approved shop'))
  })

  test('merges businessFacts and extraQa', () => {
    const biz = makeBusinessConfig({
      businessFacts: ['We offer ADAS calibration'],
      extraQa: [{ q: 'Do you bill SGI?', a: 'Yes' }],
    })
    const summary = buildKnowledgeSummary(biz)
    assert.strictEqual(summary.facts.length, 2)
    assert.strictEqual(summary.facts[0], 'We offer ADAS calibration')
    assert.strictEqual(summary.facts[1], 'Q: Do you bill SGI? → Yes')
  })

  test('deduplicates identical facts (case-insensitive)', () => {
    const biz = makeBusinessConfig({
      businessFacts: ['Open weekdays', 'Open weekdays'],
    })
    const summary = buildKnowledgeSummary(biz)
    assert.deepStrictEqual(summary.facts, ['Open weekdays'])
  })

  test('caps at MAX_SUMMARY_FACTS', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Fact number ${i + 1}`)
    const biz = makeBusinessConfig({ businessFacts: lines })
    const summary = buildKnowledgeSummary(biz)
    assert.ok(summary.facts.length <= MAX_SUMMARY_FACTS, `expected <= ${MAX_SUMMARY_FACTS}, got ${summary.facts.length}`)
  })

  test('respects SUMMARY_CHAR_LIMIT', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      `This is a detailed fact number ${i + 1} with extra detail to push the character count higher`)
    const biz = makeBusinessConfig({ businessFacts: lines })
    const summary = buildKnowledgeSummary(biz)
    assert.ok(summary.charCount <= SUMMARY_CHAR_LIMIT, `expected <= ${SUMMARY_CHAR_LIMIT}, got ${summary.charCount}`)
  })

  test('preserves full knowledge for Phase 4 retrieval', () => {
    const fullFacts = ['Very long business facts text that is preserved']
    const fullQa = [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }]
    const biz = makeBusinessConfig({ businessFacts: fullFacts, extraQa: fullQa })
    const summary = buildKnowledgeSummary(biz)
    assert.deepStrictEqual(summary.fullBusinessFacts, fullFacts)
    assert.deepStrictEqual(summary.fullExtraQa, fullQa)
  })

  test('truncates individual long facts', () => {
    const longFact = 'A'.repeat(200)
    const biz = makeBusinessConfig({ businessFacts: [longFact] })
    const summary = buildKnowledgeSummary(biz)
    assert.ok(summary.facts[0].length <= MAX_FACT_CHARS, `expected <= ${MAX_FACT_CHARS}, got ${summary.facts[0].length}`)
    assert.ok(summary.facts[0].endsWith('...'))
  })

  test('block format has header and bullet points', () => {
    const biz = makeBusinessConfig({
      businessFacts: ['Fact A', 'Fact B'],
    })
    const summary = buildKnowledgeSummary(biz)
    assert.strictEqual(summary.block, '## Key Business Facts\n- Fact A\n- Fact B')
  })
})

// ── measurePromptLength ─────────────────────────────────────────────────────

describe('measurePromptLength', () => {
  test('measures total length correctly', () => {
    const report = measurePromptLength('base', 'knowledge', 'caller', 'context')
    // 4 + 9 + 6 + 7 = 26 chars + 6 separators (\n\n for each non-empty block)
    assert.strictEqual(report.totalChars, 32)
    assert.strictEqual(report.overHardMax, false)
    assert.strictEqual(report.overTarget, false)
  })

  test('reports over target', () => {
    const bigPrompt = 'X'.repeat(PROMPT_CHAR_TARGET + 1)
    const report = measurePromptLength(bigPrompt, '', '', '')
    assert.strictEqual(report.overTarget, true)
    assert.strictEqual(report.overHardMax, false)
  })

  test('reports over hard max', () => {
    const hugePrompt = 'X'.repeat(PROMPT_CHAR_HARD_MAX + 1)
    const report = measurePromptLength(hugePrompt, '', '', '')
    assert.strictEqual(report.overHardMax, true)
    assert.strictEqual(report.overTarget, true)
  })

  test('handles empty blocks without extra separators', () => {
    const report = measurePromptLength('base', '', '', '')
    assert.strictEqual(report.totalChars, 4)
  })

  test('breakdown shows per-component sizes', () => {
    const report = measurePromptLength('base', 'kb', 'ctx', 'data')
    assert.strictEqual(report.breakdown.basePrompt, 4)
    assert.strictEqual(report.breakdown.knowledgeSummary, 2)
    assert.strictEqual(report.breakdown.callerContext, 3)
    assert.strictEqual(report.breakdown.contextData, 4)
  })
})

// ── Integration: KnowledgeSummary in AgentContext ────────────────────────────

describe('AgentContext.knowledge', () => {
  test('buildAgentContext includes knowledge field', () => {
    const client = makeClientRow({
      business_facts: ['We do chip repair', 'Full replacement available'],
      extra_qa: [{ q: 'SGI?', a: 'Yes we bill SGI' }],
    })
    const ctx = buildAgentContext(client, '+13065551234')
    assert.ok(ctx.knowledge, 'knowledge field should exist')
    assert.strictEqual(ctx.knowledge.facts.length, 3)
    assert.ok(ctx.knowledge.block.includes('## Key Business Facts'))
    assert.deepStrictEqual(ctx.knowledge.fullBusinessFacts, ['We do chip repair', 'Full replacement available'])
  })

  test('knowledge is empty when no businessFacts or extraQa', () => {
    const client = makeClientRow()
    const ctx = buildAgentContext(client, '+13065551234')
    assert.deepStrictEqual(ctx.knowledge.facts, [])
    assert.strictEqual(ctx.knowledge.block, '')
    assert.strictEqual(ctx.knowledge.charCount, 0)
  })

  test('knowledge summary respects char limit even with large input', () => {
    const bigFacts = Array.from({ length: 50 }, (_, i) =>
      `Detailed business fact #${i + 1}: we provide excellent service in this specific area`
    )
    const client = makeClientRow({ business_facts: bigFacts })
    const ctx = buildAgentContext(client, '+13065551234')
    assert.ok(ctx.knowledge.charCount <= SUMMARY_CHAR_LIMIT, `expected <= ${SUMMARY_CHAR_LIMIT}, got ${ctx.knowledge.charCount}`)
    assert.deepStrictEqual(ctx.knowledge.fullBusinessFacts, bigFacts)
  })
})

// ── Constants sanity checks ─────────────────────────────────────────────────

describe('constants', () => {
  test('PROMPT_CHAR_TARGET < PROMPT_CHAR_HARD_MAX', () => {
    assert.ok(PROMPT_CHAR_TARGET < PROMPT_CHAR_HARD_MAX)
  })

  test('SUMMARY_CHAR_LIMIT fits within prompt budget', () => {
    assert.ok(SUMMARY_CHAR_LIMIT < PROMPT_CHAR_TARGET)
  })

  test('MAX_SUMMARY_FACTS is reasonable', () => {
    assert.ok(MAX_SUMMARY_FACTS >= 5)
    assert.ok(MAX_SUMMARY_FACTS <= 20)
  })
})
