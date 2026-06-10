/**
 * knowledge-summary.ts — Phase 3: KnowledgeSummary + Prompt Length Control
 *
 * Separates knowledge into two layers:
 *   Layer 3a: KnowledgeSummary — short, always-safe facts injected every call (max 15 facts, ~1200 chars)
 *   Layer 3b: Full knowledge — preserved for Phase 4 retrieval, NOT injected into base prompt
 *
 * RULES:
 * - KnowledgeSummary is the ONLY knowledge injected into the runtime prompt by default
 * - contextData (tenant tables, lookup data) is NOT knowledge — it stays full (handled separately)
 * - Long-form content (website scrape, knowledge docs, full businessFacts) stored but not injected
 * - Prompt length is measured and enforced: target 15K chars, hard max 20K chars (BLOCK, not warn)
 *
 * Sources:
 * - businessFacts: free-text business facts from client dashboard
 * - extraQa: Q&A pairs from client dashboard
 * - Both are in BusinessConfig (from agent-context.ts Phase 1B)
 */

import type { BusinessConfig } from '@/lib/agent-context'
import { extractIdentityFacts } from '@/lib/prompt-config/niche-identity'

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum number of facts in the summary */
export const MAX_SUMMARY_FACTS = 15

/** Maximum characters per individual fact line */
export const MAX_FACT_CHARS = 100

/** Maximum total characters for the entire summary block */
export const SUMMARY_CHAR_LIMIT = 1200

/** Call-time prompt length target — warn above this */
export const PROMPT_CHAR_TARGET = 15000

/**
 * Call-time prompt length HARD MAX — block at validation (validatePrompt errors).
 * Lowered 25k → 20k (D-NEW-niche-template-trim, 2026-05-05) after Brian's PM template
 * audit showed niche FORBIDDEN_EXTRA + NICHE_EXAMPLES were emitting 24,768-char prompts.
 * Spec is 12k (.claude/rules/prompt-edit-safety.md). Compromise floor was 18k, but
 * real_estate baseline composes at ~19k due to its 10-branch TRIAGE_DEEP and would
 * silently fail provisioning at 18k. 20k was the safe block; raised to 21k on
 * 2026-05-06 when ANSWER-FIRST + TOOL-LATENCY BRIDGE (~530 chars combined) were
 * promoted from PM-only into universal FORBIDDEN rules 9 + 10.
 *
 * Raised back to 25k on 2026-05-21 — Emon manual-provision trace showed real_estate +
 * scrape-derived facts + Sonar intent buckets land at 21.7k consistently, and the
 * existing Brian (22.9k) + Urban Vibe (22.7k) prompts already run fine above the
 * old 21k cap in production. The 21k cap was hypothetical; 25k matches operational
 * reality and unblocks new signups whose data is richer than minimal trial intake.
 * Tightening to 12-15k deferred to post-Phase-9 (after promotion loop reduces FAQ pressure).
 */
export const PROMPT_CHAR_HARD_MAX = 25300

// ── Types ──────────────────────────────────────────────────────────────────────

export type KnowledgeSummary = {
  /** Short fact lines extracted from businessFacts + extraQa */
  facts: string[]
  /** Pre-formatted block ready for prompt injection — empty string if no facts */
  block: string
  /** Total character count of the block */
  charCount: number
  /** Original full businessFacts array — preserved for Phase 4 retrieval */
  fullBusinessFacts: string[] | null
  /** Original full extraQa pairs — preserved for Phase 4 retrieval */
  fullExtraQa: { q: string; a: string }[]
}

// ── Extraction ─────────────────────────────────────────────────────────────────

/**
 * Extracts key facts from businessFacts free-text.
 * Splits on newlines, filters empty/whitespace lines, trims each fact.
 * Facts written by clients are assumed to be in priority order (top = most important).
 */
export function extractFactsFromText(text: string | string[] | null): string[] {
  if (!text) return []
  if (Array.isArray(text)) {
    return text.map(f => f.trim()).filter(f => f.length > 0 && !f.startsWith('#'))
  }
  if (!text.trim()) return []
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('#')) // skip markdown headings — they're structural, not facts
}

/**
 * Converts extraQa pairs into single-line fact strings.
 * Format: "Q: ... → A: ..." — compact enough for summary injection.
 */
export function extractFactsFromQa(qa: { q: string; a: string }[]): string[] {
  return qa
    .filter(p => p.q?.trim() && p.a?.trim())
    .map(p => `Q: ${p.q.trim()} → ${p.a.trim()}`)
}

/**
 * Truncates a fact line to MAX_FACT_CHARS, appending "..." if truncated.
 */
export function truncateFact(fact: string, maxChars: number = MAX_FACT_CHARS): string {
  if (fact.length <= maxChars) return fact
  return fact.slice(0, maxChars - 3).trimEnd() + '...'
}

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Builds a KnowledgeSummary from BusinessConfig.
 *
 * Layout (2026-06-03 identity-tier refactor):
 *   1. IDENTITY block — Tier-A facts (service area, hours, business model,
 *      owner name) classified from extra_qa via niche-identity.ts. Rendered
 *      at the TOP, uncapped by MAX_SUMMARY_FACTS, with an instruction telling
 *      the agent to answer DIRECTLY (no bridge, no queryKnowledge).
 *   2. KEY BUSINESS FACTS block — the existing summary cap-15 over remaining
 *      facts (businessFacts text + non-identity extra_qa).
 *
 * Identity-tier Q&A pairs are SKIPPED in the Key Business Facts pass to avoid
 * duplicate rendering. They surface only in the Identity block.
 *
 * Pure function — no side effects, no database calls.
 */
