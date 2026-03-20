/**
 * knowledge-extractor.ts — Normalizes and caps scraped website data
 * for storage in the Supabase `clients` table.
 *
 * Pure function module — no API calls, no side effects.
 * Takes raw Sonar output and shapes it into storage-ready format.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

export const MAX_BUSINESS_FACTS = 12
export const MIN_BUSINESS_FACTS = 8
export const MAX_EXTRA_QA = 8
export const MIN_EXTRA_QA = 6
export const MAX_FACT_LENGTH = 150

/** Claims containing these terms are filtered out unless clearly safe.
 *  Dollar amounts ($\d+) intentionally NOT filtered — they are factual business knowledge.
 *  Warranty/warranties intentionally NOT filtered — factual product info clients want agents to know.
 *  Only the legal verb form "we warrant" is filtered (risky legal language). */
const UNSAFE_CLAIM_PATTERNS: RegExp[] = [
  /\bguarantee[sd]?\b/i,
  /\bpromise[sd]?\b/i,
  /\bwe\s+warrant\b/i,
]

// ── Types ──────────────────────────────────────────────────────────────────────

export type NormalizedKnowledge = {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
  warnings: string[]
}

export type NormalizationStats = {
  preFilterFacts: number
  postFilterFacts: number
  preFilterQa: number
  postFilterQa: number
  removedFacts: string[]
  removedQa: { q: string; a: string }[]
}

export type NormalizationResult = {
  result: NormalizedKnowledge
  stats: NormalizationStats
}

// ── Safety Filtering ─────────────────────────────────────────────────────────

function containsUnsafeClaim(text: string): boolean {
  return UNSAFE_CLAIM_PATTERNS.some(pattern => pattern.test(text))
}

function filterUnsafeFacts(facts: string[]): { safe: string[]; removed: string[] } {
  const safe: string[] = []
  const removed: string[] = []
  for (const fact of facts) {
    if (containsUnsafeClaim(fact)) {
      removed.push(fact)
    } else {
      safe.push(fact)
    }
  }
  return { safe, removed }
}

function filterUnsafeQa(
  qa: { q: string; a: string }[]
): { safe: { q: string; a: string }[]; removed: { q: string; a: string }[] } {
  const safe: { q: string; a: string }[] = []
  const removed: { q: string; a: string }[] = []
  for (const pair of qa) {
    if (containsUnsafeClaim(pair.q) || containsUnsafeClaim(pair.a)) {
      removed.push(pair)
    } else {
      safe.push(pair)
    }
  }
  return { safe, removed }
}

// ── Truncation ──────────────────────────────────────────────────────────────────

function truncateFact(fact: string): string {
  if (fact.length <= MAX_FACT_LENGTH) return fact
  return fact.slice(0, MAX_FACT_LENGTH - 3).trimEnd() + '...'
}

// ── Deduplication ───────────────────────────────────────────────────────────────

function deduplicateFacts(facts: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const fact of facts) {
    const key = fact.toLowerCase().trim()
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key)
      result.push(fact)
    }
  }
  return result
}

function deduplicateQa(qa: { q: string; a: string }[]): { q: string; a: string }[] {
  const seen = new Set<string>()
  const result: { q: string; a: string }[] = []
  for (const pair of qa) {
    const key = pair.q.toLowerCase().trim()
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key)
      result.push(pair)
    }
  }
  return result
}

// ── Core Functions ──────────────────────────────────────────────────────────────

/**
 * Normalize and cap scraped website data.
 * Pure function — no API calls, no side effects.
 * Returns both the normalized result and extraction stats for UI/logging.
 */
