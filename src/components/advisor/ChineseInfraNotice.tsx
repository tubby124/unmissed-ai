'use client'

import { useState, useEffect } from 'react'
import { getModelById } from '@/lib/ai-models'

interface ChineseInfraNoticeProps {
  modelId: string
}

const SESSION_STORAGE_KEY = 'advisor_china_notice_dismissed'

export default function ChineseInfraNotice({ modelId }: ChineseInfraNoticeProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored === 'true') {
      setDismissed(true)
    }
  }, [])

  const model = getModelById(modelId)
  if (!model?.isChineseInfra) return null
  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true')
  }

  return (
    <div
      className="flex items-start gap-2.5 rounded-md border-l-2 border-amber-500 px-3 py-2.5"
      style={{ backgroundColor: 'var(--color-bg-raised)' }}
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <p className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
        This model runs on Chinese cloud infrastructure. Data may be subject to PRC data regulations. No sensitive business data should be shared.
      </p>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--color-hover)]"
        style={{ color: 'var(--color-text-3)' }}
        aria-label="Dismiss"
      >
        <svg
          className="h-3.5 w-3.5"
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
