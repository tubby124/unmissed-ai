'use client'

/**
 * RuntimeDriftChip — D447 Phase 1
 *
 * Small inline chip that surfaces a per-field divergence between the DB
 * value and what's actually deployed on the live Ultravox agent.
 *
 * Style is intentionally aligned with `AgentSyncBadge` (the existing
 * `last_agent_sync_status='error'` pill) — amber for warnings, with an
 * expand to show the stored DB value, and an optional CTA button.
 *
 * Props are passed through from `/api/dashboard/agent/runtime-state`'s
 * `divergence` array. The component is dumb — it does not classify, refetch,
 * or compute anything. Parent owns state.
 */

import { useState } from 'react'
import type { DivergenceEntry } from '@/lib/agent-runtime-state'

interface Props {
  divergence: DivergenceEntry
  /** Optional refresh handler — wired to the cache-bypassing `?fresh=1` path. */
  onRefresh?: () => void
}

const REASON_COPY: Record<DivergenceEntry['reason'], { label: string; tone: 'amber' | 'red' }> = {
  fake_control: {
    label: 'This field is computed — contact support',
    tone: 'red',
  },
  propagation_failure: {
    label: 'Saved but not yet live',
    tone: 'amber',
  },
  partial_failure: {
    label: "Live agent didn't accept the change",
    tone: 'amber',
  },
  medium_constraint: {
    label: 'Phone calls only',
    tone: 'amber',
  },
  plan_gated: {
    label: "Your plan doesn't include this",
    tone: 'amber',
  },
  unknown: {
    label: 'Stored and live values disagree',
    tone: 'amber',
  },
}

export default function RuntimeDriftChip({ divergence, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false)
  const copy = REASON_COPY[divergence.reason]

  // Tone palette — amber for warnings, red for hard bugs.
  const palette =
    copy.tone === 'red'
      ? {
          bg: 'rgba(239,68,68,0.10)',
          fg: 'rgb(248,113,113)',
          border: 'rgba(248,113,113,0.30)',
        }
      : {
          bg: 'rgba(245,158,11,0.10)',
          fg: 'rgb(251,191,36)',
          border: 'rgba(251,191,36,0.30)',
        }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded(o => !o)}
        aria-expanded={expanded}
        aria-label={`${copy.label} — show details`}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: palette.bg,
          color: palette.fg,
          border: `1px solid ${palette.border}`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: palette.fg }}
        />
        <span>{copy.label}</span>
        <svg
          width="9"
          height="9"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div
          className="mt-1.5 rounded-lg p-2.5 text-[11px] leading-relaxed"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-2)',
          }}
        >
          <div className="space-y-1.5">
            <div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider mr-1.5"
                style={{ color: 'var(--color-text-3)' }}
              >
                Stored
              </span>
              <span className="break-words">
                {divergence.dbValue || <em style={{ color: 'var(--color-text-3)' }}>(empty)</em>}
              </span>
            </div>
            <div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider mr-1.5"
                style={{ color: palette.fg }}
              >
                Live
              </span>
              <span className="break-words">
                {divergence.runtimeValue || <em style={{ color: 'var(--color-text-3)' }}>(empty)</em>}
              </span>
            </div>
          </div>

          {(divergence.cta || onRefresh) && (
            <div className="mt-2 flex items-center gap-2">
              {divergence.cta && divergence.cta.href !== '#' && (
                <a
                  href={divergence.cta.href}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md cursor-pointer"
                  style={{
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {divergence.cta.label}
                </a>
              )}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="text-[10px] font-medium px-2 py-1 rounded-md cursor-pointer"
                  style={{
                    color: 'var(--color-text-3)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Refresh
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
