'use client'

import React, { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { useCallContext } from '@/contexts/CallContext'
import ActivationTile from './ActivationTile'
import BillingTile from './BillingTile'
import StatsHeroCard from './StatsHeroCard'
import TodayUpdateCard from './TodayUpdateCard'
import TrialModeSwitcher from './TrialModeSwitcher'
import BookingCalendarTile from './BookingCalendarTile'
import KnowledgeInlineTile from './KnowledgeInlineTile'
import UnansweredQuestionsTile from './UnansweredQuestionsTile'
import PendingReviewTile from './PendingReviewTile'
import QuickConfigStrip from './QuickConfigStrip'
import AgentReadinessRow from './AgentReadinessRow'
// ShareNumberCard and SoftTestGateCard replaced by compact nudge grid items
import VoicePickerDropdown from './VoicePickerDropdown'
import AgentIntelligenceSection from '@/components/dashboard/AgentIntelligenceSection'
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

const STATUS_BADGE: Record<string, string> = {
  HOT: 'bg-red-500/10 text-red-400 border border-red-500/20',
  WARM: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  COLD: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  JUNK: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  missed: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  VOICEMAIL: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  voicemail: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  test: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
}

const CALL_FILTER_TABS = ['All', 'HOT', 'WARM'] as const
const CALL_FILTER_MORE = ['COLD', 'JUNK', 'missed', 'VOICEMAIL'] as const

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
  const [syncDismissed, setSyncDismissed] = useState(false)
  const [hotDismissed, setHotDismissed] = useState(false)
  const [firstCallDismissed, setFirstCallDismissed] = useState(false)

  // D163 — Trial "call me through your agent"
  const [callMePhone, setCallMePhone] = useState('')
  const [callMeLoading, setCallMeLoading] = useState(false)
  const [callMeSuccess, setCallMeSuccess] = useState(false)
  const [callMeError, setCallMeError] = useState<string | null>(null)
  // D162 — Call forwarding guide expand/collapse
  const [forwardingExpanded, setForwardingExpanded] = useState(false)
  // D363 — Share number inline expand + copy
  const [shareExpanded, setShareExpanded] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Tier 3 — call log filter
  const [callFilter, setCallFilter] = useState<string>('All')
  const [callMoreOpen, setCallMoreOpen] = useState(false)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)

  // D143 — scroll target for test call nudge
  const testCallRef = useRef<HTMLDivElement>(null)
  function scrollToTestCall() {
    testCallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // D163 — outbound call-me handler
  async function handleCallMe() {
    const phone = callMePhone.trim()
    if (!phone || callMeLoading) return
    setCallMeLoading(true)
    setCallMeError(null)
    try {
      const res = await fetch('/api/dashboard/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_phone: phone }),
      })
      const json = await res.json()
      if (!res.ok) setCallMeError(json.error ?? 'Call failed — try again')
      else setCallMeSuccess(true)
    } catch {
      setCallMeError('Network error — please try again')
    } finally {
      setCallMeLoading(false)
    }
  }

  // D143 — count test calls from recent calls (includes call_status='test')
  const testCallCount = data.recentCalls.filter(c => c.call_status === 'test').length

  // D130 — show share number card when twilio_number is set and live calls < 5
  const liveTotalCalls = data.stats.totalCalls
  const twilioNumberDigits = data.twilioNumber ? data.twilioNumber.replace(/^\+/, '') : ''
  const showShareNumber = !!(data.twilioNumber) && liveTotalCalls < 5

  const faqCount = data.editableFields.faqs.length
  const pendingKnowledgeCount = data.knowledge?.pending_review_count ?? 0
  const openGapsCount = data.insights?.openGaps ?? 0
  const callHandlingMode = data.callHandlingMode
  // Show calendar CTA when plan includes booking (Core+, or trial which unlocks all) but calendar not connected
  const planSupportsBooking = isTrial || data.selectedPlan === 'core' || data.selectedPlan === 'pro'
  const showCalendarConnect = planSupportsBooking && !calendarConnected

  const nextAction: { text: string; cta: string; href: string | null; onUpgrade?: boolean } | null = (() => {
    if (!capabilities.hasFacts && faqCount === 0 && !capabilities.hasWebsite) {
      return { text: "Agent doesn't know your business yet", cta: 'Add facts', href: '/dashboard/knowledge?tab=add&source=manual' }
    }
    if (!capabilities.hasHours) {
      return { text: "Agent can't tell callers your hours", cta: 'Set hours', href: '/dashboard/actions#hours' }
    }
    if (pendingKnowledgeCount > 0) {
      return {
        text: `Review ${pendingKnowledgeCount} page${pendingKnowledgeCount !== 1 ? 's' : ''} scraped from your website`,
        cta: 'Review',
        href: '/dashboard/settings?tab=general#knowledge',
      }
    }
    if (!capabilities.hasWebsite && !capabilities.hasKnowledge) {
      return { text: 'Add your website to teach your agent more', cta: 'Add website', href: '/dashboard/knowledge' }
    }
    if (isTrial && !onboarding.hasPhoneNumber) {
      return { text: 'Upgrade to go live with a real phone number', cta: 'Upgrade', href: null, onUpgrade: true }
    }
    if (callHandlingMode === 'info_hub' && !data.editableFields.hasContextData) {
      return { text: 'Add your menu or reference document', cta: 'Add', href: '/dashboard/settings?tab=general#context' }
    }
    if (callHandlingMode === 'lead_capture' && faqCount === 0) {
      return { text: 'Add FAQs so your agent can qualify leads better', cta: 'Add FAQs', href: '/dashboard/settings?tab=general#knowledge' }
    }
    if (openGapsCount > 0) {
      return {
        text: `${openGapsCount} caller question${openGapsCount !== 1 ? 's' : ''} your agent couldn't answer`,
        cta: 'Answer',
        href: '/dashboard/knowledge',
      }
    }
    if (!onboarding.telegramConnected) {
      return { text: 'Get instant call alerts on Telegram', cta: 'Connect', href: '/dashboard/settings?tab=notifications' }
    }
    return null
  })()

  // D168 — first call milestone banner: show within 24h of first_call_at
  const showFirstCallBanner = !firstCallDismissed &&
    !!data.firstCallAt &&
    Date.now() - new Date(data.firstCallAt).getTime() < 24 * 60 * 60 * 1000

  // Tier 2 — setup progress (percentage of readiness dimensions complete)
  const setupDimensions = [
    !!data.editableFields.hoursWeekday,
    (data.activeServicesCount ?? 0) > 0,
    faqCount > 0,
    data.knowledge.approved_chunk_count > 0,
    data.hasTriage ?? false,
    planSupportsBooking ? calendarConnected : true,
  ]
  const setupComplete = setupDimensions.filter(Boolean).length
  const setupTotal = setupDimensions.length
  const setupPct = Math.round((setupComplete / setupTotal) * 100)

  // Tier 3 — filtered calls
  const filteredCalls = callFilter === 'All'
    ? data.recentCalls
    : data.recentCalls.filter(c => {
        const status = c.call_status.toLowerCase()
        const filter = callFilter.toLowerCase()
        return status === filter
      })

  // ── Build action nudge items for the compact grid ─────────────
  const nudgeItems: { key: string; icon: React.ReactNode; label: string; sub?: string; cta: string; color: string; bg: string; border: string; href?: string; onClick?: () => void; dismiss?: () => void }[] = []

  // D167 — Trial upgrade CTA
  if (isTrial && !onboarding.hasPhoneNumber && (typeof daysRemaining === 'undefined' || daysRemaining > 3)) {
    nudgeItems.push({
      key: 'trial-upgrade',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      label: 'Agent ready',
      sub: 'Get your phone number',
      cta: 'Upgrade',
      color: 'var(--color-primary)',
      bg: 'rgba(99,102,241,0.05)',
      border: 'rgba(99,102,241,0.2)',
      onClick: () => openUpgradeModal('trial_upgrade_card', data.clientId, daysRemaining, data.selectedPlan),
    })
  }

  // D120 — Calendar connect
  if (showCalendarConnect) {
    nudgeItems.push({
      key: 'calendar-connect',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(245,158,11)' }}><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      label: 'Calendar booking',
      sub: 'Connect Google Calendar',
      cta: 'Connect',
      color: 'rgb(245,158,11)',
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.2)',
      href: '/dashboard/settings?tab=general#booking',
    })
  }

  // Next best action
  if (nextAction) {
    nudgeItems.push({
      key: 'next-action',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      label: nextAction.text,
      cta: nextAction.cta,
      color: 'var(--color-primary)',
      bg: 'rgba(99,102,241,0.05)',
      border: 'rgba(99,102,241,0.12)',
      href: nextAction.onUpgrade ? undefined : (nextAction.href ?? undefined),
      onClick: nextAction.onUpgrade ? () => openUpgradeModal('next_action_strip', data.clientId, daysRemaining, data.selectedPlan) : undefined,
    })
  }

  // HOT leads
  if (!hotDismissed && data.stats.hotLeads > 0) {
    nudgeItems.push({
      key: 'hot-leads',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)' }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>,
      label: `${data.stats.hotLeads} HOT lead${data.stats.hotLeads !== 1 ? 's' : ''}`,
      sub: 'This month',
      cta: 'View',
      color: 'rgb(239,68,68)',
      bg: 'rgba(239,68,68,0.05)',
      border: 'rgba(239,68,68,0.2)',
      href: '/dashboard/calls',
      dismiss: () => setHotDismissed(true),
    })
  }

  // D143 — Soft test gate
  if (onboarding.hasAgent && testCallCount === 0) {
    nudgeItems.push({
      key: 'test-gate',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2"/><path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      label: 'Test your agent',
      sub: 'Hear how it sounds',
      cta: 'Test',
      color: 'var(--color-primary)',
      bg: 'rgba(99,102,241,0.05)',
      border: 'rgba(99,102,241,0.12)',
      onClick: scrollToTestCall,
    })
  }

  // D168 — First call milestone
  if (showFirstCallBanner) {
    nudgeItems.push({
      key: 'first-call',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(52,211,153)' }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      label: 'First call received!',
      sub: 'Check how it went',
      cta: 'View',
      color: 'rgb(52,211,153)',
      bg: 'rgba(52,211,153,0.06)',
      border: 'rgba(52,211,153,0.25)',
      href: '/dashboard/calls',
      dismiss: () => setFirstCallDismissed(true),
    })
  }

  // D130 + D363 — Share number with inline copy + carrier codes
  if (showShareNumber && data.twilioNumber) {
    nudgeItems.push({
      key: 'share-number',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2"/></svg>,
      label: 'Share your number',
      sub: formatPhone(data.twilioNumber),
      cta: shareExpanded ? 'Close' : 'View',
      color: 'var(--color-primary)',
      bg: 'rgba(99,102,241,0.05)',
      border: shareExpanded ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.12)',
      onClick: () => setShareExpanded(o => !o),
    })
  }

  // D172 — Forwarding confirmed
  if (!isTrial && !!data.twilioNumber && liveTotalCalls > 0 && liveTotalCalls < 10) {
    nudgeItems.push({
      key: 'forwarding-ok',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(52,211,153)' }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      label: 'Forwarding active',
      sub: 'Calls reaching your agent',
      cta: 'Calls',
      color: 'rgb(52,211,153)',
      bg: 'rgba(52,211,153,0.06)',
      border: 'rgba(52,211,153,0.25)',
      href: '/dashboard/calls',
    })
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          LAYER 1 — Inline toast alerts (slim, critical)
          ════════════════════════════════════════════════════════════ */}

      {/* Trial countdown pill */}
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

      {/* D169 — Trial expiry + D218 — Minutes warning + Sync error: slim inline toasts */}
      {(() => {
        const toasts: { key: string; text: string; cta: string; color: string; bg: string; border: string; onClick?: () => void; href?: string; dismiss?: () => void }[] = []

        // Trial expiry
        if (isTrial && typeof daysRemaining === 'number' && daysRemaining <= 3) {
          toasts.push({
            key: 'trial-expiry',
            text: daysRemaining === 0 ? 'Trial expires today' : `Trial expires in ${daysRemaining}d`,
            cta: 'Upgrade',
            color: 'rgb(239,68,68)',
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.2)',
            onClick: () => openUpgradeModal('trial_expiry_banner', data.clientId, daysRemaining, data.selectedPlan),
          })
        }

        // Minutes usage
        if (!isTrial && data.usage.totalAvailable > 0) {
          const pct = (data.usage.minutesUsed / data.usage.totalAvailable) * 100
          if (pct >= 75) {
            const isUrgent = pct >= 90
            toasts.push({
              key: 'minutes-warn',
              text: `${Math.round(pct)}% minutes used`,
              cta: 'Buy more',
              color: isUrgent ? 'rgb(239,68,68)' : 'rgb(245,158,11)',
              bg: isUrgent ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
              border: isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
              onClick: () => openUpgradeModal('minutes_warning_banner', data.clientId, undefined, data.selectedPlan),
            })
          }
        }

        // Sync error
        if (!syncDismissed && data.agentSync?.last_agent_sync_status === 'error') {
          toasts.push({
            key: 'sync-error',
            text: 'Agent sync failed',
            cta: 'Fix',
            color: 'rgb(239,68,68)',
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.2)',
            href: '/dashboard/settings?tab=general',
            dismiss: () => setSyncDismissed(true),
          })
        }

        if (toasts.length === 0) return null

        return (
          <div className="flex flex-wrap gap-2">
            {toasts.map(t => (
              <div
                key={t.key}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-200"
                style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.color }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>{t.text}</span>
                {t.onClick ? (
                  <button onClick={t.onClick} className="font-semibold hover:opacity-75 transition-opacity cursor-pointer ml-1">{t.cta}</button>
                ) : t.href ? (
                  <Link href={t.href} className="font-semibold hover:opacity-75 transition-opacity cursor-pointer ml-1">{t.cta}</Link>
                ) : null}
                {t.dismiss && (
                  <button onClick={t.dismiss} aria-label="Dismiss" className="hover:opacity-60 transition-opacity cursor-pointer ml-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════
          LAYER 2 — Compact action grid (2-col mobile, 4-col desktop)
          ════════════════════════════════════════════════════════════ */}

      {nudgeItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {nudgeItems.map(n => {
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${n.color} 12%, transparent)` }}>
                    {n.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold t1 truncate leading-tight">{n.label}</p>
                    {n.sub && <p className="text-[10px] t3 truncate leading-tight">{n.sub}</p>}
                  </div>
                </div>
                <span className="text-[10px] font-semibold mt-1.5 self-end" style={{ color: n.color }}>{n.cta}</span>
              </>
            )

            const cardClass = "flex flex-col justify-between rounded-xl px-3 py-2.5 transition-all duration-200 hover:brightness-110 cursor-pointer"
            const cardStyle = { backgroundColor: n.bg, border: `1px solid ${n.border}` }

            return (
              <div key={n.key} className="relative group">
                {n.href ? (
                  <Link href={n.href} className={cardClass} style={cardStyle}>{inner}</Link>
                ) : n.onClick ? (
                  <button onClick={n.onClick} className={`${cardClass} text-left w-full`} style={cardStyle}>{inner}</button>
                ) : (
                  <div className={cardClass} style={cardStyle}>{inner}</div>
                )}
                {n.dismiss && (
                  <button
                    onClick={n.dismiss}
                    aria-label="Dismiss"
                    className="absolute top-1.5 right-1.5 z-10 w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    style={{ color: n.color, backgroundColor: `color-mix(in srgb, ${n.color} 15%, transparent)` }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* D363 — Share number expanded panel (copy + carrier codes) */}
      {shareExpanded && data.twilioNumber && (() => {
        const dialDigits = data.twilioNumber.replace(/\D/g, '')
        const displayNum = `+1 (${dialDigits.slice(1, 4)}) ${dialDigits.slice(4, 7)}-${dialDigits.slice(7)}`
        const carriers = [
          { name: 'Rogers / Fido / Chatr', fwd: `*21*${dialDigits}#`, cancel: '##21#' },
          { name: 'Bell / Virgin / Lucky', fwd: `*21*${dialDigits}#`, cancel: '#21#' },
          { name: 'Telus / Koodo / Public Mobile', fwd: `*72${dialDigits}`, cancel: '*73' },
        ]
        function handleCopy() {
          navigator.clipboard.writeText(data.twilioNumber!).catch(() => {
            const el = document.createElement('textarea')
            el.value = data.twilioNumber!
            document.body.appendChild(el)
            el.select()
            document.execCommand('copy')
            document.body.removeChild(el)
          })
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        }
        return (
          <div className="rounded-xl" style={{ border: '1px solid rgba(99,102,241,0.2)', backgroundColor: 'rgba(99,102,241,0.03)' }}>
            {/* Number + copy */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[14px] font-mono font-semibold t1 tracking-wide">{displayNum}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                style={{
                  backgroundColor: shareCopied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                  color: shareCopied ? 'rgb(34,197,94)' : 'var(--color-primary)',
                  border: `1px solid ${shareCopied ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)'}`,
                }}
              >
                {shareCopied ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            {/* Carrier codes */}
            <div className="px-4 pb-3 space-y-1.5">
              <p className="text-[10px] t3">Dial from your business phone to forward all calls:</p>
              {carriers.map(c => (
                <div key={c.name} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}>
                  <p className="text-[11px] font-semibold t2 mb-0.5">{c.name}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[11px] t3">Forward: <code className="font-mono text-[11px] t1 ml-1">{c.fwd}</code></span>
                    <span className="text-[11px] t3">Cancel: <code className="font-mono text-[11px] t1 ml-1">{c.cancel}</code></span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] t3 leading-relaxed">
                Dial the forward code, wait for confirmation tone, then hang up.
              </p>
            </div>
          </div>
        )
      })()}

      {/* D250 — Weekly ROI (compact inline strip — not a full card) */}
      {data.weeklyStats && data.weeklyStats.callsAnswered > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
          <span className="text-[10px] font-semibold t3 uppercase tracking-wider">This week</span>
          <span className="text-[11px] t1 font-medium">{data.weeklyStats.callsAnswered} calls</span>
          {data.weeklyStats.hotLeadsCaptured > 0 && (
            <Link href="/dashboard/calls?status=HOT" className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 cursor-pointer">
              {data.weeklyStats.hotLeadsCaptured} HOT
            </Link>
          )}
          {data.weeklyStats.hoursSaved > 0 && (
            <span className="text-[11px] t2">~{data.weeklyStats.hoursSaved}h saved</span>
          )}
          {data.weeklyStats.monthCallsAnswered > data.weeklyStats.callsAnswered && (
            <span className="text-[10px] t3">Month: {data.weeklyStats.monthCallsAnswered} calls</span>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          LAYER 3 — Interactive cards (full-width, need inputs)
          ════════════════════════════════════════════════════════════ */}

      {/* Paid awaiting — activation setup tile */}
      {isPaidAwaiting && data.activation && (
        <ActivationTile
          state={data.activation.state}
          onOpenForwardingSheet={() => sheet.open('forwarding')}
          onRefreshClick={fetchData}
        />
      )}

      {/* D163 — "call me through your agent" — moved to right column in 3-col grid */}

      {/* D162 — Call forwarding guide */}
      {!isTrial && !!data.twilioNumber && data.stats.totalCalls === 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <button
            onClick={() => setForwardingExpanded(x => !x)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold t1">Forward your existing number to your agent</p>
              <p className="text-[11px] t3 leading-snug">Your agent number is <span className="font-mono">{data.twilioNumber}</span></p>
            </div>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ color: 'var(--color-text-3)', flexShrink: 0, transform: forwardingExpanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {forwardingExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
              <div className="pt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Landline — Rogers / Bell / SaskTel / Telus</p>
                <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-baseline gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>*72 {twilioNumberDigits}</code>
                    <span className="text-[11px] t3">all calls</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-text-2)' }}>*92 {twilioNumberDigits}</code>
                    <span className="text-[11px] t3">no-answer only</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Mobile — Rogers / Bell / Telus / Fido / Koodo</p>
                <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-baseline gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>*21*{twilioNumberDigits}#</code>
                    <span className="text-[11px] t3">all calls</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-text-2)' }}>*61*{twilioNumberDigits}#</code>
                    <span className="text-[11px] t3">no-answer only</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] t3">To deactivate: landline <code className="font-mono text-[12px]">*73</code> · mobile <code className="font-mono text-[12px]">#21#</code></p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          CONFIG + Setup Progress — above hero
          ════════════════════════════════════════════════════════════ */}
      {data.clientId && (
        <div className="space-y-3">
          <QuickConfigStrip
            clientId={data.clientId}
            telegramConnected={onboarding.telegramConnected}
            telegramBotUrl={onboarding.telegramBotUrl}
            emailEnabled={onboarding.emailNotificationsEnabled}
            ivrEnabled={data.editableFields.ivrEnabled}
            ivrPrompt={data.editableFields.ivrPrompt}
            voicemailGreetingText={data.editableFields.voicemailGreetingText}
            businessName={onboarding.businessName}
            agentName={agent.name}
            smsEnabled={data.editableFields.smsEnabled}
            hasSms={capabilities.hasSms}
            smsTemplate={data.editableFields.smsTemplate}
            bookingEnabled={capabilities.hasBooking}
            calendarConnected={calendarConnected}
            hasTransfer={capabilities.hasTransfer}
            forwardingNumber={data.editableFields.forwardingNumber}
            hasTriage={data.hasTriage ?? false}
            niche={data.agent.niche}
            callerReasons={data.callerReasons}
            onOpenNotificationsSheet={() => sheet.open('notifications')}
          />

          {setupPct < 100 && (
            <div className="rounded-2xl border b-theme bg-surface px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Setup Progress</p>
                <span className="text-[11px] font-medium t2">{setupPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${setupPct}%`,
                    backgroundColor: setupPct >= 80 ? 'rgb(34,197,94)' : setupPct >= 50 ? 'rgb(245,158,11)' : 'var(--color-primary)',
                  }}
                />
              </div>
              <p className="text-[11px] t3 mt-1.5">
                {setupComplete} of {setupTotal} ready
                {!data.editableFields.hoursWeekday && ' — add your hours'}
                {data.editableFields.hoursWeekday && faqCount === 0 && ' — add FAQs'}
                {data.editableFields.hoursWeekday && faqCount > 0 && data.knowledge.approved_chunk_count === 0 && ' — add knowledge'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TIER 1 — Hero (3-col: Call Stats | Test Call | Today + Stats)
          ════════════════════════════════════════════════════════════ */}
      {onboarding.hasAgent && data.clientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Left: Knowledge Base + Agent Readiness */}
          <div className="flex flex-col gap-3 order-2 md:order-1">
            <KnowledgeInlineTile
              knowledgeStats={data.knowledge}
              gbpData={data.gbpData}
              businessFacts={(data.editableFields.businessFacts ?? '').split('\n').filter(Boolean)}
              faqCount={data.editableFields.faqs?.length ?? 0}
              websiteUrl={data.editableFields.websiteUrl}
              websiteScrapeStatus={data.websiteScrapeStatus}
            />

            {/* Agent readiness — below knowledge base */}
            <AgentReadinessRow
              hoursWeekday={data.editableFields.hoursWeekday}
              activeServicesCount={data.activeServicesCount ?? 0}
              faqCount={faqCount}
              calendarConnected={calendarConnected}
              callHandlingMode={callHandlingMode}
              approvedKnowledgeCount={data.knowledge.approved_chunk_count}
              pendingKnowledgeCount={pendingKnowledgeCount}
              hasTriage={data.hasTriage ?? false}
            />
            <BookingCalendarTile hasBooking={capabilities.hasBooking} calendarConnected={calendarConnected} />

            {/* D377 — Agent intelligence / triage box (was orphaned) */}
            <AgentIntelligenceSection
              agentName={agent.name}
              businessName={onboarding.businessName}
              hoursWeekday={data.editableFields.hoursWeekday}
              faqs={data.editableFields.faqs}
              businessFacts={data.editableFields.businessFacts}
              websiteUrl={data.editableFields.websiteUrl ?? null}
              hasKnowledge={capabilities.hasKnowledge}
              hasSms={capabilities.hasSms}
              hasBooking={capabilities.hasBooking}
              hasTransfer={capabilities.hasTransfer}
              isTrial={isTrial}
              clientId={data.clientId}
            />
          </div>

          {/* Center: Test Call orb + Unanswered Questions — mobile first */}
          <div ref={testCallRef} className="order-1 md:order-2 space-y-3">
            <TestCallCard
              clientId={data.clientId}
              isAdmin={false}
              isTrial={isTrial}
              onCallEnded={fetchData}
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
            {/* Pending knowledge review — show when scrape chunks need approval */}
            {pendingKnowledgeCount > 0 && (
              <PendingReviewTile
                clientId={data.clientId}
                pendingCount={pendingKnowledgeCount}
                onApproved={fetchData}
              />
            )}
            {/* D354 — Unanswered Questions under orb for tight feedback loop */}
            <UnansweredQuestionsTile clientId={data.clientId} />

            {/* Recent Calls — moved from TIER 3 into center column */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              {/* Header */}
              <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Recent Calls</p>
                  <span className="text-[11px] t3">
                    {data.recentCalls.length} call{data.recentCalls.length !== 1 ? 's' : ''}
                    {data.stats.lastCallAt && ` · last ${timeAgo(data.stats.lastCallAt)}`}
                  </span>
                </div>
                <Link
                  href="/dashboard/calls"
                  className="text-[11px] font-medium cursor-pointer hover:opacity-75 transition-opacity shrink-0"
                  style={{ color: 'var(--color-primary)' }}
                >
                  View all
                </Link>
              </div>

              {/* Filter tabs */}
              <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
                {CALL_FILTER_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setCallFilter(tab); setCallMoreOpen(false) }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors duration-200 cursor-pointer ${
                      callFilter === tab
                        ? 'bg-white/10 t1'
                        : 'hover:bg-white/5 t3'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                {/* More dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setCallMoreOpen(o => !o)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1 ${
                      CALL_FILTER_MORE.includes(callFilter as typeof CALL_FILTER_MORE[number])
                        ? 'bg-white/10 t1'
                        : 'hover:bg-white/5 t3'
                    }`}
                  >
                    {CALL_FILTER_MORE.includes(callFilter as typeof CALL_FILTER_MORE[number])
                      ? callFilter.replace(/_/g, ' ')
                      : 'More'}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {callMoreOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 rounded-lg py-1 z-10 min-w-[120px] shadow-lg"
                      style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                    >
                      {CALL_FILTER_MORE.map(item => (
                        <button
                          key={item}
                          onClick={() => { setCallFilter(item); setCallMoreOpen(false) }}
                          className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 transition-colors duration-200 cursor-pointer t2 capitalize"
                        >
                          {item.toLowerCase().replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Call list */}
              {filteredCalls.length > 0 ? (
                <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {filteredCalls.slice(0, 8).map(call => {
                    const isTestCall = call.call_status === 'test'
                    const isExpanded = expandedCallId === call.id
                    const statusClass = STATUS_BADGE[call.call_status] ?? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    const sentimentDot = call.sentiment === 'positive' ? 'bg-emerald-400' :
                      call.sentiment === 'negative' ? 'bg-red-400' :
                      call.sentiment === 'neutral' ? 'bg-slate-400' : null

                    const cardContent = (
                      <div
                        className="px-4 py-3 hover:bg-hover transition-colors duration-200 cursor-pointer"
                        onClick={isTestCall ? () => setExpandedCallId(isExpanded ? null : call.id) : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[12px] font-medium t1">
                                {isTestCall ? 'Browser test call' : formatPhone(call.caller_phone)}
                              </p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusClass}`}>
                                {call.call_status.toUpperCase().replace(/_/g, ' ')}
                              </span>
                              {sentimentDot && (
                                <span className={`w-1.5 h-1.5 rounded-full ${sentimentDot}`} title={`Sentiment: ${call.sentiment}`} />
                              )}
                            </div>
                            {call.ai_summary && (
                              <p className="text-[11px] t3 leading-snug line-clamp-1 mt-1">&ldquo;{call.ai_summary}&rdquo;</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-3">
                            <div>
                              <p className="text-[11px] t2">{formatDuration(call.duration_seconds)}</p>
                              <p className="text-[10px] t3">{timeAgo(call.started_at)}</p>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
                              <path d={isExpanded ? 'M6 15l6-6 6 6' : 'M9 18l6-6-6-6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        {/* Expanded detail */}
                        {isExpanded && call.ai_summary && (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-[11px] t2 leading-relaxed">{call.ai_summary}</p>
                          </div>
                        )}
                      </div>
                    )

                    return isTestCall ? (
                      <div key={call.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>{cardContent}</div>
                    ) : (
                      <div key={call.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                        <Link
                          href={`/dashboard/calls/${call.ultravox_call_id ?? call.id}`}
                          className="block cursor-pointer"
                          onClick={e => {
                            if (!isExpanded) {
                              e.preventDefault()
                              setExpandedCallId(call.id)
                            }
                          }}
                        >
                          {cardContent}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="border-t px-4 py-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2" style={{ color: 'var(--color-text-3)' }}>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-[12px] t2 mb-1">
                    {callFilter !== 'All' ? `No ${callFilter} calls yet` : 'No calls yet'}
                  </p>
                  <p className="text-[11px] t3">
                    {callFilter !== 'All'
                      ? 'Try a different filter or wait for more calls'
                      : 'Forward your number to get started'}
                  </p>
                  {callFilter === 'All' && data.twilioNumber && (
                    <Link
                      href="/dashboard/settings?tab=general#forwarding"
                      className="inline-block mt-2 text-[11px] font-medium cursor-pointer hover:opacity-75 transition-opacity"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Forwarding guide
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Voice + Today's Update + Stats + Trial Mode */}
          <div className="space-y-3 order-3">
            <VoicePickerDropdown
              clientId={data.clientId}
              currentVoiceId={data.onboarding.agentVoiceId}
              currentPreset={data.agent.voiceStylePreset}
              agentName={data.agent.name}
              onVoiceChanged={fetchData}
            />

            {/* D163 — "Hear your agent on a real phone call" */}
            {!callMeSuccess ? (
              <div
                className="px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-[11px] font-semibold t1 mb-1.5">Hear your agent on a real phone call</p>
                <p className="text-[10px] t3 leading-snug mb-2">We&apos;ll dial your phone and connect you.</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={callMePhone}
                    onChange={e => setCallMePhone(e.target.value)}
                    placeholder="Your phone number"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-1)',
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') void handleCallMe() }}
                    disabled={callMeLoading}
                  />
                  <button
                    onClick={() => void handleCallMe()}
                    disabled={callMeLoading || !callMePhone.trim()}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
                    style={{ backgroundColor: 'rgb(34,197,94)' }}
                  >
                    {callMeLoading ? '...' : 'Call me'}
                  </button>
                </div>
                {callMeError && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'rgb(239,68,68)' }}>{callMeError}</p>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
                style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', color: 'rgb(52,211,153)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-medium">Call is on its way! Answer your phone.</span>
              </div>
            )}

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
              currentNoteExpiresAt={data.editableFields.injectedNoteExpiresAt}
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

      {/* Agent sync badge */}
      {data.clientId && data.agentSync && (
        <div className="flex items-center gap-2 px-1">
          <AgentSyncBadge
            lastSyncAt={data.agentSync.last_agent_sync_at}
            lastSyncStatus={data.agentSync.last_agent_sync_status}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Bottom — Plan + Trial CTA (2-col side by side on md+)
          ════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <BillingTile
          selectedPlan={data.selectedPlan}
          subscriptionStatus={onboarding.subscriptionStatus}
          onOpenSheet={() => sheet.open('billing')}
        />
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
      </div>
    </>
  )
}
