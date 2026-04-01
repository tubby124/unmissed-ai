'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  attendees?: { email?: string; name?: string; status?: string }[]
  location?: string
}

interface CalendarResponse {
  events: CalendarEvent[]
  connected: boolean
  error?: string
}

interface CalendarEventsCardProps {
  clientId: string
}

// ── Grouping helpers ───────────────────────────────────────────────────────

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  if (!dateStr.includes('T')) return 'All day'
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function groupEvents(events: CalendarEvent[]): { label: string; events: CalendarEvent[] }[] {
  const groups = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const label = dayLabel(event.start)
    const existing = groups.get(label) || []
    existing.push(event)
    groups.set(label, existing)
  }
  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }))
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ── Component ──────────────────────────────────────────────────────────────

export default function CalendarEventsCard({ clientId }: CalendarEventsCardProps) {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const cacheRef = useRef<{ ts: number; data: CalendarResponse } | null>(null)

  useEffect(() => {
    // Use cache if fresh
    if (cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL) {
      setData(cacheRef.current.data)
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/calendar-events?client_id=${clientId}`)
        if (!res.ok) { setLoading(false); return }
        const json: CalendarResponse = await res.json()
        if (!cancelled) {
          cacheRef.current = { ts: Date.now(), data: json }
          setData(json)
        }
      } catch {
        // silent — card hides on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clientId])

  // Hide entirely if not connected or still loading
  if (loading || !data || !data.connected) return null

  const groups = groupEvents(data.events)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-[var(--color-surface)] p-5 space-y-3"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
        Upcoming Appointments
      </p>

      {groups.length === 0 ? (
        <p className="text-[11px] py-2" style={{ color: 'var(--color-text-3)' }}>
          No upcoming appointments this week
        </p>
      ) : (
        groups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-3)' }}>
              {group.label}
            </p>
            {group.events.map(event => (
              <div
                key={event.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors"
              >
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
                    {event.summary}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                    {formatTime(event.start)} – {formatTime(event.end)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </motion.div>
  )
}
