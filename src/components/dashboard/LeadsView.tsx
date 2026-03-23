'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import { slaTag } from '@/lib/utils/sla'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  key_topics: string[] | null
  started_at: string | null
  created_at: string
  next_steps: string | null
  client_id?: string | null
}

type Filter = 'all' | 'HOT' | 'WARM'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function exportLeadsCsv(calls: CallLog[]) {
  const headers = ['Date', 'Phone', 'Name', 'Summary', 'Topics', 'Status', 'Age (hours)']
  const rows = calls.map(c => {
    const ts = c.started_at ?? c.created_at
    const age = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)
    return [
      new Date(ts).toISOString(),
      c.caller_phone ?? '',
      '—',
      (c.ai_summary ?? '').replace(/"/g, '""'),
      (c.key_topics ?? []).join('; '),
      c.call_status ?? '',
      String(age),
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface LeadsViewProps {
  initialCalls: CallLog[]
  clientId: string
}

export default function LeadsView({ initialCalls, clientId }: LeadsViewProps) {
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const supabase = createBrowserClient()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads_view_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        if (!['HOT', 'WARM'].includes(row.call_status ?? '')) return
        if (row.client_id !== clientId) return
        setCalls(prev => {
          if (prev.some(c => c.id === row.id)) return prev
          return [row, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        if (row.client_id !== clientId) return
        setCalls(prev => {
          const existing = prev.find(c => c.id === row.id)
          if (existing) {
            return prev.map(c => c.id === row.id ? { ...c, ...row } : c)
          }
          // Was not HOT/WARM before, now is — insert
          if (['HOT', 'WARM'].includes(row.call_status ?? '')) {
            return [row, ...prev]
          }
          return prev
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = calls.filter(c =>
    filter === 'all' ? true : c.call_status === filter
  )

  const counts = {
    all: calls.length,
    HOT: calls.filter(c => c.call_status === 'HOT').length,
    WARM: calls.filter(c => c.call_status === 'WARM').length,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-1)' }}>Leads</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            Inbound calls that need follow-up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
            style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            {filtered.length}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={() => exportLeadsCsv(filtered)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold hover:bg-[var(--color-hover)] transition-all"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter pills + list container */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {/* Filter pills */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{ touchAction: 'manipulation' }}
              className="relative flex-1 min-h-[44px] px-4 py-3 text-xs font-medium transition-colors"
            >
              {filter === f.value && (
                <motion.div
                  layoutId="leads-filter-bg"
                  className="absolute inset-0 bg-blue-500/10 border-b-2 border-blue-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className={`relative flex items-center justify-center gap-1.5 ${filter === f.value ? 'text-blue-400' : ''}`}
                style={filter === f.value ? undefined : { color: 'var(--color-text-3)' }}
              >
                {f.label}
                {counts[f.value] > 0 && (
                  <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none ${
                    filter === f.value ? 'bg-blue-500/20 text-blue-400'
                    : f.value === 'HOT' ? 'bg-red-500/20 text-red-400'
                    : f.value === 'WARM' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {counts[f.value]}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: 'var(--color-text-3)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-30">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>No leads yet</p>
            <p className="text-xs text-center max-w-[220px]" style={{ color: 'var(--color-text-3)' }}>
              Hot and warm calls will appear here automatically.
            </p>
          </div>
        ) : (
          <div>
            <AnimatePresence>
              {filtered.map((call, i) => {
                const isExpanded = expanded === call.id
                const topics = call.key_topics ?? []
                const sla = slaTag(call.started_at)
                const ts = call.started_at ?? call.created_at
                const borderCls = call.call_status === 'HOT'
                  ? 'border-l-4 border-l-red-500'
                  : 'border-l-4 border-l-amber-400'

                return (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.2, ease: 'easeOut' }}
                    className={`${borderCls} border-b transition-colors hover:bg-[var(--color-hover)] last:border-b-0`}
                    style={{ borderBottomColor: 'var(--color-border)' }}
                  >
                    {/* Row summary — always visible */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : call.id)}
                      className="w-full text-left px-4 py-3 min-h-[44px]"
                    >
                      {/* Line 1: SLA badge + status badge + phone + time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {sla && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${sla.cls}`}>
                            {sla.label}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          call.call_status === 'HOT'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {call.call_status}
                        </span>
                        <span className="font-mono text-[13px] font-medium" style={{ color: 'var(--color-text-1)' }}>
                          {call.caller_phone ?? 'Unknown'}
                        </span>
                        <span className="ml-auto text-[11px] font-mono shrink-0" style={{ color: 'var(--color-text-3)' }}>
                          {timeAgo(ts)}
                        </span>
                      </div>

                      {/* Line 2: summary snippet */}
                      {call.ai_summary && (
                        <p className="mt-1 text-[12px] italic truncate" style={{ color: 'var(--color-text-3)', maxWidth: '100%' }}>
                          {call.ai_summary.slice(0, 100)}{call.ai_summary.length > 100 ? '…' : ''}
                        </p>
                      )}

                      {/* Line 3: topic pills */}
                      {topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {topics.slice(0, 4).map(t => (
                            <span
                              key={t}
                              className="text-[10px] px-2 py-0.5 rounded-full border"
                              style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                            >
                              {t}
                            </span>
                          ))}
                          {topics.length > 4 && (
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                              +{topics.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          key="expanded"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div
                            className="px-4 pb-4 pt-0 space-y-3 border-t"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            {call.ai_summary && (
                              <div>
                                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--color-text-3)' }}>Summary</p>
                                <p className="text-xs italic" style={{ color: 'var(--color-text-2)' }}>{call.ai_summary}</p>
                              </div>
                            )}
                            {call.next_steps && (
                              <div>
                                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--color-text-3)' }}>Next Steps</p>
                                <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>{call.next_steps}</p>
                              </div>
                            )}
                            {topics.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5" style={{ color: 'var(--color-text-3)' }}>Topics</p>
                                <div className="flex flex-wrap gap-1">
                                  {topics.map(t => (
                                    <span
                                      key={t}
                                      className="text-[10px] px-2 py-0.5 rounded-full border"
                                      style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex justify-end">
                              <Link
                                href={`/dashboard/calls/${call.ultravox_call_id}`}
                                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                              >
                                View full call
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
