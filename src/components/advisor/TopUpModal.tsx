'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { CREDIT_PACKS, type CreditPack } from '@/lib/ai-models'

interface TopUpModalProps {
  open: boolean
  onClose: () => void
}

export default function TopUpModal({ open, onClose }: TopUpModalProps) {
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, handleEscape])

  async function handlePurchase(pack: CreditPack) {
    setLoadingPackId(pack.id)
    setError(null)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        setLoadingPackId(null)
        return
      }

      const res = await fetch('/api/stripe/advisor-topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packId: pack.id }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to create checkout session')
        setLoadingPackId(null)
        return
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        setError('No checkout URL returned')
        setLoadingPackId(null)
      }
    } catch {
      setError('Network error')
      setLoadingPackId(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      />

      <div
        className="relative w-full max-w-lg rounded-xl border p-6 shadow-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text-1)' }}
          >
            Add Credits
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-[var(--color-hover)]"
            style={{ color: 'var(--color-text-3)' }}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {CREDIT_PACKS.map((pack) => {
            const isLoading = loadingPackId === pack.id
            const isDisabled = loadingPackId !== null
            return (
              <button
                key={pack.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handlePurchase(pack)}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-raised)',
                }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  ${pack.priceCad}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  CAD
                </span>
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {(pack.cents / 100).toFixed(2)} credits
                </span>
                {isLoading && (
                  <svg
                    className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400"
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
              </button>
            )
          })}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <p
          className="mt-4 text-center text-xs"
          style={{ color: 'var(--color-text-3)' }}
        >
          Secure payment via Stripe. Credits never expire.
        </p>
      </div>
    </div>
  )
}