export function buildKnowledgeSummary(business: BusinessConfig): KnowledgeSummary {
  const textFacts = extractFactsFromText(business.businessFacts)

  // Identity-tier extraction — runs the classifier with the client's niche.
  const identityFacts = extractIdentityFacts(business.extraQa, business.niche)
  const identityQuestionsSet = new Set(
    identityFacts.map(f => `${f.label}::${f.answer}`.toLowerCase()),
  )

  // Filter identity-classified Q&A pairs out of the general summary pass so
  // they don't render twice.
  const nonIdentityQa = business.extraQa.filter(p => {
    if (!p?.q || !p?.a) return false
    // Re-derive label by checking each identityFact's source — cheaper to
    // compare answer alone since identityKey dedupes per key.
    for (const f of identityFacts) {
      if (f.answer.trim().toLowerCase() === String(p.a).trim().toLowerCase()) return false
    }
    return true
  })
  const qaFacts = extractFactsFromQa(nonIdentityQa)

  // Merge: text facts first (higher signal — client wrote these as priorities),
  // then non-identity Q&A facts. Deduplicate by content.
  const allFacts = [...textFacts, ...qaFacts]
  const seen = new Set<string>()
  const uniqueFacts: string[] = []
  for (const fact of allFacts) {
    const key = fact.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      uniqueFacts.push(fact)
    }
  }

  // Take top N, truncate each
  const topFacts = uniqueFacts.slice(0, MAX_SUMMARY_FACTS).map(f => truncateFact(f))

  // ── Build IDENTITY block ─────────────────────────────────────────────────
  // Rendered uncapped at the top. The instruction line is load-bearing — it
  // tells the agent these facts are baked identity, not lookup candidates.
  // The question text is rendered alongside the answer — answers are often
  // not self-contained ("Yes, chips smaller than a quarter." is meaningless
  // without "Do you do chip repair?"). Fix 2026-06-10.
  let identityBlock = ''
  const identityIncluded: string[] = []
  if (identityFacts.length > 0) {
    identityBlock = '## Identity (instant answers — answer DIRECTLY, do NOT bridge or call queryKnowledge for these)\n'
    for (const f of identityFacts) {
      const rendered = `${f.label}: ${f.question} → ${f.answer}`
      identityBlock += `- ${rendered}\n`
      identityIncluded.push(rendered)
    }
  }

  // ── Build KEY BUSINESS FACTS block ──────────────────────────────────────
  let factsBlock = ''
  const includedFacts: string[] = []
  if (topFacts.length > 0) {
    const header = '## Key Business Facts\n'
    let running = header.length
    for (const fact of topFacts) {
      const line = `- ${fact}\n`
      if (running + line.length > SUMMARY_CHAR_LIMIT) break
      factsBlock += (factsBlock === '' ? header : '') + line
      running += line.length
      includedFacts.push(fact)
    }
  }

  // ── Compose final block ──────────────────────────────────────────────────
  const block = [identityBlock.trimEnd(), factsBlock.trimEnd()]
    .filter(Boolean)
    .join('\n\n')

  return {
    facts: [...identityIncluded, ...includedFacts],
    block,
    charCount: block.length,
    fullBusinessFacts: business.businessFacts,
    fullExtraQa: business.extraQa,
  }
}

// ── Prompt Length Measurement ───────────────────────────────────────────────────

export type PromptLengthReport = {
  /** Total character count of prompt + all injected blocks */
  totalChars: number
  /** True if total exceeds PROMPT_CHAR_HARD_MAX */
  overHardMax: boolean
  /** True if total exceeds PROMPT_CHAR_TARGET */
  overTarget: boolean
  /** Breakdown by component */
  breakdown: {
    basePrompt: number
    knowledgeSummary: number
    callerContext: number
    contextData: number
  }
}

/**
 * Measures the total prompt length including all runtime-injected blocks.
 * Used by inbound webhook to detect prompts that exceed GLM-4.6 limits.
 */
export function measurePromptLength(
  basePrompt: string,
  knowledgeBlock: string,
  callerContextBlock: string,
  contextDataBlock: string,
): PromptLengthReport {
  const baseLen = basePrompt.length
  const knowledgeLen = knowledgeBlock.length
  const callerLen = callerContextBlock.length
  const contextLen = contextDataBlock.length
  const totalChars = baseLen + knowledgeLen + callerLen + contextLen
    + (knowledgeBlock ? 2 : 0) // \n\n separator
    + (callerContextBlock ? 2 : 0)
    + (contextDataBlock ? 2 : 0)

  return {
    totalChars,
    overHardMax: totalChars > PROMPT_CHAR_HARD_MAX,
    overTarget: totalChars > PROMPT_CHAR_TARGET,
    breakdown: {
      basePrompt: baseLen,
      knowledgeSummary: knowledgeLen,
      callerContext: callerLen,
      contextData: contextLen,
    },
  }
}
