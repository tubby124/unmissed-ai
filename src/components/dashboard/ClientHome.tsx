'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import StatusBadge from '@/components/dashboard/StatusBadge'
import ErrorCard from '@/components/dashboard/ErrorCard'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

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
  onboarding: {
    businessName: string
    clientStatus: string | null
    hasPhoneNumber: boolean
    hasAgent: boolean
    telegramConnected: boolean
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

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const isUp = value > 0
  return (
    <span className={`text-[11px] font-medium ${isUp ? 'text-green-400' : value < 0 ? 'text-red-400' : 't3'}`}>
      {isUp ? '+' : ''}{value}%
    </span>
  )
}

export default function ClientHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')

  useEffect(() => {
    const url = clientId
      ? `/api/dashboard/home?client_id=${clientId}`
      : '/api/dashboard/home'
    fetch(url, { signal: AbortSignal.timeout(10000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <div className="p-3 sm:p-6 space-y-6">
        <SkeletonBox className="w-48 h-6" />
        <div className="rounded-2xl p-6 space-y-3 card-surface">
          <SkeletonBox className="w-64 h-5" />
          <SkeletonBox className="w-40 h-8" />
          <SkeletonBox className="w-full h-3 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl p-4 space-y-2 card-surface">
              <SkeletonBox className="w-12 h-3" />
              <SkeletonBox className="w-8 h-6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-3 sm:p-6">
        <ErrorCard
          title="Could not load your dashboard"
          message="Check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (!data) return null
  if (data.admin) return null // No client selected — should not reach here in preview mode

  const { agent, stats, usage, recentCalls, capabilities, onboarding } = data
  const usagePct = usage.totalAvailable > 0 ? Math.min((usage.minutesUsed / usage.totalAvailable) * 100, 100) : 0
  const usageHigh = usagePct >= 80

  const isTrial = onboarding.clientStatus === 'trial'
  const showChecklist = onboarding.clientStatus === 'trial' || onboarding.clientStatus === 'active'
  const hasRealCalls = stats.totalCalls > 0

  // Build action items (suppressed when checklist is visible — they duplicate)
  const actions: { text: string; link: string; priority: 'high' | 'medium' | 'low' }[] = []

  if (!showChecklist) {
    if (!capabilities.hasFacts && !capabilities.hasFaqs) {
      actions.push({ text: 'Teach your agent about your business', link: '/dashboard/settings?tab=knowledge', priority: 'high' })
    }
    if (!capabilities.hasWebsite) {
      actions.push({ text: 'Add your website to teach your agent more', link: '/dashboard/settings?tab=knowledge', priority: 'medium' })
    }
    if (!capabilities.hasHours) {
      actions.push({ text: 'Set your business hours', link: '/dashboard/settings?tab=agent', priority: 'medium' })
    }
    if (usageHigh) {
      actions.push({ text: `${usage.minutesUsed} of ${usage.totalAvailable} minutes used this month`, link: '/dashboard/settings?tab=billing', priority: 'high' })
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Test your agent — the aha moment */}
      {onboarding.hasAgent && (
        <AgentTestCard
          agentName={agent.name}
          businessName={onboarding.businessName}
          clientStatus={onboarding.clientStatus}
        />
      )}

      {/* Onboarding checklist */}
      {showChecklist && (
        <OnboardingChecklist
          hasPhoneNumber={onboarding.hasPhoneNumber}
          hasReceivedCall={hasRealCalls}
          telegramConnected={onboarding.telegramConnected}
          hasKnowledge={capabilities.hasKnowledge}
          isTrial={isTrial}
        />
      )}

      {/* Hero card */}
      <div data-tour="agent-hero" className="rounded-2xl p-5 sm:p-6 card-surface">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-2.5 h-2.5 rounded-full ${isTrial ? 'bg-amber-400' : agent.status === 'active' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <h1 className="text-lg font-semibold t1">{agent.name}</h1>
          {isTrial ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Trial
            </span>
          ) : (
            <span
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: agent.status === 'active' ? 'var(--color-success-tint)' : 'var(--color-warning-tint)',
                color: agent.status === 'active' ? 'var(--color-success)' : 'var(--color-warning)',
              }}
            >
              {agent.status === 'active' ? 'Live' : agent.status}
            </span>
          )}
        </div>

        {/* Big stat */}
        <div className="mb-4">
          <p className="text-3xl font-bold t1 tracking-tight">
            {stats.totalCalls}
            <span className="text-sm font-normal t3 ml-2">
              call{stats.totalCalls !== 1 ? 's' : ''} this month
            </span>
          </p>
          <TrendBadge value={stats.trends.callsChange} />
        </div>

        {/* Minutes usage bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12px] t3">
              <span className={`font-semibold ${usageHigh ? 'text-amber-400' : 't1'}`}>{usage.minutesUsed}</span> of {usage.totalAvailable} minutes used
            </p>
            <p className="text-[11px] t3">{Math.round(usagePct)}%</p>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-hover)' }}>
            <div
              className={`h-full rounded-full transition-all ${usageHigh ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usage.bonusMinutes > 0 && (
            <p className="text-[11px] t3 mt-1">Includes {usage.bonusMinutes} bonus minutes</p>
          )}
        </div>
      </div>

      {/* Quick stats row — hidden until first real call */}
      {hasRealCalls && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 card-surface">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Hot Leads</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-red-400">{stats.hotLeads}</p>
              <TrendBadge value={stats.trends.hotChange} />
            </div>
          </div>
          <div className="rounded-2xl p-4 card-surface">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Bookings</p>
            <p className="text-2xl font-bold t1">{stats.bookings}</p>
          </div>
          <div className="rounded-2xl p-4 card-surface col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Avg Quality</p>
            <p className="text-2xl font-bold t1">{stats.avgQuality !== null ? stats.avgQuality.toFixed(1) : '—'}</p>
          </div>
        </div>
      )}

      {/* Action items */}
      {actions.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2 card-surface">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">Suggested Actions</p>
          {actions.map((action, i) => (
            <Link
              key={i}
              href={action.link}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer hover:bg-hover"
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
      <div className="rounded-2xl p-4 card-surface">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">Recent Calls</p>
          <Link href="/dashboard/calls" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200">
            View all
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <p className="text-xs t3 py-4 text-center">No calls yet. Test your agent to get started.</p>
        ) : (
          <div className="space-y-1">
            {recentCalls.map(call => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer hover:bg-hover"
              >
                {/* Status badge */}
                <span className="shrink-0">
                  <StatusBadge status={call.call_status} showDot={false} />
                </span>

                {/* Caller + summary */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium t1 truncate">{formatPhone(call.caller_phone)}</p>
                  {call.ai_summary && (
                    <p className="text-[11px] t3 truncate">{call.ai_summary}</p>
                  )}
                </div>

                {/* Duration + time */}
                <div className="text-right shrink-0">
                  <p className="text-[11px] t2">{formatDuration(call.duration_seconds)}</p>
                  <p className="text-[11px] t3">{timeAgo(call.started_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
