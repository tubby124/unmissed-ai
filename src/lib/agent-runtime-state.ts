/**
 * agent-runtime-state.ts — D447 Phase 1
 *
 * Pure helpers for the Overview "runtime truth" feature. Surfaces what the
 * deployed Ultravox agent actually has loaded vs what the DB says it should
 * have. When they diverge, we render a chip explaining why.
 *
 * Why this lives separately:
 * - Pure (no Supabase, no fetch). Trivial to unit-test.
 * - Reused by `/api/dashboard/agent/runtime-state` route AND any future
 *   surface (admin drift report, settings PATCH "saved-but-not-live" chip).
 * - Mirrors normalization behavior in `lib/ultravox.ts` `stripPromptMarkers()`
 *   so the route doesn't false-positive on cosmetic whitespace/marker diffs.
 *
 * Key callers:
 * - `src/app/api/dashboard/agent/runtime-state/route.ts` — the GET endpoint
 * - `src/components/dashboard/home/AgentIdentityCard.tsx` (via the route's
 *   response) — the Greeting tile binds to `runtime.deployed.greeting`
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type DivergenceField = 'greeting' | 'voice' | 'tools' | 'systemPrompt'

export type DivergenceReason =
  | 'fake_control'
  | 'propagation_failure'
  | 'partial_failure'
  | 'medium_constraint'
  | 'plan_gated'
  | 'unknown'

export type SyncStatus = 'success' | 'error' | 'unknown'

export interface DivergenceEntry {
  field: DivergenceField
  reason: DivergenceReason
  dbValue: string
  runtimeValue: string
  cta?: { label: string; href: string }
}

export interface ClassifyDivergenceInput {
  field: DivergenceField
  db: string
  runtime: string
  syncStatus: SyncStatus
  /**
   * Optional hint: was this field marked `editable:false` in the variable
   * registry at the moment the DB was written? If yes and the values still
   * disagree, that's a `fake_control` bug per [[Tracker/D443]].
   */
  registryEditable?: boolean
  /**
   * Optional hint: is this capability gated by the client's current plan?
   * Used to classify tool divergence as `plan_gated` vs `partial_failure`.
   */
  planGated?: boolean
  /**
   * Optional hint: does the capability require PSTN (transfer/IVR)? If yes
   * and the WebRTC test path is what's in use, this is a `medium_constraint`,
   * not a real divergence.
   */
  mediumConstraint?: boolean
}

// ── Greeting extraction ──────────────────────────────────────────────────────

/**
 * Pull the greeting line out of a deployed Ultravox prompt.
 *
 * Three fallback strategies, in order of preference:
 *   1. `<!-- unmissed:identity -->` slot marker — slot pipeline (D274+).
 *      Identity slot contains the spoken-name + business intro. NOT the
 *      greeting line itself, but it's the closest stable marker.
 *   2. `## 1. GREETING` heading inside `<!-- unmissed:conversation_flow -->`
 *      — the actual greeting body (a quoted utterance).
 *   3. First non-empty quoted sentence — last-ditch for legacy/snowflake
 *      prompts with hand-edited section names.
 *
 * Returns `null` when nothing usable is found. Caller should render a
 * "Greeting on file" placeholder rather than garbage.
 *
 * NOTE: deployed prompts have `stripPromptMarkers()` applied by `updateAgent()`
 * before being PATCHed to Ultravox. So the markers are GONE on the runtime
 * side. We extract from the section *contents*, not the markers themselves —
 * which means strategy 2 (the `## 1. GREETING` heading) is what hits in
 * practice when reading from the deployed prompt.
 */
