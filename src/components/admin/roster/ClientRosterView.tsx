'use client'

/**
 * ClientRosterView — admin Mission Control client roster.
 *
 * Fetches GET /api/admin/clients-roster (single source of truth — same route
 * that Pause/Resume PATCHes against), renders header stat tiles + the roster
 * as a table on desktop / stacked cards on mobile.
 *
 * Default filter hides status='paused' (toggle reveals). Sort: active first,
 * then last_call_at desc.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RosterClient, RosterStats } from '@/app/api/admin/clients-roster/route'
import RosterRow from './RosterRow'

const TRIAL_SOON_DAYS = 5

function statusRank(c: RosterClient): number {
  return c.status === 'active' ? 0 : c.status === 'paused' ? 2 : 1
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div
      className="rounded-xl p-3 flex-1 min-w-[150px]"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: accent ?? 'var(--color-text-3)' }}>
        {label}
      </div>
      <div className="text-[20px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--color-text-1)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{sub}</div>
      )}
    </div>
  )
}

export default function ClientRosterView() {
  const [clients, setClients] = useState<RosterClient[]>([])
  const [stats, setStats] = useState<RosterStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPaused, setShowPaused] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients-roster', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Roster fetch failed (${res.status})`)
      const json = await res.json()
      setClients(json.clients ?? [])
      setStats(json.stats ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const onPauseResume = useCallback(async (client: RosterClient, action: 'pause' | 'resume') => {
    if (action === 'pause') {
      const ok = window.confirm(
        `Pause ${client.business_name ?? client.slug}? The client row is set to status='paused' and it drops out of the default roster view.`
      )
      if (!ok) return
    }
    setMutatingId(client.id)
    try {
      const res = await fetch('/api/admin/clients-roster', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, action }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? `${action} failed (${res.status})`)
      }
      await load() // re-fetch so the roster + header stats reflect DB truth, not optimistic state
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`)
    } finally {
      setMutatingId(null)
    }
  }, [load])

  const visible = useMemo(() => {
    const filtered = showPaused ? clients : clients.filter(c => c.status !== 'paused')
    return [...filtered].sort((a, b) => {
      const rank = statusRank(a) - statusRank(b)
      if (rank !== 0) return rank
      const aT = a.last_call_at ? new Date(a.last_call_at).getTime() : 0
      const bT = b.last_call_at ? new Date(b.last_call_at).getTime() : 0
      return bT - aT
    })
  }, [clients, showPaused])

  const trialsExpiringSoon = useMemo(() => {
    const cutoff = Date.now() + TRIAL_SOON_DAYS * 24 * 60 * 60 * 1000
    return clients.filter(c =>
      c.subscription_status === 'trialing' &&
      c.trial_expires_at &&
      new Date(c.trial_expires_at).getTime() <= cutoff &&
      new Date(c.trial_expires_at).getTime() > Date.now()
    ).length
  }, [clients])

  const pausedCount = clients.filter(c => c.status === 'paused').length

  if (loading) {
    return (
      <div className="rounded-xl p-6 text-center text-[13px]"
        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}>
        Loading roster…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl p-3 text-[12px]"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'rgb(248,113,113)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <StatTile
          label="MRR"
          value={`$${(stats?.mrr ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
          sub="active · paying"
          accent="rgb(74,222,128)"
        />
        <StatTile label="Active" value={String(stats?.active_count ?? 0)} accent="rgb(129,140,248)" />
        <StatTile
          label="Trials expiring"
          value={String(trialsExpiringSoon)}
          sub={`within ${TRIAL_SOON_DAYS} days`}
          accent="rgb(56,189,248)"
        />
        <StatTile
          label="Stale"
          value={String(stats?.stale.length ?? 0)}
          sub={`active, no calls in 21d`}
          accent="rgb(251,191,36)"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
          {visible.length} client{visible.length === 1 ? '' : 's'}
        </span>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none" style={{ color: 'var(--color-text-2)' }}>
          <input
            type="checkbox"
            checked={showPaused}
            onChange={e => setShowPaused(e.target.checked)}
          />
          Show archived/paused ({pausedCount})
        </label>
      </div>

      {/* Desktop header row */}
      <div className="space-y-1">
        <div
          className="hidden lg:grid gap-3 px-3 py-1 text-[10px] uppercase tracking-wider font-medium"
          style={{ gridTemplateColumns: 'minmax(180px,2fr) 1fr 1.2fr 0.6fr 0.9fr 1fr 0.6fr 1.2fr', color: 'var(--color-text-3)' }}
        >
          <span>Client</span>
          <span>Plan</span>
          <span>Billing</span>
          <span>Calls 7d</span>
          <span>Last call</span>
          <span>Minutes</span>
          <span>Telegram</span>
          <span className="text-right">Actions</span>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl p-6 text-center text-[13px]"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}>
            No clients match the current filter.
          </div>
        ) : (
          visible.map(c => (
            <RosterRow
              key={c.id}
              client={c}
              mutating={mutatingId === c.id}
              onPauseResume={onPauseResume}
            />
          ))
        )}
      </div>
    </div>
  )
}
