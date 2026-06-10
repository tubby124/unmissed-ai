/**
 * niche-identity.ts — Tier-A (Identity) classifier for caller Q&A pairs.
 *
 * The agent has three tiers of knowledge:
 *   - Tier A (Identity)  — service area, hours, business model, owner name,
 *                          what we do. Should answer INSTANTLY, no bridge,
 *                          no queryKnowledge. Lives in BUSINESS FACTS block.
 *   - Tier B (Policies)  — pet rules, application steps, lease terms.
 *                          Answer with bridge phrase + queryKnowledge.
 *                          Lives in pgvector chunks.
 *   - Tier C (Out-of-scope) — unit-specific rent, listings, commission %.
 *                          Always route to {{CLOSE_PERSON}}.
 *
 * This module classifies extra_qa pairs at render-time (and later at intake-time
 * via the settings PATCH handler) so identity-tier answers can be surfaced as
 * instant-answer facts instead of being buried in the queryKnowledge corpus.
 *
 * Discovery (2026-06-03): Brian (calgary-property-leasing) had "Q: What areas
 * do you serve? A: Calgary and Edmonton, Alberta" in clients.extra_qa, embedded
 * to pgvector, and TRIAGE_DEEP told the agent to bridge + queryKnowledge for
 * "areas covered." Result: agent put the caller on hold to look up its own
 * service area. Architectural fix is to elevate identity-tier Q&A into the
 * BUSINESS FACTS block at compose time AND stop the prompt from routing
 * identity questions through queryKnowledge.
 *
 * Default behavior: unrecognized questions fall through to tier 'B' (current
 * queryKnowledge path). This is additive — never breaks an existing client.
 */

export type KnowledgeTier = 'A' | 'B' | 'C'

export type IdentityKey =
  | 'service_area'
  | 'hours'
  | 'business_model'
  | 'what_we_do'
  | 'owner_name'
  | 'how_to_contact'

export interface IdentityPattern {
  /** Stable key — used for dedupe and rendering label */
  key: IdentityKey
  /** Human-readable label for the rendered fact ("Service area: Calgary, Edmonton") */
  label: string
  /** Regex patterns matched against the lowercased question */
  patterns: RegExp[]
}

/**
 * Per-niche identity-tier patterns. Order within a niche does not matter —
 * first matching pattern wins. Niches not listed default to the
 * `_universal` fallback (lighter coverage, conservative).
 *
 * Add new niches by appending entries. Patterns are case-insensitive via
 * lowercasing the question before matching.
 */
