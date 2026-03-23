'use client'

import { useCallback, useEffect, useState } from 'react'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

interface ActivitySummary {
  total: number
  hot: number
  warm: number
  cold: number
  junk: number
  missed: number
  avgDuration: number
}

interface MissedCall {
  id: string
  caller_phone: string
  created_at: string
  end_reason: string | null
  duration_seconds: number | null
  client_slug: string
}

interface CallbackItem {
  id: string
  caller_phone: string
  created_at: string
  client_slug: string
}

interface ActivityData {
  summary: ActivitySummary
  missedCalls: MissedCall[]
  callbackQueue: CallbackItem[]
  stale?: boolean
}

type Period = '24h' | '7d' | '30d'

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '--'
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

export default function OperatorActivity({ clientId }: { clientId?: string | null }) {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('24h')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const showActivity = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SHOW_OPERATOR_ACTIVITY ?? 'true') !== 'false'
    : true

  const fetchActivity = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period })
      if (clientId) params.set('client_id', clientId)
      const res = await fetch(`/api/dashboard/activity?${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json: ActivityData = await res.json()
      setData(json)
    } catch {
      setData({
        summary: { total: 0, hot: 0, warm: 0, cold: 0, junk: 0, missed: 0, avgDuration: 0 },
        missedCalls: [],
        callbackQueue: [],
        stale: true,
      })
    } finally {
      setLoading(false)
    }
  }, [clientId, period])

  useEffect(() => {
    if (!showActivity) return
    setLoading(true)
    fetchActivity()
  }, [fetchActivity, showActivity])

  if (!showActivity) return null

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonBox className="h-20 rounded-2xl" />
        <SkeletonBox className="h-32 rounded-2xl" />
      </div>
    )
  }

  if (!data) return null

  const { summary, missedCalls, callbackQueue } = data
  const activeCallbackQueue = callbackQueue.filter(c => !dismissedIds.has(c.id))

  return (
    <div className="space-y-4 mb-6">
      {data.stale && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
          <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-xs text-amber-200/80">Activity data may be outdated</span>
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
          Operator Activity
        </p>
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
          {PERIOD_LABELS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                  : 'hover:bg-[var(--color-hover)]'
              }`}
              style={period !== p.value ? { color: 'var(--color-text-3)' } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="HOT" value={summary.hot} color="text-red-400" />
        <SummaryCard label="WARM" value={summary.warm} color="text-amber-400" />
        <SummaryCard label="COLD" value={summary.cold} color="text-blue-400" />
        <SummaryCard label="JUNK" value={summary.junk} color="text-zinc-400" />
        <SummaryCard label="Missed" value={summary.missed} color="text-orange-400" />
        <SummaryCard label="Avg Dur" value={formatDuration(summary.avgDuration)} />
      </div>

      {/* Missed calls table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <svg className="w-4 h-4 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94m-1 7.98v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.42-5.42A19.79 19.79 0 01.7 4.11 2 2 0 012.68 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.5a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
            Missed Calls
          </p>
          {missedCalls.length > 0 && (
            <span className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 leading-none">
              {missedCalls.length}
            </span>
          )}
        </div>

        {missedCalls.length === 0 ? (
          <div className="px-5 py-8 flex flex-col items-center gap-2" style={{ color: 'var(--color-text-3)' }}>
            <svg className="w-8 h-8 text-emerald-400/60" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm">No missed calls — nice!</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {missedCalls.map(call => (
              <div
                key={call.id}
                className="px-5 py-3 flex items-center gap-4 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs truncate" style={{ color: 'var(--color-text-1)' }}>
                    {call.caller_phone}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                    {formatTime(call.created_at)}
                    {call.end_reason && <span className="ml-2 opacity-60">{call.end_reason}</span>}
                  </p>
                </div>
                <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-text-3)' }}>
                  {formatDuration(call.duration_seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Callback queue */}
      {(callbackQueue.length > 0) && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55m-5.68-3.4a6.09 6.09 0 013.33 2.07m1.35-6.22a14.94 14.94 0 014 5.52M9.34 6.71L2 2m7.34 4.71A2 2 0 002.68 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.5a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
              Callback Queue
            </p>
            {activeCallbackQueue.length > 0 && (
              <span className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 leading-none">
                {activeCallbackQueue.length}
              </span>
            )}
          </div>

          {activeCallbackQueue.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>
              All caught up
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {activeCallbackQueue.map(item => (
                <div
                  key={item.id}
                  className="px-5 py-3 flex items-center gap-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate" style={{ color: 'var(--color-text-1)' }}>
                      {item.caller_phone}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                      {formatTime(item.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDismissedIds(prev => new Set(prev).add(item.id))}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:bg-emerald-500/20 hover:border-emerald-500/40"
                    style={{
                      backgroundColor: 'var(--color-bg-raised)',
                      color: 'var(--color-text-2)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Called back
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl px-3 py-2.5 text-center card-surface">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1 t3">
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums ${color ?? ''}`} style={color ? undefined : { color: 'var(--color-text-1)' }}>
        {value}
      </p>
    </div>
  )
}
