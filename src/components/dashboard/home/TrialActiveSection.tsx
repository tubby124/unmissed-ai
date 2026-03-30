'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useCallContext } from '@/contexts/CallContext'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import type { TrialPhase } from '@/lib/trial-display-state'
import AutoFaqSuggestions from '../AutoFaqSuggestions'
import BillingTile from './BillingTile'
import CapabilitiesCard from '../CapabilitiesCard'
import NotificationsTile from './NotificationsTile'
import TeachAgentCard from './TeachAgentCard'
import TodayUpdateCard from './TodayUpdateCard'
import TrialModeSwitcher from './TrialModeSwitcher'
import BookingCalendarTile from './BookingCalendarTile'
import KnowledgeInlineTile from './KnowledgeInlineTile'
import UnansweredQuestionsTile from './UnansweredQuestionsTile'
import IvrVoicemailTile from './IvrVoicemailTile'
import PostCallActionsTile from './PostCallActionsTile'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

// ── Inline helpers (no imports from ClientHome) ──────────────────
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

// ── isFirstVisit helpers ─────────────────────────────────────────
function provisioningHeadline(state: HomeData['trialWelcome']['provisioningState'], agentName: string): string {
  if (state === 'ready') return `${agentName} is ready to test`
  if (state === 'pending') return `${agentName} is almost ready`
  return 'Your agent is being set up'
}

function provisioningSubtext(state: HomeData['trialWelcome']['provisioningState']): string {
  if (state === 'ready') return "Everything's configured. Start a test call to hear how your agent handles real callers."
  if (state === 'pending') return "We're still setting up part of your account. You can start testing now."
  return 'Your agent is still being provisioned. This usually takes a minute — check back shortly.'
}

// ── Props ────────────────────────────────────────────────────────
interface Props {
  data: HomeData
  trialPhase: TrialPhase
  daysRemaining: number | undefined
  isTrial: boolean
  isFirstVisit?: boolean
  showChecklist: boolean
  hasRealCalls: boolean
  lastCompletedCall: HomeData['recentCalls'][0] | null
  postCallDismissed: boolean
  onPostCallDismiss: () => void
  sheet: ReturnType<typeof useHomeSheet>
}

