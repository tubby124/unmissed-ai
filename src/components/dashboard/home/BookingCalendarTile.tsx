'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, Settings2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Booking {
  id: string
  caller_name: string
  caller_phone: string | null
  appointment_date: string
  appointment_time: string
  service: string | null
  calendar_url: string | null
}

type ColumnKey = 'name' | 'phone' | 'date' | 'time' | 'service'

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'service', label: 'Service' },
]

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatPhone(p: string | null): string {
  if (!p) return '—'
  const digits = p.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return p
}

// ── Mini calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ bookedDates }: { bookedDates: Set<string> }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = today.toISOString().split('T')[0]

  const cells: (number | null)[] = [...Array(firstDay).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p className="text-[11px] font-semibold t3 mb-2">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-px">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold t3 pb-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const mm = String(month + 1).padStart(2, '0')
          const dd = String(day).padStart(2, '0')
          const dateStr = `${year}-${mm}-${dd}`
          const isToday = dateStr === todayStr
          const hasBooking = bookedDates.has(dateStr)
          const isPast = dateStr < todayStr

          return (
            <div key={i} className="relative flex flex-col items-center py-0.5">
              <span
                className={[
                  'text-[10px] w-6 h-6 flex items-center justify-center rounded-full leading-none',
                  isToday
                    ? 'font-bold text-white'
                    : isPast
                    ? 't3 opacity-40'
                    : 't2',
                ].join(' ')}
                style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                {day}
              </span>
              {hasBooking && (
                <span
                  className="absolute bottom-0 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main tile ────────────────────────────────────────────────────────────────

interface Props {
  hasBooking: boolean
  calendarConnected: boolean
}

export default function BookingCalendarTile({ hasBooking, calendarConnected }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(hasBooking)
  const [tableVisible, setTableVisible] = useState(true)
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    name: true,
    phone: true,
    date: true,
    time: true,
    service: true,
  })

  const fetchBookings = useCallback(async () => {
    if (!hasBooking) return
    const today = new Date()
    const dateFrom = today.toISOString().split('T')[0]
    const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]

    try {
      const res = await fetch(
        `/api/dashboard/bookings?date_from=${dateFrom}&date_to=${dateTo}&limit=20`
      )
      if (!res.ok) return
      const json = await res.json()
      setBookings(json.bookings ?? [])
    } catch {
      // silently fail — tile is non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const bookedDates = new Set(bookings.map(b => b.appointment_date))

  const toggleCol = (key: ColumnKey) =>
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }))

  const activeCols = COLUMNS.filter(c => visibleCols[c.key])

  return (
    <motion.div
      className="rounded-2xl border b-theme bg-surface overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.08 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[12px] font-semibold t1">Bookings This Month</span>
          {!loading && bookings.length > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-primary-10)', color: 'var(--color-primary)' }}
            >
              {bookings.length}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/bookings"
          className="flex items-center gap-1 text-[11px] t3 hover:t2 transition-colors"
        >
          View all
          <ExternalLink width={10} height={10} />
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* Mini calendar — always visible; dots only when booking is live */}
        <MiniCalendar bookedDates={bookedDates} />

        {/* State: booking disabled */}
        {!hasBooking ? (
          <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
            <p className="text-[12px] t2 font-medium">Let your agent book appointments</p>
            <p className="text-[11px] t3 max-w-[200px] leading-relaxed">
              Connect Google Calendar and your agent handles scheduling automatically.
            </p>
            <Link
              href="/dashboard/settings?tab=general"
              className="mt-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              Set up booking →
            </Link>
          </div>
        ) : !calendarConnected ? (
          /* State: booking enabled but calendar not connected */
          <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
              style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(245,158,11)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-[12px] t2 font-medium">Google Calendar not connected</p>
            <p className="text-[11px] t3 max-w-[200px] leading-relaxed">
              Your agent is ready to book — connect your calendar to activate it.
            </p>
            <Link
              href="/dashboard/settings?tab=general"
              className="mt-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'rgb(245,158,11)' }}
            >
              Connect Google Calendar →
            </Link>
          </div>
        ) : (
        /* Table section */
        <div>
          {/* Table toolbar */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setTableVisible(v => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] uppercase t3 hover:t2 transition-colors"
            >
              {tableVisible ? (
                <ChevronUp width={12} height={12} />
              ) : (
                <ChevronDown width={12} height={12} />
              )}
              Upcoming
            </button>

            {tableVisible && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
                    <Settings2 width={10} height={10} />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {COLUMNS.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleCols[col.key]}
                      onCheckedChange={() => toggleCol(col.key)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {tableVisible && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-[12px] t3">No appointments this month</p>
                  <Link
                    href="/dashboard/calendar"
                    className="mt-1.5 text-[11px] hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Set up calendar booking →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl border b-theme overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeCols.map(col => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map(b => (
                        <TableRow key={b.id}>
                          {visibleCols.name && (
                            <TableCell className="t1 font-medium truncate max-w-[100px]">
                              {b.caller_name}
                            </TableCell>
                          )}
                          {visibleCols.phone && (
                            <TableCell className="t3 font-mono text-[11px]">
                              {formatPhone(b.caller_phone)}
                            </TableCell>
                          )}
                          {visibleCols.date && (
                            <TableCell className="t2">
                              {formatDate(b.appointment_date)}
                            </TableCell>
                          )}
                          {visibleCols.time && (
                            <TableCell className="t2 tabular-nums">
                              {b.appointment_time}
                            </TableCell>
                          )}
                          {visibleCols.service && (
                            <TableCell className="t3 truncate max-w-[120px]">
                              {b.service ?? '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </motion.div>
  )
}
