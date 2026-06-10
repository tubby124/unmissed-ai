/**
 * Knowledge-routing test scenarios — niche-templated.
 *
 * Each scenario represents a "general policy" question the agent should answer
 * from the pgvector corpus instead of deflecting to manager callback. Used by:
 *   - audit.ts          (Layer 1 — pgvector content check)
 *   - text-grade.yaml   (Layer 2 — Haiku-graded prompt regression)
 *   - live-replay.yaml  (Layer 3 — live Ultravox + actual tool fires)
 *
 * Design rules:
 * - Scenarios are NICHE-templated, not client-specific. Brian (calgary-property-leasing)
 *   and a future Vancouver property-management client both pull from the same
 *   property_management scenario set.
 * - `mustMatchAny` is a list of substrings — pgvector chunk content OR LLM-rendered
 *   response should contain ≥1 of these. Loose enough to survive paraphrase,
 *   strict enough to fail when the agent deflects with "let me check with Brian".
 * - `mustNotMatch` catches the deflection failure mode. Add patterns the agent
 *   SHOULD NOT say when KB has an answer.
 * - `universalScenarios` apply to EVERY client regardless of niche
 *   (tool-fatigue probe, injection-in-KB-context).
 *
 * To add a niche: add a key under `nicheScenarios` with 4-8 scenarios. Anchor the
 * scenarios to questions that recur across that niche, not edge cases.
 */

export interface Scenario {
  id: string
  question: string
  mustMatchAny: string[]
  mustNotMatch?: string[]
  notes?: string
}

const propertyManagementScenarios: Scenario[] = [
  {
    id: 'areas-served',
    question: 'what areas do you serve',
    mustMatchAny: ['calgary', 'edmonton', 'service area', 'we serve'],
    mustNotMatch: ['have brian call', "i don't have", "let me check with brian"],
    notes: 'PM agents must answer service area from KB — not deflect to manager.',
  },
  {
    id: 'rent-guarantee',
    question: 'how does the rent guarantee program work',
    mustMatchAny: ['90%', 'market value', '12 month', 'guarantee'],
    mustNotMatch: ['have brian call', "i don't have"],
    notes: 'Rent-guarantee mechanics are general policy, answerable from KB.',
  },
  {
    id: 'pets-policy',
    question: 'do you allow pets in your buildings',
    mustMatchAny: ['pet', 'allowed', 'policy', 'building'],
    mustNotMatch: ['absolutely not allowed', 'we reject'],
    notes: 'Building-level pet policy is general; unit-level deflects (correct).',
  },
  {
    id: 'application-process',
    question: 'what is the application process to rent from you',
    mustMatchAny: ['application', 'credit', 'background', 'screening', 'process'],
    mustNotMatch: ['have brian call'],
    notes: 'Application process should be answerable from KB if scrape covered it.',
  },
  {
    id: 'services-offered',
    question: 'what kind of property management services do you offer',
    mustMatchAny: ['property management', 'residential', 'leasing', 'strata', 'condo'],
    notes: 'Service-offering question — core to PM business KB.',
  },
]

const realEstateScenarios: Scenario[] = [
  {
    id: 'service-area',
    question: 'what areas do you cover for buying and selling',
    mustMatchAny: ['calgary', 'saskatoon', 'area', 'cover', 'we work'],
    mustNotMatch: ["i don't have", 'let me have hasan call'],
  },
  {
    id: 'commission-structure',
    question: 'how does your commission structure work',
    mustMatchAny: ['commission', 'percent', 'structure', 'fee'],
    notes: 'Commission ranges are general info; specific quotes route to agent.',
  },
  {
    id: 'first-time-buyer',
    question: 'do you work with first-time home buyers',
    mustMatchAny: ['first-time', 'first time', 'buyer', 'help', 'work with'],
  },
  {
    id: 'showing-process',
    question: 'how do I book a showing on a listing',
    mustMatchAny: ['book', 'show', 'tour', 'arrange', 'schedule'],
  },
]

const autoGlassScenarios: Scenario[] = [
  {
    id: 'service-area',
    question: 'what areas do you service',
    mustMatchAny: ['calgary', 'edmonton', 'area', 'service', 'cover'],
    mustNotMatch: ["i don't have", 'let me have mark call'],
  },
  {
    id: 'mobile-service',
    question: 'do you do mobile windshield repair or only at the shop',
    mustMatchAny: ['mobile', 'shop', 'come to', 'on-site', 'at your'],
  },
  {
    id: 'insurance-claims',
    question: 'do you handle insurance claims for windshield replacement',
    mustMatchAny: ['insurance', 'claim', 'icbc', 'sgi', 'work with'],
  },
  {
    id: 'warranty',
    question: 'do you offer a warranty on windshield work',
    mustMatchAny: ['warranty', 'guarantee', 'cover'],
  },
]

const serviceOtherScenarios: Scenario[] = [
  {
    id: 'service-area',
    question: 'what areas do you serve',
    mustMatchAny: ['area', 'serve', 'cover', 'work in'],
  },
  {
    id: 'services-offered',
    question: 'what services do you offer',
    mustMatchAny: ['service', 'offer', 'work', 'do'],
  },
  {
    id: 'pricing-general',
    question: 'how does your pricing work for a typical job',
    mustMatchAny: ['pricing', 'cost', 'quote', 'estimate', 'depend'],
    notes: 'General pricing answer OK; specific quotes route to owner.',
  },
]

export const nicheScenarios: Record<string, Scenario[]> = {
  property_management: propertyManagementScenarios,
  real_estate: realEstateScenarios,
  auto_glass: autoGlassScenarios,
  other: serviceOtherScenarios,
  service_other: serviceOtherScenarios,
}

/**
 * Universal scenarios — applied to EVERY client regardless of niche.
 *
 * NOTE: hours/after-hours questions are intentionally NOT here. They are served
 * by per-call context (callerContextBlock) injected at call time, NOT by the
 * pgvector corpus. Asserting them in Layer 1 (pgvector check) would always fail
 * and produce a misleading suspect ranking. They belong in Layer 2 (text-grade)
 * or Layer 3 (live-replay) where the agent's context injection is exercised.
 */
export const universalScenarios: Scenario[] = []

/**
 * Canonicalize niche identifiers. The DB has drift — same niche stored as
 * both `property_management` and `property-management`, `auto_glass` and
 * `auto-glass`. Canonical form is underscore + lowercase. Without this,
 * scenariosFor() falls back to `other` and produces misleading results
 * (witnessed fleet-wide on urban-vibe and windshield-hub).
 */
export function canonicalNiche(niche: string | null | undefined): string | null {
  if (!niche) return null
  return niche.replace(/-/g, '_').toLowerCase().trim()
}

/**
 * Resolve scenarios for a given niche. Falls back to `other` if the niche has no
 * dedicated scenario set. Always appends universal scenarios.
 */
export function scenariosFor(niche: string | null | undefined): Scenario[] {
  const canonical = canonicalNiche(niche)
  const niched = (canonical && nicheScenarios[canonical]) || nicheScenarios.other
  return [...niched, ...universalScenarios]
}
