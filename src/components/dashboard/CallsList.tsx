'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'motion/react'
import CallRow from './CallRow'
import EmptyState from './EmptyState'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
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
}

export default function CallsList({ initialCalls, phone }: CallsListProps) {
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel('call_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        setCalls(prev => [row, ...prev])
        setNewIds(prev => new Set(prev).add(row.id))
        setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(row.id); return s }), 2000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        setCalls(prev => prev.map(c => c.id === row.id ? row : c))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = calls.filter(c => {
    if (c.call_status === 'live' || c.call_status === 'processing') return filter === 'all'
    if (filter !== 'all' && c.call_status !== filter) return false
    if (search && !c.caller_phone?.includes(search)) return false
    return true
  })

  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '200ms' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
            Recent Calls
          </p>
          <span className="text-xs text-zinc-600">{calls.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Search number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-36 transition-colors"
          />
          {/* Filter pills */}
          <div className="flex gap-1">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <EmptyState phone={phone} />
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {filtered.map(call => (
              <motion.div
                key={call.id}
                initial={newIds.has(call.id) ? { height: 0, opacity: 0 } : false}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={newIds.has(call.id) ? 'border-l-2 border-blue-500 transition-colors' : ''}
              >
                <CallRow call={call} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
