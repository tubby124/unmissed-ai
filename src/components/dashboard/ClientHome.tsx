'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatPhone } from '@/lib/format-phone'
import { createBrowserClient } from '@/lib/supabase/client'
import LiveCallBanner from '@/components/dashboard/LiveCallBanner'
import { useSearchParams } from 'next/navigation'
import { parseDashboardTab, type DashboardTab } from '@/lib/dashboard-routes'
import { useCallContext } from '@/contexts/CallContext'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import { deriveTrialPhase } from '@/lib/trial-display-state'
import { deriveHomePhase } from '@/lib/derive-home-phase'
import type { ActivationState } from '@/lib/derive-activation-state'
import StatusBadge from '@/components/dashboard/StatusBadge'
import ErrorCard from '@/components/dashboard/ErrorCard'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'
import { useHomeSheet } from '@/hooks/useHomeSheet'

// Phase section components (Wave 2 decomposition)
import TrialExpiredSection from './home/TrialExpiredSection'
import TrialActiveSection from './home/TrialActiveSection'
import UnifiedHomeSection from './home/UnifiedHomeSection'
// Shared bento-level components kept at this level
import TrialWelcomeBanner from './home/TrialWelcomeBanner'
import HomeSideSheet from './home/HomeSideSheet'


export interface HomeData {
  admin: boolean
  clientId: string | null
  agent: { name: string; status: string; niche: string | null; voiceStylePreset: string | null }
  stats: {
    totalCalls: number
    hotLeads: number
    bookings: number
    avgQuality: number | null
    todayCalls: number
    missedThisMonth: number
    lastCallAt: string | null
    timeSavedMinutes: number
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
    emailNotificationsEnabled: boolean
    telegramNotificationsEnabled: boolean
  }
  trialWelcome: {
    businessName: string
    agentName: string
    daysLeft: number | null
    isTrialExpired: boolean
    isFirstVisit: boolean
    hasHours: boolean
    hasFaqs: boolean
    hasWebsite: boolean
    hasForwardingNumber: boolean
    hasGbp: boolean
    hasFacts: boolean
    compiledChunkCount: number
    provisioningState: 'ready' | 'pending' | 'incomplete'
  }
  editableFields: {
    hoursWeekday: string | null
    hoursWeekend: string | null
    afterHoursBehavior: string | null
    afterHoursPhone: string | null
    faqs: { q: string; a: string }[]
    forwardingNumber: string | null
    websiteUrl: string | null
    businessFacts: string | null
    injectedNote: string | null
    ivrEnabled: boolean
    ivrPrompt: string | null
    voicemailGreetingText: string | null
    smsEnabled: boolean
    smsTemplate: string | null
    hasContextData: boolean
  }
  // New fields added in Phase 1
  selectedPlan: string | null
  callHandlingMode: string | null
  websiteScrapeStatus: string | null
  activation: {
    state: ActivationState
    twilio_number_present: boolean
    setup_complete: boolean | null
  }
  knowledge: {
    approved_chunk_count: number
    pending_review_count: number
    source_types: string[]
    last_updated_at: string | null
  }
  agentSync?: {
    last_agent_sync_at: string | null
    last_agent_sync_status: string | null
  }
  insights?: {
    knowledgeCoverage: number | null
    openGaps: number
  }
  lastCallTopics?: {
    id: string
    client_id: string
    topics: string[]
  } | null
  lastFaqSuggestions?: { q: string; a: string }[] | null
  calendarConnected: boolean
  twilioNumber?: string | null
  agentHealth?: 'healthy' | 'degraded' | 'offline'
  activeServicesCount?: number
  returningCallerCount?: number
  firstCallAt?: string | null
  gbpData?: {
    placeId: string | null
    summary: string | null
    rating: number | null
    reviewCount: number | null
    photoUrl: string | null
  } | null
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
  const [welcomeDismissed, setWelcomeDismissed] = useState(true)
  const [postCallDismissed, setPostCallDismissed] = useState(false)
  const [liveCalls, setLiveCalls] = useState<{ id: string; ultravox_call_id: string; caller_phone: string | null; started_at: string; business_name?: string | null; transfer_status?: string | null }[]>([])
  const hasTrackedCallEnd = useRef(false)
  const hasAutoOpenedUpgrade = useRef(false)
  const searchParams = useSearchParams()
  const adminClientId = searchParams.get('client_id')
  const activeTab = parseDashboardTab(searchParams.get('tab'))
  const { callState } = useCallContext()
  const { openUpgradeModal } = useUpgradeModal()
  const sheet = useHomeSheet()

