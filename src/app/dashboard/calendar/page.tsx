'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

interface Booking {
  id: string
  slug: string
  caller_name: string | null
  caller_phone: string | null
  appointment_date: string | null
  appointment_time: string | null
  service: string | null
  calendar_url: string | null
  created_at: string
  status: string | null
  call_id: string | null
  google_event_id: string | null
  clients?: { business_name?: string } | null
}

type Filter = '' | 'upcoming' | 'today' | 'past' | 'cancelled'

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('')
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })

  useEffect(() => {
    fetch('/api/dashboard/bookings?limit=100')
      .then(r => r.json())
      .then(d => { setBookings(d.bookings || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const counts = useMemo(() => {
    const upcoming = bookings.filter(b => b.appointment_date && b.appointment_date > today && b.status !== 'cancelled').length
    const todayCount = bookings.filter(b => b.appointment_date === today && b.status !== 'cancelled').length
    const past = bookings.filter(b => b.appointment_date && b.appointment_date < today).length
    const cancelled = bookings.filter(b => b.status === 'cancelled').length
    return { upcoming, today: todayCount, past, cancelled, total: bookings.length }
  }, [bookings, today])

  const filtered = useMemo(() => {
    if (!filter) return bookings
    if (filter === 'upcoming') return bookings.filter(b => b.appointment_date && b.appointment_date > today && b.status !== 'cancelled')
    if (filter === 'today') return bookings.filter(b => b.appointment_date === today && b.status !== 'cancelled')
    if (filter === 'past') return bookings.filter(b => b.appointment_date && b.appointment_date < today)
    if (filter === 'cancelled') return bookings.filter(b => b.status === 'cancelled')
    return bookings
  }, [bookings, filter, today])

  // Booking dates for mini calendar
  const bookingDates = useMemo(() => {
    const set = new Set<string>()
    bookings.forEach(b => { if (b.appointment_date) set.add(b.appointment_date) })
    return set
  }, [bookings])

  // Group filtered bookings by date
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; bookings: Booking[] }[] = []
    const map = new Map<string, Booking[]>()
    filtered.forEach(b => {
      const key = b.appointment_date || 'unscheduled'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    })
    for (const [date, items] of map) {
      const d = date === 'unscheduled' ? null : new Date(date + 'T00:00')
      const label = d
        ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Unscheduled'
      groups.push({ date, label, bookings: items })
    }
    return groups
  }, [filtered])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          Bookings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>
          Appointments booked by your AI agent during calls.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            <span className="text-sm" style={{ color: 'var(--color-text-3)' }}>Loading bookings...</span>
          </div>
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-12 text-center border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="font-semibold text-lg mb-2" style={{ color: 'var(--color-text-1)' }}>No bookings yet</p>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-3)' }}>
            When callers book appointments through your AI agent, they'll appear here with calendar links and call context.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-500/10"
            style={{ color: 'var(--color-primary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Connect Google Calendar
          </Link>
        </motion.div>
      )}

      {!loading && bookings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Upcoming" value={counts.upcoming} color="indigo" />
            <StatCard label="Today" value={counts.today} color="emerald" />
            <StatCard label="Completed" value={counts.past} color="slate" />
            <StatCard label="Cancelled" value={counts.cancelled} color="red" />
          </div>

          {/* Calendar + List layout */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Mini calendar */}
            <div className="lg:w-72 shrink-0">
              <div
                className="rounded-2xl border p-4 sticky top-6"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <MiniCalendar
                  month={calMonth.month}
                  year={calMonth.year}
                  bookingDates={bookingDates}
                  today={today}
                  onPrev={() => setCalMonth(p => p.month === 0 ? { month: 11, year: p.year - 1 } : { month: p.month - 1, year: p.year })}
                  onNext={() => setCalMonth(p => p.month === 11 ? { month: 0, year: p.year + 1 } : { month: p.month + 1, year: p.year })}
                />
              </div>
            </div>

            {/* Booking list */}
            <div className="flex-1 min-w-0">
              {/* Filter pills */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {([
                  { key: '' as Filter, label: 'All', count: counts.total },
                  { key: 'upcoming' as Filter, label: 'Upcoming', count: counts.upcoming },
                  { key: 'today' as Filter, label: 'Today', count: counts.today },
                  { key: 'past' as Filter, label: 'Past', count: counts.past },
                  { key: 'cancelled' as Filter, label: 'Cancelled', count: counts.cancelled },
                ]).filter(f => f.count > 0 || f.key === '').map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      filter === f.key
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 shadow-sm shadow-indigo-500/10'
                        : 'border-transparent hover:bg-white/[0.04]'
                    }`}
                    style={filter !== f.key ? { color: 'var(--color-text-3)' } : undefined}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className="ml-1.5 text-[10px] opacity-60">{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Grouped timeline */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={filter}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {filtered.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                      <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>No bookings match this filter.</p>
                    </div>
                  )}

                  {grouped.map((group, gi) => (
                    <div key={group.date}>
                      {/* Date header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
                          {group.date === today ? 'Today' : group.label}
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-3)' }}>
                          {group.bookings.length} {group.bookings.length === 1 ? 'booking' : 'bookings'}
                        </span>
                      </div>

                      {/* Timeline cards */}
                      <div className="relative pl-6 space-y-3">
                        {/* Timeline line */}
                        <div
                          className="absolute left-[7px] top-2 bottom-2 w-px"
                          style={{ backgroundColor: 'var(--color-border)' }}
                        />

                        {group.bookings.map((b, i) => (
                          <motion.div
                            key={b.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: gi * 0.05 + i * 0.03 }}
                            className="relative"
                          >
                            {/* Timeline dot */}
                            <div
                              className={`absolute -left-6 top-5 w-[15px] h-[15px] rounded-full border-2 ${
                                b.status === 'cancelled'
                                  ? 'border-red-500/50 bg-red-500/20'
                                  : b.appointment_date === today
                                  ? 'border-emerald-500/50 bg-emerald-500/20'
                                  : b.appointment_date && b.appointment_date < today
                                  ? 'border-gray-500/30 bg-gray-500/10'
                                  : 'border-indigo-500/50 bg-indigo-500/20'
                              }`}
                            >
                              {b.status !== 'cancelled' && b.appointment_date && b.appointment_date <= today && (
                                <div className={`absolute inset-[3px] rounded-full ${
                                  b.appointment_date === today ? 'bg-emerald-400' : 'bg-gray-400'
                                }`} />
                              )}
                            </div>

                            {/* Card */}
                            <div
                              className="rounded-xl border p-4 transition-all hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/[0.03] group"
                              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                            >
                              <div className="flex items-start gap-4">
                                {/* Time badge */}
                                <div
                                  className="shrink-0 w-[68px] rounded-lg py-2 text-center"
                                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                                >
                                  {b.appointment_time ? (
                                    <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                                      {b.appointment_time}
                                    </span>
                                  ) : (
                                    <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>TBD</span>
                                  )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm" style={{ color: 'var(--color-text-1)' }}>
                                      {b.caller_name ?? 'Unknown caller'}
                                    </span>
                                    {b.status && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                        b.status === 'cancelled'
                                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                          : b.status === 'rescheduled'
                                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                      }`}>
                                        {b.status}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: 'var(--color-text-3)' }}>
                                    {b.service && (
                                      <span className="flex items-center gap-1">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-50">
                                          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                        </svg>
                                        {b.service}
                                      </span>
                                    )}
                                    {b.caller_phone && (
                                      <span className="flex items-center gap-1">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-50">
                                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5"/>
                                        </svg>
                                        {b.caller_phone}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action row */}
                                  <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {b.calendar_url && (
                                      <a
                                        href={b.calendar_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors hover:bg-indigo-500/10"
                                        style={{ color: 'var(--color-primary)' }}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Google Calendar
                                      </a>
                                    )}
                                    {b.call_id && (
                                      <Link
                                        href={`/dashboard/calls/${b.call_id}`}
                                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors hover:bg-white/[0.06]"
                                        style={{ color: 'var(--color-text-3)' }}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                          <path d="M12 18.5A2.5 2.5 0 0114.5 16H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h3.5A2.5 2.5 0 0112 18.5zM12 18.5V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                        View call
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Stats Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: 'rgba(99,102,241,0.08)', text: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.15)' },
    emerald: { bg: 'rgba(16,185,129,0.08)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.15)' },
    slate: { bg: 'rgba(148,163,184,0.08)', text: 'rgb(148,163,184)', border: 'rgba(148,163,184,0.15)' },
    red: { bg: 'rgba(239,68,68,0.08)', text: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.15)' },
  }
  const c = colors[color] || colors.slate
  return (
    <div
      className="rounded-xl px-4 py-3 border"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: c.text }}>{value}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</p>
    </div>
  )
}

// ─── Mini Calendar ───────────────────────────────────────────────────────────
function MiniCalendar({
  month, year, bookingDates, today, onPrev, onNext,
}: {
  month: number; year: number; bookingDates: Set<string>; today: string
  onPrev: () => void; onNext: () => void
}) {
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>{monthName}</span>
        <div className="flex gap-1">
          <button onClick={onPrev} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={onNext} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: 'var(--color-text-3)' }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasBooking = bookingDates.has(dateStr)
          const isToday = dateStr === today

          return (
            <div
              key={day}
              className={`relative text-center text-xs py-1.5 rounded-md transition-colors ${
                isToday ? 'font-bold' : ''
              } ${hasBooking ? 'font-medium' : ''}`}
              style={{
                color: isToday
                  ? 'var(--color-primary)'
                  : hasBooking
                  ? 'var(--color-text-1)'
                  : 'var(--color-text-3)',
                backgroundColor: isToday ? 'rgba(99,102,241,0.1)' : undefined,
              }}
            >
              {day}
              {hasBooking && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isToday ? 'bg-indigo-400' : 'bg-indigo-500/60'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
