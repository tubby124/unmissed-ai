'use client'

import { useState, useEffect, useCallback } from 'react'

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

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; dot: string }> = {
  debug: {
    bg: 'bg-zinc-100 dark:bg-zinc-700/50',
    text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
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
          className="text-[10px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: 'var(--color-text-3)' }}
        >
          Call Events
        </p>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="text-xs rounded-lg border px-2 py-1 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <div
              key={i}
              className="h-12 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--color-hover)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 dark:text-red-400 py-4 text-center">
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
                        className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}
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
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.bg} ${styles.text}`}
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