  useEffect(() => {
    setWelcomeDismissed(localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true')
  }, [])

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
    if (!data) return
    const phase = deriveTrialPhase({
      subscriptionStatus: data.onboarding.subscriptionStatus,
      daysLeft: data.trialWelcome.daysLeft,
      isTrialExpired: data.trialWelcome.isTrialExpired,
    })
    if (phase === 'expired') trackEvent('trial_expired_viewed')
    else if (phase === 'active_final') trackEvent('final_day_trial_seen')
    else if (phase === 'active_urgent') trackEvent('urgent_trial_banner_seen')
  }, [data])

  useEffect(() => {
    if (hasAutoOpenedUpgrade.current) return
    if (searchParams.get('upgrade') !== '1') return
    if (!data) return
    hasAutoOpenedUpgrade.current = true
    openUpgradeModal('locked_route', data.clientId, data.trialWelcome.daysLeft ?? undefined)
    const cleaned = new URL(window.location.href)
    cleaned.searchParams.delete('upgrade')
    window.history.replaceState({}, '', cleaned.toString())
  }, [data, searchParams, openUpgradeModal])

  const fetchData = useCallback(() => {
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

  useEffect(() => { fetchData() }, [fetchData])

  // Sync liveCalls from initial home data load
  useEffect(() => {
    if (!data) return
    setLiveCalls(data.recentCalls.filter(c => c.call_status === 'live').map(c => ({
      id: c.id,
      ultravox_call_id: c.ultravox_call_id,
      caller_phone: c.caller_phone,
      started_at: c.started_at,
      business_name: null,
      transfer_status: null,
    })))
  }, [data])

  // Realtime subscription — live calls for this client appear/disappear instantly
  useEffect(() => {
    if (!data?.clientId) return
    const clientId = data.clientId
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`live-calls-${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'call_logs',
        filter: `client_id=eq.${clientId}`,
      }, () => {
        // Re-fetch live calls when any call_log changes for this client
        supabase
          .from('call_logs')
          .select('id, ultravox_call_id, caller_phone, started_at, transfer_status')
          .eq('client_id', clientId)
          .eq('call_status', 'live')
          .order('started_at', { ascending: false })
          .then(({ data: rows }) => {
            setLiveCalls((rows ?? []).map(r => ({
              id: r.id,
              ultravox_call_id: r.ultravox_call_id,
              caller_phone: r.caller_phone,
              started_at: r.started_at,
              business_name: null,
              transfer_status: r.transfer_status ?? null,
            })))
          })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [data?.clientId])

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

  const { agent, stats, recentCalls, onboarding } = data

  const homeClientId = data.clientId
  const daysRemaining = data.trialWelcome.daysLeft ?? undefined

  const trialPhase = deriveTrialPhase({
    subscriptionStatus: onboarding.subscriptionStatus,
    daysLeft: data.trialWelcome.daysLeft,
    isTrialExpired: data.trialWelcome.isTrialExpired,
  })
  const homePhase = deriveHomePhase(trialPhase, data.activation?.state ?? 'awaiting_number')
  const isTrial = trialPhase !== 'paid_or_non_trial'
  const isTrialActive = trialPhase !== 'expired' && trialPhase !== 'paid_or_non_trial'
  const isExpired = trialPhase === 'expired'
  const showChecklist = onboarding.clientStatus === 'active' && !isExpired
  const hasRealCalls = stats.totalCalls > 0
  const justUpgraded = searchParams.get('upgraded') === 'true'

  // ProofStrip: most recent completed call from recentCalls (not 'live')
  const lastCompletedCall = recentCalls.find(c => c.call_status !== 'live') ?? null

  function dismissWelcome() {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    setWelcomeDismissed(true)
    trackEvent('trial_welcome_banner_dismissed', { trial_phase: trialPhase })
  }

  return (
    <>
      <div className="p-3 sm:p-6 space-y-4">

        {/* ── Live call banner — realtime, appears when a call is active ── */}
        <LiveCallBanner calls={liveCalls} />

        {/* ── Upgrade success banner ─────────────────────────────── */}
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

        {/* ── Trial welcome banner (active trials, dismissable) ─── */}
        {isTrialActive && !welcomeDismissed && (
          <TrialWelcomeBanner
            trialPhase={trialPhase}
            agentName={data.trialWelcome.agentName}
            daysLeft={data.trialWelcome.daysLeft}
            provisioningState={data.trialWelcome.provisioningState}
            onDismiss={dismissWelcome}
          />
        )}

        {/* ── Tab segmented control ──────────────────────────────── */}
        {(() => {
          const tabs: { id: DashboardTab; label: string }[] = [
            { id: 'overview', label: 'Overview' },
            { id: 'activity', label: 'Activity' },
          ]
          return (
            <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-hover)' }}>
              {tabs.map(({ id, label }) => {
                const p = new URLSearchParams(searchParams.toString())
                if (id === 'overview') { p.delete('tab'); p.delete('section') }
                else { p.set('tab', id); p.delete('section') }
                const q = p.toString()
                return (
                  <Link
                    key={id}
                    href={q ? `?${q}` : '?'}
                    replace
                    className="flex-1 py-2 text-center text-sm font-medium rounded-lg transition-colors"
                    style={activeTab === id
                      ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)', boxShadow: 'var(--shadow-sm)' }
                      : { color: 'var(--color-text-3)' }
                    }
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          )
        })()}

        {activeTab === 'overview' && (<>
          {homePhase === 'trial_expired' && (
            <TrialExpiredSection
              clientId={homeClientId}
              onUpgradeClick={() => openUpgradeModal('trial_expired_hero', homeClientId)}
            />
          )}
          {/* First-visit welcome screen — intentionally distinct one-time onboarding moment */}
          {homePhase === 'trial_active' && data.trialWelcome.isFirstVisit && (
            <TrialActiveSection
              data={data}
              trialPhase={trialPhase}
              daysRemaining={daysRemaining}
              isTrial={isTrial}
              isFirstVisit={true}
              showChecklist={showChecklist}
              hasRealCalls={hasRealCalls}
              lastCompletedCall={lastCompletedCall}
              postCallDismissed={postCallDismissed}
              onPostCallDismiss={() => setPostCallDismissed(true)}
              sheet={sheet}
              fetchData={fetchData}
            />
          )}
          {/* Unified layout for returning trial users, paid-awaiting, and paid-ready */}
          {(homePhase === 'paid_ready' ||
            homePhase === 'paid_awaiting' ||
            (homePhase === 'trial_active' && !data.trialWelcome.isFirstVisit)) && (
            <UnifiedHomeSection
              data={data}
              isTrial={isTrial}
              isPaidAwaiting={homePhase === 'paid_awaiting'}
              daysRemaining={daysRemaining}
              sheet={sheet}
              fetchData={fetchData}
            />
          )}
        </>)}

        {activeTab === 'activity' && (<>

        {/* ── Quick stats row (real calls only) ─────────────────── */}
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

        {/* ── Recent calls ───────────────────────────────────────── */}
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
              {recentCalls.map(call => {
                const isTestCall = call.call_status === 'test'
                const row = (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-hover"
                  >
                    <span className="shrink-0">
                      {isTestCall ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}>Test</span>
                      ) : (
                        <StatusBadge status={call.call_status} showDot={false} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium t1 truncate">
                        {isTestCall ? 'Browser test call' : formatPhone(call.caller_phone)}
                      </p>
                      {!isTestCall && call.ai_summary && (
                        <p className="text-[11px] t3 truncate">{call.ai_summary}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] t2">{formatDuration(call.duration_seconds)}</p>
                      <p className="text-[11px] t3">{timeAgo(call.started_at)}</p>
                    </div>
                  </div>
                )
                return isTestCall ? row : (
                  <Link key={call.id} href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`} className="block cursor-pointer">
                    {row}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        </>)}

      </div>

      {/* ── HomeSideSheet — single host for all 6 sheet types ─── */}
      <HomeSideSheet
        openSheet={sheet.openSheet}
        onClose={sheet.close}
        markDirty={sheet.markDirty}
        markClean={sheet.markClean}
        clientId={homeClientId}
        isAdmin={false}
        agentName={agent.name}
        editableFields={data.editableFields}
        websiteScrapeStatus={data.websiteScrapeStatus}
        knowledge={data.knowledge}
        selectedPlan={data.selectedPlan}
        subscriptionStatus={onboarding.subscriptionStatus}
        telegramConnected={onboarding.telegramConnected}
        smsEnabled={data.capabilities.hasSms}
        hasTwilioNumber={data.activation.twilio_number_present}
        onDataRefresh={fetchData}
      />
    </>
  )
}
