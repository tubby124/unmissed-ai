'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { createBrowserClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'motion/react'
import { createSoundCues } from '@/components/DemoCallVisuals'
import CallRow from './CallRow'
import EmptyState from './EmptyState'
import KanbanBoard from './KanbanBoard'
import LiveCallBanner from './LiveCallBanner'
import StatsGrid from './StatsGrid'
import MinuteUsage from './MinuteUsage'
import OutcomeCharts from './OutcomeCharts'
import DialModal from './DialModal'
import ClientSelector from './ClientSelector'
import RevenueAtRisk from './RevenueAtRisk'
import ClientHealthBar from './ClientHealthBar'
import ScopedClientLabel from './ScopedClientLabel'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  client_id?: string | null
  business_name?: string | null
  confidence?: number | null
  sentiment?: string | null
  key_topics?: string[] | null
  next_steps?: string | null
  quality_score?: number | null
  transfer_status?: string | null
}

interface ClientInfo {
  id: string
  slug: string
  business_name: string
  niche?: string | null
  status?: string | null
  twilio_number?: string | null
  seconds_used_this_month?: number | null
  monthly_minute_limit?: number | null
  bonus_minutes?: number | null
}

type Filter = 'all' | 'HOT' | 'WARM' | 'COLD' | 'JUNK' | 'UNKNOWN' | 'MISSED'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COLD', label: 'COLD' },
  { value: 'JUNK', label: 'JUNK' },
  { value: 'UNKNOWN', label: 'Unclassified' },
  { value: 'MISSED', label: 'MISSED' },
]

const STATUS_BORDER: Record<string, string> = {
  HOT:     'border-l-red-500',
  WARM:    'border-l-amber-400',
  COLD:    'border-l-blue-400',
  JUNK:    'border-l-[var(--color-border)]',
  UNKNOWN: 'border-l-[var(--color-border)]',
  MISSED:  'border-l-orange-500',
}

interface CallsListProps {
  initialCalls: CallLog[]
  phone?: string | null
  isAdmin?: boolean
  adminClients?: ClientInfo[]
  clientSlug?: string | null
  clientBusinessName?: string | null
  clientId?: string | null
  clientStatus?: string | null
  minutesUsed?: number
  minuteLimit?: number
  bonusMinutes?: number
}

function dateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