export function extractGreetingFromPrompt(prompt: string): string | null {
  if (!prompt || typeof prompt !== 'string') return null

  // Strategy 1: slot marker (DB side has this; runtime side has it stripped)
  // Look for content between <!-- unmissed:identity --> markers when present.
  const identityMatch = prompt.match(
    /<!--\s*unmissed:identity\s*-->([\s\S]*?)<!--\s*\/unmissed:identity\s*-->/i,
  )
  if (identityMatch) {
    const body = identityMatch[1].trim()
    // Identity block describes WHO the agent is. The greeting body is in
    // conversation_flow. So fall through unless we find a quoted line here
    // (some niches inline the greeting in identity).
    const quoted = body.match(/"([^"]{3,})"/)
    if (quoted) return quoted[1].trim()
  }

  // Strategy 2: `## 1. GREETING` heading (slot pipeline + most legacy prompts)
  // Headings vary: `## 1. GREETING`, `## GREETING`, `# GREETING`, `## OPENING`.
  const greetingHeadingMatch = prompt.match(
    /(?:^|\n)#{1,3}\s*(?:\d+\.\s*)?(?:GREETING|OPENING)\s*\n+([\s\S]*?)(?:\n#{1,3}\s|\n<!--|$)/i,
  )
  if (greetingHeadingMatch) {
    const body = greetingHeadingMatch[1].trim()
    // Prefer a quoted utterance if present
    const quoted = body.match(/"([^"]{3,})"/)
    if (quoted) return quoted[1].trim()
    // Otherwise, the first non-empty paragraph
    const firstPara = body.split(/\n\s*\n/).find(p => p.trim().length > 0)
    if (firstPara) {
      const cleaned = firstPara.trim().replace(/^["']|["']$/g, '')
      if (cleaned.length > 0) return cleaned
    }
  }

  // Strategy 3: first non-empty quoted sentence anywhere in the prompt.
  // Last-ditch for hand-rolled prompts with no recognizable section structure.
  const firstQuoted = prompt.match(/"([^"\n]{10,})"/)
  if (firstQuoted) return firstQuoted[1].trim()

  return null
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a string for divergence comparison.
 *
 * Mirrors `stripPromptMarkers()` in `src/lib/ultravox.ts` plus whitespace
 * collapse — so a DB prompt with markers and a runtime prompt without them
 * compare equal when their meaningful content matches.
 *
 * Preserves `{{templateContext}}` placeholders. Those resolve at call time
 * and SHOULD appear in both DB + runtime — divergence in placeholder presence
 * is real divergence (e.g., `{{businessFacts}}` got lost during a malformed
 * `updateAgent()` call).
 *
 * Idempotent: `normalize(normalize(x)) === normalize(x)` for all inputs.
 */
export function normalizeForCompare(s: string): string {
  if (!s || typeof s !== 'string') return ''
  return s
    // Strip section markers — same regex as stripPromptMarkers()
    .replace(/<!--\s*unmissed:\w+\s*-->\n?/g, '')
    .replace(/<!--\s*\/unmissed:\w+\s*-->\n?/g, '')
    // Collapse runs of whitespace within lines
    .replace(/[ \t]+/g, ' ')
    // Collapse 3+ newlines down to 2 (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace
    .trim()
}

// ── Divergence classifier ────────────────────────────────────────────────────

/**
 * Classify *why* DB and runtime disagree on a specific field.
 *
 * Pure function. The route layer is responsible for gathering the inputs
 * (DB row, Ultravox response, sync status, plan, registry meta). This
 * function decides the human-meaningful reason — which is what makes the
 * UI chip useful instead of just noise.
 *
 * Mapping (per Tracker/D447 §"Divergence reason classification"):
 *
 * | reason                | trigger                                                 |
 * | --------------------- | ------------------------------------------------------- |
 * | `fake_control`        | Field is registry-readonly but values still differ      |
 * | `propagation_failure` | `syncStatus='error'` (last `updateAgent()` failed)      |
 * | `partial_failure`     | sync succeeded but runtime still doesn't reflect DB     |
 * | `medium_constraint`   | tool requires PSTN — explained by call medium, not drift|
 * | `plan_gated`          | DB has flag on, runtime missing because plan excludes it|
 * | `unknown`             | catch-all                                               |
 *
 * Returns `null` when there is no divergence (db === runtime after normalize).
 * That's the happy path — caller does not render a chip.
 */
