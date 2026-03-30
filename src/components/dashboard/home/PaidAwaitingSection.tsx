'use client'

import { AgentSyncBadge } from '@/components/dashboard/AgentSyncBadge'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import ActivationTile from './ActivationTile'
import AgentIdentityTile from './AgentIdentityTile'
import AgentKnowledgeTile from './AgentKnowledgeTile'
import BillingTile from './BillingTile'
import KnowledgeSourcesTile from './KnowledgeSourcesTile'
import BusinessHoursTile from './BusinessHoursTile'
import CallHandlingTile from './CallHandlingTile'
import NotificationsTile from './NotificationsTile'
import NicheInsightsTile from './NicheInsightsTile'
import AgentContextPreviewTile from './AgentContextPreviewTile'
import UnansweredQuestionsTile from './UnansweredQuestionsTile'
import IvrVoicemailTile from './IvrVoicemailTile'
import PostCallActionsTile from './PostCallActionsTile'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

interface Props {
  data: HomeData
  sheet: ReturnType<typeof useHomeSheet>
  fetchData: () => void
}

export default function PaidAwaitingSection({ data, sheet, fetchData }: Props) {
  const { agent, capabilities, onboarding } = data

  return (
    <>
      <ActivationTile
        state={data.activation.state}
        onOpenForwardingSheet={() => sheet.open('forwarding')}
        onRefreshClick={fetchData}
      />

      {onboarding.hasAgent && (
        <AgentTestCard
          agentName={agent.name}
          businessName={onboarding.businessName}
          clientStatus={onboarding.clientStatus}
          isTrial={false}
          clientId={data.clientId}
          daysRemaining={undefined}
        />
      )}

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

          <KnowledgeSourcesTile
            gbpData={data.gbpData}
            editableFields={data.editableFields}
            websiteScrapeStatus={data.websiteScrapeStatus}
            clientId={data.clientId ?? ''}
            onMutate={fetchData}
          />

          <CallHandlingTile
            selectedPlan={data.selectedPlan}
            subscriptionStatus={onboarding.subscriptionStatus}
            capabilities={capabilities}
            knowledge={data.knowledge}
            callHandlingMode={data.callHandlingMode}
            onOpenSheet={sheet.open}
          />

          <AgentContextPreviewTile
            editableFields={data.editableFields}
            knowledge={data.knowledge}
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
            emailEnabled={onboarding.emailNotificationsEnabled}
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

          {data.clientId && (
            <IvrVoicemailTile
              clientId={data.clientId}
              isAdmin={false}
              ivrEnabled={data.editableFields.ivrEnabled}
              ivrPrompt={data.editableFields.ivrPrompt}
              voicemailGreetingText={data.editableFields.voicemailGreetingText}
              businessName={onboarding.businessName}
              agentName={agent.name}
            />
          )}

          {data.clientId && (
            <PostCallActionsTile
              clientId={data.clientId}
              isAdmin={false}
              smsEnabled={data.editableFields.smsEnabled}
              smsTemplate={data.editableFields.smsTemplate}
              hasSms={capabilities.hasSms}
              agentName={agent.name}
            />
          )}

          <div className="sm:col-span-2">
            <NicheInsightsTile
              niche={agent.niche}
              capabilities={capabilities}
              knowledge={data.knowledge}
              onboarding={onboarding}
              sheet={sheet}
            />
          </div>
        </div>
      )}

      {/* ── Unanswered questions ────────────────────────────────── */}
      {onboarding.hasAgent && data.clientId && (
        <UnansweredQuestionsTile clientId={data.clientId} />
      )}
    </>
  )
}
