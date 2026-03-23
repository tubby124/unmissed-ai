'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import { createSoundCues } from '@/components/DemoCallVisuals'

interface ActivityEvent {
  id: string
  caller_phone: string | null
  call_status: string | null
  business_name: string | null
  started_at: string
  _key: string // unique per-event for AnimatePresence
}

const STATUS_DOT: Record<string, string> = {
  HOT:        'bg-red-500',
  WARM:       'bg-amber-500',
  COLD:       'bg-blue-400',
  JUNK:       'bg-zinc-600',
  live:       'bg-green-500',
  processing: 'bg-yellow-500',
}

const STATUS_LABEL: Record<string, string> = {
  HOT: 'Hot', WARM: 'Warm', COLD: 'Cold', JUNK: 'Junk', live: 'Live', processing: '…',
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return 'now'
}

function EventRow({ event, showBusiness }: { event: ActivityEvent; showBusiness: boolean }) {
  const dot = STATUS_DOT[event.call_status ?? ''] ?? 'bg-zinc-700'
  const label = STATUS_LABEL[event.call_status ?? ''] ?? '—'
  const isLive = event.call_status === 'live'
  const href = event.caller_phone
    ? `/dashboard/calls?highlight=${encodeURIComponent(event.caller_phone)}`
    : null

  const inner = (
    <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-xl hover:bg-[var(--color-hover)] transition-colors group cursor-pointer">
      {/* Status dot */}
      <span className="relative flex shrink-0 mt-0.5">
        {isLive && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono truncate leading-snug" style={{ color: "var(--color-text-2)" }}>
          {formatPhone(event.caller_phone)}
        </p>
        {showBusiness && event.business_name && (
          <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--color-text-3)" }}>{event.business_name}</p>
        )}
      </div>

      {/* Right: label + time + chevron */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className={`text-[9px] font-bold tracking-wider uppercase ${
          event.call_status === 'HOT' ? 'text-red-400/80' :
          event.call_status === 'WARM' ? 'text-amber-400/80' :
          event.call_status === 'COLD' ? 'text-blue-400/80' :
          event.call_status === 'live' ? 'text-green-400/80' :
          'text-[var(--color-text-3)]'
        }`}>{label}</span>
        <span className="text-[9px] font-mono" style={{ color: "var(--color-text-3)" }}>{timeAgo(event.started_at)}</span>
      </div>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="transition-colors shrink-0 mt-0.5" style={{ color: "var(--color-text-3)" }}>
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

interface ActivityFeedProps {
  isAdmin?: boolean
  clientId?: string | null
}

export default function ActivityFeed({ isAdmin, clientId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [hasLive, setHasLive] = useState(false)
  const supabase = createBrowserClient()
  const keyCounter = useRef(0)
  const soundCuesRef = useRef<ReturnType<typeof createSoundCues> | null>(null)

  useEffect(() => { soundCuesRef.current = createSoundCues() }, [])

  function makeKey() { return `ev-${++keyCounter.current}` }

  useEffect(() => {
    // Initial fetch — last 15 events
    async function loadInitial() {
      let q = supabase
        .from('call_logs')
        .select('id, caller_phone, call_status, started_at, clients(business_name)')
        .order('started_at', { ascending: false })
        .limit(15)

      if (!isAdmin && clientId) {
        q = q.eq('client_id', clientId)
      }

      const { data } = await q
      if (!data) return

      const mapped = data.map(r => ({
        id: r.id,
        caller_phone: r.caller_phone,
        call_status: r.call_status,
        business_name: (r.clients as { business_name?: string } | null)?.business_name ?? null,
        started_at: r.started_at,
        _key: makeKey(),
      }))
      setEvents(mapped)
      setHasLive(mapped.some(e => e.call_status === 'live'))
    }

    loadInitial()

    // Realtime subscription
    const channel = supabase
      .channel('activity_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, async (payload) => {
        const row = payload.new as { id: string; caller_phone: string | null; call_status: string | null; started_at: string; client_id: string | null }
        if (!isAdmin && clientId && row.client_id !== clientId) return

        // Fetch business name for new row
        let bizName: string | null = null
        if (row.client_id) {
          const { data } = await supabase.from('clients').select('business_name').eq('id', row.client_id).single()
          bizName = data?.business_name ?? null
        }

        const newEvent: ActivityEvent = {
          id: row.id,
          caller_phone: row.caller_phone,
          call_status: row.call_status,
          business_name: bizName,
          started_at: row.started_at,
          _key: makeKey(),
        }

        setEvents(prev => {
          const next = [newEvent, ...prev].slice(0, 15)
          setHasLive(next.some(e => e.call_status === 'live'))
          return next
        })
        if (newEvent.call_status === 'live') soundCuesRef.current?.connectChime()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as { id: string; call_status: string | null; client_id: string | null }
        if (!isAdmin && clientId && row.client_id !== clientId) return

        setEvents(prev => {
          const next = prev.map(e => e.id === row.id ? { ...e, call_status: row.call_status } : e)
          setHasLive(next.some(e => e.call_status === 'live'))
          return next
        })
        if (row.call_status === 'HOT') soundCuesRef.current?.tagPop()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <aside className="hidden xl:flex flex-col w-[272px] shrink-0 border-l h-screen sticky top-0 overflow-hidden" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: "var(--color-text-3)" }}>Live Activity</span>
        {hasLive && (
          <span className="relative flex w-1.5 h-1.5 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
        )}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-none">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <p className="text-[11px] text-center" style={{ color: "var(--color-text-3)" }}>No recent activity</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map(event => (
              <motion.div
                key={event._key}
                initial={{ opacity: 0, x: 16, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <EventRow event={event} showBusiness={!!isAdmin} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Top fade mask */}
      <div className="absolute top-[57px] left-0 right-0 h-6 pointer-events-none" style={{ background: "linear-gradient(to bottom, var(--color-surface), transparent)" }} />
      {/* Bottom fade mask */}
      <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }} />
    </aside>
  )
}
