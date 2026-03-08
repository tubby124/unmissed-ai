'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'motion/react'
import CallRow from './CallRow'
import EmptyState from './EmptyState'
import LiveCallBanner from './LiveCallBanner'
import StatsGrid from './StatsGrid'
import OutcomeCharts from './OutcomeCharts'
import DialModal from './DialModal'

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
}

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

type Filter = 'all' | 'HOT' | 'WARM' | 'COLD' | 'JUNK'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COLD', label: 'COLD' },
  { value: 'JUNK', label: 'JUNK' },
]

interface CallsListProps {
  initialCalls: CallLog[]
  phone?: string | null
  isAdmin?: boolean
  adminClients?: ClientInfo[]
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

export default function CallsList({ initialCalls, phone, isAdmin, adminClients = [] }: CallsListProps) {
  const searchParams = useSearchParams()
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<string>(() => searchParams.get('client') ?? 'all')
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [showDial, setShowDial] = useState(false)
  const initialIds = useRef(new Set(initialCalls.map(c => c.id)))
  const supabase = createBrowserClient()

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
      const { data } = await supabase
        .from('call_logs')
        .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, client_id, clients(business_name)')
        .in('call_status', ['live', 'processing'])
        .order('started_at', { ascending: false })

      if (!data?.length) return

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

  // Reactive stats — recompute whenever calls change
  const stats = useMemo(() => {
    const completed = calls.filter(c => ['HOT', 'WARM', 'COLD', 'JUNK'].includes(c.call_status ?? ''))
    return {
      totalCalls: completed.length,
      hotLeads: completed.filter(c => c.call_status === 'HOT').length,
      avgDurationSecs: completed.length
        ? Math.round(completed.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / completed.length)
        : 0,
      activeNow: calls.filter(c => c.call_status === 'live').length,
    }
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
          onClose={() => setShowDial(false)}
          onDialed={(_callId, _phone) => setShowDial(false)}
        />
      )}

      {/* Stats — reactive, updates with every call change */}
      <StatsGrid
        totalCalls={stats.totalCalls}
        hotLeads={stats.hotLeads}
        avgDurationSecs={stats.avgDurationSecs}
        activeNow={stats.activeNow}
        calls={calls}
      />

      {/* Outcome charts with day click */}
      <OutcomeCharts calls={calls} onDayClick={setDateFilter} selectedDay={dateFilter} />

      <div>
        {/* Live call banner */}
        <LiveCallBanner
          calls={liveCalls.map(c => ({
            id: c.id,
            ultravox_call_id: c.ultravox_call_id,
            caller_phone: c.caller_phone,
            started_at: c.started_at,
            business_name: c.business_name,
          }))}
        />

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
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] text-amber-400/80">
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

        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Admin client tabs */}
          {isAdmin && adminClients.length > 0 && (
            <div className="px-5 border-b border-white/[0.06] flex items-center gap-0 overflow-x-auto">
              <button
                onClick={() => setClientFilter('all')}
                className={`px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  clientFilter === 'all'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All Clients
              </button>
              {adminClients.map(client => (
                <button
                  key={client.id}
                  onClick={() => setClientFilter(client.id)}
                  className={`px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                    clientFilter === client.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {client.business_name}
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
                Call Log
              </p>
              <span className="text-[11px] font-mono text-zinc-600">{filtered.length}</span>

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

              {isAdmin && (
                <button
                  onClick={() => setShowDial(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/35 transition-all"
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.07] hover:text-zinc-200 transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  CSV
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder={isAdmin ? 'Search number or client…' : 'Search number…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 w-44 transition-colors"
              />
              <div className="flex gap-1">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      filter === f.value
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rows — date grouped */}
          {filtered.length === 0 ? (
            <EmptyState phone={phone} />
          ) : (
            <div>
              {grouped.map(group => (
                <div key={group.label}>
                  {/* Date group header */}
                  <div className="px-5 py-2 bg-white/[0.01] border-b border-white/[0.04]">
                    <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-zinc-600">
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
                          className={isNew ? 'border-l-2 border-blue-500 transition-colors' : ''}
                        >
                          <CallRow call={call} showBusiness={showBusiness} />
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
