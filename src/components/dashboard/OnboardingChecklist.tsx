'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useOnboarding, type OnboardingState } from '@/hooks/useOnboarding'

interface OnboardingChecklistProps {
  hasPhoneNumber: boolean
  hasReceivedCall: boolean
  telegramConnected: boolean
  hasKnowledge: boolean
  isTrial: boolean
  onTestAgent?: () => void
  initialOnboardingState?: Partial<OnboardingState>
}

interface Step {
  id: string
  label: string
  description: string
  doneDescription: string
  done: boolean
  link?: string
  linkLabel?: string
  onClick?: () => void
}

export default function OnboardingChecklist({
  hasPhoneNumber,
  hasReceivedCall,
  telegramConnected,
  hasKnowledge,
  isTrial,
  onTestAgent,
  initialOnboardingState,
}: OnboardingChecklistProps) {
  const { state, dismissChecklist, isStepComplete, recordFirstLogin } = useOnboarding(initialOnboardingState)

  // Record first dashboard visit
  useEffect(() => {
    recordFirstLogin()
  }, [recordFirstLogin])

  // Auto-detect completion from real data + persisted state
  const meetDone = isStepComplete('meet_agent') || hasReceivedCall || state.test_call_count > 0
  const alertsDone = isStepComplete('setup_alerts') || telegramConnected
  const trainDone = isStepComplete('train_agent') || hasKnowledge
  const liveDone = isStepComplete('go_live') || (hasPhoneNumber && !isTrial)

  const steps: Step[] = [
    {
      id: 'meet_agent',
      label: 'Meet your agent',
      description: 'Talk to your agent from your browser — hear how it handles calls.',
      doneDescription: 'You\'ve tested your agent',
      done: meetDone,
      ...(onTestAgent
        ? { onClick: onTestAgent, linkLabel: 'Test now' }
        : { link: '#agent-test-card', linkLabel: 'Test now' }),
    },
    {
      id: 'setup_alerts',
      label: 'Set up alerts',
      description: 'Get instant call summaries on Telegram so you never miss a lead.',
      doneDescription: 'Telegram connected',
      done: alertsDone,
      link: '/dashboard/settings?tab=notifications',
      linkLabel: 'Connect',
    },
    {
      id: 'train_agent',
      label: 'Train your agent',
      description: 'Add FAQs, service details, or upload docs to personalize responses.',
      doneDescription: 'Knowledge base configured',
      done: trainDone,
      link: '/dashboard/settings?tab=knowledge',
      linkLabel: 'Add knowledge',
    },
    {
      id: 'go_live',
      label: 'Go live',
      description: isTrial
        ? 'After upgrading: forward your existing business line. Callers reach your agent automatically.'
        : 'Forward your business line so calls reach your agent.',
      doneDescription: isTrial ? 'Upgrade to go live' : 'Your agent is live',
      done: liveDone,
      link: isTrial ? '/dashboard/settings?tab=billing' : '/dashboard/setup',
      linkLabel: isTrial ? 'Upgrade to go live' : 'Setup instructions',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  if (state.checklist_dismissed || allDone) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden mb-4 card-surface"
        id="onboarding-checklist"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <p
              className="text-[11px] font-semibold tracking-[0.15em] uppercase"
              style={{ color: 'var(--color-text-3)' }}
            >
              Get Started
            </p>
            <span
              className="text-[11px] font-mono tabular-nums"
              style={{ color: 'var(--color-text-3)' }}
            >
              {completedCount}/{steps.length}
            </span>
          </div>
          <button
            onClick={dismissChecklist}
            className="text-xs hover:underline cursor-pointer"
            style={{ color: 'var(--color-text-3)' }}
          >
            Dismiss
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: 'var(--color-primary)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / steps.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="px-4 pb-4 space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 24 }}
              className="flex items-start gap-3"
            >
              {/* Checkbox circle */}
              <div className="mt-0.5 shrink-0">
                {step.done ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                ) : (
                  <div
                    className="w-5 h-5 rounded-full border-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? 'line-through' : ''}`}
                  style={{ color: step.done ? 'var(--color-text-3)' : 'var(--color-text-1)' }}
                >
                  {step.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                  {step.done ? step.doneDescription : step.description}
                  {!step.done && step.link && (
                    <>
                      {' — '}
                      <Link
                        href={step.link}
                        className="underline" style={{ color: 'var(--color-primary)' }}
                      >
                        {step.linkLabel}
                      </Link>
                    </>
                  )}
                  {!step.done && !step.link && step.onClick && (
                    <>
                      {' — '}
                      <button
                        onClick={step.onClick}
                        className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer"
                      >
                        {step.linkLabel}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