const IDENTITY_PATTERNS: Record<string, IdentityPattern[]> = {
  _universal: [
    {
      key: 'service_area',
      label: 'Service area',
      patterns: [
        /\b(what|which)\s+(areas?|cities|regions|neighborhoods?)\b/,
        /\bwhere\s+(do\s+you|are\s+you)\s+(serve|located|based|cover|operate)\b/,
        /\bdo\s+you\s+(serve|cover|work\s+in)\b/,
        /\bwhat\s+(parts?|areas?)\s+of\b/,
        /\bservice\s+area\b/,
      ],
    },
    {
      key: 'hours',
      label: 'Hours',
      patterns: [
        /\b(what|when)\s+(are\s+your|is\s+your|time)\s+(hours|open|close)\b/,
        /\bare\s+you\s+(open|closed)\b/,
        /\bwhat\s+time\s+(do\s+you|are\s+you)\b/,
        /\bhours\s+of\s+operation\b/,
        /\bbusiness\s+hours\b/,
        /\bopen\s+(today|tomorrow|on)\b/,
      ],
    },
    {
      key: 'how_to_contact',
      label: 'How to reach us',
      patterns: [
        /\bhow\s+(can\s+I|do\s+I)\s+(reach|contact)\b/,
        /\bbest\s+(way|number)\s+to\s+(reach|contact)\b/,
      ],
    },
  ],
  property_management: [
    {
      key: 'business_model',
      label: 'Business model',
      patterns: [
        /\bhow\s+(does|do)\s+(your\s+)?(rent\s+guarantee|leasing|rental|management)\s+(program|service)\s+work\b/,
        /\bwhat\s+kind\s+of\s+(business|company)\s+(are\s+you|is\s+this)\b/,
        /\bare\s+you\s+(a\s+)?(property\s+management|leasing\s+company|landlord)\b/,
        /\bwhat\s+do\s+you\s+(actually\s+)?(do|manage|handle)\b/,
      ],
    },
    {
      key: 'what_we_do',
      label: 'Services',
      patterns: [
        /\bwhat\s+services\b/,
        /\bdo\s+you\s+(handle|manage|do)\s+(rentals|leasing|sublease|properties)\b/,
      ],
    },
    {
      key: 'owner_name',
      label: 'Owner',
      patterns: [
        /\bwho\s+(is\s+the\s+|'s\s+the\s+)?(owner|manager|in\s+charge|landlord)\b/,
        /\bwho\s+(do\s+I|should\s+I)\s+(talk|speak)\s+to\b/,
        /\bowner'?s\s+name\b/,
      ],
    },
  ],
  real_estate: [
    {
      key: 'business_model',
      label: 'Business model',
      patterns: [
        /\bwhat\s+kind\s+of\s+(realtor|agent|brokerage)\b/,
        /\bare\s+you\s+(a\s+)?(realtor|agent|brokerage)\b/,
        /\bwhat\s+brokerage\b/,
      ],
    },
    {
      key: 'what_we_do',
      label: 'Services',
      patterns: [
        /\bdo\s+you\s+(do|handle)\s+(sales|listings|rentals|commercial|residential|land)\b/,
        /\bwhat\s+(do\s+you|kind\s+of\s+properties)\s+sell\b/,
      ],
    },
  ],
  auto_glass: [
    {
      key: 'business_model',
      label: 'Business model',
      patterns: [
        /\bwhat\s+kind\s+of\s+(auto|glass|shop|business)\b/,
        /\bare\s+you\s+(an?\s+)?(auto\s+glass|windshield|glass\s+shop)\b/,
      ],
    },
    {
      key: 'what_we_do',
      label: 'Services',
      patterns: [
        /\bdo\s+you\s+(do|handle|offer)\s+(chip|repair|replacement|mobile|calibration|tint)\b/,
        /\bwhat\s+(services|repairs|work)\s+do\s+you\b/,
      ],
    },
  ],
  home_renovation: [
    {
      key: 'business_model',
      label: 'Business model',
      patterns: [
        /\bwhat\s+kind\s+of\s+(contractor|builder|renovation|construction)\b/,
        /\bare\s+you\s+(a\s+)?(contractor|builder|renovation)\b/,
      ],
    },
    {
      key: 'what_we_do',
      label: 'Services',
      patterns: [
        /\bdo\s+you\s+(do|handle|offer)\s+(kitchen|bathroom|basement|addition|new\s+build|reno|renovation)\b/,
        /\bwhat\s+(types?\s+of\s+)?projects?\s+do\s+you\s+(do|take|handle)\b/,
      ],
    },
  ],
}

/**
 * Classifies a caller Q&A pair into a knowledge tier.
 *
 * Returns 'A' (identity) when the question matches a niche-specific or
 * universal identity pattern. Returns 'B' (default — policies via
 * queryKnowledge) for any unrecognized question. Returns 'C' (out-of-scope)
 * is reserved for future extension — currently always returns 'A' or 'B'.
 *
 * Pure function. No DB. No side effects.
 *
 * @param question  The raw question text from an extra_qa pair
 * @param niche     The client's niche key (e.g. 'property_management').
 *                  Falsy values fall back to '_universal' coverage only.
 */
export function classifyQaTier(
  question: string,
  niche: string | null | undefined,
): { tier: KnowledgeTier; identityKey?: IdentityKey; label?: string } {
  if (!question || typeof question !== 'string') return { tier: 'B' }

  const q = question.toLowerCase().trim()
  if (!q) return { tier: 'B' }

  // Niche-specific patterns first (more specific wins), then universal fallback
  const nicheBucket = niche ? IDENTITY_PATTERNS[niche] || [] : []
  const universalBucket = IDENTITY_PATTERNS._universal

  for (const pat of [...nicheBucket, ...universalBucket]) {
    for (const re of pat.patterns) {
      if (re.test(q)) return { tier: 'A', identityKey: pat.key, label: pat.label }
    }
  }

  return { tier: 'B' }
}

/**
 * Extracts all identity-tier Q&A pairs from a client's extra_qa array,
 * returning an array of `{label, question, answer, key}` records suitable
 * for rendering into the BUSINESS FACTS block.
 *
 * `question` is preserved because many answers are not self-contained —
 * "Q: Do you do chip repair? A: Yes, chips smaller than a quarter." loses
 * its subject entirely if only the answer is rendered. (Bug found 2026-06-10
 * via prompt-knowledge-separation.test.ts 'extra_qa from DB are available
 * in KnowledgeSummary at call time'.)
 *
 * Deduplicates by `identityKey` — if multiple Q&A pairs match the same
 * identity key, only the first answer is kept. Empty answers are skipped.
 */
export function extractIdentityFacts(
  extraQa: Array<{ q: string; a: string }> | null | undefined,
  niche: string | null | undefined,
): Array<{ key: IdentityKey; label: string; question: string; answer: string }> {
  if (!Array.isArray(extraQa) || extraQa.length === 0) return []

  const seen = new Set<IdentityKey>()
  const out: Array<{ key: IdentityKey; label: string; question: string; answer: string }> = []

  for (const pair of extraQa) {
    if (!pair?.q || !pair?.a) continue
    const question = String(pair.q).trim()
    const answer = String(pair.a).trim()
    if (!answer) continue

    const { tier, identityKey, label } = classifyQaTier(pair.q, niche)
    if (tier !== 'A' || !identityKey || !label) continue
    if (seen.has(identityKey)) continue

    seen.add(identityKey)
    out.push({ key: identityKey, label, question, answer })
  }

  return out
}
