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
 *     2. corpusAvailable=true (knowledge_backend='pgvector' on the client)
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

export type RetrievalBackend = 'ultravox' | 'pgvector' | null

export type RetrievalConfig = {
  /** Whether retrieval is fully enabled for this call (capability + backend available) */
  enabled: boolean
  /** Which retrieval backend is active */
  backend: RetrievalBackend
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
 * @param corpusAvailable - True when knowledge_backend='pgvector' on the client
 * @param knowledgeBackend - 'pgvector' | 'ultravox' | null from clients.knowledge_backend
 */
export function buildRetrievalConfig(
  capabilities: AgentCapabilities,
  knowledge: KnowledgeSummary,
  corpusAvailable: boolean,
  knowledgeBackend: RetrievalBackend = null,
): RetrievalConfig {
  const nicheSupportsLookup = capabilities.useKnowledgeLookup

  // Determine effective backend and enabled state
  const backend: RetrievalBackend = knowledgeBackend
  // pgvector bypasses the niche gate — if the client explicitly has pgvector enabled,
  // they uploaded knowledge and it should be retrievable regardless of niche defaults.
  // Non-pgvector backends still require useKnowledgeLookup=true on the niche.
  const enabled = (backend === 'pgvector') || (
    nicheSupportsLookup && (
      (backend === 'ultravox' && corpusAvailable) ||
      (!backend && corpusAvailable) // legacy: no backend set but corpus available
    )
  )

  const fullFactCount = countFullFacts(knowledge)
  const knowledgeTruncated = fullFactCount > knowledge.facts.length
  const hasInlineFacts = fullFactCount > 0

  const promptInstruction = enabled ? buildRetrievalInstruction(knowledgeTruncated, backend, hasInlineFacts) : ''

  return {
    enabled,
    backend,
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
export function buildRetrievalInstruction(
  knowledgeTruncated: boolean,
  backend?: RetrievalBackend,
  hasInlineFacts: boolean = true,
): string {
  // pgvector is now universal — only legacy ultravox backend uses queryCorpus
  const toolName = backend === 'ultravox' ? 'queryCorpus' : 'queryKnowledge'

  // D368: When no inline facts exist, don't imply facts above are authoritative —
  // that causes the agent to skip queryKnowledge entirely.
  if (!hasInlineFacts) {
    return [
      '## KNOWLEDGE LOOKUP',
      `This business has no inline facts configured. Use ${toolName} for ALL business-specific questions.`,
      `When a caller asks about services, prices, hours, or any business detail, use ${toolName} to search.`,
      `If ${toolName} returns a relevant result, answer naturally. If no results, tell the caller you will have someone follow up — never guess.`,
      `Do NOT use ${toolName} for greetings, emergencies, or booking confirmation.`,
    ].join('\n')
  }

  const truncationNote = knowledgeTruncated
    ? ' The facts above are a summary — more detail is available through search.'
    : ''

  return [
    '## KNOWLEDGE LOOKUP',
    `You have access to a knowledge base with detailed business information.${truncationNote}`,
    `The Key Business Facts above are authoritative. Use ${toolName} only for details not already covered.`,
    `When a caller asks a specific question NOT answered by the facts above, use the ${toolName} tool to search.`,
    `If the search returns a relevant result, answer naturally. If ${toolName} returns no results, tell the caller you will have someone follow up with that information — never guess.`,
    `Do NOT use ${toolName} for greetings, emergencies, booking, or information already in the facts above.`,
  ].join('\n')
}
