/**
 * slot-ceilings.test.ts — Phase D regression guard
 *
 * After Phase D slot compression (2026-04-09), these ceilings prevent silent
 * re-bloat. If any slot exceeds its ceiling, the test fails loudly and the
 * commit is blocked by the pre-commit hook.
 *
 * Ceilings are set ~20% above the Phase D post-compression numbers to give
 * headroom for intentional small additions. Large additions or drift should
 * trip the alarm and force a deliberate ceiling bump + review.
 *
 * Target total for auto_glass baseline: Hasan's preferred range is 8K ideal,
 * 12K practical ceiling. Phase D landed at 11,974 (auto_glass baseline). The
 * total ceiling here (13,500) is Phase D + ~10% headroom.
 *
 * Niche-specific slots (CONVERSATION_FLOW via triageDeep, FORBIDDEN_ACTIONS
 * via niche FORBIDDEN_EXTRA) vary widely per niche — only asserted for the
 * auto_glass baseline fixture. PM has its own higher ceiling tracked in
 * prompt-builder-golden.test.ts (PM_CEILING = 28_000).
 *
 * Run: npx tsx --test src/lib/__tests__/slot-ceilings.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSlotContext,
  buildPersonaAnchor,
  buildSafetyPreamble,
  buildForbiddenActions,
  buildVoiceNaturalness,
  buildGrammar,
  buildIdentity,
  buildToneAndStyle,
  buildGoal,
  buildConversationFlow,
  buildEscalationTransfer,
  buildInlineExamples,
  buildCallHandlingMode,
  buildRecencyAnchor,
  buildTodayUpdate,
  buildBusinessNotes,
} from '../prompt-slots.js'
import { buildPromptFromIntake } from '../prompt-builder.js'

// Auto_glass baseline intake — the canonical fixture all Phase D numbers were measured against.
const AUTO_GLASS_INTAKE = {
  niche: 'auto_glass',
  business_name: 'Mountain View Auto Glass',
  agent_name: 'Sam',
  city: 'Saskatoon',
  owner_name: 'Mike',
  business_hours_weekday: '8:00 AM - 5:30 PM',
  voice_style_preset: 'casual_friendly',
  call_handling_mode: 'triage',
}

// Phase D post-compression numbers (2026-04-09) + ~20% headroom for each slot.
// If you intentionally grow a slot, bump its ceiling here and note the reason in git.
const SLOT_CEILINGS = {
  PERSONA_ANCHOR: 900,        // Phase D: 722
  SAFETY_PREAMBLE: 600,       // Phase D: 465
  FORBIDDEN_ACTIONS: 2_100,   // Phase D: 1,661 (niche FORBIDDEN_EXTRA adds up to ~500 more)
  VOICE_NATURALNESS: 700,     // Phase D: 523
  GRAMMAR: 500,               // Phase D: 342
  IDENTITY: 400,              // Phase D: 278
  TONE_AND_STYLE: 1_100,      // Phase D: 898
  GOAL: 650,                  // Phase D: 502
  CONVERSATION_FLOW: 5_000,   // Phase D: 3,996 — includes niche triageDeep
  ESCALATION_TRANSFER: 550,   // Phase D: 418
  INLINE_EXAMPLES: 1_400,     // Phase D: 1,084 — safety-preserving trim helper
  CALL_HANDLING_MODE: 450,    // Phase D: 207 — bumped for triage no-repeat-name guardrail (+113 chars)
  RECENCY_ANCHOR: 500,        // Phase D: 374
  // Phase E.5 Wave 6 — Phase E Wave 5 slots. Both collapse to '' when the
  // underlying intake field is empty, so these ceilings only bite when owners
  // actually populate today_update (200-char UI cap + ~282 chars wrapper) or
  // business_notes (3000-char UI cap + ~275 chars wrapper).
  TODAY_UPDATE: 550,          // 200-char raw + header + tags + wrapSection padding (measured: 482)
  BUSINESS_NOTES: 3_400,      // 3000-char raw + header + tags + wrapSection padding
} as const

// Total prompt ceiling for auto_glass baseline.
// Phase D landed at 11,974. Ideal: 8K. Practical ceiling: 12K (per Hasan 2026-04-09).
// Test ceiling: 13,500 to allow +10% drift before failing.
const TOTAL_PROMPT_CEILING = 13_500

describe('Phase D slot char ceilings (auto_glass baseline)', () => {
  const ctx = buildSlotContext(AUTO_GLASS_INTAKE)

  test('PERSONA_ANCHOR under ceiling', () => {
    const len = buildPersonaAnchor(ctx).length
    assert.ok(len <= SLOT_CEILINGS.PERSONA_ANCHOR,
      `PERSONA_ANCHOR is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.PERSONA_ANCHOR}`)
  })

  test('SAFETY_PREAMBLE under ceiling', () => {
    const len = buildSafetyPreamble().length
    assert.ok(len <= SLOT_CEILINGS.SAFETY_PREAMBLE,
      `SAFETY_PREAMBLE is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.SAFETY_PREAMBLE}`)
  })

  test('FORBIDDEN_ACTIONS under ceiling', () => {
    const len = buildForbiddenActions(ctx).length
    assert.ok(len <= SLOT_CEILINGS.FORBIDDEN_ACTIONS,
      `FORBIDDEN_ACTIONS is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.FORBIDDEN_ACTIONS}`)
  })

  test('FORBIDDEN_ACTIONS — strict niche with pgvector KB stays under ceiling', () => {
    const kbCtx = buildSlotContext({
      ...AUTO_GLASS_INTAKE,
      niche: 'property_management',
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 5,
    } as never)
    const out = buildForbiddenActions(kbCtx)
    // PM has larger FORBIDDEN_EXTRA (~6 grouped rules) vs auto_glass baseline.
    // Measured post-Fix1: 3,709 chars. Ceiling raised to 4,200 by KB-aware niche templates
    // Phase 1 Task 4 (2026-05-05): SCOPE rule reframed to KB-conditional (+330 chars).
    // Reframe is intentional — restores Brian's 16 approved KB chunks pre-empted since 2026-04-27.
    // If this trips again, investigate FORBIDDEN_EXTRA bloat in property_management niche config.
    assert.ok(out.length <= 4_200,
      `FORBIDDEN_ACTIONS with strict KB priming exceeds 4200: ${out.length}`)
  })

  test('VOICE_NATURALNESS under ceiling', () => {
    const len = buildVoiceNaturalness(ctx).length
    assert.ok(len <= SLOT_CEILINGS.VOICE_NATURALNESS,
      `VOICE_NATURALNESS is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.VOICE_NATURALNESS}`)
  })

  test('GRAMMAR under ceiling', () => {
    const len = buildGrammar().length
    assert.ok(len <= SLOT_CEILINGS.GRAMMAR,
      `GRAMMAR is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.GRAMMAR}`)
  })

  test('IDENTITY under ceiling', () => {
    const len = buildIdentity(ctx).length
    assert.ok(len <= SLOT_CEILINGS.IDENTITY,
      `IDENTITY is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.IDENTITY}`)
  })

  test('TONE_AND_STYLE under ceiling', () => {
    const len = buildToneAndStyle(ctx).length
    assert.ok(len <= SLOT_CEILINGS.TONE_AND_STYLE,
      `TONE_AND_STYLE is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.TONE_AND_STYLE}`)
  })

  test('GOAL under ceiling', () => {
    const len = buildGoal(ctx).length
    assert.ok(len <= SLOT_CEILINGS.GOAL,
      `GOAL is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.GOAL}`)
  })

  test('CONVERSATION_FLOW under ceiling', () => {
    const len = buildConversationFlow(ctx).length
    assert.ok(len <= SLOT_CEILINGS.CONVERSATION_FLOW,
      `CONVERSATION_FLOW is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.CONVERSATION_FLOW}`)
  })

  test('ESCALATION_TRANSFER under ceiling', () => {
    const len = buildEscalationTransfer(ctx).length
    assert.ok(len <= SLOT_CEILINGS.ESCALATION_TRANSFER,
      `ESCALATION_TRANSFER is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.ESCALATION_TRANSFER}`)
  })

  test('INLINE_EXAMPLES under ceiling', () => {
    const len = buildInlineExamples(ctx).length
    assert.ok(len <= SLOT_CEILINGS.INLINE_EXAMPLES,
      `INLINE_EXAMPLES is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.INLINE_EXAMPLES}`)
  })

  test('CALL_HANDLING_MODE under ceiling', () => {
    const len = buildCallHandlingMode(ctx).length
    assert.ok(len <= SLOT_CEILINGS.CALL_HANDLING_MODE,
      `CALL_HANDLING_MODE is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.CALL_HANDLING_MODE}`)
  })

  test('RECENCY_ANCHOR under ceiling', () => {
    const len = buildRecencyAnchor(ctx).length
    assert.ok(len <= SLOT_CEILINGS.RECENCY_ANCHOR,
      `RECENCY_ANCHOR is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.RECENCY_ANCHOR}`)
  })

  // Phase E.5 Wave 6 — TODAY_UPDATE slot regression guard (populated).
  test('TODAY_UPDATE under ceiling (populated with max 200 chars)', () => {
    const populatedCtx = buildSlotContext({
      ...AUTO_GLASS_INTAKE,
      today_update: 'a'.repeat(200),
    })
    const len = buildTodayUpdate(populatedCtx).length
    assert.ok(len <= SLOT_CEILINGS.TODAY_UPDATE,
      `TODAY_UPDATE is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.TODAY_UPDATE}`)
  })

  // Phase E.5 Wave 6 — BUSINESS_NOTES slot regression guard (populated).
  test('BUSINESS_NOTES under ceiling (populated with max 3000 chars)', () => {
    const populatedCtx = buildSlotContext({
      ...AUTO_GLASS_INTAKE,
      business_notes: 'b'.repeat(3000),
    })
    const len = buildBusinessNotes(populatedCtx).length
    assert.ok(len <= SLOT_CEILINGS.BUSINESS_NOTES,
      `BUSINESS_NOTES is ${len} chars, exceeds ceiling ${SLOT_CEILINGS.BUSINESS_NOTES}`)
  })
})

describe('Phase D total prompt ceilings', () => {
  test('auto_glass baseline total under 13,500 chars (ideal: 8K, practical: 12K)', () => {
    const prompt = buildPromptFromIntake(AUTO_GLASS_INTAKE)
    assert.ok(prompt.length <= TOTAL_PROMPT_CEILING,
      `auto_glass baseline prompt is ${prompt.length} chars, exceeds Phase D ceiling ${TOTAL_PROMPT_CEILING}. ` +
      `Investigate which slot grew via npx tsx scripts/b4-slot-breakdown.mjs`)
  })

  test('hvac baseline total under 13,500 chars', () => {
    const prompt = buildPromptFromIntake({
      niche: 'hvac',
      business_name: 'Prairie HVAC',
      agent_name: 'Alex',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
    })
    assert.ok(prompt.length <= TOTAL_PROMPT_CEILING,
      `hvac baseline prompt is ${prompt.length} chars, exceeds Phase D ceiling ${TOTAL_PROMPT_CEILING}`)
  })

  // Wave 4 (2026-04-28) — real_estate niche rebuilt to property_management parity:
  // 10-branch TRIAGE_DEEP (Buy / Sell / Eval / Rent + 6 edge intents) + INFO_FLOW_OVERRIDE
  // + CLOSING_OVERRIDE + 7 NICHE_EXAMPLES. Same complexity tier as PM, same higher ceiling.
  test('real_estate baseline under 19,500 chars (niche-specific higher ceiling — Wave 4)', () => {
    const prompt = buildPromptFromIntake({
      niche: 'real_estate',
      business_name: 'Sharif Realty',
      agent_name: 'Aisha',
      city: 'Edmonton',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      callback_phone: '+17805550000',
    })
    assert.ok(prompt.length <= 19_500,
      `real_estate baseline is ${prompt.length} chars, exceeds Wave 4 ceiling 19,500`)
  })

  test('plumbing baseline total under 13,500 chars', () => {
    const prompt = buildPromptFromIntake({
      niche: 'plumbing',
      business_name: 'Prairie Plumbing',
      agent_name: 'Jordan',
      city: 'Regina',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
    })
    assert.ok(prompt.length <= TOTAL_PROMPT_CEILING,
      `plumbing baseline prompt is ${prompt.length} chars, exceeds Phase D ceiling ${TOTAL_PROMPT_CEILING}`)
  })

  // Property_management ceiling tightened 18,500 → 16,000 by D-NEW-niche-template-trim
  // (2026-05-05). Raised to 17,000 by KB-aware niche templates Phase 1 Task 4 (2026-05-05):
  // SCOPE rule + RENTAL INQUIRY block reframed from blanket-block to KB-conditional logic
  // (+~490 chars). Reframe is intentional — conditional logic is more verbose than blanket
  // blocks but restores Brian's 16 approved KB chunks that were pre-empted since 2026-04-27.
  // PM still keeps: 10-branch TRIAGE_DEEP, INFO_FLOW_OVERRIDE, CLOSING_OVERRIDE, all FHA/ESA/
  // bedbug/closure-anti-hallucination guardrails.
  test('property_management baseline under 17,000 chars (post KB-aware reframe)', () => {
    const prompt = buildPromptFromIntake({
      niche: 'property_management',
      business_name: 'Urban Vibe Properties',
      agent_name: 'Jess',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      owner_name: 'Ray',
    })
    assert.ok(prompt.length <= 17_000,
      `property_management baseline is ${prompt.length} chars, exceeds post-KB-aware-reframe ceiling 17,000`)
  })
})
