'use client'

import { useEffect, useState } from 'react'

interface MaintenanceRequest {
  id: string
  unit_number: string | null
  tenant_name: string | null
  caller_phone: string | null
  category: string | null
  description: string | null
  urgency_tier: string | null
  preferred_access_window: string | null
  entry_permission: boolean | null
  status: string | null
  created_at: string
  notes: string | null
}

type UrgencyFilter = 'all' | 'urgent' | 'routine'
type StatusFilter = 'all' | 'new' | 'in_progress' | 'completed'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function urgencyColor(tier: string | null): string {
  if (tier === 'urgent') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (tier === 'routine') return 'bg-blue-500/15 text-blue-400 border-blue-500/25'
  return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
}

function statusColor(status: string | null): string {
  if (status === 'new') return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
  if (status === 'in_progress') return 'bg-blue-500/15 text-blue-400 border-blue-500/25'
  if (status === 'completed') return 'bg-green-500/15 text-green-400 border-green-500/25'
  return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
      style={
        active
          ? { backgroundColor: 'var(--color-cta)', color: 'black' }
          : { color: 'var(--color-text-2)' }
      }
    >
      {label}
    </button>
  )
}

export default function MaintenanceTab() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function fetchRequests() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/dashboard/pm/maintenance-requests?${params.toString()}`)
      if (res.ok) {
        const json = await res.json() as { maintenance_requests: MaintenanceRequest[] }
        setRequests(json.maintenance_requests ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [urgencyFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/dashboard/pm/maintenance-requests?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setRequests(prev =>
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        )
      }
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold t1">Maintenance Requests</h1>
        <p className="text-[11px] t3 mt-0.5">Service requests captured by your agent</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex items-center gap-1 px-3 py-2 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <span className="text-[10px] font-semibold tracking-widest uppercase t3 mr-1">Urgency</span>
          {(['all', 'urgent', 'routine'] as UrgencyFilter[]).map(f => (
            <FilterPill
              key={f}
              label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              active={urgencyFilter === f}
              onClick={() => setUrgencyFilter(f)}
            />
          ))}
        </div>

        <div
          className="flex items-center gap-1 px-3 py-2 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <span className="text-[10px] font-semibold tracking-widest uppercase t3 mr-1">Status</span>
          {(['all', 'new', 'in_progress', 'completed'] as StatusFilter[]).map(f => (
            <FilterPill
              key={f}
              label={f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
              active={statusFilter === f}
              onClick={() => setStatusFilter(f)}
            />
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--color-surface)' }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-5">
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-20"
              style={{ background: 'var(--color-primary)', transform: 'scale(1.5)' }}
            />
            <div className="relative w-14 h-14 rounded-2xl border b-theme bg-surface flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="t3">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <p className="text-[14px] font-semibold t2 mb-1">No maintenance requests</p>
          <p className="text-[12px] t3 max-w-[240px] leading-relaxed">
            When tenants report issues through your agent, requests will appear here.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && requests.length > 0 && (
        <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
          {/* Desktop header */}
          <div
            className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-5 py-2.5 border-b b-theme"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            {['Date', 'Unit', 'Tenant', 'Category', 'Urgency', 'Status'].map(h => (
              <p key={h} className="text-[10px] font-semibold tracking-widest uppercase t3">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {requests.map((req, i) => (
            <div
              key={req.id}
              className={`px-5 py-3.5 ${i < requests.length - 1 ? 'border-b b-theme' : ''}`}
            >
              {/* Desktop row */}
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 items-center">
                <p className="text-[12px] t3 tabular-nums">{formatDate(req.created_at)}</p>
                <p className="text-[12px] t2 font-medium truncate">{req.unit_number ?? '—'}</p>
                <div className="min-w-0">
                  <p className="text-[12px] t2 font-medium truncate">{req.tenant_name ?? '—'}</p>
                  {req.caller_phone && (
                    <p className="text-[11px] t3 font-mono truncate">{req.caller_phone}</p>
                  )}
                </div>
                <p className="text-[12px] t3 truncate">{req.category ?? '—'}</p>
                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${urgencyColor(req.urgency_tier)}`}>
                  {req.urgency_tier ?? '—'}
                </span>
                <select
                  value={req.status ?? 'new'}
                  disabled={updatingId === req.id}
                  onChange={e => updateStatus(req.id, e.target.value)}
                  className="text-[11px] font-medium px-2 py-1 rounded-lg border b-theme bg-transparent t2 cursor-pointer disabled:opacity-50"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Mobile row */}
              <div className="sm:hidden space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold t1">{req.tenant_name ?? 'Unknown'}</p>
                    <p className="text-[11px] t3">Unit {req.unit_number ?? '?'} · {formatDate(req.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyColor(req.urgency_tier)}`}>
                    {req.urgency_tier ?? '—'}
                  </span>
                </div>
                {req.category && <p className="text-[12px] t3">{req.category}</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor(req.status)}`}>
                    {req.status ?? 'new'}
                  </span>
                  <select
                    value={req.status ?? 'new'}
                    disabled={updatingId === req.id}
                    onChange={e => updateStatus(req.id, e.target.value)}
                    className="text-[11px] font-medium px-2 py-1 rounded-lg border b-theme bg-transparent t2 cursor-pointer disabled:opacity-50"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
