'use client'

/**
 * SyncStatusChip — D449 Phase 1
 *
 * Per-field "Saved, but not yet live on your agent" chip. Surfaces propagation
 * failures the moment a settings PATCH succeeds in DB but doesn't reach the
 * live Ultravox agent (most commonly the legacy-monolithic prompt + slot regen
 * no-op path that's the root cause of "I edited the greeting and the agent
 * still says the old one").
 *
 * Today the only signal owners get for this is the page-level legacy-prompt
 * banner from D369 — too coarse, easy to miss. This chip pins to the specific
 * field that didn't propagate.
 *
 * Palette is intentionally aligned with `RuntimeDriftChip` (D447) so both chips
 * read as a family on the dashboard.
 *
 * Props:
 *   status — 'success' renders nothing; 'error' renders the amber chip;
 *            'skipped' renders a neutral gray pill.
 *   reason — drives the inline copy for the expanded "Why?" panel.
 *   onRetry — called when the Retry button is clicked. Caller owns retry budget
 *             (the hook in usePatchSettings caps to 3 per page-load per field).
 *   retryDisabled — when true, Retry button is disabled (e.g. budget exhausted).
 */

import { useState } from 'react'

export type SyncStatusChipStatus = 'success' | 'error' | 'skipped'

export type SyncStatusChipReason =
  | 'legacy_prompt_patcher_noop'
  | 'ultravox_5xx'
  | 'plan_gated'
  | 'unknown'

interface Props {
  status: SyncStatusChipStatus
  reason?: SyncStatusChipReason
  onRetry?: () => Promise<void> | void
  retryDisabled?: boolean
}

/**
 * Inline copy per reason. Mirrors the mapping in
 * CALLINGAGENTS/Tracker/D449.md lines 45-49.
 */
const REASON_COPY: Record<SyncStatusChipReason, string> = {
  legacy_prompt_patcher_noop:
    'Your prompt format is legacy — the new value was saved but the live prompt has no section markers to update. Migrate your prompt to refresh.',
  ultravox_5xx:
    'Ultravox was temporarily unavailable when we tried to push this change. Retry to push again.',
  plan_gated:
    "Your plan doesn't include this capability. Upgrade to push it live.",
  unknown:
    'Saved to your account, but not yet live on your agent. Retry to push it again.',
}

const AMBER = {
  bg: 'rgba(245,158,11,0.10)',
  fg: 'rgb(251,191,36)',
  border: 'rgba(251,191,36,0.30)',
}

const NEUTRAL = {
  bg: 'var(--color-hover)',
  fg: 'var(--color-text-3)',
  border: 'var(--color-border)',
}

export default function SyncStatusChip({
  status,
  reason,
  onRetry,
  retryDisabled,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // success → render nothing. The chip exists to flag failure.
  if (status === 'success') return null

  if (status === 'skipped') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: NEUTRAL.bg,
          color: NEUTRAL.fg,
          border: `1px solid ${NEUTRAL.border}`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: NEUTRAL.fg }}
        />
        Field not propagated this save.
      </span>
    )
  }

  // status === 'error'
  const r: SyncStatusChipReason = reason ?? 'unknown'
  const copy = REASON_COPY[r]

  async function handleRetry() {
    if (!onRetry || retryDisabled || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mt-1.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: AMBER.bg,
          color: AMBER.fg,
          border: `1px solid ${AMBER.border}`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: AMBER.fg }}
        />
        <span>Saved, but not yet live on your agent.</span>
        <button
          type="button"
          onClick={() => setExpanded(o => !o)}
          aria-expanded={expanded}
          className="font-semibold underline-offset-2 hover:underline cursor-pointer"
          style={{ color: AMBER.fg }}
        >
          Why?
        </button>
        {onRetry && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retryDisabled || retrying}
              className="font-semibold underline-offset-2 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: AMBER.fg }}
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          </>
        )}
      </span>

      {expanded && (
        <div
          className="mt-1.5 rounded-lg p-2.5 text-[11px] leading-relaxed"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-2)',
          }}
        >
          {copy}
        </div>
      )}
    </div>
  )
}
