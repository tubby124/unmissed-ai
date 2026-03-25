'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import PostCallImprovementPanel from '@/components/dashboard/PostCallImprovementPanel'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import { useCallContext } from '@/contexts/CallContext'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import StatusBadge from '@/components/dashboard/StatusBadge'
import ErrorCard from '@/components/dashboard/ErrorCard'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

interface HomeData {
  admin: boolean
  clientId: string | null
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
    subscriptionStatus: string | null
    trialExpiresAt: string | null
    servicesOffered: string | null
    agentVoiceId: string | null
    hasPhoneNumber: boolean
    hasAgent: boolean
    telegramConnected: boolean
  }
  trialWelcome: {
    businessName: string
    agentName: string
    daysLeft: number | null
    isFirstVisit: boolean
    hasHours: boolean
    hasFaqs: boolean
    hasWebsite: boolean
    hasForwardingNumber: boolean
    provisioningState: 'ready' | 'pending' | 'incomplete'
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

const WELCOME_DISMISSED_KEY = 'trial_welcome_dismissed'

export default function ClientHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [welcomeDismissed, setWelcomeDismissed] = useState(true) // start dismissed to avoid flash
  const [postCallDismissed, setPostCallDismissed] = useState(false)
  const hasTrackedCallEnd = useRef(false)
  const searchParams = useSearchParams()
  const adminClientId = searchParams.get('client_id') // admin cloak param
  const { callState, resetCall } = useCallContext()
  const { openUpgradeModal } = useUpgradeModal()

  useEffect(() => {
    setWelcomeDismissed(localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true')
  }, [])

  // Track test_call_completed once per call cycle; reset dismissed state on next call
  useEffect(() => {
    if (callState === 'ended' && !hasTrackedCallEnd.current) {
      hasTrackedCallEnd.current = true
      trackEvent('test_call_completed')
    }
    if (callState === 'idle') {
      hasTrackedCallEnd.current = false
      setPostCallDismissed(false)
    }
  }, [callState])

  useEffect(() => {
    const url = adminClientId
      ? `/api/dashboard/home?client_id=${adminClientId}`
      : '/api/dashboard/home'
    fetch(url, { signal: AbortSignal.timeout(10000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [adminClientId])

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
  if (data.admin) return null

  const { agent, stats, usage, recentCalls, capabilities, onboarding } = data
  const usagePct = usage.totalAvailable > 0 ? Math.min((usage.minutesUsed / usage.totalAvailable) * 100, 100) : 0
  const usageHigh = usagePct >= 80

  const isTrial = onboarding.subscriptionStatus === 'trialing'
  const homeClientId = data.clientId
  const daysRemaining = data.trialWelcome.daysLeft ?? undefined
  const showChecklist = onboarding.clientStatus === 'active'
  const hasRealCalls = stats.totalCalls > 0
  const justUpgraded = searchParams.get('upgraded') === 'true'

  function dismissWelcome() {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    setWelcomeDismissed(true)
  }

  // Action items (non-trial only — trial has focused guidance cards)
  const actions: { text: string; link: string; priority: 'high' | 'medium' | 'low' }[] = []
  if (!isTrial && !showChecklist) {
    if (!capabilities.hasFacts && !capabilities.hasFaqs) {
      actions.push({ text: 'Teach your agent about your business', link: '/dashboard/settings?tab=knowledge', priority: 'high' })
    }
    if (!capabilities.hasWebsite) {
      actions.push({ text: 'Add your website to teach your agent more', link: '/dashboard/settings?tab=knowledge', priority: 'medium' })
    }
    if (!capabilities.hasHours) {
      actions.push({ text: 'Set your business hours', link: '/dashboard/setup', priority: 'medium' })
    }
    if (usageHigh) {
      actions.push({ text: `${usage.minutesUsed} of ${usage.totalAvailable} minutes used this month`, link: '/dashboard/settings?tab=billing', priority: 'high' })
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">

      {/* Upgrade success — shown when Stripe redirects back with ?upgraded=true */}
      {justUpgraded && (
        <div
          className="rounded-2xl p-4 sm:p-5 flex items-start gap-3"
          style={{ background: 'var(--color-success-tint)', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p className="text-sm font-semibold t1">You&apos;re upgraded — welcome to the team</p>
            <p className="text-xs t3 mt-0.5 leading-relaxed">Your account is now active. Complete your phone setup to start receiving real calls.</p>
            <a href="/dashboard/setup" className="text-xs font-semibold mt-2 inline-block" style={{ color: 'var(--color-primary)' }}>
              Finish setup →
            </a>
          </div>
        </div>
      )}

      {/* Trial welcome banner — dismissable */}
      {isTrial && !welcomeDismissed && (
        <div
          className="rounded-2xl p-4 sm:p-5 relative"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-tint) 0%, var(--color-surface) 100%)', border: '1px solid var(--color-border)' }}
        >
          <button
            onClick={dismissWelcome}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-hover transition-colors"
            style={{ color: 'var(--color-text-3)' }}
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold t1">
                  {data.trialWelcome.provisioningState === 'ready'
                    ? `${data.trialWelcome.agentName} is ready to test`
                    : data.trialWelcome.provisioningState === 'pending'
                    ? `${data.trialWelcome.agentName} is being set up`
                    : 'Your agent is being provisioned'}
                </p>
                {data.trialWelcome.daysLeft !== null && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap">
                    {data.trialWelcome.daysLeft} day{data.trialWelcome.daysLeft !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>
              <p className="text-xs t3 mt-1 leading-relaxed">
                {data.trialWelcome.provisioningState === 'ready'
                  ? "Everything's ready. Start a test call to hear how it handles real callers."
                  : data.trialWelcome.provisioningState === 'pending'
                  ? "We're still setting up part of your account. You can start testing now."
                  : 'Your agent is still being provisioned. Check back shortly.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial label above the orb */}
      {isTrial && onboarding.hasAgent && (
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase -mb-2" style={{ color: 'var(--color-primary)' }}>
          Your AI receptionist is ready — call it now
        </p>
      )}

      {/* Test your agent — the aha moment */}
      {onboarding.hasAgent && (
        <AgentTestCard
          agentName={agent.name}
          businessName={onboarding.businessName}
          clientStatus={onboarding.clientStatus}
          isTrial={isTrial}
          clientId={homeClientId}
          daysRemaining={daysRemaining}
        />
      )}

      {/* Post-call improvement loop — trial users only, shown after each completed test call */}
      {isTrial && callState === 'ended' && !postCallDismissed && data.trialWelcome && (
        <PostCallImprovementPanel
          hasHours={data.trialWelcome.hasHours}
          hasFaqs={data.trialWelcome.hasFaqs}
          hasForwardingNumber={data.trialWelcome.hasForwardingNumber}
          onDismiss={() => { trackEvent('post_call_improvement_dismissed'); setPostCallDismissed(true) }}
          onRetest={resetCall}
          clientId={homeClientId}
          daysRemaining={daysRemaining}
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

      {/* Hero stats card — hidden for trial users with no calls (avoid sad "0 calls" state) */}
      {(!isTrial || hasRealCalls) && (
        <div data-tour="agent-hero" className="rounded-2xl p-5 sm:p-6 card-surface">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-2.5 h-2.5 rounded-full ${agent.status === 'active' ? 'bg-green-400' : 'bg-amber-400'}`} />
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

          <div className="mb-4">
            <p className="text-3xl font-bold t1 tracking-tight">
              {stats.totalCalls}
              <span className="text-sm font-normal t3 ml-2">
                call{stats.totalCalls !== 1 ? 's' : ''} this month
              </span>
            </p>
            <TrendBadge value={stats.trends.callsChange} />
          </div>

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
      )}

      {/* What Your Agent Knows — trial users */}
      {isTrial && (
        <div className="rounded-2xl p-4 card-surface">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">What callers experience</p>
            <Link href="/dashboard/settings?tab=knowledge" className="text-[12px] font-medium hover:opacity-75 transition-opacity" style={{ color: 'var(--color-primary)' }}>
              Improve →
            </Link>
          </div>
          <div className="space-y-2.5">
            {onboarding.servicesOffered && (
              <div className="flex items-start gap-3">
                <span className="text-[11px] font-medium t3 w-20 shrink-0 pt-0.5">Services</span>
                <span className="text-[11px] t2 flex-1 leading-relaxed">{onboarding.servicesOffered}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium t3 w-20 shrink-0">Hours</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full leading-none ${data.trialWelcome.hasHours ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {data.trialWelcome.hasHours ? 'Configured' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium t3 w-20 shrink-0">FAQs</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full leading-none ${data.trialWelcome.hasFaqs ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {data.trialWelcome.hasFaqs ? 'Configured' : 'None added yet'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium t3 w-20 shrink-0">Knowledge</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full leading-none ${capabilities.hasKnowledge ? 'bg-green-500/10 text-green-400' : capabilities.hasFacts ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {capabilities.hasKnowledge ? 'Website loaded' : capabilities.hasFacts ? 'Facts added' : 'Basic only'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium t3 w-20 shrink-0">Booking</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full leading-none ${capabilities.hasBooking ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                {capabilities.hasBooking ? 'Calendar connected' : 'Not connected'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Subtle upgrade nudge — trial only */}
      {isTrial && (
        <div className="text-center pb-1">
          <button
            onClick={() => openUpgradeModal('home_quiet_nudge', homeClientId, daysRemaining)}
            className="text-xs t3 hover:opacity-75 transition-opacity cursor-pointer"
          >
            Ready to take real calls? Get a phone number →
          </button>
        </div>
      )}

      {/* Quick stats row — only when there are real calls */}
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

      {/* Action items — non-trial only */}
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
          <Link href="/dashboard/calls" className="text-[12px] font-medium hover:opacity-75 transition-opacity" style={{ color: 'var(--color-primary)' }}>
            View all
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <p className="text-xs t3 py-4 text-center">No calls yet. Test your agent above to get started.</p>
        ) : (
          <div className="space-y-1">
            {recentCalls.map(call => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer hover:bg-hover"
              >
                <span className="shrink-0">
                  <StatusBadge status={call.call_status} showDot={false} />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium t1 truncate">{formatPhone(call.caller_phone)}</p>
                  {call.ai_summary && (
                    <p className="text-[11px] t3 truncate">{call.ai_summary}</p>
                  )}
                </div>

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
