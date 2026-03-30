'use client'

import { useState } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { useCallContext } from '@/contexts/CallContext'
import AutoFaqSuggestions from '../AutoFaqSuggestions'
import ActivationTile from './ActivationTile'
import BillingTile from './BillingTile'
import CapabilitiesCard from '../CapabilitiesCard'
import NotificationsTile from './NotificationsTile'
import StatsHeroCard from './StatsHeroCard'
import TodayUpdateCard from './TodayUpdateCard'
import TrialModeSwitcher from './TrialModeSwitcher'
import KnowledgeSourcesTile from './KnowledgeSourcesTile'
import KnowledgeTextInput from '@/components/dashboard/knowledge/KnowledgeTextInput'
import NicheInsightsTile from './NicheInsightsTile'
import BookingCalendarTile from './BookingCalendarTile'
import KnowledgeInlineTile from './KnowledgeInlineTile'
import UnansweredQuestionsTile from './UnansweredQuestionsTile'
import IvrVoicemailTile from './IvrVoicemailTile'
import PostCallActionsTile from './PostCallActionsTile'
import CallHandlingTile from './CallHandlingTile'
import BusinessHoursTile from './BusinessHoursTile'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

// ── Inline helpers ───────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function formatNiche(niche: string | null): string {
  if (!niche) return 'General'
  return niche.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const VOICE_PRESET_LABELS: Record<string, string> = {
  casual_friendly: 'Casual & friendly',
  professional_warm: 'Professional & warm',
  formal: 'Formal',
  energetic: 'Energetic',
  empathetic: 'Empathetic',
}
function formatVoicePreset(preset: string | null): string {
  if (!preset) return 'Professional & warm'
  return VOICE_PRESET_LABELS[preset] ?? preset.replace(/_/g, ' ')
}

