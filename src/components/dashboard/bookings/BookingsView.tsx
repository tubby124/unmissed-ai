'use client'

import { motion } from 'motion/react'

export interface Booking {
  id: string
  caller_name: string
  caller_phone: string | null
  appointment_date: string
  appointment_time: string
  service: string | null
  calendar_url: string | null
  created_at: string
  slug: string
}

interface BookingsViewProps {
  bookings: Booking[]
}

function getStatusLabel(date: string): { label: string; color: string } {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  if (date === todayStr) return { label: 'Today', color: 'bg-green-500/15 text-green-400 border-green-500/25' }
  if (date === tomorrowStr) return { label: 'Tomorrow', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
  if (date > todayStr) return { label: 'Upcoming', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  return { label: 'Past', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BookingsView({ bookings }: BookingsViewProps) {
  const today = new Date().toISOString().split('T')[0]

  const upcoming = bookings.filter(b => b.appointment_date >= today)
  const past = bookings.filter(b => b.appointment_date < today)

  const thisMonth = bookings.filter(b => {
    const now = new Date()
    return b.appointment_date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  })

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {[
          { label: 'Total', value: bookings.length },
          { label: 'This Month', value: thisMonth.length },
          { label: 'Upcoming', value: upcoming.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border b-theme bg-surface px-4 py-3.5">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">{stat.label}</p>
            <p className="text-[28px] font-bold t1 mt-0.5 leading-none">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
        >
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Upcoming Appointments</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((b, i) => {
              const status = getStatusLabel(b.appointment_date)
              return (
                <motion.div
                  key={b.id}
                  className="rounded-2xl border b-theme bg-surface p-5 flex flex-col gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 + i * 0.04 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[28px] font-bold t1 leading-none">{b.appointment_time}</p>
                      <p className="text-[12px] t3 mt-1">{formatDate(b.appointment_date)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="h-px" style={{ background: 'var(--color-border)' }} />

                  <div className="space-y-1.5">
                    <p className="text-[12px] t2 font-medium">{b.caller_name}</p>
                    {b.caller_phone && (
                      <p className="text-[11px] t3 font-mono">{b.caller_phone}</p>
                    )}
                    {b.service && (
                      <p className="text-[11px] t3">{b.service}</p>
                    )}
                  </div>

                  {b.calendar_url && (
                    <a
                      href={b.calendar_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-primary)] hover:opacity-70 transition-opacity cursor-pointer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      View in Google Calendar
                    </a>
                  )}
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
        >
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Past Appointments</p>
          <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
            {past.map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 px-5 py-3.5 ${i < past.length - 1 ? 'border-b b-theme' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] t2 font-medium truncate">{b.caller_name}</p>
                  {b.service && <p className="text-[11px] t3 truncate">{b.service}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] t2 tabular-nums">{b.appointment_time}</p>
                  <p className="text-[11px] t3">{formatDate(b.appointment_date)}</p>
                </div>
                {b.calendar_url && (
                  <a
                    href={b.calendar_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 t3 hover:t2 transition-colors cursor-pointer"
                    aria-label="View in Google Calendar"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {bookings.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center py-20 text-center"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
        >
          <div className="relative mb-5">
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-20"
              style={{ background: 'var(--color-primary)', transform: 'scale(1.5)' }}
            />
            <div className="relative w-14 h-14 rounded-2xl border b-theme bg-surface flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="t3">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 16l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <p className="text-[14px] font-semibold t2 mb-1">No appointments yet</p>
          <p className="text-[12px] t3 max-w-[240px] leading-relaxed">
            When callers book through your agent, appointments will show up here.
          </p>
        </motion.div>
      )}

      {/* Upcoming empty, past exists */}
      {upcoming.length === 0 && past.length > 0 && (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-4 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] t3">No upcoming appointments — all bookings are in the past.</p>
        </div>
      )}
    </div>
  )
}
