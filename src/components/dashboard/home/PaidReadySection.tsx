'use client'

import { useState } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import AutoFaqSuggestions from '../AutoFaqSuggestions'
import BillingTile from './BillingTile'
import CapabilitiesCard from '../CapabilitiesCard'
import NotificationsTile from './NotificationsTile'
import StatsHeroCard from './StatsHeroCard'
import TeachAgentCard from './TeachAgentCard'
import TodayUpdateCard from './TodayUpdateCard'
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

// ── Props ────────────────────────────────────────────────────────
interface Props {
  data: HomeData
  showChecklist: boolean
  hasRealCalls: boolean
  lastCompletedCall: HomeData['recentCalls'][0] | null
  sheet: ReturnType<typeof useHomeSheet>
}

// ── Component ────────────────────────────────────────────────────
export default function PaidReadySection({
  data,
  sheet,
}: Props) {
  const { agent, capabilities, onboarding } = data
  const { openUpgradeModal } = useUpgradeModal()
const [knowOpen, setKnowOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [syncDismissed, setSyncDismissed] = useState(false)
  const [hotDismissed, setHotDismissed] = useState(false)

  // ── Derived summary values ───────────────────────────────────
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

  // Next best action — paid users: no upgrade nudge, focus on quality gaps
  const nextAction: { text: string; cta: string; href: string | null } | null = (() => {
    if (!capabilities.hasFacts && faqCount === 0 && !capabilities.hasWebsite) {
      return { text: "Agent doesn't know your business yet", cta: 'Add facts →', href: '/dashboard/settings?tab=knowledge' }
    }
    if (!capabilities.hasHours) {
      return { text: "Agent can't tell callers your hours", cta: 'Set hours →', href: '/dashboard/settings?tab=general' }
    }
    if (!capabilities.hasWebsite && !capabilities.hasKnowledge) {
      return { text: 'Add your website to teach your agent more', cta: 'Add website →', href: '/dashboard/settings?tab=knowledge' }
    }
    if (!onboarding.telegramConnected) {
      return { text: 'Get instant call alerts on Telegram', cta: 'Connect →', href: '/dashboard/settings?tab=notifications' }
    }
    return null
  })()

  return (
    <>
      {/* ── 0. Sync error banner ─────────────────────────────────── */}
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
            href="/dashboard/settings"
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

      {/* ── 1. StatsHeroCard ────────────────────────────────────── */}
      <StatsHeroCard
        agentName={agent.name}
        agentStatus={agent.status}
        isTrial={false}
        isExpired={false}
        totalCalls={data.stats.totalCalls}
        callsTrend={data.stats.trends.callsChange}
        minutesUsed={data.usage.minutesUsed}
        totalAvailable={data.usage.totalAvailable}
        bonusMinutes={data.usage.bonusMinutes}
        onUpgrade={() => openUpgradeModal('home_stats_usage', data.clientId)}
      />

      {/* ── 1b. Stats secondary strip ──────────────────────────── */}
      {(data.stats.todayCalls > 0 || data.stats.lastCallAt || data.stats.timeSavedMinutes > 0) && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl flex-wrap" style={{ backgroundColor: 'var(--color-hover)' }}>
          {data.stats.todayCalls > 0 && (
            <span className="text-[12px]" style={{ color: 'var(--color-text-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>{data.stats.todayCalls}</span>{' '}call{data.stats.todayCalls !== 1 ? 's' : ''} today
            </span>
          )}
          {data.stats.lastCallAt && (
            <span className="text-[12px]" style={{ color: 'var(--color-text-2)' }}>
              last call <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>{timeAgo(data.stats.lastCallAt)}</span>
            </span>
          )}
          {data.stats.timeSavedMinutes > 0 && (
            <span className="text-[12px]" style={{ color: 'var(--color-text-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>{formatTimeSaved(data.stats.timeSavedMinutes)}</span>{' '}handled this month
            </span>
          )}
        </div>
      )}

      {/* ── 2. Next best action (inline strip) ─────────────────── */}
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
          {nextAction.href && (
            <Link
              href={nextAction.href}
              className="text-[12px] font-semibold cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--color-primary)' }}
            >
              {nextAction.cta}
            </Link>
          )}
        </div>
      )}

      {/* ── 2b. HOT lead banner ────────────────────────────────── */}
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

      {/* ── 3. CapabilitiesCard ─────────────────────────────────── */}
      <CapabilitiesCard
        capabilities={capabilities}
        agentName={agent.name}
        voiceStylePreset={agent.voiceStylePreset}
        isTrial={false}
        clientId={data.clientId}
        hasPhoneNumber={onboarding.hasPhoneNumber}
        hasIvr={data.editableFields.ivrEnabled}
        hasContextData={data.editableFields.hasContextData}
      />

      {/* ── 4. 2-col grid: TestCallCard + TodayUpdateCard ─────── */}
      {onboarding.hasAgent && data.clientId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TestCallCard
            clientId={data.clientId}
            isAdmin={false}
            isTrial={false}
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
          <TodayUpdateCard
            clientId={data.clientId}
            currentNote={data.editableFields.injectedNote}
          />
        </div>
      )}

      {/* ── 5. Identity strip ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Agent name chip */}
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
            <span className="sr-only">Agent status: {data.agentHealth ?? 'unknown'}</span>
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

        {/* Niche chip */}
        {agent.niche && (
          <Link
            href="/dashboard/settings?tab=general"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] cursor-pointer hover:opacity-75 transition-opacity"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
          >
            {formatNiche(agent.niche)}
          </Link>
        )}

        {/* Voice chip */}
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

        {/* Telegram pill */}
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

        {/* SMS pill */}
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

        {/* Agent sync badge */}
        {data.agentSync && (
          <AgentSyncBadge
            lastSyncAt={data.agentSync.last_agent_sync_at}
            lastSyncStatus={data.agentSync.last_agent_sync_status}
          />
        )}
      </div>

      {/* ── 6. "WHAT IT KNOWS" collapsible ─────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
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
              /* Empty state */
              <div className="py-6 text-center space-y-2">
                <p className="text-sm t2">Nothing added yet</p>
                <p className="text-[12px] t3 leading-relaxed max-w-xs mx-auto">
                  Your agent answers from its base training only. Add business facts, FAQs, or a website to make it specific to you.
                </p>
                <Link
                  href="/dashboard/settings?tab=knowledge"
                  className="inline-block text-[12px] font-semibold mt-1 cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Add knowledge →
                </Link>
              </div>
            ) : (
              <>
                {/* Business facts preview */}
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

                {/* FAQ preview (first 2) */}
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
                        <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                          +{faqCount - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Source pills */}
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
                          style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'rgb(129,140,248)' }}
                        >
                          {srcLabels[src] ?? src}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Auto FAQ suggestions */}
                {data.clientId && data.lastFaqSuggestions && data.lastFaqSuggestions.length > 0 && (
                  <AutoFaqSuggestions
                    clientId={data.clientId}
                    suggestions={data.lastFaqSuggestions}
                  />
                )}

                {/* Teach agent card */}
                {data.clientId && (
                  <TeachAgentCard clientId={data.clientId} agentName={agent.name} />
                )}
              </>
            )}

            <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <Link
                href="/dashboard/settings?tab=knowledge"
                className="text-[12px] font-medium cursor-pointer hover:opacity-75 transition-opacity"
                style={{ color: 'var(--color-primary)' }}
              >
                Manage knowledge →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. "RECENT ACTIVITY" collapsible ───────────────────── */}
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
                  Recent activity
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
              {data.recentCalls.slice(0, 3).map(call => {
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
        </div>
      )}

      {/* ── 8. NotificationsTile ────────────────────────────────── */}
      <NotificationsTile
        telegramConnected={onboarding.telegramConnected}
        agentName={agent.name}
        onOpenSheet={() => sheet.open('notifications')}
      />

      {/* ── 9. BillingTile ──────────────────────────────────────── */}
      <BillingTile
        selectedPlan={data.selectedPlan}
        subscriptionStatus={onboarding.subscriptionStatus}
        onOpenSheet={() => sheet.open('billing')}
      />
    </>
  )
}
