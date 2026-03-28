/**
 * build-trial-welcome-view-model.ts
 *
 * Derives a compact read-only view model from ClientAgentConfig for the
 * first-login / trial dashboard welcome surface.
 *
 * Pure function — no DB calls, no async, no side effects.
 */

import type { ClientAgentConfig } from '@/types/client-agent-config'

export type TrialWelcomeViewModel = {
  businessName: string
  agentName: string
  /** Days left in trial, or null if no active trial */
  daysLeft: number | null
  /** True when trial period has passed and user has NOT converted — disambiguates daysLeft=null */
  isTrialExpired: boolean
  /** True when setup_complete is false — first-login proxy */
  isFirstVisit: boolean
  hasHours: boolean
  hasFaqs: boolean
  hasWebsite: boolean
  hasForwardingNumber: boolean
  hasGbp: boolean
  compiledChunkCount: number
  /**
   * ready     — agent exists + forwarding is configured (setup_complete)
   * pending   — agent exists, forwarding not yet configured
   * incomplete — no agent yet (provisioning still running)
   */
  provisioningState: 'ready' | 'pending' | 'incomplete'
}

export function buildTrialWelcomeViewModel(
  config: ClientAgentConfig,
  hasAgent: boolean,
  now: Date = new Date(),
  compiledChunkCount: number = 0,
): TrialWelcomeViewModel {
  // Days left — only meaningful when trial is active
  const daysLeft =
    config.trial.isTrialActive && config.trial.trialExpiresAt != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(config.trial.trialExpiresAt).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null

  // Expired: had a trial, it ended, and they haven't converted — disambiguates daysLeft=null
  const isTrialExpired =
    config.trial.trialExpiresAt !== null &&
    !config.trial.isTrialActive &&
    !config.trial.trialConverted

  const provisioningState: TrialWelcomeViewModel['provisioningState'] =
    hasAgent && config.auth.setupComplete
      ? 'ready'
      : hasAgent
        ? 'pending'
        : 'incomplete'

  return {
    businessName: config.business.businessName,
    agentName: config.persona.agentName,
    daysLeft,
    isTrialExpired,
    isFirstVisit: config.auth.isFirstVisit,
    hasHours: !!config.hours.hoursWeekday,
    hasFaqs: config.knowledge.extraQa.length > 0,
    // scrapeStatus='complete' means scrape ran AND user approved it — corpus is actually live
    hasWebsite: config.knowledge.scrapeStatus === 'complete',
    hasForwardingNumber: config.routing.callForwardingEnabled,
    hasGbp: config.gbp.hasGbp,
    compiledChunkCount,
    provisioningState,
  }
}
