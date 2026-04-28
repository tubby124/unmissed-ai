'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { useCallContext } from '@/contexts/CallContext'
import ActivationTile from './ActivationTile'
import BillingTile from './BillingTile'
// v2: removed StatsHeroCard (stats surfaced in trial pill)
// v2: removed TrialModeSwitcher, BookingCalendarTile, UnansweredQuestionsTile, PendingReviewTile, AgentReadinessRow
// (merged into single readiness band below)
// ShareNumberCard and SoftTestGateCard replaced by compact nudge grid items
import AgentIdentityCardCompact from './AgentIdentityCardCompact'
// v2: removed AgentIntelligenceSection (not in mockup Option 1)
// Wave 2 — unified overview bands (v2: CapabilitiesCard + AgentRoutesOnCard removed)
import V2CallList from './V2CallList'
import InlineModalsV2 from './InlineModalsV2'
import { useInlineEdit, type ModalId } from '@/hooks/useInlineEdit'
import type { HomeData } from '../ClientHomeV2'

// ── Inline helpers ───────────────────────────────────────────────
// Phone formatter retained — still used by the "Share your number" + call-me panels.
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

// ── Props ────────────────────────────────────────────────────────
interface Props {
  data: HomeData
  /** true when subscription_status is trialing */
  isTrial: boolean
  /** true when homePhase === 'paid_awaiting' (paid but no phone number yet) */
  isPaidAwaiting: boolean
  daysRemaining?: number
  fetchData: () => void
}

