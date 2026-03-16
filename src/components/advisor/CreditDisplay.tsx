'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { CREDIT_REFRESH_INTERVAL_MS } from '@/lib/advisor-constants'
import TopUpModal from './TopUpModal'

interface CreditBalance {
  balance_cents: number
  is_unlimited: boolean
}

export default function CreditDisplay() {
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [topUpOpen, setTopUpOpen] = useState(false)

  const fetchBalance = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/advisor/credits', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data: CreditBalance = await res.json()
      setBalance(data)
    } catch {
      // silent — chip just stays in loading state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, CREDIT_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchBalance])

  if (loading || !balance) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
        style={{
          backgroundColor: 'var(--color-bg-raised)',
          color: 'var(--color-text-3)',
        }}
      >
        ...
      </span>
    )
  }

  if (balance.is_unlimited) {
    return (
      <>
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          ∞
        </span>
        <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      </>
    )
  }

  const dollars = (balance.balance_cents / 100).toFixed(2)
  const isLow = balance.balance_cents > 0 && balance.balance_cents < 50
  const isZero = balance.balance_cents <= 0

  if (isZero) {
    return (
      <>
        <button
          type="button"
          onClick={() => setTopUpOpen(true)}
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 transition-colors hover:bg-red-200 dark:hover:bg-red-900/50"
        >
          Add credits
        </button>
        <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setTopUpOpen(true)}
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          isLow
            ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50'
            : 'hover:bg-[var(--color-hover)]'
        }`}
        style={
          isLow
            ? undefined
            : {
                backgroundColor: 'var(--color-bg-raised)',
                color: 'var(--color-text-1)',
              }
        }
      >
        ${dollars}
      </button>
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </>
  )
}
