'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface OnboardingChecklistProps {
  hasPhoneNumber: boolean
  hasReceivedCall: boolean
  telegramConnected: boolean
  twilioNumber: string | null
}

export default function OnboardingChecklist({
  hasPhoneNumber,
  hasReceivedCall,
  telegramConnected,
  twilioNumber,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false)

  const steps = [
    {
      id: 'phone',
      label: 'Phone number assigned',
      description: hasPhoneNumber
        ? `Your unmissed number is ${twilioNumber}`
        : 'Waiting for number assignment...',
      done: hasPhoneNumber,
    },
    {
      id: 'forward',
      label: 'Forward your business line',
      description: hasReceivedCall
        ? 'Call forwarding is working'
        : 'Forward your phone so calls reach your AI agent',
      done: hasReceivedCall,
      link: '/dashboard/setup',
      linkLabel: 'Setup instructions',
    },
    {
      id: 'telegram',
      label: 'Connect Telegram alerts',
      description: telegramConnected
        ? 'Telegram connected — you\'ll get real-time call alerts'
        : 'Get instant call summaries on your phone',
      done: telegramConnected,
      link: '/dashboard/settings?tab=notifications',
      linkLabel: 'Connect now',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  return (
    <AnimatePresence>
      {!dismissed && !allDone && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12, height: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border overflow-hidden mb-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <p
            className="text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: 'var(--color-text-3)' }}
          >
            Get Started
          </p>
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: 'var(--color-text-3)' }}
          >
            {completedCount}/{steps.length}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs hover:underline"
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
            className="h-full rounded-full bg-blue-500"
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
                {step.description}
                {!step.done && step.link && (
                  <>
                    {' — '}
                    <Link
                      href={step.link}
                      className="text-blue-500 hover:text-blue-400 underline"
                    >
                      {step.linkLabel}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
