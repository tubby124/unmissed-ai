'use client'

import { useState, useRef, useCallback } from 'react'
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
import AgentReadinessRow from './AgentReadinessRow'
import ShareNumberCard from './ShareNumberCard'
import SoftTestGateCard from './SoftTestGateCard'
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
  const [firstCallDismissed, setFirstCallDismissed] = useState(false)

  // D163 — Trial "call me through your agent"
  const [callMePhone, setCallMePhone] = useState('')
  const [callMeLoading, setCallMeLoading] = useState(false)
  const [callMeSuccess, setCallMeSuccess] = useState(false)
  const [callMeError, setCallMeError] = useState<string | null>(null)
  // D162 — Call forwarding guide expand/collapse
  const [forwardingExpanded, setForwardingExpanded] = useState(false)

  // D133 — Ask your agent preview
  const [askQuestion, setAskQuestion] = useState('')
  const [askAnswer, setAskAnswer] = useState<{ answer: string; sources: string[] } | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const handleAskQuestion = useCallback(async () => {
    const q = askQuestion.trim()
    if (!q || askLoading) return
    setAskLoading(true)
    setAskAnswer(null)
    setAskError(null)
    try {
      const res = await fetch('/api/dashboard/preview-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, clientId: data.clientId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAskError(json.error ?? 'Something went wrong')
      } else {
        setAskAnswer(json)
      }
    } catch {
      setAskError('Network error — please try again')
    } finally {
      setAskLoading(false)
    }
  }, [askQuestion, askLoading, data.clientId])

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
  const liveTotalCalls = data.stats.totalCalls // already excludes test calls (home route filters neq 'test')
  // D162 — forwarding codes need digits only (strip leading + from E.164 +16045551234 → 16045551234)
  const twilioNumberDigits = data.twilioNumber ? data.twilioNumber.replace(/^\+/, '') : ''
  const showShareNumber = !!(data.twilioNumber) && liveTotalCalls < 5

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

  const pendingKnowledgeCount = data.knowledge?.pending_review_count ?? 0
  const openGapsCount = data.insights?.openGaps ?? 0
  const callHandlingMode = data.callHandlingMode

  const isBookingModeNoCalendar = callHandlingMode === 'appointment_booking' && !calendarConnected

  const nextAction: { text: string; cta: string; href: string | null; onUpgrade?: boolean } | null = (() => {
    // D120 — booking mode + no calendar is handled by dedicated amber banner, not nextAction strip
    if (!capabilities.hasFacts && faqCount === 0 && !capabilities.hasWebsite) {
      return { text: "Agent doesn't know your business yet", cta: 'Add facts →', href: '/dashboard/knowledge?tab=add&source=manual' }
    }
    if (!capabilities.hasHours) {
      return { text: "Agent can't tell callers your hours", cta: 'Set hours →', href: '/dashboard/actions#hours' }
    }

    // D129 — Knowledge pending review is high priority
    if (pendingKnowledgeCount > 0) {
      return {
        text: `Review ${pendingKnowledgeCount} page${pendingKnowledgeCount !== 1 ? 's' : ''} scraped from your website — approve what's correct`,
        cta: 'Review →',
        href: '/dashboard/settings?tab=general#knowledge',
      }
    }

    if (!capabilities.hasWebsite && !capabilities.hasKnowledge) {
      return { text: 'Add your website to teach your agent more', cta: 'Add website →', href: '/dashboard/knowledge' }
    }
    if (isTrial && !onboarding.hasPhoneNumber) {
      return { text: 'Upgrade to go live with a real phone number', cta: 'Upgrade →', href: null, onUpgrade: true }
    }
    // D113 — Mode-aware: info_hub with no context data
    if (callHandlingMode === 'info_hub' && !data.editableFields.hasContextData) {
      return { text: 'Add your menu or reference document — your agent needs it to answer questions', cta: 'Add →', href: '/dashboard/settings?tab=general#context' }
    }

    // D113 — lead_capture: nudge toward FAQs and services
    if (callHandlingMode === 'lead_capture' && faqCount === 0) {
      return { text: 'Add FAQs so your agent can qualify leads better', cta: 'Add FAQs →', href: '/dashboard/settings?tab=general#knowledge' }
    }

    // D131 — Unanswered caller questions ready to close
    if (openGapsCount > 0) {
      return {
        text: `${openGapsCount} caller question${openGapsCount !== 1 ? 's' : ''} your agent couldn't answer — teach it now`,
        cta: 'Answer →',
        href: '/dashboard/knowledge',
      }
    }

    if (!onboarding.telegramConnected) {
      return { text: 'Get instant call alerts on Telegram', cta: 'Connect →', href: '/dashboard/settings?tab=notifications' }
    }
    return null
  })()

  // D168 — first call milestone banner: show within 24h of first_call_at
  const showFirstCallBanner = !firstCallDismissed &&
    !!data.firstCallAt &&
    Date.now() - new Date(data.firstCallAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <>
      {/* ── D168 — First call milestone banner ──────────────────── */}
      {showFirstCallBanner && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <span className="text-xl leading-none mt-0.5">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-200">First real call received!</p>
            <p className="text-xs text-emerald-400 mt-0.5">Your agent handled its first live call. Check your calls page to see how it went.</p>
          </div>
          <button
            onClick={() => setFirstCallDismissed(true)}
            className="text-emerald-500 hover:text-emerald-300 text-lg leading-none mt-0.5 shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

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

      {/* ── D169 — Trial expiry warning ──────────────────────────── */}
      {isTrial && typeof daysRemaining === 'number' && daysRemaining <= 3 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)', flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[12px] flex-1 leading-snug" style={{ color: 'rgb(239,68,68)' }}>
            {daysRemaining === 0
              ? 'Your trial expires today — upgrade now to keep your agent live'
              : `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — don\u2019t lose your agent`}
          </p>
          <button
            onClick={() => openUpgradeModal('trial_expiry_banner', data.clientId, daysRemaining, data.selectedPlan)}
            className="text-[12px] font-semibold hover:opacity-75 transition-opacity shrink-0"
            style={{ color: 'rgb(239,68,68)' }}
          >
            Upgrade →
          </button>
        </div>
      )}

      {/* ── D218 — Minutes usage warning banner ─────────────────── */}
      {!isTrial && data.usage.totalAvailable > 0 && (() => {
        const pct = (data.usage.minutesUsed / data.usage.totalAvailable) * 100
        if (pct < 75) return null
        const isUrgent = pct >= 90
        return (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              backgroundColor: isUrgent ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: isUrgent ? 'rgb(239,68,68)' : 'rgb(245,158,11)', flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-[12px] flex-1 leading-snug" style={{ color: isUrgent ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}>
              {isUrgent
                ? `You've used ${Math.round(pct)}% of your ${data.usage.totalAvailable} monthly minutes — upgrade or buy more to stay live`
                : `You've used ${Math.round(pct)}% of your ${data.usage.totalAvailable} monthly minutes`}
            </p>
            <button
              onClick={() => openUpgradeModal('minutes_warning_banner', data.clientId, undefined, data.selectedPlan)}
              className="text-[12px] font-semibold hover:opacity-75 transition-opacity shrink-0"
              style={{ color: isUrgent ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}
            >
              Buy minutes →
            </button>
          </div>
        )
      })()}

      {/* ── D167 — Trial upgrade CTA card ────────────────────────── */}
      {isTrial && !onboarding.hasPhoneNumber && (typeof daysRemaining === 'undefined' || daysRemaining > 3) && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}
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
            <p className="text-[12px] font-semibold t1">Your agent is configured and ready</p>
            <p className="text-[11px] t3 leading-snug">Get your own phone number so real callers can reach your agent.</p>
          </div>
          <button
            onClick={() => openUpgradeModal('trial_upgrade_card', data.clientId, daysRemaining, data.selectedPlan)}
            className="shrink-0 text-[12px] font-semibold hover:opacity-75 transition-opacity whitespace-nowrap"
            style={{ color: 'var(--color-primary)' }}
          >
            Get my number →
          </button>
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

      {/* ── D120 — Booking mode: no calendar connected banner ───── */}
      {isBookingModeNoCalendar && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(245,158,11)', flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[12px] flex-1 leading-snug" style={{ color: 'rgb(180,130,30)' }}>
            Your agent is in booking mode but can&apos;t book yet. Connect Google Calendar to start accepting appointments.
          </p>
          <Link
            href="/dashboard/settings?tab=general#booking"
            className="text-[12px] font-semibold whitespace-nowrap hover:opacity-75 transition-opacity shrink-0"
            style={{ color: 'rgb(245,158,11)' }}
          >
            Connect Calendar →
          </Link>
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

      {/* ── D249 — Agent readiness gate ─────────────────────────── */}
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

      {/* ── Activity stats strip ─────────────────────────────────── */}
      {data.stats.totalCalls > 0 ? (
        <div className="flex items-center gap-2 flex-wrap px-1">
          {/* D141 — Agent freshness signal */}
          {(() => {
            const lastCallAt = data.stats.lastCallAt
            if (!lastCallAt) return null
            const diff = Date.now() - new Date(lastCallAt).getTime()
            const mins = Math.floor(diff / 60000)
            const hrs = Math.floor(mins / 60)
            const isToday = new Date(lastCallAt).toDateString() === new Date().toDateString()
            let freshnessText: string
            if (mins < 60) {
              freshnessText = `Active — answered ${mins < 1 ? 'just now' : `${mins}m ago`}`
            } else if (isToday) {
              freshnessText = `Last answered today at ${new Date(lastCallAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
            } else if (hrs < 48) {
              freshnessText = 'Quiet today'
            } else {
              freshnessText = 'Quiet today'
            }
            return (
              <span className="text-[12px]" style={{ color: mins < 60 ? 'rgb(34,197,94)' : 'var(--color-text-3)' }}>
                {freshnessText}
              </span>
            )
          })()}
          {data.recentCalls[0] && data.stats.lastCallAt && (() => {
            const diff = Date.now() - new Date(data.stats.lastCallAt).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins >= 60) {
              return (
                <>
                  <span style={{ color: 'var(--color-text-3)' }}>·</span>
                  <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                    {callsToday > 0
                      ? `${callsToday} call${callsToday !== 1 ? 's' : ''} today`
                      : `${data.stats.totalCalls} call${data.stats.totalCalls !== 1 ? 's' : ''} total`}
                  </span>
                </>
              )
            }
            return (
              <>
                <span style={{ color: 'var(--color-text-3)' }}>·</span>
                <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                  {callsToday > 0
                    ? `${callsToday} call${callsToday !== 1 ? 's' : ''} today`
                    : `${data.stats.totalCalls} call${data.stats.totalCalls !== 1 ? 's' : ''} total`}
                </span>
              </>
            )
          })()}
          {data.usage.minutesUsed > 0 && (
            <>
              <span style={{ color: 'var(--color-text-3)' }}>·</span>
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                {formatTimeSaved(data.usage.minutesUsed)} handled
              </span>
            </>
          )}
          {/* D139 — Returning caller stat */}
          {(data.returningCallerCount ?? 0) >= 3 ? (
            <>
              <span style={{ color: 'var(--color-text-3)' }}>·</span>
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }} title="Callers recognized by name this month">
                {data.returningCallerCount} recognized
              </span>
            </>
          ) : data.stats.totalCalls >= 5 ? (
            <>
              <span style={{ color: 'var(--color-text-3)' }}>·</span>
              <span className="text-[12px] italic" style={{ color: 'var(--color-text-3)' }}>
                Once callers return, your agent greets them by name.
              </span>
            </>
          ) : null}
        </div>
      ) : (
        /* D141 — No calls yet freshness state */
        <div className="px-1">
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            No calls yet — forward your number to get started
          </span>
        </div>
      )}

      {/* ── D162 — Call forwarding guide ─────────────────────────── */}
      {!isTrial && !!data.twilioNumber && data.stats.totalCalls === 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <button
            onClick={() => setForwardingExpanded(x => !x)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
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
              <p className="text-[11px] t3 leading-snug">Your agent number is <span className="font-mono">{data.twilioNumber}</span> — forward from your business line to start receiving calls.</p>
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
                    <span className="text-[11px] t3">all calls (pick up landline, dial, wait for tone)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-text-2)' }}>*92 {twilioNumberDigits}</code>
                    <span className="text-[11px] t3">no-answer only</span>
                  </div>
                  <p className="text-[11px] t3">Telus: destination must ring and be answered to confirm activation.</p>
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
                  <p className="text-[11px] t3">Rogers/Fido: disable voicemail first. Koodo: requires Call Forwarding add-on in My Koodo app.</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>VoIP — RingCentral / Ooma / Telus Business Connect</p>
                <p className="text-[11px] t3 leading-relaxed">In your admin portal: <strong>Extensions → Call Forwarding → No Answer</strong> → enter <code className="font-mono text-[12px]" style={{ color: 'var(--color-primary)' }}>{data.twilioNumber}</code></p>
              </div>
              <p className="text-[11px] t3">To deactivate: landline dial <code className="font-mono text-[12px]">*73</code> · mobile dial <code className="font-mono text-[12px]">#21#</code></p>
            </div>
          )}
        </div>
      )}

      {/* ── D172 — Forwarding confirmed banner ───────────────────── */}
      {!isTrial && !!data.twilioNumber && liveTotalCalls > 0 && liveTotalCalls < 10 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-emerald-400 text-lg leading-none shrink-0">✅</span>
          <div>
            <p className="text-sm font-semibold text-emerald-200">Call forwarding is working</p>
            <p className="text-xs text-emerald-400 mt-0.5">Your calls are reaching your agent. Check your calls page to review them.</p>
          </div>
        </div>
      )}

      {/* ── D143 — Soft test gate nudge ──────────────────────────── */}
      {onboarding.hasAgent && testCallCount === 0 && (
        <SoftTestGateCard onScrollToTestCall={scrollToTestCall} />
      )}

      {/* ── D163 — Trial "call me through your agent" ────────────── */}
      {isTrial && data.clientId && !callMeSuccess && (
        <div
          className="px-4 py-4 rounded-xl space-y-3"
          style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div>
            <p className="text-[12px] font-semibold t1">Hear your agent on a real phone call</p>
            <p className="text-[11px] t3 leading-snug mt-0.5">We&apos;ll dial your phone and connect you — no forwarding setup needed.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="tel"
              value={callMePhone}
              onChange={e => setCallMePhone(e.target.value)}
              placeholder="Your phone number"
              className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-1"
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
              className="px-3 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {callMeLoading ? 'Calling…' : 'Call me'}
            </button>
          </div>
          {callMeError && (
            <p className="text-[11px]" style={{ color: 'rgb(239,68,68)' }}>{callMeError}</p>
          )}
        </div>
      )}
      {isTrial && callMeSuccess && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <span className="text-base">📞</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold t1">Call is on its way!</p>
            <p className="text-[11px] t3 leading-snug">Your phone will ring in a few seconds — answer it to talk to your agent.</p>
          </div>
        </div>
      )}


      {/* ── D130 — Share number card ─────────────────────────────── */}
      {showShareNumber && data.twilioNumber && (
        <ShareNumberCard twilioNumber={data.twilioNumber} />
      )}

      {/* ── D250 — Weekly ROI card ────────────────────────────────── */}
      {data.weeklyStats && data.weeklyStats.callsAnswered > 0 && (
        <div
          className="rounded-xl px-4 py-3"
          style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <p className="text-[11px] font-semibold t3 uppercase tracking-wide mb-2">Your agent this week</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[12px] t1 font-medium">{data.weeklyStats.callsAnswered} calls answered</span>
            {data.weeklyStats.hotLeadsCaptured > 0 && (
              <Link href="/dashboard/calls?status=HOT" className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300">
                {data.weeklyStats.hotLeadsCaptured} HOT {data.weeklyStats.hotLeadsCaptured === 1 ? 'lead' : 'leads'} →
              </Link>
            )}
            {data.weeklyStats.callbacksMade > 0 && (
              <span className="text-[12px] t2">{data.weeklyStats.callbacksMade} called back</span>
            )}
            {data.weeklyStats.hoursSaved > 0 && (
              <span className="text-[12px] t2">~{data.weeklyStats.hoursSaved}h saved</span>
            )}
          </div>
          {data.weeklyStats.monthCallsAnswered > data.weeklyStats.callsAnswered && (
            <p className="text-[11px] t3 mt-1">
              This month: {data.weeklyStats.monthCallsAnswered} calls · {data.weeklyStats.monthHotLeads} leads · ~{data.weeklyStats.monthHoursSaved}h saved
            </p>
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
            hasTelegramAlerts={onboarding.telegramConnected}
          />
          <div ref={testCallRef}>
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
          </div>
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

      {/* ── D133 — Ask your agent (knowledge preview) ────────────── */}
      {data.clientId && (capabilities.hasFacts || capabilities.hasKnowledge || capabilities.hasWebsite) && (
        <div className="rounded-2xl border b-theme bg-surface p-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Ask your agent</p>
            <p className="text-[11px] t3 mt-0.5">Type a question a caller might ask — see what your agent knows.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={askQuestion}
              onChange={e => {
                setAskQuestion(e.target.value)
                if (askAnswer) setAskAnswer(null)
                if (askError) setAskError(null)
              }}
              onKeyDown={e => { if (e.key === 'Enter') void handleAskQuestion() }}
              placeholder="e.g. What are your hours? Do you offer emergency service?"
              className="flex-1 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              disabled={askLoading}
            />
            <button
              onClick={() => void handleAskQuestion()}
              disabled={!askQuestion.trim() || askLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 shrink-0"
            >
              {askLoading ? '…' : 'Ask'}
            </button>
          </div>
          {askError && (
            <p className="text-[11px] text-red-400">{askError}</p>
          )}
          {askAnswer && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">What your agent knows:</p>
              <blockquote
                className="rounded-lg px-3 py-2.5 text-[12px] leading-relaxed t1"
                style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderLeft: '3px solid var(--color-primary)' }}
              >
                {askAnswer.answer}
              </blockquote>
              {askAnswer.sources.length > 0 && (
                <p className="text-[10px] t3">
                  Sources: {askAnswer.sources.join(', ')}
                </p>
              )}
            </div>
          )}
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