function exportCsv(calls: CallLog[]) {
  const headers = ['Date', 'Phone', 'Status', 'Service', 'Duration (s)', 'Client', 'Summary', 'Confidence', 'Sentiment', 'Key Topics', 'Next Steps', 'Quality Score']
  const rows = calls.map(c => [
    new Date(c.started_at).toISOString(),
    c.caller_phone ?? '',
    c.call_status ?? '',
    c.service_type ?? '',
    String(c.duration_seconds ?? ''),
    c.business_name ?? '',
    (c.ai_summary ?? '').replace(/"/g, '""'),
    c.confidence != null ? String(c.confidence) : '',
    c.sentiment ?? '',
    (c.key_topics ?? []).join('; '),
    (c.next_steps ?? '').replace(/"/g, '""'),
    c.quality_score != null ? String(c.quality_score) : '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function CallsListSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded bg-gray-300 dark:bg-gray-700 w-1/3" />
            <div className="h-3 rounded bg-gray-300 dark:bg-gray-700 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CallsList({ initialCalls, phone, isAdmin, adminClients = [], clientSlug, clientBusinessName, clientId, clientStatus, minutesUsed = 0, minuteLimit = 200, bonusMinutes = 0 }: CallsListProps) {
  const searchParams = useSearchParams()
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [loading, setLoading] = useState(initialCalls.length === 0)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const { selectedClientId: contextClientId, setSelectedClientId: setContextClient } = useAdminClient()
  const [clientFilter, setClientFilter] = useState<string>(() => contextClientId)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [showDial, setShowDial] = useState(false)
  const [dialPhone, setDialPhone] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const initialIds = useRef(new Set(initialCalls.map(c => c.id)))
  const supabase = createBrowserClient()
  const soundCuesRef = useRef<ReturnType<typeof createSoundCues> | null>(null)

  useEffect(() => { soundCuesRef.current = createSoundCues() }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('call_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        setCalls(prev => {
          if (prev.some(c => c.id === row.id)) return prev
          setNewIds(s => new Set(s).add(row.id))
          setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(row.id); return n }), 2000)
          return [row, ...prev]
        })
        if (row.call_status === 'live') soundCuesRef.current?.connectChime()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        setCalls(prev => prev.map(c => c.id === row.id ? { ...c, ...row } : c))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling fallback — catches Realtime misses for live/processing calls every 6s
  useEffect(() => {
    const poll = async () => {
      let q = supabase
        .from('call_logs')
        .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, client_id, transfer_status, clients(business_name)')
        .in('call_status', ['live', 'processing'])
        .order('started_at', { ascending: false })
      if (!isAdmin && clientId) q = q.eq('client_id', clientId)
      const { data } = await q

      setLoading(false)
      if (!data) return

      setCalls(prev => {
        const map = new Map(prev.map(c => [c.id, c]))
        for (const fresh of data) {
          const existing = map.get(fresh.id)
          const business_name = (fresh.clients as { business_name?: string } | null)?.business_name ?? existing?.business_name ?? null
          map.set(fresh.id, existing
            ? { ...existing, ...fresh, business_name }
            : { ...fresh, business_name }
          )
        }
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )
      })
    }

    poll()
    const id = setInterval(poll, 6000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-recover calls stuck as 'live' for >15min (webhook never fired)
  useEffect(() => {
    const stale = calls.filter(
      c => c.call_status === 'live' &&
        Date.now() - new Date(c.started_at).getTime() > 15 * 60 * 1000
    )
    stale.forEach(c => {
      fetch('/api/admin/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: c.ultravox_call_id }),
      }).catch(() => {/* already logged server-side */})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reactive stats — recompute whenever calls change
  const stats = useMemo(() => {
    const completed = calls.filter(c => ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED'].includes(c.call_status ?? ''))
    return {
      totalCalls: completed.length,
      hotLeads: completed.filter(c => c.call_status === 'HOT').length,
      activeNow: calls.filter(c => c.call_status === 'live').length,
      missedCalls: calls.filter(c => c.call_status === 'MISSED').length,
    }
  }, [calls])

  // Count per status for filter tab badges
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const c of calls) {
      if (c.call_status === 'live') continue
      counts.all = (counts.all ?? 0) + 1
      if (c.call_status) counts[c.call_status] = (counts[c.call_status] ?? 0) + 1
    }
    return counts
  }, [calls])

  const liveCalls = calls.filter(c => c.call_status === 'live')
  const processingCount = calls.filter(c => c.call_status === 'processing').length

  const filtered = useMemo(() => calls.filter(c => {
    if (c.call_status === 'live') return false
    if (c.call_status === 'processing') {
      if (filter !== 'all') return false
    } else {
      if (filter !== 'all' && c.call_status !== filter) return false
    }
    if (isAdmin && clientFilter !== 'all' && c.client_id !== clientFilter) return false
    if (dateFilter) {
      const callDate = new Date(c.started_at).toISOString().slice(0, 10)
      if (callDate !== dateFilter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const matchPhone = c.caller_phone?.includes(search) ?? false
      const matchBusiness = isAdmin ? (c.business_name?.toLowerCase().includes(q) ?? false) : false
      if (!matchPhone && !matchBusiness) return false
    }
    return true
  }), [calls, filter, clientFilter, dateFilter, search, isAdmin])

  // Date-grouped rows
  const grouped = useMemo(() => {
    const groups: { label: string; calls: CallLog[] }[] = []
    for (const call of filtered) {
      const label = dateGroupLabel(call.started_at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) {
        last.calls.push(call)
      } else {
        groups.push({ label, calls: [call] })
      }
    }
    return groups
  }, [filtered])

  const showBusiness = isAdmin && clientFilter === 'all'

  // Formatted date filter label
  const dateFilterLabel = useMemo(() => {
    if (!dateFilter) return null
    const d = new Date(dateFilter)
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }, [dateFilter])

  return (
    <div className="space-y-6">
      {/* Dial modal */}
      {showDial && isAdmin && (
        <DialModal
          clients={adminClients}
          defaultPhone={dialPhone ?? undefined}
          onClose={() => { setShowDial(false); setDialPhone(null) }}
          onDialed={(_callId, _phone) => { setShowDial(false); setDialPhone(null) }}
        />
      )}
      {showDial && !isAdmin && clientSlug && (
        <DialModal
          clients={[{ id: '', slug: clientSlug, business_name: clientBusinessName ?? clientSlug }]}
          defaultSlug={clientSlug}
          defaultPhone={dialPhone ?? undefined}
          onClose={() => { setShowDial(false); setDialPhone(null) }}
          onDialed={(_callId, _phone) => { setShowDial(false); setDialPhone(null) }}
        />
      )}

      {/* Live call banner — above everything */}
      <LiveCallBanner
        calls={liveCalls.map(c => ({
          id: c.id,
          ultravox_call_id: c.ultravox_call_id,
          caller_phone: c.caller_phone,
          started_at: c.started_at,
          business_name: c.business_name,
          transfer_status: c.transfer_status,
        }))}
      />

      {/* Setup incomplete card — shown for setup clients only */}
      <AnimatePresence>
        {!isAdmin && clientStatus === 'setup' && (
          <motion.div
            key="setup-card"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06]"
          >
            <svg className="w-5 h-5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="flex-1 text-sm text-amber-200/80">
              Your AI agent isn&apos;t live yet — complete setup to start receiving calls
            </p>
            <a
              href="/dashboard/setup"
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50 hover:text-amber-200 transition-all"
            >
              Complete Setup
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minute usage — prominent display */}
      {(() => {
        if (isAdmin && clientFilter !== 'all') {
          const sel = adminClients.find(c => c.id === clientFilter)
          if (sel) return <MinuteUsage minutesUsed={Math.ceil((sel.seconds_used_this_month ?? 0) / 60)} minuteLimit={sel.monthly_minute_limit ?? 200} bonusMinutes={sel.bonus_minutes ?? 0} />
        }
        if (!isAdmin) return <MinuteUsage minutesUsed={minutesUsed} minuteLimit={minuteLimit} bonusMinutes={bonusMinutes} />
        return null
      })()}

      {/* Stats — reactive, updates with every call change */}
      <StatsGrid
        totalCalls={stats.totalCalls}
        hotLeads={stats.hotLeads}
        missedCalls={stats.missedCalls}
        calls={calls}
      />

      {/* Outcome charts with day click */}
      <OutcomeCharts calls={calls} onDayClick={setDateFilter} selectedDay={dateFilter} />

      {/* Revenue-at-risk urgency banner */}
      <RevenueAtRisk calls={calls} />

      {/* Admin client health bar */}
      {isAdmin && <ClientHealthBar adminClients={adminClients} hotLeads={calls.filter(c => c.call_status === 'HOT').map(c => ({ client_id: c.client_id, started_at: c.started_at }))} />}

      <div>

        {/* Processing indicator */}
        <AnimatePresence>
          {processingCount > 0 && (
            <motion.div
              key="processing-bar"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}>
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-[11px] font-medium tracking-wide">
                  Classifying {processingCount} call{processingCount > 1 ? 's' : ''}…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {/* Admin client selector */}
          {isAdmin && adminClients.length > 0 && (
            <div className="px-5 py-3 flex items-center" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <ClientSelector
                clients={adminClients}
                value={clientFilter}
                onChange={(id) => { setClientFilter(id); setContextClient(id) }}
              />
            </div>
          )}

          {/* Header */}
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                Call Log
              </p>
              <ScopedClientLabel />
              <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>{filtered.length}</span>

              {/* Date filter chip */}
              <AnimatePresence>
                {dateFilterLabel && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setDateFilter(null)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    Viewing: {dateFilterLabel}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="ml-0.5">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>

              {(isAdmin || clientSlug) && (
                <button
                  onClick={() => setShowDial(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold hover:bg-[var(--color-hover)] transition-all"
                  style={{ backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.84 19.79 19.79 0 01.7 1.23a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 6.54a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Dial
                </button>
              )}

              {/* CSV export */}
              {filtered.length > 0 && (
                <button
                  onClick={() => exportCsv(filtered)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold hover:bg-[var(--color-hover)] transition-all"
                  style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  CSV
                </button>
              )}

              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 ml-auto p-0.5 rounded-lg" style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => setViewMode('list')}
                  title="List view"
                  className={`flex items-center justify-center w-7 h-6 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm dark:bg-zinc-700' : 'hover:bg-gray-100 dark:hover:bg-zinc-700/50'}`}
                  style={viewMode === 'list' ? { color: 'var(--color-text-1)' } : { color: 'var(--color-text-3)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  title="Kanban view"
                  className={`flex items-center justify-center w-7 h-6 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm dark:bg-zinc-700' : 'hover:bg-gray-100 dark:hover:bg-zinc-700/50'}`}
                  style={viewMode === 'kanban' ? { color: 'var(--color-text-1)' } : { color: 'var(--color-text-3)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="18" rx="1" stroke="currentColor" strokeWidth="2"/>
                    <rect x="14" y="3" width="7" height="11" rx="1" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder={isAdmin ? 'Search number or client…' : 'Search number…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/30 w-full sm:w-56 transition-colors"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}
              />
              <div className="flex gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {FILTERS.map(f => {
                  const count = filterCounts[f.value] ?? 0
                  return (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value)}
                      style={{ touchAction: 'manipulation' }}
                      className="relative flex-shrink-0"
                    >
                      {filter === f.value && (
                        <motion.div
                          layoutId="tab-bg"
                          className="absolute inset-0 rounded-full bg-blue-500/15 border border-blue-500/25"
                          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                        />
                      )}
                      <span
                        className={`relative flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          filter === f.value
                            ? 'text-blue-400'
                            : 'hover:text-[var(--color-text-2)]'
                        }`}
                        style={filter === f.value ? undefined : { color: 'var(--color-text-3)' }}
                      >
                        {f.label}
                        {count > 0 && (
                          <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none ${
                            filter === f.value
                              ? 'bg-blue-500/20 text-blue-400'
                              : f.value === 'HOT' ? 'bg-red-500/20 text-red-400'
                              : f.value === 'WARM' ? 'bg-amber-500/20 text-amber-400'
                              : f.value === 'COLD' ? 'bg-blue-500/20 text-blue-400'
                              : f.value === 'JUNK' ? 'bg-hover t3'
                              : 'bg-hover t3'
                          }`}>
                            {count}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Rows — kanban or date-grouped list */}
          {viewMode === 'kanban' ? (
            <div className="p-4">
              <KanbanBoard
                calls={filtered}
                showBusiness={showBusiness}
                onStatusChange={(callId, newStatus) => {
                  setCalls(prev => prev.map(c =>
                    c.id === callId ? { ...c, call_status: newStatus } : c
                  ))
                }}
              />
            </div>
          ) : loading ? (
            <div className="p-4">
              <CallsListSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState phone={phone} />
          ) : (
            <div>
              {grouped.map(group => (
                <div key={group.label}>
                  {/* Date group header */}
                  <div className="px-5 py-2" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="text-xs font-semibold tracking-[0.18em] uppercase px-2 py-0.5 rounded" style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-bg-raised)' }}>
                      {group.label}
                    </span>
                  </div>
                  <AnimatePresence>
                    {group.calls.map((call, i) => {
                      const isNew = newIds.has(call.id)
                      const isInitial = initialIds.current.has(call.id)
                      return (
                        <motion.div
                          key={call.id}
                          initial={isNew
                            ? { height: 0, opacity: 0 }
                            : isInitial
                            ? { opacity: 0, x: -6 }
                            : false
                          }
                          animate={{ height: 'auto', opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={isInitial && !isNew
                            ? { duration: 0.22, delay: Math.min(i * 0.035, 0.6), ease: 'easeOut' }
                            : { duration: 0.25, ease: 'easeOut' }
                          }
                          className={`border-l-4 ${isNew ? 'border-l-blue-500' : (STATUS_BORDER[call.call_status ?? ''] ?? 'border-l-transparent')} transition-colors`}
                        >
                          <CallRow
                            call={call}
                            showBusiness={showBusiness}
                            onCallBack={(phone) => { setDialPhone(phone); setShowDial(true) }}
                          />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
