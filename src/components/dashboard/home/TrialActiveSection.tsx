'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import PostCallImprovementPanel from '@/components/dashboard/PostCallImprovementPanel'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import { CallInsightsHeader } from '@/components/dashboard/CallInsightsHeader'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useCallContext } from '@/contexts/CallContext'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import type { TrialPhase } from '@/lib/trial-display-state'
import AgentIdentityTile from './AgentIdentityTile'
import AgentKnowledgeTile from './AgentKnowledgeTile'
import BillingTile from './BillingTile'
import BusinessHoursTile from './BusinessHoursTile'
import CallHandlingTile from './CallHandlingTile'
import NotificationsTile from './NotificationsTile'
import ProofStrip from './ProofStrip'
import StatsHeroCard from './StatsHeroCard'
import SuggestedTestPrompts from './SuggestedTestPrompts'
import TeachAgentCard from './TeachAgentCard'
import TrialModeSwitcher from './TrialModeSwitcher'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

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

export default function TrialActiveSection({
  data,
  trialPhase,
  daysRemaining,
  isTrial,
  isFirstVisit = false,
  showChecklist,
  hasRealCalls,
  lastCompletedCall,
  postCallDismissed,
  onPostCallDismiss,
  sheet,
}: Props) {
  const { agent, capabilities, onboarding } = data
  const { callState, resetCall } = useCallContext()
  const { openUpgradeModal } = useUpgradeModal()

  useEffect(() => {
    if (!isFirstVisit) return
    const sessionKey = `welcome_viewed_${data.clientId}`
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1')
      trackEvent('welcome_viewed', { client_id: data.clientId ?? '', provisioning_state: data.trialWelcome.provisioningState })
    }
  }, [isFirstVisit, data.clientId, data.trialWelcome.provisioningState])

  if (isFirstVisit) {
    const { provisioningState, hasHours, hasFaqs, hasGbp, hasWebsite, compiledChunkCount, hasFacts, hasForwardingNumber } = data.trialWelcome

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

        {/* What callers experience summary */}
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
            <KnowledgeRow label="Google" active={hasGbp} activeText="Imported" inactiveText="Not imported" neutral />
            <KnowledgeRow label="Website" active={hasWebsite} activeText="Loaded" inactiveText="Not added" neutral />
            <KnowledgeRow label="AI Compiler" active={compiledChunkCount > 0} activeText={`${compiledChunkCount} item${compiledChunkCount !== 1 ? 's' : ''}`} inactiveText="None yet" neutral />
            <KnowledgeRow label="Quick-teach" active={hasFacts} activeText="Added" inactiveText="None added" neutral />
            <KnowledgeRow label="Booking" active={capabilities.hasBooking} activeText="Calendar connected" inactiveText="Not connected" neutral={!capabilities.hasBooking} />
            <KnowledgeRow label="Forwarding" active={hasForwardingNumber} activeText="Configured" inactiveText="Not set" />
          </div>
        </div>

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
            onClick={() => openUpgradeModal('welcome_upgrade_cta', data.clientId, daysRemaining)}
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

  return (
    <>
      {/* Trial label above orb */}
      {onboarding.hasAgent && (
        <p
          className="text-[11px] font-semibold tracking-[0.12em] uppercase -mb-1"
          style={{ color: (trialPhase === 'active_urgent' || trialPhase === 'active_final') ? 'rgb(245,158,11)' : 'var(--color-primary)' }}
        >
          {(trialPhase === 'active_urgent' || trialPhase === 'active_final')
            ? 'Test before your trial ends'
            : 'Your AI receptionist is ready — call it now'}
        </p>
      )}

      {/* Mode switcher */}
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

      {/* Post-call improvement loop */}
      {callState === 'ended' && !postCallDismissed && data.trialWelcome && (
        <PostCallImprovementPanel
          hasHours={data.trialWelcome.hasHours}
          hasFaqs={data.trialWelcome.hasFaqs}
          hasForwardingNumber={data.trialWelcome.hasForwardingNumber}
          existingFaqs={data.editableFields.faqs}
          onDismiss={() => { trackEvent('post_call_improvement_dismissed'); onPostCallDismiss() }}
          onRetest={resetCall}
          clientId={data.clientId}
          daysRemaining={daysRemaining}
        />
      )}

      {/* Suggested test prompts */}
      {callState === 'idle' && !postCallDismissed && (
        <SuggestedTestPrompts
          hasHours={!!data.editableFields.hoursWeekday}
          hasFaqs={data.editableFields.faqs.length > 0}
          hasTransfer={capabilities.hasTransfer}
          firstFaqQuestion={data.editableFields.faqs[0]?.q ?? null}
          onPromptClick={() => {}}
        />
      )}

      {/* Proof strip */}
      {lastCompletedCall && (
        <ProofStrip
          call={lastCompletedCall}
          hasHours={capabilities.hasHours}
          hasFaqs={capabilities.hasFaqs}
          hasForwardingNumber={!!data.editableFields.forwardingNumber}
          onRetest={resetCall}
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

      {/* Call insights header (trial users only see when they have real calls) */}
      {data.insights && hasRealCalls && (
        <CallInsightsHeader
          totalCalls={data.stats.totalCalls}
          avgQuality={data.stats.avgQuality}
          knowledgeCoverage={data.insights.knowledgeCoverage}
          openGaps={data.insights.openGaps}
        />
      )}

      {/* Stats hero (trial users only see when they have real calls) */}
      {hasRealCalls && (
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
          onUpgrade={() => openUpgradeModal('home_stats_usage', data.clientId, daysRemaining)}
        />
      )}

      {/* Bento grid */}
      {onboarding.hasAgent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Test call card — full width */}
          <div className="sm:col-span-2">
            <TestCallCard
              clientId={data.clientId ?? ''}
              isAdmin={false}
              isTrial={isTrial}
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

          <AgentKnowledgeTile
            clientId={data.clientId}
            selectedPlan={data.selectedPlan}
            subscriptionStatus={onboarding.subscriptionStatus}
            websiteScrapeStatus={data.websiteScrapeStatus}
            knowledge={data.knowledge}
            editableFields={data.editableFields}
            onOpenSheet={() => sheet.open('knowledge')}
          />

          <CallHandlingTile
            selectedPlan={data.selectedPlan}
            subscriptionStatus={onboarding.subscriptionStatus}
            capabilities={capabilities}
            knowledge={data.knowledge}
            onOpenSheet={sheet.open}
          />

          <div className="space-y-2">
            <AgentIdentityTile
              agentName={agent.name}
              niche={agent.niche}
              voiceStylePreset={agent.voiceStylePreset}
              onOpenSheet={() => sheet.open('identity')}
            />
            {data.agentSync && (
              <div className="px-1">
                <AgentSyncBadge
                  lastSyncAt={data.agentSync.last_agent_sync_at}
                  lastSyncStatus={data.agentSync.last_agent_sync_status}
                />
              </div>
            )}
          </div>

          <NotificationsTile
            telegramConnected={onboarding.telegramConnected}
            agentName={agent.name}
            onOpenSheet={() => sheet.open('notifications')}
          />

          <BusinessHoursTile
            hoursWeekday={data.editableFields.hoursWeekday}
            hoursWeekend={data.editableFields.hoursWeekend}
            onOpenSheet={() => sheet.open('hours')}
          />

          <BillingTile
            selectedPlan={data.selectedPlan}
            subscriptionStatus={onboarding.subscriptionStatus}
            onOpenSheet={() => sheet.open('billing')}
          />
        </div>
      )}

      {/* Quiet upgrade nudge */}
      <div className="text-center pb-1">
        <button
          onClick={() => openUpgradeModal('home_quiet_nudge', data.clientId, daysRemaining)}
          className="text-xs t3 hover:opacity-75 transition-opacity cursor-pointer"
        >
          Ready to take real calls? Get a phone number →
        </button>
      </div>
    </>
  )
}