export function normalizeExtraction(
  rawFacts: string[],
  rawQa: { q: string; a: string }[],
  rawServiceTags: string[],
  rawWarnings: string[],
): NormalizationResult {
  const warnings: string[] = [...rawWarnings]

  // 1. Trim all inputs
  const trimmedFacts = rawFacts
    .map(f => f.trim())
    .filter(f => f.length > 0)
  const trimmedQa = rawQa
    .filter(p => p.q?.trim() && p.a?.trim())
    .map(p => ({ q: p.q.trim(), a: p.a.trim() }))
  const trimmedTags = rawServiceTags
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0)

  const preFilterFacts = trimmedFacts.length
  const preFilterQa = trimmedQa.length

  // 2. Safety filter — remove unsafe claims
  const { safe: safeFacts, removed: removedFacts } = filterUnsafeFacts(trimmedFacts)
  const { safe: safeQa, removed: removedQa } = filterUnsafeQa(trimmedQa)

  if (removedFacts.length > 0) {
    warnings.push(`Removed ${removedFacts.length} fact(s) with unsafe claims: ${removedFacts.map(f => `"${truncateFact(f)}"`).join(', ')}`)
  }
  if (removedQa.length > 0) {
    warnings.push(`Removed ${removedQa.length} Q&A pair(s) with unsafe claims`)
  }

  // 3. Deduplicate
  const uniqueFacts = deduplicateFacts(safeFacts)
  const uniqueQa = deduplicateQa(safeQa)
  const uniqueTags = Array.from(new Set(trimmedTags))

  // 4. Truncate facts
  const truncatedFacts = uniqueFacts.map(truncateFact)

  // 5. Cap at limits
  const cappedFacts = truncatedFacts.slice(0, MAX_BUSINESS_FACTS)
  const cappedQa = uniqueQa.slice(0, MAX_EXTRA_QA)

  // 6. Warn if below minimums
  if (cappedFacts.length < MIN_BUSINESS_FACTS) {
    warnings.push(`Only ${cappedFacts.length} business facts extracted (minimum recommended: ${MIN_BUSINESS_FACTS})`)
  }
  if (cappedQa.length < MIN_EXTRA_QA) {
    warnings.push(`Only ${cappedQa.length} Q&A pairs extracted (minimum recommended: ${MIN_EXTRA_QA})`)
  }

  return {
    result: {
      businessFacts: cappedFacts,
      extraQa: cappedQa,
      serviceTags: uniqueTags,
      warnings,
    },
    stats: {
      preFilterFacts,
      postFilterFacts: cappedFacts.length,
      preFilterQa,
      postFilterQa: cappedQa.length,
      removedFacts,
      removedQa,
    },
  }
}

/**
 * Merge website-derived facts with existing manual facts.
 * Manual facts take priority — website facts are only added if non-duplicate.
 * Returns the merged set.
 */
export function mergeWithExisting(
  websiteFacts: string[],
  websiteQa: { q: string; a: string }[],
  existingFacts: string | null,
  existingQa: { q: string; a: string }[],
): { mergedFacts: string; mergedQa: { q: string; a: string }[] } {
  // Parse existing facts by splitting on newlines
  const existingFactLines = (existingFacts ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  // Build a set of existing fact keys for dedup (lowercase trimmed)
  const existingFactKeys = new Set(
    existingFactLines.map(f => f.toLowerCase().trim())
  )

  // Add website facts AFTER existing manual facts (manual = higher priority)
  const mergedFactLines = [...existingFactLines]
  for (const fact of websiteFacts) {
    const key = fact.toLowerCase().trim()
    if (!existingFactKeys.has(key)) {
      existingFactKeys.add(key)
      mergedFactLines.push(fact)
    }
  }

  // Cap merged facts
  const cappedMergedFacts = mergedFactLines.slice(0, MAX_BUSINESS_FACTS)

  // For QA: compare question text (lowercase trim) for dedup
  const existingQaKeys = new Set(
    existingQa.map(p => p.q.toLowerCase().trim())
  )

  const mergedQa = [...existingQa]
  for (const pair of websiteQa) {
    const key = pair.q.toLowerCase().trim()
    if (!existingQaKeys.has(key)) {
      existingQaKeys.add(key)
      mergedQa.push(pair)
    }
  }

  // Cap merged QA
  const cappedMergedQa = mergedQa.slice(0, MAX_EXTRA_QA)

  return {
    mergedFacts: cappedMergedFacts.join('\n'),
    mergedQa: cappedMergedQa,
  }
}
