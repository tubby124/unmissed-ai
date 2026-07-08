'use client'

/**
 * RosterRow — one client in the Mission Control roster.
 * Grid row on desktop (lg+), stacked card on mobile.
 */

import Link from 'next/link'
import type { RosterClient } from '@/app/api/admin/clients-roster/route'
import { timeAgo } from '@/lib/settings-utils'
import { billingBadge, minutesPct } from '@/lib/roster-billing'

export default function RosterRow({
  client: c,
  mutating,
  onPauseResume,
}: {
  client: RosterClient
  mutating: boolean
  onPauseResume: (client: RosterClient, action: 'pause' | 'resume') => void
}) {
  const badge = billingBadge(c)
  const pct = minutesPct(c.minutes_used_this_month, c.monthly_minute_limit)
  const pctWarn = pct !== null && pct > 80
  const paused = c.status === 'paused'
  const rate = c.effective_monthly_rate ?? 0

  const clientCell = (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {c.is_stale && (
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: 'rgb(251,191,36)' }}
            title={`Stale — no calls in ${c.last_call_at ? timeAgo(c.last_call_at) : 'ever'} (21d threshold)`}
          />
        )}
        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
          {c.business_name ?? c.slug}
        </span>
      </div>
      <div className="text-[11px] truncate" style={{ color: 'var(--color-text-3)' }}>
        {c.slug}{c.agent_name ? ` · ${c.agent_name}` : ''}
      </div>
    </div>
  )

  const planCell = (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium w-fit"
      style={{ backgroundColor: 'var(--color-surface-2, rgba(148,163,184,0.08))', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}
    >
      {c.selected_plan ?? '—'}
      <span className="tabular-nums" style={{ color: rate > 0 ? 'rgb(74,222,128)' : 'var(--color-text-3)' }}>
        ${rate}/mo
      </span>
    </span>
  )

  const billingCell = (
    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: badge.color }}>
      <span aria-hidden>{badge.dot}</span>
      {badge.label}
      {badge.detail && (
        <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>· {badge.detail}</span>
      )}
    </span>
  )

  const minutesCell = pct === null ? (
    <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>—</span>
  ) : (
    <span
      className="text-[12px] tabular-nums"
      style={{ color: pctWarn ? 'rgb(251,191,36)' : 'var(--color-text-2)' }}
      title={`${c.minutes_used_this_month ?? 0} / ${c.monthly_minute_limit} min`}
    >
      {pct}%
    </span>
  )

  const telegramCell = (
    <span className="text-[12px]" style={{ color: c.telegram_linked ? 'rgb(74,222,128)' : 'var(--color-text-3)' }}>
      {c.telegram_linked ? '✓' : '✗'}
    </span>
  )

  const actionsCell = (
    <div className="flex items-center gap-2 lg:justify-end">
      <Link
        href={`/dashboard/calls?client_id=${c.id}`}
        className="rounded-md px-2 py-1 text-[11px] font-medium"
        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}
      >
        Calls
      </Link>
      <button
        type="button"
        disabled={mutating}
        onClick={() => onPauseResume(c, paused ? 'resume' : 'pause')}
        className="rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50"
        style={{
          border: '1px solid var(--color-border)',
          color: paused ? 'rgb(74,222,128)' : 'rgb(248,113,113)',
        }}
      >
        {mutating ? '…' : paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  )

  return (
    <div
      className="rounded-xl px-3 py-2.5 lg:py-2"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        opacity: paused ? 0.6 : 1,
      }}
    >
      {/* Desktop grid row */}
      <div
        className="hidden lg:grid gap-3 items-center"
        style={{ gridTemplateColumns: 'minmax(180px,2fr) 1fr 1.2fr 0.6fr 0.9fr 1fr 0.6fr 1.2fr' }}
      >
        {clientCell}
        <div>{planCell}</div>
        <div>{billingCell}</div>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--color-text-2)' }}>{c.calls_7d}</span>
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>{timeAgo(c.last_call_at)}</span>
        <div>{minutesCell}</div>
        <div>{telegramCell}</div>
        {actionsCell}
      </div>

      {/* Mobile stacked card */}
      <div className="lg:hidden space-y-2">
        <div className="flex items-start justify-between gap-2">
          {clientCell}
          {billingCell}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: 'var(--color-text-2)' }}>
          {planCell}
          <span className="tabular-nums">{c.calls_7d} calls 7d</span>
          <span style={{ color: 'var(--color-text-3)' }}>{timeAgo(c.last_call_at)}</span>
          <span className="inline-flex items-center gap-1">min {minutesCell}</span>
          <span className="inline-flex items-center gap-1">tg {telegramCell}</span>
        </div>
        {actionsCell}
      </div>
    </div>
  )
}
