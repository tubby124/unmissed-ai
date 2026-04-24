'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useCallLog } from '@/hooks/useCallLog'
import CallRow from '../CallRow'

const FILTERS = ['All', 'HOT', 'WARM', 'MISSED'] as const
type Filter = typeof FILTERS[number]

interface OverviewCallLogProps {
  clientId: string | null
  /** Upper bound on rows rendered on Overview (before filtering). */
  limit?: number
  /** True → no forwarding configured yet; used to show the guide CTA. */
  hasTwilioNumber: boolean
}

/**
 * D266 — Overview call log. Uses the shared `useCallLog` hook and the
 * canonical `CallRow` component that /dashboard/calls also renders, so
 * the two surfaces stay visually identical.
 */
export default function OverviewCallLog({ clientId, limit = 12, hasTwilioNumber }: OverviewCallLogProps) {
  const { calls, loading } = useCallLog(clientId, limit)
  const [filter, setFilter] = useState<Filter>('All')

  const filtered = useMemo(() => {
    return calls.filter(c => {
      if (c.call_status === 'live') return false
      if (filter === 'All') return true
      if (filter === 'MISSED') return c.call_status === 'MISSED'
      return c.call_status === filter
    }).slice(0, 5)
  }, [calls, filter])

  const totalCount = calls.filter(c => c.call_status !== 'live').length

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between gap-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Call Log</p>
          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>
            {totalCount}
          </span>
        </div>
        <Link
          href="/dashboard/calls"
          className="text-[11px] font-medium hover:opacity-75 transition-opacity shrink-0"
          style={{ color: 'var(--color-primary)' }}
        >
          View all →
        </Link>
      </div>

      {/* Filter pills */}
      <div
        role="tablist"
        aria-label="Call filter"
        className="px-4 py-2 flex items-center gap-1 border-b b-theme"
      >
        {FILTERS.map(f => {
          const active = filter === f
          return (
            <button
              key={f}
              role="tab"
              aria-pressed={active}
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/60 ${
                active ? 'bg-white/10 t1' : 'hover:bg-white/5 t3'
              }`}
              style={{ minHeight: 28 }}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-6 text-center">
          <div
            className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyCallLog filter={filter} hasTwilioNumber={hasTwilioNumber} />
      ) : (
        <div>
          {filtered.map(call => (
            <CallRow key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyCallLog({ filter, hasTwilioNumber }: { filter: Filter; hasTwilioNumber: boolean }) {
  if (filter !== 'All') {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[12px] t2 mb-1">No {filter} calls yet</p>
        <p className="text-[11px] t3">Try a different filter or wait for more calls.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-8 text-center space-y-2">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto" style={{ color: 'var(--color-text-3)' }}>
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="text-[12px] t2">
        No calls yet. Test your agent with the orb above, or forward your number to go live.
      </p>
      {hasTwilioNumber && (
        <Link
          href="/dashboard/settings?tab=general#forwarding"
          className="inline-block text-[11px] font-semibold hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          Test my agent →
        </Link>
      )}
    </div>
  )
}
