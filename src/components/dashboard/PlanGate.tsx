'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { usePlanGate, type PlanFeature } from '@/hooks/usePlanGate'

interface PlanGateProps {
  clientId: string
  selectedPlan: string | null | undefined
  subscriptionStatus: string | null | undefined
  feature: PlanFeature
  children: ReactNode
}

/**
 * Wraps a settings card or section. When the feature is not available
 * on the current plan, renders a semi-transparent overlay with an
 * upgrade prompt that calls the billing API directly. During trial,
 * everything is unlocked.
 */
export default function PlanGate({
  clientId,
  selectedPlan,
  subscriptionStatus,
  feature,
  children,
}: PlanGateProps) {
  const { locked, requiredPlan } = usePlanGate(selectedPlan, subscriptionStatus, feature)
  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = useCallback(async () => {
    if (upgrading) return
    setUpgrading(true)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, planId: requiredPlan, billing: 'monthly' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setUpgrading(false)
    }
  }, [clientId, requiredPlan, upgrading])

  if (!locked) return <>{children}</>

  const planLabel = requiredPlan === 'pro' ? 'Pro' : 'Core'

  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/50 backdrop-blur-sm shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-xs font-medium text-zinc-200">
            Available on {planLabel}
          </span>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {upgrading ? '...' : 'Upgrade'}
          </button>
        </div>
      </div>
    </div>
  )
}
