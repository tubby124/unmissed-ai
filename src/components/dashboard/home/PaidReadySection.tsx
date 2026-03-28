'use client'

import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import { CallInsightsHeader } from '@/components/dashboard/CallInsightsHeader'
import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import { useCallContext } from '@/contexts/CallContext'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import AgentIdentityTile from './AgentIdentityTile'
import AgentKnowledgeTile from './AgentKnowledgeTile'
import BillingTile from './BillingTile'
import BusinessHoursTile from './BusinessHoursTile'
import CallHandlingTile from './CallHandlingTile'
import NotificationsTile from './NotificationsTile'
import ProofStrip from './ProofStrip'
import StatsHeroCard from './StatsHeroCard'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

interface Props {
  data: HomeData
  showChecklist: boolean
  hasRealCalls: boolean
  lastCompletedCall: HomeData['recentCalls'][0] | null
  sheet: ReturnType<typeof useHomeSheet>
}

export default function PaidReadySection({
  data,
  showChecklist,
  hasRealCalls,
  lastCompletedCall,
  sheet,
}: Props) {
  const { agent, capabilities, onboarding } = data
  const { resetCall } = useCallContext()
  const { openUpgradeModal } = useUpgradeModal()

  return (
    <>
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
          isTrial={false}
        />
      )}

      {/* Call insights header */}
      {data.insights && (
        <CallInsightsHeader
          totalCalls={data.stats.totalCalls}
          avgQuality={data.stats.avgQuality}
          knowledgeCoverage={data.insights.knowledgeCoverage}
          openGaps={data.insights.openGaps}
        />
      )}

      {/* Stats hero */}
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

      {/* Bento grid */}
      {onboarding.hasAgent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    </>
  )
}
