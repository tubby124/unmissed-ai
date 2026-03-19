/**
 * knowledge-retrieval.ts — Phase 4: Retrieval for Business Knowledge
 *
 * Separates knowledge access into two tiers:
 *   Tier 1: KnowledgeSummary (Phase 3) — always injected, max 15 facts, ~1200 chars
 *   Tier 2: Corpus retrieval — on-demand via queryCorpus tool, for detailed/long-form knowledge
 *
 * RULES:
 * - Retrieval is ONLY for business knowledge (products, services, policies, FAQs, docs)
 * - These concerns are NEVER in retrieval:
 *     • emergency logic (handled by EMERGENCY OVERRIDE section)
 *     • booking logic (handled by booking tools + DYNAMIC CONVERSATION FLOW)
 *     • after-hours behavior (handled by callerContext injection)
 *     • tone / turn-taking rules (handled by VOICE NATURALNESS + GRAMMAR sections)
 * - Retrieval requires BOTH:
 *     1. useKnowledgeLookup=true (niche capability from Phase 1A)
 *     2. corpusAvailable=true (corpus_enabled + corpus infrastructure exists)
 * - KnowledgeSummary is always injected regardless of retrieval availability
 * - contextData (tenant tables, lookup data) is NOT retrieval — stays full, handled separately
 *
 * PROPERTY MANAGEMENT separation (documented for Phase 7):
 *   - Retrieval/search: building policies, PM procedures, tenant FAQs → queryCorpus (this phase)
 *   - Structured records: tenant table, unit data → contextData (already exists, NOT retrieval)
 *   - Write/update actions: create maintenance request, update status → Phase 7 (NOT this phase)
 *
 * WHEN TO USE RETRIEVAL vs KNOWLEDGE SUMMARY:
 *   - KnowledgeSummary: always available, covers top 15 facts, answers 80% of common questions
 *   - Retrieval: on-demand search for detailed info NOT in the summary — pricing specifics,
 *     policy details, procedure steps, product specs, service area boundaries, etc.
 *   - The agent should try the summary first (it's already in context) and only use
 *     queryCorpus when the caller asks something the summary doesn't cover.
 */

import type { AgentCapabilities } from '@/lib/niche-capabilities'
import type { KnowledgeSummary } from '@/lib/knowledge-summary'
import { extractFactsFromText, extractFactsFromQa } from '@/lib/knowledge-summary'

// ── Types ──────────────────────────────────────────────────────────────────────

export type RetrievalConfig = {
  /** Whether retrieval is fully enabled for this call (capability + corpus) */
  enabled: boolean
  /** Whether the niche supports useKnowledgeLookup */
  nicheSupportsLookup: boolean
  /** Whether corpus infrastructure is available */
  corpusAvailable: boolean
  /** Whether the KnowledgeSummary was truncated (more knowledge exists than fits) */
  knowledgeTruncated: boolean
  /** Prompt instruction block — non-empty ONLY when retrieval is enabled */
  promptInstruction: string
}

// ── Core builder ───────────────────────────────────────────────────────────────

/**
 * Determines retrieval configuration for a client.
 * Pure function — no DB, no env vars, no side effects.
 *
 * @param capabilities  - Niche capability flags (Phase 1A)
 * @param knowledge     - KnowledgeSummary built in Phase 3
 * @param corpusAvailable - True when corpus_enabled=true AND corpus infrastructure exists
 */
export function buildRetrievalConfig(
  capabilities: AgentCapabilities,
  knowledge: KnowledgeSummary,
  corpusAvailable: boolean,
): RetrievalConfig {
  const nicheSupportsLookup = capabilities.useKnowledgeLookup
  const enabled = nicheSupportsLookup && corpusAvailable

  const knowledgeTruncated = countFullFacts(knowledge) > knowledge.facts.length

  const promptInstruction = enabled ? buildRetrievalInstruction(knowledgeTruncated) : ''

  return {
    enabled,
    nicheSupportsLookup,
    corpusAvailable,
    knowledgeTruncated,
    promptInstruction,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Count total available facts before KnowledgeSummary truncation.
 * Used to detect if the summary is a subset of available knowledge.
 */
export function countFullFacts(knowledge: KnowledgeSummary): number {
  const textLines = extractFactsFromText(knowledge.fullBusinessFacts).length
  const qaCount = extractFactsFromQa(knowledge.fullExtraQa).length
  return textLines + qaCount
}

/**
 * Builds the retrieval instruction for injection into the prompt.
 * Scoped strictly to business knowledge — NEVER includes emergency/booking/after-hours/tone rules.
 */
export function buildRetrievalInstruction(knowledgeTruncated: boolean): string {
  const truncationNote = knowledgeTruncated
    ? ' The facts above are a summary — more detail is available through search.'
    : ''

  return [
    '## KNOWLEDGE LOOKUP',
    `You have access to a knowledge base with detailed business information.${truncationNote}`,
    'When a caller asks a specific question NOT answered by the facts above, use the queryCorpus tool to search.',
    'If the search returns a relevant result, answer naturally. If not, say you will have someone follow up with details.',
    'Do NOT use queryCorpus for greetings, emergencies, booking, or information already in the facts above.',
  ].join('\n')
}
