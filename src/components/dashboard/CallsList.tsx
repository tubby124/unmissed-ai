'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'motion/react'
import CallRow from './CallRow'
import EmptyState from './EmptyState'
import LiveCallBanner from './LiveCallBanner'

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

export default function CallsList({ initialCalls, phone, isAdmin, adminClients = [] }: CallsListProps) {
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const initialIds = useRef(new Set(initialCalls.map(c => c.id)))
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

  const liveCalls = calls.filter(c => c.call_status === 'live')

  const filtered = calls.filter(c => {
    if (c.call_status === 'live') return false // shown in banner
    if (c.call_status === 'processing') {
      if (filter !== 'all') return false
    } else {
      if (filter !== 'all' && c.call_status !== filter) return false
    }
    if (isAdmin && clientFilter !== 'all' && c.client_id !== clientFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchPhone = c.caller_phone?.includes(search) ?? false
      const matchBusiness = isAdmin ? (c.business_name?.toLowerCase().includes(q) ?? false) : false
      if (!matchPhone && !matchBusiness) return false
    }
    return true
  })

  const showBusiness = isAdmin && clientFilter === 'all'

  return (
    <div>
      {/* Live call banner — above the table */}
      <LiveCallBanner
        calls={liveCalls.map(c => ({
          id: c.id,
          ultravox_call_id: c.ultravox_call_id,
          caller_phone: c.caller_phone,
          started_at: c.started_at,
          business_name: c.business_name,
        }))}
      />

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
          <div className="flex items-center gap-2 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
              Call Log
            </p>
            <span className="text-[11px] font-mono text-zinc-600">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <input
              type="text"
              placeholder={isAdmin ? 'Search number or client…' : 'Search number…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 w-44 transition-colors"
            />
            {/* Filter pills */}
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

        {/* Rows */}
        {filtered.length === 0 ? (
          <EmptyState phone={phone} />
        ) : (
          <div>
            <AnimatePresence>
              {filtered.map((call, i) => {
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
        )}
      </div>
    </div>
  )
}
