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
 * promoted from PM-only into universal FORBIDDEN rules 9 + 10 — every niche pays
 * the cost, and real_estate now lands at ~20,040. 21k still blocks Brian-level
 * (24k+) bloat and leaves ~500 chars of headroom.
 * Tightening to 12-15k deferred to post-Phase-9 (after promotion loop reduces FAQ pressure).
 */
export const PROMPT_CHAR_HARD_MAX = 21000

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
 * Extracts top facts from businessFacts + extraQa, truncates each,
 * and caps the total block at SUMMARY_CHAR_LIMIT.
 *
 * Pure function — no side effects, no database calls.
 */
export function buildKnowledgeSummary(business: BusinessConfig): KnowledgeSummary {
  const textFacts = extractFactsFromText(business.businessFacts)
  const qaFacts = extractFactsFromQa(business.extraQa)

  // Merge: text facts first (higher signal — client wrote these as priorities),
  // then Q&A facts. Deduplicate by content.
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

  // Build block, respecting char limit
  let block = ''
  const includedFacts: string[] = []
  if (topFacts.length > 0) {
    const header = '## Key Business Facts\n'
    let running = header.length
    for (const fact of topFacts) {
      const line = `- ${fact}\n`
      if (running + line.length > SUMMARY_CHAR_LIMIT) break
      block += (block === '' ? header : '') + line
      running += line.length
      includedFacts.push(fact)
    }
  }

  return {
    facts: includedFacts,
    block: block.trimEnd(),
    charCount: block.trimEnd().length,
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
