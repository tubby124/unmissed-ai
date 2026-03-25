'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import type { TrialWelcomeViewModel } from '@/lib/build-trial-welcome-view-model'

interface WelcomeViewProps {
  trialWelcome: TrialWelcomeViewModel
  clientStatus: string | null
  hasAgent: boolean
  hasKnowledge: boolean
  hasFacts: boolean
  hasBooking: boolean
}

function provisioningHeadline(state: TrialWelcomeViewModel['provisioningState'], agentName: string): string {
  if (state === 'ready') return `${agentName} is ready to test`
  if (state === 'pending') return `${agentName} is almost ready`
  return 'Your agent is being set up'
}

function provisioningSubtext(state: TrialWelcomeViewModel['provisioningState']): string {
  if (state === 'ready') return "Everything's configured. Start a test call to hear how your agent handles real callers."
  if (state === 'pending') return "We're still setting up part of your account. You can start testing now."
  return 'Your agent is still being provisioned. This usually takes a minute — check back shortly.'
}

export default function WelcomeView({
  trialWelcome,
  clientStatus,
  hasAgent,
  hasKnowledge,
  hasFacts,
  hasBooking,
}: WelcomeViewProps) {
  const { agentName, businessName, daysLeft, provisioningState, hasHours, hasFaqs, hasWebsite, hasForwardingNumber } = trialWelcome

  // Mark welcome as seen so /dashboard doesn't redirect here again
  useEffect(() => {
    document.cookie = 'welcome_seen=1; path=/; max-age=31536000; SameSite=Lax'
  }, [])

  return (
    <div className="p-3 sm:p-6 max-w-xl mx-auto space-y-5">

      {/* ── Hero header ──────────────────────────────────────────── */}
      <div>
        {/* Trial countdown pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--color-primary)' }}>
            Trial
          </span>
          {daysLeft !== null && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold leading-none whitespace-nowrap">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
            </span>
          )}
        </div>

        {/* Main headline */}
        <h1 className="text-xl sm:text-2xl font-bold t1 leading-snug mb-1.5">
          {provisioningHeadline(provisioningState, agentName)}
        </h1>
        <p className="text-sm t3 leading-relaxed">
          {provisioningSubtext(provisioningState)}
        </p>
      </div>

      {/* ── Orb / Test call — PRIMARY ACTION ────────────────────── */}
      {hasAgent ? (
        <AgentTestCard
          agentName={agentName}
          businessName={businessName}
          clientStatus={clientStatus}
          isTrial={true}
        />
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

      {/* ── What your agent knows — mini summary ────────────────── */}
      <div className="rounded-2xl p-4 card-surface">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">What callers experience</p>
          <Link
            href="/dashboard/settings?tab=knowledge"
            className="text-[12px] font-medium hover:opacity-75 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Improve →
          </Link>
        </div>
        <div className="space-y-2.5">
          <KnowledgeRow label="Hours" active={hasHours} activeText="Configured" inactiveText="Not set" />
          <KnowledgeRow label="FAQs" active={hasFaqs} activeText="Configured" inactiveText="None added yet" />
          <KnowledgeRow
            label="Knowledge"
            active={hasKnowledge || hasFacts}
            activeText={hasKnowledge ? 'Website loaded' : 'Facts added'}
            inactiveText="Basic only"
            neutral={!hasKnowledge && hasFacts}
          />
          <KnowledgeRow label="Booking" active={hasBooking} activeText="Calendar connected" inactiveText="Not connected" neutral={!hasBooking} />
          <KnowledgeRow label="Forwarding" active={hasForwardingNumber} activeText="Configured" inactiveText="Not set" />
          <KnowledgeRow label="Website" active={hasWebsite} activeText="Added" inactiveText="Not added" />
        </div>
      </div>

      {/* ── Go-live upgrade CTA ──────────────────────────────────── */}
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
        <a
          href="/dashboard/settings?tab=billing"
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Get a real phone number — upgrade to go live
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>

      {/* ── Escape hatch ─────────────────────────────────────────── */}
      <div className="text-center pb-2">
        <Link
          href="/dashboard"
          className="text-xs t3 hover:opacity-75 transition-opacity"
        >
          Explore your dashboard →
        </Link>
      </div>

    </div>
  )
}

function KnowledgeRow({
  label,
  active,
  activeText,
  inactiveText,
  neutral = false,
}: {
  label: string
  active: boolean
  activeText: string
  inactiveText: string
  neutral?: boolean
}) {
  const pillClass = active
    ? 'bg-green-500/10 text-green-400'
    : neutral
    ? 'bg-blue-500/10 text-blue-400'
    : 'bg-amber-500/10 text-amber-400'

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium t3 w-20 shrink-0">{label}</span>
      <span className={`text-[11px] px-2 py-0.5 rounded-full leading-none ${pillClass}`}>
        {active ? activeText : inactiveText}
      </span>
    </div>
  )
}
