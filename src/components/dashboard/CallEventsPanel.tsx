'use client'

import { useState, useEffect, useCallback } from 'react'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

interface CallEvent {
  callId: string
  callStageId: string
  callTimestamp: string
  wallClockTimestamp: string | null
  severity: 'debug' | 'info' | 'warning' | 'error'
  type: string
  text: string
  extras: Record<string, unknown>
}

interface CallEventsPanelProps {
  callId: string
}

const SEVERITY_OPTIONS = ['debug', 'info', 'warning', 'error'] as const
type Severity = (typeof SEVERITY_OPTIONS)[number]

const SEVERITY_STYLES: Record<Severity, { bg: string; color: string; dotColor: string }> = {
  debug: {
    bg: 'var(--color-hover)',
    color: 'var(--color-text-3)',
    dotColor: 'var(--color-text-3)',
  },
  info: {
    bg: 'var(--color-info-tint)',
    color: 'var(--color-info)',
    dotColor: 'var(--color-info)',
  },
  warning: {
    bg: 'var(--color-warning-tint)',
    color: 'var(--color-warning)',
    dotColor: 'var(--color-warning)',
  },
  error: {
    bg: 'var(--color-error-tint)',
    color: 'var(--color-error)',
    dotColor: 'var(--color-error)',
  },
}

export default function CallEventsPanel({ callId }: CallEventsPanelProps) {
  const [events, setEvents] = useState<CallEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState<Severity>('info')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/dashboard/calls/${callId}/events?minimum_severity=${severity}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [callId, severity])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const toggleExtras = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx)
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-[10px] font-semibold tracking-[0.15em] uppercase"
          style={{ color: 'var(--color-text-3)' }}
        >
          Call Events
        </p>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="text-xs rounded-lg border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          style={{
            backgroundColor: 'var(--color-input-bg)',
            borderColor: 'var(--color-input-border)',
            color: 'var(--color-text-1)',
          }}
        >
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}+
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <SkeletonBox key={i} className="h-12 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm py-4 text-center" style={{ color: 'var(--color-error)' }}>
          {error}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-3)' }}>
          No events recorded for this call.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
          {events.map((event, i) => {
            const styles = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.info
            const hasExtras =
              event.extras && Object.keys(event.extras).length > 0
            const isExpanded = expandedIdx === i

            return (
              <div key={`${event.callTimestamp}-${i}`}>
                <button
                  type="button"
                  onClick={() => hasExtras && toggleExtras(i)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                    hasExtras ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                  }`}
                  style={{ backgroundColor: 'var(--color-bg-raised)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: styles.dotColor }}
                      />
                      <span
                        className="text-[10px] font-mono tabular-nums"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {event.callTimestamp}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: styles.bg, color: styles.color }}
                        >
                          {event.severity}
                        </span>
                        <span
                          className="text-[11px] font-mono truncate"
                          style={{ color: 'var(--color-text-2)' }}
                        >
                          {event.type}
                        </span>
                        {hasExtras && (
                          <span
                            className="text-[10px] ml-auto shrink-0"
                            style={{ color: 'var(--color-text-3)' }}
                          >
                            {isExpanded ? '\u25B2' : '\u25BC'}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        {event.text}
                      </p>
                    </div>
                  </div>
                </button>

                {isExpanded && hasExtras && (
                  <div
                    className="mx-3 mt-1 mb-1 rounded-lg p-3 overflow-x-auto"
                    style={{ backgroundColor: 'var(--color-hover)' }}
                  >
                    <pre
                      className="text-[11px] font-mono whitespace-pre-wrap break-words"
                      style={{ color: 'var(--color-text-2)' }}
                    >
                      {JSON.stringify(event.extras, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