// ── Component ────────────────────────────────────────────────────
export default function UnifiedHomeSectionV2({
  data,
  isTrial,
  isPaidAwaiting,
  daysRemaining,
  fetchData,
}: Props) {
  const { agent, capabilities, onboarding, calendarConnected } = data
  const { openUpgradeModal } = useUpgradeModal()
  const { resetCall } = useCallContext()
  const inlineEdit = useInlineEdit()
  const [syncDismissed, setSyncDismissed] = useState(false)
  const [hotDismissed, setHotDismissed] = useState(false)
  const [firstCallDismissed, setFirstCallDismissed] = useState(false)
  // resetCall is unused in this surface but kept in context for legacy banners
  void resetCall

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
  const planSupportsTransfer = isTrial || data.selectedPlan === 'core' || data.selectedPlan === 'pro'
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

      {/* Trial pill — mockup parity (Trial · Xd left · Y calls this month · X/Y minutes used) */}
      {isTrial && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--color-primary)' }}>
            Trial
          </span>
          {daysRemaining !== undefined && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
            </span>
          )}
          <span className="text-[11px] t3">·</span>
          <span className="text-[11px] t2">
            <strong className="t1">{data.stats.totalCalls} call{data.stats.totalCalls !== 1 ? 's' : ''}</strong> this month
          </span>
          {data.usage.totalAvailable > 0 && (
            <>
              <span className="text-[11px] t3">·</span>
              <span className="text-[11px] t2">
                <strong className="t1">{Math.round(data.usage.minutesUsed)} / {data.usage.totalAvailable}</strong> minutes used
              </span>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TOP — Agent Identity Card (Phase 2 v3 launch cut)
          Consolidates greeting, voice, identity vars, after-call SMS,
          Telegram pill, and "today's update" in one inline-editable card.
          Replaces AgentSpeaksCard + VoicePickerDropdown + TodayUpdateCard.
          ════════════════════════════════════════════════════════════ */}
      {data.clientId && onboarding.hasAgent && (
        <>
          <AgentIdentityCardCompact
            agentName={agent.name}
            businessName={onboarding.businessName}
            voiceFallback={data.agent.voiceStylePreset
              ? data.agent.voiceStylePreset.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' voice'
              : null}
            voiceId={data.onboarding.agentVoiceId}
            twilioNumber={data.twilioNumber ?? null}
            capabilities={{
              hasGreeting: true,
              hasSms: data.editableFields.smsEnabled && data.activation.twilio_number_present,
              hasTelegram: onboarding.telegramConnected,
              hasIvr: data.editableFields.ivrEnabled,
              hasVoicemail: !!data.editableFields.voicemailGreetingText,
              hasBooking: capabilities.hasBooking && calendarConnected,
              hasTransfer: capabilities.hasTransfer,
              hasWebsite: capabilities.hasWebsite,
              hasGoogleProfile: !!data.gbpData?.placeId,
            }}
            injectedNote={data.editableFields.injectedNote}
            syncedLabel={(() => {
              const at = data.agentSync?.last_agent_sync_at
              if (!at) return null
              const m = Math.floor((Date.now() - new Date(at).getTime()) / 60000)
              if (m < 1) return 'Synced just now'
              if (m < 60) return `Synced ${m}m ago`
              const h = Math.floor(m / 60)
              if (h < 24) return `Synced ${h}h ago`
              return `Synced ${Math.floor(h / 24)}d ago`
            })()}
            isTrial={isTrial}
            hasForwarding={!!data.editableFields.forwardingNumber}
            openModal={inlineEdit.openModal}
          />
        </>
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

      {/* v2: nudgeItems grid removed — covered by AgentIdentityCard chips + AgentReadinessRow */}

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

      {/* Paid awaiting — activation setup tile.
          v2: forwarding sheet replaced by the inline Transfer modal (drops HomeSideSheet
          to avoid the role="dialog" double-mount footgun). */}
      {isPaidAwaiting && data.activation && (
        <ActivationTile
          state={data.activation.state}
          onOpenForwardingSheet={() => inlineEdit.openModal('transfer')}
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

      {/* v2: QuickConfigStrip + setupPct removed — chip pills in AgentIdentityCard are the source of truth */}

      {/* ════════════════════════════════════════════════════════════
          TIER 1 — Hero (2-col: Orb+UnansweredQs | Quick Add)
          Mockup parity 2026-04-26 — Quick Add beside the orb,
          page restructured from 3-col to 2-col flow.
          ════════════════════════════════════════════════════════════ */}
      {onboarding.hasAgent && data.clientId && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          {/* Left: Test Call orb + Unanswered Questions */}
          <div ref={testCallRef} className="space-y-3">
            <TestCallCard
              clientId={data.clientId}
              isAdmin={false}
              isTrial={isTrial}
              onCallEnded={fetchData}
              compact
            />
            {/* v2: PendingReviewTile + UnansweredQuestionsTile moved into the single readiness band below */}
          </div>

          {/* Right: Recent calls (moved from bottom row 2026-04-27) */}
          <div className="space-y-3">
            <V2CallList
              clientId={data.clientId}
              hasTwilioNumber={!!data.twilioNumber}
              twilioNumber={data.twilioNumber ?? null}
              limit={5}
              onRowClick={(snapshot) => inlineEdit.openModal('call', snapshot)}
            />
          </div>
        </div>

        {/* v2: TIER 1.5 (CallMe + StatsHeroCard + TrialModeSwitcher) removed.
            Stats now surfaced inline in the trial pill at the top per mockup. */}

        {/* v2: AgentKnowsCard ("What your agent knows") removed 2026-04-27 —
            users go to /dashboard/knowledge directly for that view. */}

        {/* ════════════════════════════════════════════════════════════
            v2 — Readiness band (full-width, internal 2-col grid).
            Recent calls moved to top hero (2026-04-27).
            ════════════════════════════════════════════════════════════ */}
        <div>
          {(() => {
            const readyDims = [
              !!data.editableFields.hoursWeekday,
              (data.activeServicesCount ?? 0) > 0,
              faqCount > 0,
              !calendarConnected ? false : true,
              data.knowledge.approved_chunk_count > 0,
              pendingKnowledgeCount === 0 && (data.insights?.openGaps ?? 0) === 0,
            ]
            const readyCount = readyDims.filter(Boolean).length
            const readyTotal = readyDims.length
            const readyPct = Math.round((readyCount / readyTotal) * 100)
            const openGaps = data.insights?.openGaps ?? 0

            type Row = {
              key: string
              done: boolean
              label: string
              meta: string
              modalId: Exclude<ModalId, null>
              urgent?: boolean
            }
            const rows: Row[] = [
              {
                key: 'hours',
                done: !!data.editableFields.hoursWeekday,
                label: 'Hours',
                meta: data.editableFields.hoursWeekday || '— add your hours',
                modalId: 'hours',
              },
              {
                key: 'services',
                done: (data.activeServicesCount ?? 0) > 0,
                label: 'Services',
                meta: (data.activeServicesCount ?? 0) > 0 ? `${data.activeServicesCount} active` : '— what do you sell?',
                modalId: 'services',
                urgent: (data.activeServicesCount ?? 0) === 0,
              },
              {
                key: 'faqs',
                done: faqCount > 0,
                label: 'FAQs',
                meta: faqCount > 0 ? `${faqCount} answers` : '— add your top questions',
                modalId: 'faqs',
              },
              {
                key: 'booking',
                done: calendarConnected,
                label: 'Booking',
                meta: calendarConnected ? 'Calendar connected' : '— connect Google Calendar',
                modalId: 'calendar',
              },
              {
                key: 'knowledge',
                done: data.knowledge.approved_chunk_count > 0,
                label: 'Knowledge',
                meta: pendingKnowledgeCount > 0
                  ? `${pendingKnowledgeCount} page${pendingKnowledgeCount !== 1 ? 's' : ''} pending review`
                  : data.knowledge.approved_chunk_count > 0
                    ? `${data.knowledge.approved_chunk_count} chunks`
                    : '— add a website or PDF',
                modalId: 'knowledge',
                urgent: pendingKnowledgeCount > 0,
              },
              {
                key: 'gaps',
                done: openGaps === 0,
                label: openGaps > 0
                  ? `${openGaps} unanswered question${openGaps !== 1 ? 's' : ''} this week`
                  : 'No unanswered questions',
                meta: openGaps > 0 ? 'tap to answer' : 'agent knows what callers ask',
                modalId: 'gaps',
                urgent: openGaps > 0,
              },
            ]

            return (
              <div className="rounded-2xl p-4" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">
                    Agent readiness — {readyCount} of {readyTotal} ready
                  </p>
                  <span className="text-[11px] font-medium t2">{readyPct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${readyPct}%`,
                      backgroundColor: readyPct >= 80 ? 'rgb(34,197,94)' : readyPct >= 50 ? 'rgb(245,158,11)' : 'var(--color-primary)',
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                  {rows.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => inlineEdit.openModal(r.modalId)}
                      className="flex items-center justify-between gap-3 py-2.5 hover:bg-hover transition-colors px-2 -mx-2 rounded-lg w-full text-left border-b md:border-b-0 md:border-t"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{r.done ? '✅' : r.urgent ? '⚠️' : '⚪'}</span>
                        <span className="text-[12px] font-semibold t1 truncate">{r.label}</span>
                        <span className="text-[11px] t3 truncate">{r.meta}</span>
                      </div>
                      <span
                        className="text-[11px] font-semibold shrink-0"
                        style={{ color: r.done ? 'var(--color-text-3)' : 'var(--color-primary)' }}
                      >
                        {r.done ? 'view →' : 'fix →'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </>)}

      {/* Agent sync badge */}
      {data.clientId && data.agentSync && (
        <div className="flex items-center gap-2 px-1">
          <AgentSyncBadge
            lastSyncAt={data.agentSync.last_agent_sync_at}
            lastSyncStatus={data.agentSync.last_agent_sync_status}
          />
        </div>
      )}

      {/* Footer — Plan card + "When you're ready to go live" card (mockup parity).
          v2: billing sheet dropped — link to /dashboard/billing instead. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <Link
          href="/dashboard/billing"
          className="rounded-2xl p-4 card-surface text-left hover:opacity-90 transition-opacity cursor-pointer block"
        >
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1.5">Plan</p>
          <p className="text-[14px] font-bold t1">
            {isTrial
              ? `Trial · ${daysRemaining ?? 0} day${daysRemaining === 1 ? '' : 's'} left`
              : (data.selectedPlan === 'core' ? 'AI Receptionist · $119/mo'
                : data.selectedPlan === 'lite' ? 'Solo · $49/mo'
                : data.selectedPlan === 'pro' ? 'AI Receptionist · $119/mo'
                : 'Active')}
          </p>
          <p className="text-[12px] t3 mt-1">
            {Math.round(data.usage.minutesUsed)} / {data.usage.totalAvailable || 0} minutes used · Manage billing →
          </p>
        </Link>

        {isTrial && (
          <button
            onClick={() => openUpgradeModal('unified_upgrade_cta', data.clientId, daysRemaining, data.selectedPlan)}
            className="rounded-2xl p-4 text-left transition-opacity cursor-pointer"
            style={{
              backgroundColor: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1.5">When you&apos;re ready to go live</p>
            <p className="text-[12px] t2 mb-3 leading-relaxed">
              Solo $49/mo or AI Receptionist $119/mo. Pick one to keep your number live.
            </p>
            <div
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white text-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              See plans →
            </div>
          </button>
        )}
      </div>

      {/* Inline edit modals — single host for the v2 chip + readiness band + call list. */}
      <InlineModalsV2
        clientId={data.clientId}
        isAdmin={false}
        data={data}
        edit={inlineEdit}
        fetchData={fetchData}
        openUpgrade={() => openUpgradeModal('overview_inline_modal', data.clientId, daysRemaining, data.selectedPlan)}
        planSupportsBooking={planSupportsBooking}
        planSupportsTransfer={planSupportsTransfer}
      />
    </>
  )
}
