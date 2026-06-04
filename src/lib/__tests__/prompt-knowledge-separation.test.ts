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
import {
  buildSlotContext,
  buildFaqPairsSlot,
  buildKnowledgeBaseSlot,
  buildForbiddenActions,
  buildPromptFromSlots,
} from '../prompt-slots.js'

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

// ─────────────────────────────────────────────────────────────────────────────
// 7. SLOT PIPELINE — extra_qa scrape-leak guard (Workstream B Phase 1)
//
// Sections 1–2 above cover the LEGACY buildPromptFromIntake path (websiteContent +
// knowledgeDocs). The slot pipeline (buildPromptFromSlots used by recomposePrompt +
// regenerateSlot) is a separate code path that was added later and never got the same
// inline-content guard. The result: clients.extra_qa flows through clientRowToIntake
// (slot-regenerator.ts:191) -> intake.niche_faq_pairs -> ctx.faqPairs -> baked into
// the stored prompt via buildFaqPairsSlot, even though the SAME data is already served
// at runtime via (a) queryKnowledge against knowledge_chunks and (b) per-call
// templateContext.businessFacts.
//
// Production proof of the leak (audit 2026-06-02, calgary-property-leasing / Brian):
//   - Live stored prompt = 22,922 chars
//   - Single dryrun recompose: faq_pairs slot grew 115 -> 1,496 chars purely from
//     clients.extra_qa being re-pulled into the FAQ block
//   - 0% queryKnowledge hit rate on policy-question calls (3/50 total fires across
//     50 production calls) — the agent reads inline FAQ instead of reaching for
//     the tool, defeating the pgvector + per-call architecture
//
// These tests fail against current buildFaqPairsSlot (which unconditionally emits
// the FAQ block) and pass once it honors the pgvector + chunks > 0 guard.
// ─────────────────────────────────────────────────────────────────────────────

