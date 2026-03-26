'use client'

import { type TrialPhase } from '@/lib/trial-display-state'
import { trackEvent } from '@/lib/analytics'

interface TrialWelcomeBannerProps {
  trialPhase: TrialPhase
  agentName: string
  daysLeft: number | null
  provisioningState: 'ready' | 'pending' | 'incomplete'
  onDismiss: () => void
}

export default function TrialWelcomeBanner({
  trialPhase,
  agentName,
  daysLeft,
  provisioningState,
  onDismiss,
}: TrialWelcomeBannerProps) {
  const isUrgent = trialPhase === 'active_urgent' || trialPhase === 'active_final'
  const isFinal = trialPhase === 'active_final'

  const headingText =
    provisioningState === 'ready'
      ? `${agentName} is ready to test`
      : provisioningState === 'pending'
      ? `${agentName} is being set up`
      : 'Your agent is being provisioned'

  const bodyText =
    provisioningState === 'ready'
      ? isUrgent
        ? "Time's running out — upgrade now to keep your agent taking real calls."
        : "Everything's ready. Start a test call to hear how it handles real callers."
      : provisioningState === 'pending'
      ? "We're still setting up part of your account. You can start testing now."
      : 'Your agent is still being provisioned. Check back shortly.'

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 relative"
      style={{
        background: isUrgent
          ? 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, var(--color-surface) 100%)'
          : 'linear-gradient(135deg, var(--color-accent-tint) 0%, var(--color-surface) 100%)',
        border: isUrgent ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--color-border)',
      }}
    >
      <button
        onClick={() => { trackEvent('trial_welcome_banner_dismissed', { trial_phase: trialPhase }); onDismiss() }}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-hover transition-colors"
        style={{ color: 'var(--color-text-3)' }}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: isUrgent ? 'rgba(245,158,11,0.15)' : 'var(--color-primary)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
              stroke={isUrgent ? 'rgb(245,158,11)' : 'white'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold t1">{headingText}</p>
            {daysLeft !== null && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold leading-none whitespace-nowrap"
                style={{
                  backgroundColor: isFinal ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
                  color: isFinal ? 'rgb(239,68,68)' : 'rgb(245,158,11)',
                }}
              >
                {isFinal ? 'Last day' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
              </span>
            )}
          </div>
          <p className="text-xs t3 mt-1 leading-relaxed">{bodyText}</p>
        </div>
      </div>
    </div>
  )
}
