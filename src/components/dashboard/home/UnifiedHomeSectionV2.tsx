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
  // resetCall is unused in this surface but kept in context for legacy banners
  void resetCall

  // Scroll target for the orb (kept — still anchors the test-call card)
  const testCallRef = useRef<HTMLDivElement>(null)

  const faqCount = data.editableFields.faqs.length
  const pendingKnowledgeCount = data.knowledge?.pending_review_count ?? 0
  const planSupportsBooking = isTrial || data.selectedPlan === 'core' || data.selectedPlan === 'pro'
  const planSupportsTransfer = isTrial || data.selectedPlan === 'core' || data.selectedPlan === 'pro'

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          LAYER 1 — Inline toast alerts (slim, critical)
          ════════════════════════════════════════════════════════════ */}

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

      {/* Forwarding live on Go Live — slim link, single source of truth (2026-04-28). */}
      {!isTrial && !!data.twilioNumber && data.stats.totalCalls === 0 && (
        <Link
          href="/dashboard/go-live"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div className="min-w-0">
            <p className="text-[12px] font-semibold t1">Forward your existing number to your agent</p>
            <p className="text-[11px] t3 leading-snug">Set it up on the Go Live page → carrier code + one-tap test.</p>
          </div>
          <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--color-primary)' }}>Open Go Live →</span>
        </Link>
      )}

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
            {data.stats.totalCalls} call{data.stats.totalCalls !== 1 ? 's' : ''} this month · {Math.round(data.usage.minutesUsed)} / {data.usage.totalAvailable || 0} minutes used · Manage billing →
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