export function classifyDivergence(
  input: ClassifyDivergenceInput,
): DivergenceEntry | null {
  const dbNorm = normalizeForCompare(input.db)
  const runtimeNorm = normalizeForCompare(input.runtime)
  if (dbNorm === runtimeNorm) return null

  // Determine the reason. Order matters — most specific first.

  // 1. Registry-readonly field that still managed to drift = bug per D443.
  if (input.registryEditable === false) {
    return {
      field: input.field,
      reason: 'fake_control',
      dbValue: input.db,
      runtimeValue: input.runtime,
    }
  }

  // 2. Medium constraint — not really drift, just a UI-truth nuance.
  if (input.mediumConstraint === true) {
    return {
      field: input.field,
      reason: 'medium_constraint',
      dbValue: input.db,
      runtimeValue: input.runtime,
    }
  }

  // 3. Plan gating — DB has the capability on, but the plan strips it from
  //    the deployed tool list. Owner-actionable: upgrade.
  if (input.planGated === true) {
    return {
      field: input.field,
      reason: 'plan_gated',
      dbValue: input.db,
      runtimeValue: input.runtime,
      cta: { label: 'Upgrade plan', href: '/dashboard/billing' },
    }
  }

  // 4. Last sync errored — most likely cause of greeting/prompt drift on
  //    snowflake clients. Owner-actionable: migrate prompt.
  if (input.syncStatus === 'error') {
    return {
      field: input.field,
      reason: 'propagation_failure',
      dbValue: input.db,
      runtimeValue: input.runtime,
      cta: { label: 'Retry sync', href: '/dashboard/settings?tab=general' },
    }
  }

  // 5. Sync said success but runtime doesn't match — partial_failure.
  if (input.syncStatus === 'success') {
    return {
      field: input.field,
      reason: 'partial_failure',
      dbValue: input.db,
      runtimeValue: input.runtime,
      cta: { label: 'Refresh', href: '#' },
    }
  }

  // 6. Catch-all (syncStatus === 'unknown' and no other hint).
  return {
    field: input.field,
    reason: 'unknown',
    dbValue: input.db,
    runtimeValue: input.runtime,
    cta: { label: 'Refresh', href: '#' },
  }
}

// ── In-memory LRU cache with single-flight ───────────────────────────────────

/**
 * Per-clientId LRU cache for runtime-state lookups.
 *
 * Why this exists:
 * - Each Overview page mount triggers a GET against Ultravox. With 5+ owner
 *   sessions × N tabs × M re-mounts/min, that's an unbounded multiplier on
 *   our Ultravox API quota.
 * - The values are stable on a 60s timescale (greeting changes when settings
 *   PATCH fires + needsAgentSync triggers — bursty events, not steady-state).
 *
 * Behavior:
 * - 60s TTL (`CACHE_TTL_MS`). Entry past TTL is treated as a miss.
 * - Max 50 entries (`CACHE_MAX_ENTRIES`). FIFO eviction — small enough that
 *   LRU vs FIFO doesn't matter, and FIFO is simpler.
 * - Single-flight per clientId: if a fetch is already in-flight, concurrent
 *   callers wait on the same Promise instead of starting a second upstream
 *   call. Prevents the thundering-herd on cold cache.
 *
 * Caveat: this is a per-process cache. Railway containers don't share memory.
 * On a multi-replica deploy each replica caches independently — that's fine,
 * we just want a constant-bounded API budget per replica per minute, not a
 * globally-shared cache.
 *
 * Test seam: `_resetRuntimeStateCache()` clears entries between tests.
 */

const CACHE_TTL_MS = 60_000
const CACHE_MAX_ENTRIES = 50

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

// Module-scoped singletons. Per-process, intentional — see caveat above.
const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

export async function withRuntimeStateCache<T>(
  clientId: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const entry = cache.get(clientId) as CacheEntry<T> | undefined

  if (entry && entry.expiresAt > now) {
    return entry.value
  }

  // Single-flight: if a fetch is already running for this clientId, queue
  // behind it instead of kicking off a second upstream call.
  const pending = inFlight.get(clientId) as Promise<T> | undefined
  if (pending) return pending

  const promise = (async () => {
    try {
      const value = await fetcher()
      // FIFO eviction when at capacity. Map preserves insertion order.
      if (cache.size >= CACHE_MAX_ENTRIES) {
        const firstKey = cache.keys().next().value
        if (firstKey !== undefined) cache.delete(firstKey)
      }
      cache.set(clientId, { value, expiresAt: Date.now() + CACHE_TTL_MS })
      return value
    } finally {
      inFlight.delete(clientId)
    }
  })()

  inFlight.set(clientId, promise)
  return promise
}

/** Test-only: reset cache + in-flight maps between assertions. */
export function _resetRuntimeStateCache(): void {
  cache.clear()
  inFlight.clear()
}
