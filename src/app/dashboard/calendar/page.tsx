'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  clients?: { business_name?: string } | null
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/bookings')
      .then(r => r.json())
      .then(d => {
        setBookings(d.bookings || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = bookings.filter(b => !b.appointment_date || b.appointment_date >= today)
  const past = bookings.filter(b => b.appointment_date && b.appointment_date < today)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-1)' }}>Bookings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>
          Appointments booked by your AI agent during calls.
        </p>
      </div>

      {loading && (
        <div className="text-center py-20" style={{ color: 'var(--color-text-3)' }}>
          Loading...
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div
          className="rounded-xl p-8 text-center border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="text-4xl mb-4">📅</div>
          <p className="font-medium mb-1" style={{ color: 'var(--color-text-1)' }}>No bookings yet</p>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
            When callers book with you through your AI agent, appointments appear here.
          </p>
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-3)' }}>
            To enable calendar booking,{' '}
            <Link href="/dashboard/settings" className="underline" style={{ color: 'var(--color-primary)' }}>
              connect your Google Calendar
            </Link>{' '}
            in Settings.
          </p>
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <BookingSection title="Upcoming" bookings={upcoming} />
      )}

      {!loading && past.length > 0 && (
        <BookingSection title="Past" bookings={past} faded />
      )}
    </div>
  )
}

function BookingSection({ title, bookings, faded }: { title: string; bookings: Booking[]; faded?: boolean }) {
  return (
    <div className={`mb-8 ${faded ? 'opacity-60' : ''}`}>
      <h2
        className="text-xs font-medium uppercase tracking-widest mb-3"
        style={{ color: 'var(--color-text-3)' }}
      >
        {title} ({bookings.length})
      </h2>

      <div
        className="rounded-xl overflow-hidden border divide-y"
        style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-border)' }}
      >
        {bookings.map(b => (
          <div
            key={b.id}
            className="flex items-start gap-4 px-4 py-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            {/* Date badge */}
            <div
              className="shrink-0 rounded-lg px-2.5 py-2 text-center min-w-[52px]"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
                {b.appointment_date
                  ? new Date(b.appointment_date + 'T00:00').toLocaleDateString('en-CA', { month: 'short' })
                  : '—'}
              </div>
              <div className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-1)' }}>
                {b.appointment_date
                  ? new Date(b.appointment_date + 'T00:00').getDate()
                  : '—'}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium" style={{ color: 'var(--color-text-1)' }}>
                  {b.caller_name ?? 'Unknown caller'}
                </span>
                {b.service && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
                  >
                    {b.service}
                  </span>
                )}
              </div>
              <div className="text-sm mt-0.5 flex items-center gap-3" style={{ color: 'var(--color-text-3)' }}>
                {b.appointment_time && <span>{b.appointment_time}</span>}
                {b.caller_phone && <span>{b.caller_phone}</span>}
              </div>
            </div>

            {/* Action */}
            {b.calendar_url && (
              <Link
                href={b.calendar_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                View →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
