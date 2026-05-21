'use client'

/**
 * FilterStrip — client filters for the harness findings list.
 *
 * State lives in URL search params so admins can deep-link a filtered view.
 * Default status filter is 'open' (the high-signal default — resolved findings
 * are archival and noise on first load).
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import type { HarnessName, Severity } from '@/lib/harness-writer'

const HARNESSES: ReadonlyArray<HarnessName> = [
  'data-hygiene',
  'drift-check',
  'schemathesis',
  'promptfoo',
  'stripe-drift',
  'twilio-ownership',
  'prompt-injection',
]

const SEVERITIES: ReadonlyArray<Severity> = ['P0', 'P1', 'P2', 'PASS']

const STATUSES = ['open', 'resolved', 'suppressed', 'all'] as const
type StatusFilter = (typeof STATUSES)[number]

interface FilterStripProps {
  harness?: HarnessName | 'all'
  severity?: Severity | 'all'
  status?: StatusFilter
}

export default function FilterStrip({
  harness = 'all',
  severity = 'all',
  status = 'open',
}: FilterStripProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value === '' || value === 'all') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `?${qs}` : '?')
      })
    },
    [params, router],
  )

  return (
    <div
      className="rounded-2xl p-3 flex flex-wrap gap-3 items-center card-surface"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <FilterGroup label="Harness">
        <Pill active={harness === 'all'} onClick={() => setParam('harness', 'all')}>
          All
        </Pill>
        {HARNESSES.map(h => (
          <Pill key={h} active={harness === h} onClick={() => setParam('harness', h)}>
            {h}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Severity">
        <Pill active={severity === 'all'} onClick={() => setParam('severity', 'all')}>
          All
        </Pill>
        {SEVERITIES.map(s => (
          <Pill key={s} active={severity === s} onClick={() => setParam('severity', s)}>
            {s}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Status">
        {STATUSES.map(s => (
          <Pill key={s} active={status === s} onClick={() => setParam('status', s)}>
            {s}
          </Pill>
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 mr-1">
        {label}
      </span>
      {children}
    </div>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-hover)',
        color: active ? 'white' : 'var(--color-text-2)',
        border: '1px solid',
        borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
      }}
    >
      {children}
    </button>
  )
}
