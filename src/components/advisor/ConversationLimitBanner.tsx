'use client'

import { useState, useEffect, useRef } from 'react'
import { CONVERSATION_SUMMARY_THRESHOLD } from '@/lib/advisor-constants'

interface ConversationLimitBannerProps {
  messageCount: number
  onSummarize: () => void
  isSummarizing: boolean
}

export default function ConversationLimitBanner({
  messageCount,
  onSummarize,
  isSummarizing,
}: ConversationLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const dismissedAtCount = useRef<number>(0)

  useEffect(() => {
    if (dismissed && messageCount >= dismissedAtCount.current + 10) {
      setDismissed(false)
    }
  }, [messageCount, dismissed])

  if (messageCount < CONVERSATION_SUMMARY_THRESHOLD) return null
  if (dismissed) return null

  const handleDismiss = () => {
    dismissedAtCount.current = messageCount
    setDismissed(true)
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-amber-500/40 px-4 py-3"
      style={{ backgroundColor: 'var(--color-bg-raised)' }}
    >
      <svg
        className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>

      <p className="flex-1 text-sm" style={{ color: 'var(--color-text-2)' }}>
        This conversation has {messageCount} messages. Summarize it to start fresh with context preserved.
      </p>

      <button
        type="button"
        onClick={onSummarize}
        disabled={isSummarizing}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
      >
        {isSummarizing && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isSummarizing ? 'Summarizing...' : 'Summarize & Continue'}
      </button>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 transition-colors hover:bg-[var(--color-hover)]"
        style={{ color: 'var(--color-text-3)' }}
        aria-label="Dismiss"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
