/**
 * prompt-knowledge-separation.test.ts — Knowledge separation tests
 *
 * Verifies that:
 * 1. websiteContent is NOT inlined into stored prompts (served via KnowledgeSummary + pgvector)
 * 2. knowledgeDocs are NOT inlined into stored prompts (served via pgvector)
 * 3. Key business facts are still available at call-time via KnowledgeSummary
 * 4. Unknown-answer behavior instructions still present when configured
 * 5. Prompt length stays controlled with large website/doc inputs
 * 6. prepareFactChunks/prepareQaChunks respect source param for settings sync
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-knowledge-separation.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildPromptFromIntake } from '../prompt-builder.js'
import { buildKnowledgeSummary, PROMPT_CHAR_HARD_MAX, SUMMARY_CHAR_LIMIT } from '../knowledge-summary.js'
import { buildAgentContext, type ClientRow } from '../agent-context.js'
import { prepareFactChunks, prepareQaChunks } from '../embeddings.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function baseIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: 'Acme Auto Glass',
    niche: 'auto_glass',
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    ...overrides,
  }
}

function makeClientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 'test-id',
    slug: 'test-slug',
    niche: 'auto_glass',
    business_name: 'Acme Auto Glass',
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

// ── 1. websiteContent NOT inlined ────────────────────────────────────────────

describe('websiteContent separation', () => {
  const bigWebsiteContent = Array.from({ length: 50 }, (_, i) =>
    `- Business fact from website #${i + 1}: we provide excellent service`
  ).join('\n')

  test('websiteContent text is NOT embedded in the stored prompt', () => {
    const prompt = buildPromptFromIntake(baseIntake(), bigWebsiteContent)
    assert.ok(!prompt.includes('WEBSITE CONTENT (auto-scraped)'),
      'Stored prompt should NOT contain "WEBSITE CONTENT (auto-scraped)" header')
    assert.ok(!prompt.includes('Business fact from website #1'),
      'Stored prompt should NOT contain website-scraped fact text')
  })

  test('prompt length unchanged with or without websiteContent', () => {
    const withoutWebsite = buildPromptFromIntake(baseIntake())
    const withWebsite = buildPromptFromIntake(baseIntake(), bigWebsiteContent)
    // Should be identical — websiteContent is intentionally ignored
    assert.strictEqual(withWebsite.length, withoutWebsite.length,
      'Prompt with websiteContent should be same length as without')
  })

  test('massive website input does not increase prompt size at all', () => {
    const hugeContent = 'X'.repeat(10000)
    const basePrompt = buildPromptFromIntake(baseIntake())
    const withHugeWebsite = buildPromptFromIntake(baseIntake(), hugeContent)
    assert.strictEqual(withHugeWebsite.length, basePrompt.length,
      'Even 10K chars of website content should add zero chars to stored prompt')
  })
})

// ── 2. knowledgeDocs NOT inlined ─────────────────────────────────────────────

describe('knowledgeDocs separation', () => {
  const bigKnowledgeDocs = Array.from({ length: 20 }, (_, i) =>
    `Document ${i + 1}: This is a detailed knowledge document with policies and procedures.`
  ).join('\n\n---\n\n')

  test('knowledgeDocs text is NOT embedded in the stored prompt', () => {
    const prompt = buildPromptFromIntake(baseIntake(), undefined, bigKnowledgeDocs)
    assert.ok(!prompt.includes('KNOWLEDGE BASE DOCUMENTS'),
      'Stored prompt should NOT contain "KNOWLEDGE BASE DOCUMENTS" section')
    assert.ok(!prompt.includes('Document 1: This is a detailed'),
      'Stored prompt should NOT contain raw document text')
  })

  test('prompt length unchanged with or without knowledgeDocs', () => {
    const withoutDocs = buildPromptFromIntake(baseIntake())
    const withDocs = buildPromptFromIntake(baseIntake(), undefined, bigKnowledgeDocs)
    assert.strictEqual(withDocs.length, withoutDocs.length,
      'Prompt with knowledgeDocs should be same length as without')
  })
})

// ── 3. Business facts available at call-time via KnowledgeSummary ────────────

describe('call-time KnowledgeSummary availability', () => {
  test('business_facts from DB are available in KnowledgeSummary at call time', () => {
    const client = makeClientRow({
      business_facts: 'SGI approved shop\nFree mobile service\nADAS calibration available',
    })
    const ctx = buildAgentContext(client, '+13065551234')
    assert.strictEqual(ctx.knowledge.facts.length, 3)
    assert.ok(ctx.knowledge.block.includes('SGI approved shop'))
    assert.ok(ctx.knowledge.block.includes('Free mobile service'))
    assert.ok(ctx.knowledge.block.includes('ADAS calibration'))
  })

  test('extra_qa from DB are available in KnowledgeSummary at call time', () => {
    const client = makeClientRow({
      extra_qa: [
        { q: 'Do you do chip repair?', a: 'Yes, chips smaller than a quarter.' },
        { q: 'Open weekends?', a: 'Saturdays 9am to 2pm.' },
      ],
    })
    const ctx = buildAgentContext(client, '+13065551234')
    assert.strictEqual(ctx.knowledge.facts.length, 2)
    assert.ok(ctx.knowledge.block.includes('chip repair'))
    assert.ok(ctx.knowledge.block.includes('Saturdays'))
  })

  test('KnowledgeSummary respects char limit even with many facts', () => {
    const manyFacts = Array.from({ length: 50 }, (_, i) =>
      `Important business detail #${i + 1} about our operations`
    )
    const client = makeClientRow({ business_facts: manyFacts })
    const ctx = buildAgentContext(client, '+13065551234')
    assert.ok(ctx.knowledge.charCount <= SUMMARY_CHAR_LIMIT,
      `KnowledgeSummary is ${ctx.knowledge.charCount} chars — must be under ${SUMMARY_CHAR_LIMIT}`)
    // Full facts preserved for retrieval
    assert.deepStrictEqual(ctx.knowledge.fullBusinessFacts, manyFacts)
  })
})

// ── 4. Unknown-answer behavior still works ──────────────────────────────────

describe('unknown-answer behavior in stored prompt', () => {
  test('take_message fallback instruction present when configured', () => {
    const prompt = buildPromptFromIntake(baseIntake({ unknown_answer_behavior: 'take_message' }))
    assert.ok(prompt.includes('take a message'),
      'take_message fallback should be in stored prompt')
  })

  test('find_out_callback fallback instruction present when configured', () => {
    const prompt = buildPromptFromIntake(baseIntake({ unknown_answer_behavior: 'find_out_callback' }))
    assert.ok(prompt.includes("let me find out"),
      'find_out_callback fallback should be in stored prompt')
  })

  test('no fallback instruction when not configured', () => {
    const prompt = buildPromptFromIntake(baseIntake())
    // Should not have FALLBACK: prefix from unknown answer map
    assert.ok(!prompt.includes('FALLBACK:'),
      'No FALLBACK instruction should appear when unknown_answer_behavior is not set')
  })
})

// ── 5. Prompt length control ─────────────────────────────────────────────────

describe('prompt length control', () => {
  test('websiteContent and knowledgeDocs add zero to stored prompt length', () => {
    const base = buildPromptFromIntake(baseIntake())
    const withAll = buildPromptFromIntake(
      baseIntake(),
      'X'.repeat(5000),  // websiteContent
      'Y'.repeat(5000),  // knowledgeDocs
    )
    assert.strictEqual(withAll.length, base.length,
      'websiteContent + knowledgeDocs should add zero chars to stored prompt')
  })

  test('caller_faq replaces KB section but websiteContent does not change length', () => {
    const withFaq = buildPromptFromIntake(baseIntake({
      caller_faq: 'We offer chip repair\nFull windshield replacement',
    }))
    const withFaqAndWebsite = buildPromptFromIntake(
      baseIntake({ caller_faq: 'We offer chip repair\nFull windshield replacement' }),
      'X'.repeat(5000),
    )
    // caller_faq content should appear in the prompt (replaces KB marker)
    assert.ok(withFaq.includes('chip repair'),
      'caller_faq content should be in stored prompt')
    // But website should not add on top of that
    assert.strictEqual(withFaqAndWebsite.length, withFaq.length,
      'websiteContent should not add chars beyond caller_faq')
  })

  test('caller_faq (client-provided) still works in stored prompt', () => {
    const prompt = buildPromptFromIntake(baseIntake({
      caller_faq: 'We offer chip repair starting at competitive prices\nFull windshield replacement available',
    }))
    assert.ok(prompt.includes('chip repair'),
      'Client-provided caller_faq should still be in stored prompt')
  })
})

// ── 6. Chunk source tagging for settings sync ────────────────────────────────

describe('prepareFactChunks source param', () => {
  test('default source is website_scrape', () => {
    const chunks = prepareFactChunks('Fact one\nFact two')
    assert.ok(chunks.every(c => c.source === 'website_scrape'))
  })

  test('settings_edit source tags correctly', () => {
    const chunks = prepareFactChunks('Fact one\nFact two', 'settings_edit')
    assert.ok(chunks.every(c => c.source === 'settings_edit'))
    assert.strictEqual(chunks.length, 2)
  })
})

describe('prepareQaChunks source param', () => {
  test('default source is website_scrape', () => {
    const chunks = prepareQaChunks([{ q: 'Q?', a: 'A.' }])
    assert.ok(chunks.every(c => c.source === 'website_scrape'))
  })

  test('settings_edit source tags correctly', () => {
    const chunks = prepareQaChunks([{ q: 'Q?', a: 'A.' }], 'settings_edit')
    assert.ok(chunks.every(c => c.source === 'settings_edit'))
    assert.strictEqual(chunks.length, 1)
  })
})
