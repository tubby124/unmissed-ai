/**
 * settings-field-sync-status.ts — D449 Phase 1
 *
 * Pure helper that converts a settings PATCH outcome into per-field sync status.
 *
 * Today the settings PATCH response only has whole-PATCH `ultravox_synced`. That
 * misses the propagation-failure case where DB write succeeded but the regen
 * patcher silently no-op'd on a legacy-monolithic prompt — the most common
 * silent failure ("Brian's literal complaint").
 *
 * This helper inspects the inputs the route already collected (`updates`,
 * `slotRegenError`, `ultravox_synced`, `ultravox_error`) and produces a per-field
 * status map keyed by user-visible field name.
 *
 * Tested in isolation via `src/lib/__tests__/settings-field-sync-status.test.ts`.
 */
import { computeNeedsSync } from './settings-schema'

export type FieldSyncStatus = 'success' | 'error' | 'skipped'

export type FieldSyncReason =
  | 'legacy_prompt_patcher_noop'
  | 'ultravox_5xx'
  | 'plan_gated'
  | 'unknown'

export interface FieldSyncEntry {
  status: FieldSyncStatus
  reason?: FieldSyncReason
}

export interface BuildFieldSyncStatusArgs {
  /** The DB updates dict applied this PATCH (already includes prompt-patcher results) */
  updates: Record<string, unknown>
  /** True when slot regen ran AND succeeded — short-circuits the per-field success path */
  regenAlreadySynced: boolean
  /** True when updateAgent() succeeded (or was not needed) */
  ultravox_synced: boolean
  /** Set when updateAgent() threw — message string */
  ultravox_error?: string
  /** Set when regenerateSlots() returned an error string (typically the legacy-prompt no-op) */
  slotRegenError?: string
  /**
   * The original niche_custom_variables payload from the PATCH body, if present.
   * Used to expand the parent key into per-variable status entries (so each
   * VARIABLE NAME — e.g. `GREETING_LINE`, `AGENT_NAME` — gets its own row,
   * not just the parent `niche_custom_variables` key).
   */
  nicheCustomVariablesUpdate?: Record<string, string>
}

/**
 * Marker the legacy patcher returns when it can't find section markers in an
 * old monolithic prompt. Sourced from `src/lib/slot-regenerator.ts:371`.
 */
const LEGACY_PROMPT_PATCHER_MARKER =
  'Old-format prompt without section markers — use patchers instead of regeneration'

/**
 * Detect 5xx-class errors in an Ultravox error message. Matches the same
 * heuristic the route's retry logic uses (`isRetryableUltravoxError`).
 */
function isUltravox5xx(message: string | undefined): boolean {
  if (!message) return false
  return /\s5\d{2}\b/.test(message)
}

/**
 * Build the per-field sync status map for a settings PATCH outcome.
 *
 * Mapping rules (in evaluation order):
 * 1. If `slotRegenError` matches the legacy-prompt-no-op marker AND a
 *    regen-triggering field changed (`niche_custom_variables` or `city`), every
 *    affected field gets `error` + `legacy_prompt_patcher_noop`. For
 *    `niche_custom_variables`, each VARIABLE NAME inside the JSONB gets its own
 *    entry (callers care about `GREETING_LINE`, not the parent key).
 * 2. If `ultravox_error` is set AND the field would have triggered
 *    `needsAgentSync`, the field gets `error` + a reason classified by the
 *    error message (`ultravox_5xx` for 5xx, else `unknown`).
 * 3. Successful sync → `success`. Field changed but didn't trigger any sync
 *    path → `skipped`.
 *
 * The output is an additive overlay on the existing whole-PATCH response. Pure
 * function, no side effects, no Supabase, no Ultravox.
 */
export function buildFieldSyncStatus(
  args: BuildFieldSyncStatusArgs,
): Record<string, FieldSyncEntry> {
  const {
    updates,
    regenAlreadySynced,
    ultravox_synced,
    ultravox_error,
    slotRegenError,
    nicheCustomVariablesUpdate,
  } = args

  const out: Record<string, FieldSyncEntry> = {}

  const legacyNoOp = slotRegenError === LEGACY_PROMPT_PATCHER_MARKER
  const ultravoxFailed = !!ultravox_error
  const ultravoxReason: FieldSyncReason = isUltravox5xx(ultravox_error)
    ? 'ultravox_5xx'
    : 'unknown'

  // Per-field expansion. We iterate the keys the route actually mutated.
  for (const fieldKey of Object.keys(updates)) {
    // niche_custom_variables is a parent key — expand to per-variable entries
    // so the chip can pin to e.g. the GREETING_LINE row, not the JSON blob.
    if (fieldKey === 'niche_custom_variables') {
      const ncv = nicheCustomVariablesUpdate ?? {}
      for (const variableName of Object.keys(ncv)) {
        out[variableName] = legacyNoOp
          ? { status: 'error', reason: 'legacy_prompt_patcher_noop' }
          : ultravoxFailed
            ? { status: 'error', reason: ultravoxReason }
            : regenAlreadySynced || ultravox_synced
              ? { status: 'success' }
              : { status: 'skipped' }
      }
      continue
    }

    // city is the other field that goes through regenerateSlots — same legacy-noop handling
    if (fieldKey === 'city' && legacyNoOp) {
      out[fieldKey] = { status: 'error', reason: 'legacy_prompt_patcher_noop' }
      continue
    }

    // Everything else: if updateAgent failed AND this field would have triggered
    // a sync, surface the error. computeNeedsSync needs a single-field shape to
    // ask the per-field question.
    const wouldTriggerSync = computeNeedsSync({ [fieldKey]: updates[fieldKey] }, false)
    if (wouldTriggerSync && ultravoxFailed) {
      out[fieldKey] = { status: 'error', reason: ultravoxReason }
      continue
    }

    if (wouldTriggerSync && (regenAlreadySynced || ultravox_synced)) {
      out[fieldKey] = { status: 'success' }
      continue
    }

    // Field changed but didn't ride any sync path (DB_ONLY or PER_CALL_CONTEXT_ONLY).
    out[fieldKey] = { status: 'skipped' }
  }

  return out
}