describe('SLOT PIPELINE — extra_qa leak guard (Workstream B)', () => {
  // Realistic property_management FAQ content. Markers are checked against composed-prompt
  // output verbatim — if they appear when pgvector serves, the leak is back.
  const SAMPLE_FAQ_ARRAY = [
    { q: 'What areas do you serve?', a: 'Calgary and Edmonton primarily.' },
    { q: 'How does the rent guarantee work?', a: 'We guarantee 90% of market value for 12 months.' },
    { q: 'What is your pet policy?', a: 'Most buildings allow pets but contact us for specifics.' },
  ]
  const SAMPLE_FAQ_JSON = JSON.stringify(SAMPLE_FAQ_ARRAY)
  const FAQ_LEAK_MARKERS = [
    'guarantee 90% of market value',
    'Most buildings allow pets',
    'Calgary and Edmonton primarily',
  ] as const

  function pmIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      niche: 'property_management',
      business_name: 'Test Properties',
      agent_name: 'Eric',
      timezone: 'America/Edmonton',
      owner_name: 'Brian',
      callback_phone: '+14035550100',
      hours_weekday: '9am-5pm',
      hours_weekend: 'closed',
      niche_faq_pairs: SAMPLE_FAQ_JSON,
      ...overrides,
    }
  }

  test('LEAK GUARD: buildFaqPairsSlot returns empty when pgvector backend + approved chunks exist', () => {
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 12,
    }) as never)

    const out = buildFaqPairsSlot(ctx)

    assert.strictEqual(
      out,
      '',
      'When pgvector serves and chunks > 0, the FAQ content already reaches the agent via\n' +
      '  (a) queryKnowledge tool against knowledge_chunks, and\n' +
      '  (b) per-call templateContext.businessFacts from clients.extra_qa.\n' +
      'Embedding the same content a third time inside clients.system_prompt is the scrape leak.',
    )
  })

  test('LEAK GUARD: composed prompt contains no FAQ Q&A markers when pgvector serves', () => {
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 12,
    }) as never)
    const prompt = buildPromptFromSlots(ctx)

    for (const marker of FAQ_LEAK_MARKERS) {
      assert.ok(
        !prompt.includes(marker),
        `Composed prompt MUST NOT contain FAQ marker "${marker}" when pgvector + chunks exist. ` +
        'Found in stored prompt -> data is being baked in instead of served via runtime paths.',
      )
    }
    assert.ok(
      !prompt.includes('## FREQUENTLY ASKED QUESTIONS'),
      'The FAQ section header MUST NOT appear in the composed prompt when pgvector serves.',
    )
  })

  test('LEAK GUARD: section marker <!-- unmissed:faq_pairs --> is absent when pgvector serves', () => {
    // The wrapSection() helper emits HTML comment markers around each slot's content:
    // `<!-- unmissed:faq_pairs -->\n...content...\n<!-- /unmissed:faq_pairs -->`
    // When buildFaqPairsSlot returns '' under the pgvector guard, composePrompt's filter
    // step drops the slot entirely — neither markers nor content reach the stored prompt.
    // This is a structural invariant that doesn't depend on FAQ data size: it captures the
    // shape of the slot output regardless of how big the underlying content is.
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 12,
    }) as never)
    const prompt = buildPromptFromSlots(ctx)

    assert.ok(
      !prompt.includes('<!-- unmissed:faq_pairs -->'),
      'Opening marker for the faq_pairs slot must NOT appear in the composed prompt when pgvector serves.',
    )
    assert.ok(
      !prompt.includes('<!-- /unmissed:faq_pairs -->'),
      'Closing marker for the faq_pairs slot must NOT appear in the composed prompt when pgvector serves.',
    )
  })

  test('LEAK SAVINGS at production scale: realistic extra_qa volume produces a shorter pgvector prompt', () => {
    // Phase 1 win is data-size-dependent. For SMALL extra_qa, the KB-instruction block
    // (buildKnowledgeBaseSlot) plus kbPriming (in buildForbiddenActions) can ADD more chars
    // than buildFaqPairsSlot would have emitted — net pgvector prompt can be larger.
    // The architectural win materializes above ~1,000 chars of FAQ content. Brian's
    // production extra_qa is ~1,500 chars; this test scales to that operating point.
    const largeFaq = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        q: `Production-scale FAQ question number ${i + 1} about properties and tenants and rents and leases and applications?`,
        a: `Detailed FAQ answer number ${i + 1} that mirrors the kind of scrape-derived prose that pumps Brian's prompt to 22K chars. Covers policies, hours, rates, services, exclusions.`,
      })),
    )
    const inlinePrompt = buildPromptFromSlots(buildSlotContext(pmIntake({
      knowledge_backend: 'inline',
      knowledge_chunk_count: 0,
      niche_faq_pairs: largeFaq,
    }) as never))
    const pgvectorPrompt = buildPromptFromSlots(buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 20,
      niche_faq_pairs: largeFaq,
    }) as never))

    assert.ok(
      pgvectorPrompt.length < inlinePrompt.length,
      `At production-scale extra_qa volume, pgvector prompt (${pgvectorPrompt.length} chars) ` +
      `must be SHORTER than inline prompt (${inlinePrompt.length} chars). ` +
      'If not, the FAQ leak is still present OR buildKnowledgeBaseSlot/kbPriming have grown ' +
      'beyond the savings — verify Phase 2 niche-defaults compression hasn\'t been deferred forever.',
    )
  })

  test('FALLBACK: buildFaqPairsSlot still emits inline FAQ when knowledge_backend is not pgvector', () => {
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'inline',
      knowledge_chunk_count: 0,
    }) as never)

    const out = buildFaqPairsSlot(ctx)

    assert.ok(
      out.includes('## FREQUENTLY ASKED QUESTIONS'),
      'Non-pgvector clients have no runtime knowledge path — inline FAQ must remain in stored prompt.',
    )
    assert.ok(
      out.includes('guarantee 90% of market value'),
      'Inline FAQ content must reach the prompt for clients without pgvector backend.',
    )
  })

  test('FALLBACK: buildFaqPairsSlot emits inline FAQ when pgvector backend BUT zero approved chunks', () => {
    // pgvector backend can be set before any chunks are approved. In that window
    // queryKnowledge has nothing to return; the inline FAQ has to serve as fallback.
    // buildKnowledgeBaseSlot already has the same gating (D265+D269) at prompt-slots.ts:583;
    // this preserves parity between the two slot guards.
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 0,
    }) as never)

    const out = buildFaqPairsSlot(ctx)

    assert.ok(
      out.includes('## FREQUENTLY ASKED QUESTIONS'),
      'pgvector backend with 0 chunks means queryKnowledge returns nothing — inline FAQ must remain as fallback.',
    )
  })

  test('PARITY: when pgvector + chunks suppress inline FAQ, buildKnowledgeBaseSlot must compensate with a queryKnowledge instruction', () => {
    // Architectural commitment: "inline FAQ leaves the stored prompt, queryKnowledge takes
    // over as the runtime path." If the KB slot didn't emit the instruction, the agent
    // would have neither inline data nor a clear directive to call the tool — that would
    // be a real regression.
    const ctx = buildSlotContext(pmIntake({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 12,
    }) as never)

    const kbOutput = buildKnowledgeBaseSlot(ctx)
    const prompt = buildPromptFromSlots(ctx)

    assert.ok(kbOutput.length > 0, 'buildKnowledgeBaseSlot must emit content when pgvector + chunks exist.')
    assert.ok(
      kbOutput.includes('queryKnowledge'),
      'The KB slot must instruct the agent to call queryKnowledge when pgvector serves.',
    )
    assert.ok(
      prompt.includes('# KNOWLEDGE BASE'),
      'The composed prompt must include the KNOWLEDGE BASE section so the agent knows the retrieval path.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. FORBIDDEN_EXTRA cap — Workstream B Phase 2a (~3,000 char cap)
//
// buildForbiddenActions concatenates every rule in ctx.forbiddenExtraRules
// unconditionally. The same scrape-leak that pumped clients.extra_qa into the
// FAQ slot (Phase 1 above) also pumps AI-generated FORBIDDEN_EXTRA rules into
// the FORBIDDEN_ACTIONS slot. Brian's prompt had 1,500+ chars of duplicate
// scrape-derived guardrails (rules 18-25 restating rules 11-17 in different
// words) — confirmed by sections audit on 2026-06-02.
//
// Architectural rule: niche-defaults rules (FHA, ESA, PEST, bedbug) are
// SACRED and live FIRST in the forbiddenExtraRules array per the merge order
// at prompt-slots.ts:758 (baseVars before customVars). AI-generated bloat
// arrives via niche_custom_variables.FORBIDDEN_EXTRA and lands SECOND. A cap
// that takes complete rules in order until budget exhausted naturally
// preserves the sacred head and clips the bloated tail.
//
// Cap = 3,000 chars. Sized to fit the heaviest niche-defaults observed
// (property_management: 2,608 chars across 8 sacred rules) plus ~400 char
// headroom for legitimate owner-added rules. Phase 2d compresses
// property_management + real_estate niche-defaults; once that ships, this
// cap drops to ~1,500.
// ─────────────────────────────────────────────────────────────────────────────

describe('FORBIDDEN_EXTRA cap (Workstream B Phase 2a)', () => {
  function pmIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      niche: 'property_management',
      business_name: 'Test Properties',
      agent_name: 'Eric',
      timezone: 'America/Edmonton',
      owner_name: 'Brian',
      callback_phone: '+14035550100',
      hours_weekday: '9am-5pm',
      hours_weekend: 'closed',
      ...overrides,
    }
  }

  // Synthetic "scrape bloat" — 12 rules, ~120 chars each, ~1,500 chars total.
  // Mirrors the wording pattern of Brian's actual rules 18-25 (restatements of
  // existing rules with marginally different phrasing). None of these contain
  // sacred phrases, so any survivor identifies a leak past the cap.
  const SCRAPE_BLOAT_RULES = Array.from({ length: 12 }, (_, i) =>
    `BLOAT_RULE_${i + 1}: never restate the obvious — duplicated guardrail number ${i + 1} pulled from a website scrape and re-injected by the AI compiler.`,
  )
  const SCRAPE_BLOAT_BLOCK = SCRAPE_BLOAT_RULES.join('\n')

  test('CAP: with niche-defaults + 1,500 chars of scrape bloat, forbidden_extra portion stays under 3,000 chars', () => {
    const ctx = buildSlotContext(pmIntake({
      niche_custom_variables: { FORBIDDEN_EXTRA: SCRAPE_BLOAT_BLOCK },
    }) as never)

    const out = buildForbiddenActions(ctx)

    // The forbidden_extra portion is everything appended after rule 10 (TOOL-LATENCY
    // BRIDGE) and before the kbPriming block. We measure it by counting chars
    // contributed from ctx.forbiddenExtraRules — which the cap controls directly.
    // Sum the survivor rules: anything that appears in `out` from the original array.
    const survivorChars = ctx.forbiddenExtraRules
      .filter(rule => out.includes(rule))
      .reduce((sum, rule) => sum + rule.length + 1, 0) // +1 for join newline
    // 2026-06-03 cap raised 3000 → 4500 to accommodate property_management Phase 1c
    // rules (UTILITIES, APPLICATION, FAIR HOUSING-ESA carve-out, LEGAL ADVICE refusal)
    // and 2026-06-04 home_renovation safety hardening (5 new rules + TIMELINES/MATERIAL
    // strengthened). Test assertion updated to match the actual cap.
    assert.ok(
      survivorChars <= 4500,
      `Forbidden-extra survivor bytes = ${survivorChars}, must be <= 4500. ` +
      `Without the cap this concatenates niche-defaults + scrape bloat unbounded. ` +
      `Phase 2a clips the bloated tail; sacred niche head survives.`,
    )
  })

  test('CAP: sacred niche rules (FHA / ESA) at the head survive the cap', () => {
    const ctx = buildSlotContext(pmIntake({
      niche_custom_variables: { FORBIDDEN_EXTRA: SCRAPE_BLOAT_BLOCK },
    }) as never)

    const out = buildForbiddenActions(ctx)

    // property_management niche-defaults FORBIDDEN_EXTRA contains the FHA penalty
    // wording. That rule is FIRST in the merged array (baseVars before customVars
    // per prompt-slots.ts:758) so the cap MUST preserve it.
    assert.ok(
      out.includes('Fair Housing Act violations carry penalties up to $150,000'),
      'FHA sacred rule MUST survive the cap. If this fails, the cap is clipping the wrong end.',
    )
    assert.ok(
      out.includes('NEVER reject or question service animal or ESA'),
      'ESA sacred rule MUST survive the cap.',
    )
  })

  test('CAP: tail bloat rules are dropped', () => {
    const ctx = buildSlotContext(pmIntake({
      niche_custom_variables: { FORBIDDEN_EXTRA: SCRAPE_BLOAT_BLOCK },
    }) as never)

    const out = buildForbiddenActions(ctx)

    // At least the final 4 bloat rules should be dropped (12 rules × ~125 chars
    // = ~1,500 chars; if sacred head takes ~700 chars then only ~500 chars of
    // bloat fit, ~4 rules). Asserting on the LAST rule is conservative.
    assert.ok(
      !out.includes('BLOAT_RULE_12'),
      'Tail bloat rule BLOAT_RULE_12 MUST be clipped. If present the cap is not firing.',
    )
  })

  test('CAP: small extras (under 1,200 chars total) are unaffected', () => {
    // Default property_management intake — no scrape bloat. The niche-defaults
    // FORBIDDEN_EXTRA is ~1,100 chars on its own. The full set of sacred rules
    // should pass through untouched.
    const ctx = buildSlotContext(pmIntake() as never)

    const out = buildForbiddenActions(ctx)

    // All sacred niche-defaults rules must survive when no bloat is injected.
    assert.ok(
      out.includes('Fair Housing Act violations carry penalties up to $150,000'),
      'FHA sacred rule must survive in the no-bloat case.',
    )
    assert.ok(
      out.includes('NEVER reject or question service animal or ESA'),
      'ESA sacred rule must survive in the no-bloat case.',
    )
    // Bedbug urgent-tier rule lives in the niche-defaults PEST rule.
    assert.ok(
      /bedbug/i.test(out),
      'Bedbug sacred wording must survive in the no-bloat case.',
    )
  })

  test('CAP: rule integrity — no mid-rule truncation', () => {
    const ctx = buildSlotContext(pmIntake({
      niche_custom_variables: { FORBIDDEN_EXTRA: SCRAPE_BLOAT_BLOCK },
    }) as never)

    const out = buildForbiddenActions(ctx)

    // Every rule in ctx.forbiddenExtraRules that appears in `out` must appear in
    // FULL — the cap operates at rule boundaries, never mid-rule. If any rule
    // is present in `out` only as a prefix, the cap is truncating mid-string.
    for (const rule of ctx.forbiddenExtraRules) {
      const idx = out.indexOf(rule.slice(0, 30)) // probe with first 30 chars
      if (idx === -1) continue // rule was clipped entirely — fine
      assert.ok(
        out.includes(rule),
        `Rule appeared partially in output but not fully — mid-rule truncation. ` +
        `Rule prefix: "${rule.slice(0, 40)}...". Cap must preserve rule boundaries.`,
      )
    }
  })
})