function formatTimeSaved(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Props ────────────────────────────────────────────────────────
interface Props {
  data: HomeData
  /** true when subscription_status is trialing */
  isTrial: boolean
  /** true when homePhase === 'paid_awaiting' (paid but no phone number yet) */
  isPaidAwaiting: boolean
  daysRemaining?: number
  sheet: ReturnType<typeof useHomeSheet>
  fetchData: () => void
}

// ── Component ────────────────────────────────────────────────────
export default function UnifiedHomeSection({
  data,
  isTrial,
  isPaidAwaiting,
  daysRemaining,
  sheet,
  fetchData,
}: Props) {
  const { agent, capabilities, onboarding, calendarConnected } = data
  const { openUpgradeModal } = useUpgradeModal()
  const { resetCall } = useCallContext()
  const [activityOpen, setActivityOpen] = useState(data.recentCalls.length > 0)
  const [syncDismissed, setSyncDismissed] = useState(false)
  const [hotDismissed, setHotDismissed] = useState(false)

  const faqCount = data.editableFields.faqs.length
  const todayStr = new Date().toISOString().slice(0, 10)
  const callsToday = data.recentCalls.filter(c => c.started_at.slice(0, 10) === todayStr).length
  const mostRecentCall = data.recentCalls[0] ?? null
  const missedCount = data.recentCalls.filter(
    c => c.call_status === 'missed' || c.call_status === 'VOICEMAIL' || c.call_status === 'voicemail'
  ).length
  const activitySummaryText = (() => {
    if (data.recentCalls.length === 0) return 'No calls yet'
    const parts: string[] = [`${data.recentCalls.length} call${data.recentCalls.length !== 1 ? 's' : ''}`]
    if (mostRecentCall) parts.push(`last ${timeAgo(mostRecentCall.started_at)}`)
    if (missedCount > 0) parts.push(`${missedCount} missed`)
    return parts.join(' · ')
  })()

  const nextAction: { text: string; cta: string; href: string | null; onUpgrade?: boolean } | null = (() => {
    if (!capabilities.hasFacts && faqCount === 0 && !capabilities.hasWebsite) {
      return { text: "Agent doesn't know your business yet", cta: 'Add facts →', href: '/dashboard/knowledge?tab=add&source=manual' }
    }
    if (!capabilities.hasHours) {
      return { text: "Agent can't tell callers your hours", cta: 'Set hours →', href: '/dashboard/actions#hours' }
    }
    if (!capabilities.hasWebsite && !capabilities.hasKnowledge) {
      return { text: 'Add your website to teach your agent more', cta: 'Add website →', href: '/dashboard/knowledge' }
    }
    if (isTrial && !onboarding.hasPhoneNumber) {
      return { text: 'Upgrade to go live with a real phone number', cta: 'Upgrade →', href: null, onUpgrade: true }
    }
    if (capabilities.hasBooking && !calendarConnected) {
      return { text: 'Connect Google Calendar so your agent can book appointments', cta: 'Connect →', href: '/dashboard/settings?tab=general' }
    }
    if (!onboarding.telegramConnected) {
      return { text: 'Get instant call alerts on Telegram', cta: 'Connect →', href: '/dashboard/settings?tab=notifications' }
    }
    return null
  })()

  return (
    <>
      {/* ── Trial countdown pill ─────────────────────────────────── */}
      {isTrial && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--color-primary)' }}>
            Trial
          </span>
          {daysRemaining !== undefined && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
            </span>
          )}
        </div>
      )}

      {/* ── Paid awaiting — activation setup tile ───────────────── */}
      {isPaidAwaiting && data.activation && (
        <ActivationTile
          state={data.activation.state}
          onOpenForwardingSheet={() => sheet.open('forwarding')}
          onRefreshClick={fetchData}
        />
      )}

      {/* ── Sync error banner ─────────────────────────────────────── */}
      {!syncDismissed && data.agentSync?.last_agent_sync_status === 'error' && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)', flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-[12px] flex-1" style={{ color: 'rgb(239,68,68)' }}>Agent sync failed — your latest settings may not be live</p>
          <Link
            href="/dashboard/settings?tab=general"
            className="text-[12px] font-semibold hover:opacity-75 transition-opacity shrink-0"
            style={{ color: 'rgb(239,68,68)' }}
          >
            Fix →
          </Link>
          <button
            onClick={() => setSyncDismissed(true)}
            aria-label="Dismiss"
            className="ml-1 shrink-0 hover:opacity-60 transition-opacity leading-none"
            style={{ color: 'rgb(239,68,68)', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Next best action strip ───────────────────────────────── */}
      {nextAction && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-[12px] flex-1" style={{ color: 'var(--color-text-2)' }}>{nextAction.text}</p>
          {nextAction.onUpgrade ? (
            <button
              onClick={() => openUpgradeModal('next_action_strip', data.clientId, daysRemaining, data.selectedPlan)}
              className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--color-primary)' }}
            >
              {nextAction.cta}
            </button>
          ) : nextAction.href ? (
            <Link
              href={nextAction.href}
              className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--color-primary)' }}
            >
              {nextAction.cta}
            </Link>
          ) : null}
        </div>
      )}

      {/* ── HOT lead banner ─────────────────────────────────────── */}
      {!hotDismissed && data.stats.hotLeads > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Link
            href="/dashboard/calls"
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity"
          >
            <span className="text-[13px] shrink-0">🔥</span>
            <p className="text-[12px] flex-1 font-medium" style={{ color: 'rgb(239,68,68)' }}>
              {data.stats.hotLeads} HOT lead{data.stats.hotLeads !== 1 ? 's' : ''} this month — view now
            </p>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)', flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <button
            onClick={() => setHotDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 hover:opacity-60 transition-opacity leading-none"
            style={{ color: 'rgb(239,68,68)', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Activity stats strip ─────────────────────────────────── */}
      {data.stats.totalCalls > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            {callsToday > 0
              ? `${callsToday} call${callsToday !== 1 ? 's' : ''} today`
              : `${data.stats.totalCalls} call${data.stats.totalCalls !== 1 ? 's' : ''} total`}
          </span>
          {data.recentCalls[0] && (
            <>
              <span style={{ color: 'var(--color-text-3)' }}>·</span>
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                last {timeAgo(data.recentCalls[0].started_at)}
              </span>
            </>
          )}
          {data.usage.minutesUsed > 0 && (
            <>
              <span style={{ color: 'var(--color-text-3)' }}>·</span>
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                {formatTimeSaved(data.usage.minutesUsed)} handled
              </span>
            </>
          )}
        </div>
      )}

      {/* ── 3-col hero: Capabilities | TestCall | TodayUpdate + Stats ── */}
      {onboarding.hasAgent && data.clientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          <CapabilitiesCard
            capabilities={capabilities}
            agentName={agent.name}
            voiceStylePreset={agent.voiceStylePreset}
            isTrial={isTrial}
            clientId={data.clientId}
            hasPhoneNumber={onboarding.hasPhoneNumber}
            hasIvr={data.editableFields.ivrEnabled}
            hasContextData={data.editableFields.hasContextData}
            selectedPlan={data.selectedPlan}
          />
          <TestCallCard
            clientId={data.clientId}
            isAdmin={false}
            isTrial={isTrial}
            knowledge={{
              agentName: agent.name || undefined,
              hasFacts: !!(data.editableFields.businessFacts?.trim()),
              hasFaqs: faqCount > 0,
              hasHours: !!data.editableFields.hoursWeekday,
              hasBooking: capabilities.hasBooking,
              hasTransfer: capabilities.hasTransfer,
              hasSms: capabilities.hasSms,
              hasKnowledge: capabilities.hasKnowledge,
              hasWebsite: capabilities.hasWebsite,
            }}
          />
          <div className="space-y-3">
            {/* Trial: show mode switcher so they can configure before go-live */}
            {isTrial && (
              <TrialModeSwitcher
                clientId={data.clientId}
                subscriptionStatus={onboarding.subscriptionStatus}
                selectedPlan={data.selectedPlan}
                currentMode={data.callHandlingMode}
                hasBooking={capabilities.hasBooking}
                onRetest={resetCall}
              />
            )}
            <TodayUpdateCard
              clientId={data.clientId}
              currentNote={data.editableFields.injectedNote}
            />
            <StatsHeroCard
              agentName={agent.name}
              agentStatus={agent.status}
              isTrial={isTrial}
              isExpired={false}
              totalCalls={data.stats.totalCalls}
              callsTrend={data.stats.trends.callsChange}
              minutesUsed={data.usage.minutesUsed}
              totalAvailable={data.usage.totalAvailable}
              bonusMinutes={data.usage.bonusMinutes}
              onUpgrade={() => openUpgradeModal('home_stats_usage', data.clientId)}
            />
          </div>
        </div>
      )}

      {/* ── Recent calls accordion ───────────────────────────────── */}
      {data.recentCalls.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <button
            onClick={() => setActivityOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-hover transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                  Recent calls
                </p>
                <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                  {activitySummaryText}
                </span>
                {data.stats.missedThisMonth > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap">
                    {data.stats.missedThisMonth} voicemail{data.stats.missedThisMonth !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              className={`shrink-0 transition-transform duration-200 ${activityOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--color-text-3)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {activityOpen && (
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              {data.recentCalls.slice(0, 5).map(call => {
                const isTestCall = call.call_status === 'test'
                const row = (
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium t1">
                        {isTestCall ? 'Browser test call' : formatPhone(call.caller_phone)}
                      </p>
                      <p className="text-[11px] t3 capitalize">
                        {call.call_status.toLowerCase().replace(/_/g, ' ')}
                      </p>
                      {call.ai_summary && (
                        <p className="text-[10px] t3 leading-snug line-clamp-2 mt-0.5 italic">{call.ai_summary}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] t2">{formatDuration(call.duration_seconds)}</p>
                      <p className="text-[11px] t3">{timeAgo(call.started_at)}</p>
                    </div>
                  </div>
                )
                return isTestCall ? (
                  <div key={call.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>{row}</div>
                ) : (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`}
                    className="block cursor-pointer border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {row}
                  </Link>
                )
              })}
              <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link
                  href="/dashboard/calls"
                  className="text-[12px] font-medium cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  View all calls →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2-col: IVR + PostCall | Calendar ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {data.clientId ? (
          <div className="space-y-3">
            <IvrVoicemailTile
              clientId={data.clientId}
              isAdmin={false}
              ivrEnabled={data.editableFields.ivrEnabled}
              ivrPrompt={data.editableFields.ivrPrompt}
              voicemailGreetingText={data.editableFields.voicemailGreetingText}
              businessName={onboarding.businessName}
              agentName={agent.name}
            />
            <PostCallActionsTile
              clientId={data.clientId}
              isAdmin={false}
              smsEnabled={data.editableFields.smsEnabled}
              smsTemplate={data.editableFields.smsTemplate}
              hasSms={capabilities.hasSms}
              agentName={agent.name}
            />
          </div>
        ) : <div />}
        <BookingCalendarTile hasBooking={capabilities.hasBooking} calendarConnected={calendarConnected} />
      </div>

      {/* ── 2-col: CallHandling + BusinessHours ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
        <CallHandlingTile
          selectedPlan={data.selectedPlan}
          subscriptionStatus={onboarding.subscriptionStatus}
          capabilities={capabilities}
          knowledge={data.knowledge}
          callHandlingMode={data.callHandlingMode}
          onOpenSheet={sheet.open}
        />
        <BusinessHoursTile
          hoursWeekday={data.editableFields.hoursWeekday}
          hoursWeekend={data.editableFields.hoursWeekend}
          onOpenSheet={() => sheet.open('hours')}
        />
      </div>

      {/* ── 2-col: KnowledgeInline + Billing ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <KnowledgeInlineTile knowledgeStats={data.knowledge} />
        <BillingTile
          selectedPlan={data.selectedPlan}
          subscriptionStatus={onboarding.subscriptionStatus}
          onOpenSheet={() => sheet.open('billing')}
        />
      </div>

      {/* ── Identity strip ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => sheet.open('identity')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium cursor-pointer hover:opacity-75 transition-opacity"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-1)' }}
        >
          <div
            className="relative group flex items-center shrink-0"
            role="status"
            aria-label={`Agent status: ${data.agentHealth ?? 'unknown'}`}
          >
            <span
              className={['w-2 h-2 rounded-full', data.agentHealth === 'healthy' ? 'animate-pulse' : ''].join(' ')}
              style={{
                backgroundColor: data.agentHealth === 'healthy' ? 'rgb(34,197,94)' :
                  data.agentHealth === 'degraded' ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
              }}
            />
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 hidden group-hover:block z-20">
              <span
                className="text-[10px] px-2 py-1 rounded-md font-medium whitespace-nowrap shadow-md"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-2)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {data.agentHealth === 'healthy'
                  ? 'Agent is live'
                  : data.agentHealth === 'degraded'
                  ? 'Sync failed — settings may be stale'
                  : 'Agent offline'}
              </span>
            </div>
          </div>
          {agent.name}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {agent.niche && (
          <Link
            href="/dashboard/settings?tab=general"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] cursor-pointer hover:opacity-75 transition-opacity"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
          >
            {formatNiche(agent.niche)}
          </Link>
        )}

        <Link
          href="/dashboard/settings?tab=voice"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] cursor-pointer hover:opacity-75 transition-opacity"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {formatVoicePreset(agent.voiceStylePreset)}
        </Link>

        <button
          onClick={() => sheet.open('notifications')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] cursor-pointer hover:opacity-75 transition-opacity"
          style={{
            backgroundColor: onboarding.telegramConnected ? 'rgba(34,197,94,0.1)' : 'var(--color-hover)',
            color: onboarding.telegramConnected ? 'rgb(34,197,94)' : 'var(--color-text-3)',
          }}
        >
          {onboarding.telegramConnected ? 'Telegram ✓' : 'Connect Telegram →'}
        </button>

        <Link
          href="/dashboard/settings?tab=sms"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] cursor-pointer hover:opacity-75 transition-opacity"
          style={{
            backgroundColor: capabilities.hasSms ? 'rgba(34,197,94,0.1)' : 'var(--color-hover)',
            color: capabilities.hasSms ? 'rgb(34,197,94)' : 'var(--color-text-3)',
          }}
        >
          {capabilities.hasSms ? 'SMS on' : 'Enable SMS →'}
        </Link>

        {data.agentSync && (
          <AgentSyncBadge
            lastSyncAt={data.agentSync.last_agent_sync_at}
            lastSyncStatus={data.agentSync.last_agent_sync_status}
          />
        )}
      </div>

      {/* ── Knowledge sources (GBP + business facts editor) ──────── */}
      {data.clientId && (
        <KnowledgeSourcesTile
          gbpData={data.gbpData}
          editableFields={data.editableFields}
          websiteScrapeStatus={data.websiteScrapeStatus}
          clientId={data.clientId}
          onMutate={fetchData}
        />
      )}

      {/* ── Teach more ──────────────────────────────────────────── */}
      {data.clientId && (
        <div className="rounded-2xl border b-theme bg-surface p-4 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
            TEACH {agent.name?.toUpperCase() || 'YOUR AGENT'} MORE
          </p>
          <p className="text-[11px] t3">
            Paste anything — services, pricing, team bios, policies, FAQs. {agent.name || 'Your agent'} will learn it and use it on calls.
          </p>
          <KnowledgeTextInput clientId={data.clientId} isAdmin={false} compact />
        </div>
      )}

      {/* ── FAQ suggestions ──────────────────────────────────────── */}
      {data.clientId && data.lastFaqSuggestions && data.lastFaqSuggestions.length > 0 && (
        <AutoFaqSuggestions
          clientId={data.clientId}
          suggestions={data.lastFaqSuggestions}
        />
      )}

      {/* ── Unanswered questions ─────────────────────────────────── */}
      {data.clientId && (
        <UnansweredQuestionsTile clientId={data.clientId} />
      )}

      {/* ── Trial: upgrade CTA ───────────────────────────────────── */}
      {isTrial && (
        <div className="rounded-2xl p-4 card-surface">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-3">When you&apos;re ready to go live</p>
          <div className="space-y-1.5 mb-4">
            {[
              'Your own business phone number',
              'Real call forwarding from your existing line',
              'Live call dashboard + hot lead tracking',
              'Instant Telegram, email & SMS alerts',
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs t2">{feat}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => openUpgradeModal('unified_upgrade_cta', data.clientId, daysRemaining, data.selectedPlan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Get a real phone number — upgrade to go live
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 2-col: Notifications + Niche Insights ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <NotificationsTile
          telegramConnected={onboarding.telegramConnected}
          emailEnabled={onboarding.emailNotificationsEnabled}
          agentName={agent.name}
          onOpenSheet={() => sheet.open('notifications')}
        />
        <NicheInsightsTile
          niche={agent.niche}
          capabilities={capabilities}
          knowledge={data.knowledge}
          onboarding={onboarding}
          sheet={sheet}
        />
      </div>
    </>
  )
}
