/**
 * learning-bank-inject.ts — W3 prompt injection helpers.
 *
 * Pulls promoted patterns from the learning bank and injects a
 * `# LESSONS LEARNED` block into a freshly composed prompt.
 *
 * Gated by `LEARNING_BANK_INJECT='true'` env flag at the call site
 * (see `slot-regenerator.recomposePrompt`). This module is pure helpers
 * and contains no env reads of its own — that keeps it testable.
 *
 * Why a separate module: keeps `slot-regenerator.ts` readable and lets
 * other call sites (e.g. a future per-slot injection) reuse the same
 * fetch + render code path.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupa = any

/** Soft budget — keep prompts well under the 12K hard cap. */
export const LEARNING_BANK_PROMPT_BUDGET_CHARS = 11500

const VOICE_NATURALNESS_HEADER_RE = /^# VOICE NATURALNESS\b.*$/m
const CALLER_CONTEXT_RE = /\{\{callerContext\}\}/

/** Shape returned by the v_active_patterns_by_niche view. */
export interface ActivePatternRow {
  id: string
  name: string
  category: string
  verbatim_line: string
  rationale: string | null
  niche: string | null
  niche_applicability: string[] | null
  score: number | null
}

/**
 * Fetch promoted patterns for a niche from the v_active_patterns_by_niche view.
 *
 * Selection rule:
 *   - rows where `niche = <niche>` OR `niche = 'all'`
 *   - ordered by score desc
 *   - limited to 8
 *
 * The view is expected to expand niche_applicability into one row per niche
 * value, so the simple `in('niche', [niche, 'all'])` filter is correct.
 */
export async function fetchActivePatternsForNiche(
  supabase: AnySupa,
  niche: string | null,
): Promise<ActivePatternRow[]> {
  const filterValues = niche ? [niche, 'all'] : ['all']

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('v_active_patterns_by_niche')
    .select('id, name, category, verbatim_line, rationale, niche, niche_applicability, score')
    .in('niche', filterValues)
    .order('score', { ascending: false })
    .limit(8)

  if (error) {
    console.warn(`[learning-bank] fetchActivePatternsForNiche failed: ${error.message}`)
    return []
  }

  // Dedupe by pattern id — the view may return the same pattern twice if it
  // applies to both <niche> and 'all'. Keep the first occurrence (higher score
  // by ordering above is already preserved).
  const seen = new Set<string>()
  const out: ActivePatternRow[] = []
  for (const row of (data ?? []) as ActivePatternRow[]) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

/** Render the LESSONS LEARNED block as plain text (no leading/trailing newlines). */
function renderLearningBankBlock(patterns: ActivePatternRow[]): string {
  const bullets = patterns
    .map(p => `- ${p.verbatim_line.trim()}`)
    .filter(line => line.length > 2)
    .join('\n')
  return `# LESSONS LEARNED\n${bullets}`
}

/** Estimate the chars added when injecting (block + the surrounding blank lines). */
export function estimateLearningBankBlockChars(patterns: ActivePatternRow[]): number {
  if (patterns.length === 0) return 0
  // Block + two blank-line separators around it.
  return renderLearningBankBlock(patterns).length + 4
}

/**
 * Insert the LESSONS LEARNED block into a prompt.
 *
 * Strategy:
 *   1. Find `# VOICE NATURALNESS` header. Insert AFTER the end of that section.
 *      "End of section" = next `# ` header line, or end-of-prompt.
 *   2. If the header is missing, fall back to inserting BEFORE `{{callerContext}}`.
 *   3. If neither anchor exists, append to the end.
 */
export function injectLearningBankBlock(prompt: string, patterns: ActivePatternRow[]): string {
  if (patterns.length === 0) return prompt
  const block = renderLearningBankBlock(patterns)

  // Strategy 1 — after VOICE NATURALNESS section.
  const headerMatch = VOICE_NATURALNESS_HEADER_RE.exec(prompt)
  if (headerMatch) {
    const headerIndex = headerMatch.index
    const afterHeader = headerIndex + headerMatch[0].length

    // Look for next top-level `# ` header at start of a line. We deliberately
    // exclude `#!` style markers — only `# X` headers count.
    const rest = prompt.slice(afterHeader)
    const nextHeaderMatch = rest.match(/\n# [A-Z]/)
    let insertAt: number
    if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
      insertAt = afterHeader + nextHeaderMatch.index
    } else {
      // No next header — append at end of prompt.
      insertAt = prompt.length
    }
    const before = prompt.slice(0, insertAt).replace(/\s+$/, '')
    const after = prompt.slice(insertAt)
    return `${before}\n\n${block}\n${after}`
  }

  // Strategy 2 — before {{callerContext}} placeholder.
  const ctxMatch = CALLER_CONTEXT_RE.exec(prompt)
  if (ctxMatch && ctxMatch.index !== undefined) {
    const insertAt = ctxMatch.index
    const before = prompt.slice(0, insertAt).replace(/\s+$/, '')
    const after = prompt.slice(insertAt)
    return `${before}\n\n${block}\n\n${after}`
  }

  // Strategy 3 — append.
  return `${prompt.replace(/\s+$/, '')}\n\n${block}\n`
}
