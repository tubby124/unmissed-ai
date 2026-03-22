'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HomeData {
  admin: boolean
  agent: { name: string; status: string; niche: string | null }
  stats: {
    totalCalls: number
    hotLeads: number
    bookings: number
    avgQuality: number | null
    trends: { callsChange: number | null; hotChange: number | null }
  }
  usage: {
    minutesUsed: number
    minuteLimit: number
    bonusMinutes: number
    totalAvailable: number
  }
  recentCalls: {
    id: string
    ultravox_call_id: string
    caller_phone: string | null
    call_status: string
    duration_seconds: number | null
    started_at: string
    ai_summary: string | null
    sentiment: string | null
  }[]
  capabilities: {
    hasKnowledge: boolean
    hasFacts: boolean
    hasFaqs: boolean
    hasHours: boolean
    hasBooking: boolean
    hasSms: boolean
    hasTransfer: boolean
    hasWebsite: boolean
  }
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_COLORS: Record<string, string> = {
  HOT: 'bg-red-500/15 text-red-400 border-red-500/25',
  WARM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  COLD: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  JUNK: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  MISSED: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  VOICEMAIL: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const isUp = value > 0
  return (
    <span className={`text-[10px] font-medium ${isUp ? 'text-green-400' : value < 0 ? 'text-red-400' : 't3'}`}>
      {isUp ? '+' : ''}{value}%
    </span>
  )
}

export default function ClientHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/home', { signal: AbortSignal.timeout(10000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-3 sm:p-6 space-y-4">
        <div className="w-48 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
        <div className="rounded-2xl border p-6 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="w-64 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
          <div className="w-40 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          <div className="w-full h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="w-12 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
              <div className="w-8 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-3 sm:p-6">
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-sm t1 font-medium mb-1">Could not load your dashboard</p>
          <p className="text-xs t3 mb-4">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  if (!data || data.admin) return null

  const { agent, stats, usage, recentCalls, capabilities } = data
  const usagePct = usage.totalAvailable > 0 ? Math.min((usage.minutesUsed / usage.totalAvailable) * 100, 100) : 0
  const usageHigh = usagePct >= 80

  // Build action items
  const actions: { text: string; link: string; priority: 'high' | 'medium' | 'low' }[] = []

  if (!capabilities.hasFacts && !capabilities.hasFaqs) {
    actions.push({ text: 'Teach your agent about your business', link: '/dashboard/settings', priority: 'high' })
  }
  if (!capabilities.hasWebsite) {
    actions.push({ text: 'Add your website to teach your agent more', link: '/dashboard/settings', priority: 'medium' })
  }
  if (!capabilities.hasHours) {
    actions.push({ text: 'Set your business hours', link: '/dashboard/settings', priority: 'medium' })
  }
  if (stats.totalCalls === 0) {
    actions.push({ text: 'Test your agent with a call', link: '/dashboard/settings', priority: 'high' })
  }
  if (usageHigh) {
    actions.push({ text: `${usage.minutesUsed} of ${usage.totalAvailable} minutes used this month`, link: '/dashboard/settings', priority: 'high' })
  }

  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Hero card */}
      <div className="rounded-2xl border bg-surface p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-2.5 h-2.5 rounded-full ${agent.status === 'active' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <h1 className="text-lg font-semibold t1">{agent.name}</h1>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
            agent.status === 'active'
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {agent.status === 'active' ? 'Live' : agent.status}
          </span>
        </div>

        {/* Big stat */}
        <div className="mb-4">
          <p className="text-3xl font-bold t1 tracking-tight">
            {stats.totalCalls}
            <span className="text-base font-normal t3 ml-2">
              call{stats.totalCalls !== 1 ? 's' : ''} this month
            </span>
          </p>
          <TrendBadge value={stats.trends.callsChange} />
        </div>

        {/* Minutes usage bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] t3">
              <span className={`font-semibold ${usageHigh ? 'text-amber-400' : 't1'}`}>{usage.minutesUsed}</span> of {usage.totalAvailable} minutes used
            </p>
            <p className="text-[10px] t3">{Math.round(usagePct)}%</p>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <div
              className={`h-full rounded-full transition-all ${usageHigh ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usage.bonusMinutes > 0 && (
            <p className="text-[9px] t3 mt-1">Includes {usage.bonusMinutes} bonus minutes</p>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-[10px] font-semibold tracking-wide uppercase t3 mb-1">Hot Leads</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-red-400">{stats.hotLeads}</p>
            <TrendBadge value={stats.trends.hotChange} />
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-[10px] font-semibold tracking-wide uppercase t3 mb-1">Bookings</p>
          <p className="text-2xl font-bold t1">{stats.bookings}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-[10px] font-semibold tracking-wide uppercase t3 mb-1">Avg Quality</p>
          <p className="text-2xl font-bold t1">{stats.avgQuality !== null ? stats.avgQuality.toFixed(1) : '—'}</p>
        </div>
      </div>

      {/* Action items */}
      {actions.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Suggested Actions</p>
          {actions.map((action, i) => (
            <Link
              key={i}
              href={action.link}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                action.priority === 'high' ? 'bg-amber-400' : action.priority === 'medium' ? 'bg-blue-400' : 'bg-zinc-500'
              }`} />
              <span className="text-xs t2">{action.text}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 ml-auto shrink-0">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* Recent calls */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Recent Calls</p>
          <Link href="/dashboard/calls" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
            View all
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <p className="text-xs t3 py-4 text-center">No calls yet. Test your agent to get started.</p>
        ) : (
          <div className="space-y-1.5">
            {recentCalls.map(call => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                {/* Status badge */}
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                  STATUS_COLORS[call.call_status] ?? STATUS_COLORS.JUNK
                }`}>
                  {call.call_status}
                </span>

                {/* Caller + summary */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium t1 truncate">{formatPhone(call.caller_phone)}</p>
                  {call.ai_summary && (
                    <p className="text-[10px] t3 truncate">{call.ai_summary}</p>
                  )}
                </div>

                {/* Duration + time */}
                <div className="text-right shrink-0">
                  <p className="text-[10px] t2">{formatDuration(call.duration_seconds)}</p>
                  <p className="text-[9px] t3">{timeAgo(call.started_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