// ── Component ────────────────────────────────────────────────────
export default function TrialActiveSection({
  data,
  trialPhase,
  daysRemaining,
  isTrial,
  isFirstVisit = false,
  postCallDismissed,
  onPostCallDismiss,
  sheet,
}: Props) {
  const { agent, capabilities, onboarding } = data
  const { callState, resetCall } = useCallContext()
  const { openUpgradeModal } = useUpgradeModal()
  const [knowOpen, setKnowOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  useEffect(() => {
    if (!isFirstVisit) return
    const sessionKey = `welcome_viewed_${data.clientId}`
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1')
      trackEvent('welcome_viewed', { client_id: data.clientId ?? '', provisioning_state: data.trialWelcome.provisioningState })
    }
  }, [isFirstVisit, data.clientId, data.trialWelcome.provisioningState])

  // ── isFirstVisit branch (DO NOT TOUCH) ──────────────────────
  if (isFirstVisit) {
    const { provisioningState } = data.trialWelcome

    return (
      <>
        {/* Trial countdown pill */}
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

        {/* Provisioning headline */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold t1 leading-snug mb-1.5">
            {provisioningHeadline(provisioningState, agent.name)}
          </h1>
          <p className="text-sm t3 leading-relaxed">
            {provisioningSubtext(provisioningState)}
          </p>
        </div>

        {/* Mode switcher — pick how the agent handles calls before testing */}
        {onboarding.hasAgent && data.clientId && (
          <TrialModeSwitcher
            clientId={data.clientId}
            subscriptionStatus={onboarding.subscriptionStatus}
            selectedPlan={data.selectedPlan}
            currentMode={data.callHandlingMode}
            hasBooking={capabilities.hasBooking}
            onRetest={resetCall}
          />
        )}

        {/* Agent test card */}
        {onboarding.hasAgent ? (
          <div onClick={() => trackEvent('test_call_started_from_welcome', { client_id: data.clientId ?? '' })}>
            <TestCallCard
              clientId={data.clientId ?? ''}
              isAdmin={false}
              isTrial={true}
              knowledge={{
                agentName: agent.name || undefined,
                hasFacts: !!(data.editableFields.businessFacts?.trim()),
                hasFaqs: data.editableFields.faqs.length > 0,
                hasHours: !!data.editableFields.hoursWeekday,
                hasBooking: capabilities.hasBooking,
                hasTransfer: capabilities.hasTransfer,
                hasSms: capabilities.hasSms,
                hasKnowledge: capabilities.hasKnowledge,
                hasWebsite: capabilities.hasWebsite,
              }}
            />
          </div>
        ) : (
          <div className="rounded-2xl p-8 card-surface text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--color-hover)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="t3">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm font-semibold t1 mb-1">Provisioning your agent</p>
            <p className="text-xs t3 leading-relaxed max-w-xs mx-auto">
              Your AI receptionist is being set up. This usually takes under a minute. Refresh to check.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-75"
              style={{ color: 'var(--color-primary)' }}
            >
              Refresh →
            </button>
          </div>
        )}

        {/* Capabilities — same component as return branch */}
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

        {/* Teach your agent */}
        <TeachAgentCard clientId={data.clientId ?? ''} agentName={agent.name} />

        {/* Go-live upgrade CTA */}
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
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs t2">{feat}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => openUpgradeModal('welcome_upgrade_cta', data.clientId, daysRemaining, data.selectedPlan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Get a real phone number — upgrade to go live
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </>
    )
  }

  // ── Return branch ────────────────────────────────────────────

  const knowledgeSources = data.knowledge.source_types
  const faqCount = data.editableFields.faqs.length
  const knowledgeItemCount = data.knowledge.approved_chunk_count + faqCount
  const knowledgeSummaryText = (() => {
    if (knowledgeItemCount === 0 && !data.editableFields.businessFacts) return 'Nothing added yet'
    const parts: string[] = []
    if (knowledgeItemCount > 0) parts.push(`${knowledgeItemCount} item${knowledgeItemCount !== 1 ? 's' : ''}`)
    if (knowledgeSources.length > 0) {
      const srcLabels: Record<string, string> = {
        website_scrape: 'website', settings_edit: 'FAQs',
        compiled_import: 'AI compiler', pdf_upload: 'docs',
      }
      parts.push(knowledgeSources.slice(0, 2).map(s => srcLabels[s] ?? s).join(' + '))
    }
    return parts.join(' · ')
  })()

  const missedCount = data.recentCalls.filter(
    c => c.call_status === 'missed' || c.call_status === 'VOICEMAIL' || c.call_status === 'voicemail'
  ).length

  const nextAction: { text: string; cta: string; href: string | null } | null = (() => {
    if (!capabilities.hasFacts && faqCount === 0 && !capabilities.hasWebsite) {
      return { text: "Agent doesn't know your business yet", cta: 'Add facts →', href: '/dashboard/knowledge?tab=add&source=manual' }
    }
    if (!capabilities.hasHours) {
      return { text: "Agent can't tell callers your hours", cta: 'Set hours →', href: '/dashboard/actions#hours' }
    }
    if (!capabilities.hasWebsite && !capabilities.hasKnowledge) {
      return { text: 'Add your website to teach your agent more', cta: 'Add website →', href: '/dashboard/knowledge' }
    }
    if (!onboarding.hasPhoneNumber) {
      return { text: 'Upgrade to go live with a real phone number', cta: 'Upgrade →', href: null }
    }
    return null
  })()

  const usagePct = data.usage.totalAvailable > 0
    ? Math.min(100, Math.round((data.usage.minutesUsed / data.usage.totalAvailable) * 100))
    : 0

  return (
    <>
      {/* ── 1. 3-col hero: [Capabilities] | [Talk to Agent] | [Today's Update + Agent Identity] ── */}
      {onboarding.hasAgent && data.clientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Col 1 — What your agent can do */}
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

          {/* Col 2 — Talk to your agent */}
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

          {/* Col 3 — Today's update + compact agent identity */}
          <div className="space-y-3">
            <TodayUpdateCard
              clientId={data.clientId}
              currentNote={data.editableFields.injectedNote}
            />
            <div className="rounded-xl p-3 card-surface space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => sheet.open('identity')}
                  className="text-[13px] font-bold t1 hover:opacity-75 transition-opacity cursor-pointer text-left leading-tight"
                >
                  {agent.name}
                </button>
                {agent.niche && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }}>
                    {formatNiche(agent.niche)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href="/dashboard/settings?tab=voice"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {formatVoicePreset(agent.voiceStylePreset)}
                </Link>
                <button
                  onClick={() => sheet.open('notifications')}
                  className="px-2 py-0.5 rounded-md text-[10px] cursor-pointer hover:opacity-75 transition-opacity"
                  style={{
                    backgroundColor: onboarding.telegramConnected ? 'rgba(34,197,94,0.1)' : 'var(--color-hover)',
                    color: onboarding.telegramConnected ? 'rgb(34,197,94)' : 'var(--color-text-3)',
                  }}
                >
                  {onboarding.telegramConnected ? 'Telegram ✓' : 'Connect alerts'}
                </button>
                <Link
                  href="/dashboard/settings?tab=sms"
                  className="px-2 py-0.5 rounded-md text-[10px] cursor-pointer hover:opacity-75 transition-opacity"
                  style={{
                    backgroundColor: capabilities.hasSms ? 'rgba(34,197,94,0.1)' : 'var(--color-hover)',
                    color: capabilities.hasSms ? 'rgb(34,197,94)' : 'var(--color-text-3)',
                  }}
                >
                  {capabilities.hasSms ? 'SMS ✓' : 'SMS off'}
                </Link>
              </div>
              {data.agentSync && (
                <AgentSyncBadge
                  lastSyncAt={data.agentSync.last_agent_sync_at}
                  lastSyncStatus={data.agentSync.last_agent_sync_status}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Trial usage strip ──────────────────────────────── */}
      <div
        className="rounded-xl border px-4 py-2.5 flex items-center gap-3 flex-wrap"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-[11px] font-semibold tracking-[0.12em] uppercase shrink-0"
          style={{ color: (trialPhase === 'active_urgent' || trialPhase === 'active_final') ? 'rgb(245,158,11)' : 'var(--color-primary)' }}
        >
          Trial
        </span>
        {daysRemaining !== undefined && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap shrink-0">
            {daysRemaining}d left
          </span>
        )}
        <div className="flex-1 min-w-[100px] h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-hover)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${usagePct}%`, backgroundColor: usagePct >= 80 ? 'rgb(245,158,11)' : 'var(--color-primary)' }}
          />
        </div>
        <span className="text-[11px] shrink-0" style={{ color: 'var(--color-text-3)' }}>
          {data.usage.minutesUsed}m / {data.usage.totalAvailable}m
        </span>
        <button
          onClick={() => openUpgradeModal('home_header_upgrade', data.clientId, daysRemaining, data.selectedPlan)}
          className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
          style={{ color: 'var(--color-primary)' }}
        >
          Upgrade →
        </button>
      </div>

      {/* ── 3. Next best action strip ──────────────────────────── */}
      {nextAction && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'var(--color-accent-tint)', border: '1px solid rgba(22,163,74,0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-[12px] flex-1" style={{ color: 'var(--color-text-2)' }}>{nextAction.text}</p>
          {nextAction.href ? (
            <Link
              href={nextAction.href}
              className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--color-primary)' }}
            >
              {nextAction.cta}
            </Link>
          ) : (
            <button
              onClick={() => openUpgradeModal('nba_strip', data.clientId, daysRemaining, data.selectedPlan)}
              className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--color-primary)' }}
            >
              {nextAction.cta}
            </button>
          )}
        </div>
      )}

      {/* ── 4. HOT lead banner ─────────────────────────────────── */}
      {data.stats.hotLeads > 0 && (
        <Link
          href="/dashboard/calls"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:opacity-75 transition-opacity"
          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="text-[13px] shrink-0">🔥</span>
          <p className="text-[12px] flex-1 font-medium" style={{ color: 'rgb(239,68,68)' }}>
            {data.stats.hotLeads} HOT lead{data.stats.hotLeads !== 1 ? 's' : ''} this month — view now
          </p>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)', flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      {/* ── 5. 2-col: [IVR+AfterCalls] | [Calendar] ── */}
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
        <BookingCalendarTile hasBooking={capabilities.hasBooking} calendarConnected={data.calendarConnected} />
      </div>

      {/* ── 6. Compact 4-stat row ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: data.stats.totalCalls ?? data.recentCalls.length, suffix: '' },
          { label: 'Time Handled', value: data.stats.timeSavedMinutes > 0 ? formatTimeSaved(data.stats.timeSavedMinutes) : '—', suffix: '' },
          { label: 'Missed', value: missedCount > 0 ? missedCount : (data.stats.missedThisMonth ?? 0), suffix: '' },
          { label: 'Minutes Used', value: data.usage.minutesUsed, suffix: `/ ${data.usage.totalAvailable}` },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="rounded-xl px-4 py-3 card-surface">
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--color-text-3)' }}>{label}</p>
            <p className="text-xl font-bold t1 leading-none">
              {value}<span className="text-[12px] font-normal t3 ml-1">{suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── 7. Recent calls — flat list ───────────────────────── */}
      {data.recentCalls.length > 0 && (
        <div className="rounded-xl overflow-hidden card-surface">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
              Recent Calls
            </p>
            {data.stats.missedThisMonth > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none">
                {data.stats.missedThisMonth} voicemail{data.stats.missedThisMonth !== 1 ? 's' : ''}
              </span>
            )}
          </div>
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

      {/* ── 8. BillingTile — upgrade / go live strip ──────────── */}
      <BillingTile
        selectedPlan={data.selectedPlan}
        subscriptionStatus={onboarding.subscriptionStatus}
        onOpenSheet={() => sheet.open('billing')}
      />

      {/* ── 9. Post-call nudge ────────────────────────────────── */}
      {callState === 'ended' && !postCallDismissed && data.clientId && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
              After your call — teach your agent
            </p>
            <button
              onClick={() => { trackEvent('post_call_improvement_dismissed'); onPostCallDismiss() }}
              className="text-[11px] cursor-pointer hover:opacity-75 transition-opacity"
              style={{ color: 'var(--color-text-3)' }}
            >
              Dismiss
            </button>
          </div>
          <TeachAgentCard clientId={data.clientId} agentName={agent.name} />
        </div>
      )}

      {/* ── 10. Trial mode switcher ──────────────────────────── */}
      {onboarding.hasAgent && data.clientId && (
        <TrialModeSwitcher
          clientId={data.clientId}
          subscriptionStatus={onboarding.subscriptionStatus}
          selectedPlan={data.selectedPlan}
          currentMode={data.callHandlingMode}
          hasBooking={capabilities.hasBooking}
          onRetest={resetCall}
        />
      )}

      {/* ── 11. 2-col: KnowledgeInline + Unanswered ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <KnowledgeInlineTile knowledgeStats={data.knowledge} />
        {data.clientId && (
          <UnansweredQuestionsTile clientId={data.clientId} />
        )}
      </div>

      {/* ── 12. "WHAT IT KNOWS" collapsible ─────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <button
          onClick={() => setKnowOpen(o => !o)}
          className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-hover transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                What it knows
              </p>
              <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                {knowledgeSummaryText}
              </span>
              {data.knowledge.last_updated_at && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }}
                >
                  updated {timeAgo(data.knowledge.last_updated_at)}
                </span>
              )}
            </div>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`shrink-0 transition-transform duration-200 ${knowOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-3)' }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {knowOpen && (
          <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {knowledgeItemCount === 0 && !data.editableFields.businessFacts ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm t2">Nothing added yet</p>
                <p className="text-[12px] t3 leading-relaxed max-w-xs mx-auto">
                  Your agent answers from its base training only. Add business facts, FAQs, or a website to make it specific to you.
                </p>
                <Link
                  href="/dashboard/knowledge"
                  className="inline-block text-[12px] font-semibold mt-1 cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Add knowledge →
                </Link>
              </div>
            ) : (
              <>
                {data.editableFields.businessFacts && (
                  <div className="pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-text-3)' }}>
                      Business facts
                    </p>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                      {data.editableFields.businessFacts.slice(0, 200)}{data.editableFields.businessFacts.length > 200 ? '…' : ''}
                    </p>
                  </div>
                )}

                {faqCount > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-text-3)' }}>
                      FAQs ({faqCount})
                    </p>
                    <div className="space-y-1.5">
                      {data.editableFields.faqs.slice(0, 2).map((faq, i) => (
                        <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-hover)' }}>
                          <p className="text-[12px] font-medium t1">{faq.q}</p>
                          <p className="text-[11px] t3 truncate">{faq.a}</p>
                        </div>
                      ))}
                      {faqCount > 2 && (
                        <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>+{faqCount - 2} more</p>
                      )}
                    </div>
                  </div>
                )}

                {knowledgeSources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {knowledgeSources.map(src => {
                      const srcLabels: Record<string, string> = {
                        website_scrape: 'Website', settings_edit: 'FAQs',
                        compiled_import: 'AI Compiler', pdf_upload: 'Docs',
                      }
                      return (
                        <span
                          key={src}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}
                        >
                          {srcLabels[src] ?? src}
                        </span>
                      )
                    })}
                  </div>
                )}

                {data.clientId && data.lastFaqSuggestions && data.lastFaqSuggestions.length > 0 && (
                  <AutoFaqSuggestions
                    clientId={data.clientId}
                    suggestions={data.lastFaqSuggestions}
                  />
                )}

                {data.clientId && (
                  <TeachAgentCard clientId={data.clientId} agentName={agent.name} />
                )}
              </>
            )}

            <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <Link
                href="/dashboard/knowledge"
                className="text-[12px] font-medium cursor-pointer hover:opacity-75 transition-opacity"
                style={{ color: 'var(--color-primary)' }}
              >
                Manage knowledge →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 13. Notifications ────────────────────────────────── */}
      <NotificationsTile
        telegramConnected={onboarding.telegramConnected}
        emailEnabled={onboarding.emailNotificationsEnabled}
        agentName={agent.name}
        onOpenSheet={() => sheet.open('notifications')}
      />

    </>
  )
}
