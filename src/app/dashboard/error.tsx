'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-3)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--color-text-1)' }}
      >
        Something went wrong
      </h2>
      <p
        className="text-sm mb-6 max-w-sm"
        style={{ color: 'var(--color-text-3)' }}
      >
        An unexpected error occurred. This has been logged automatically.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-1)',
          border: '1px solid var(--color-border)',
        }}
      >
        Try again
      </button>
    </div>
  )
}
