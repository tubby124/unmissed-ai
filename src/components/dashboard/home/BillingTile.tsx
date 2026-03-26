'use client'

/**
 * BillingTile — compact plan & billing bento card.
 * Shows current plan badge + minutes included. Opens BillingSheet on click.
 */

import { getPlanEntitlements } from '@/lib/plan-entitlements'

interface Props {
  selectedPlan: string | null
  subscriptionStatus: string | null
  onOpenSheet: () => void
}

function planBadgeStyle(plan: string): { bg: string; text: string } {
  switch (plan) {
    case 'pro':    return { bg: 'bg-purple-500/10', text: 'text-purple-400' }
    case 'core':   return { bg: 'bg-blue-500/10',   text: 'text-blue-400' }
    case 'lite':   return { bg: 'bg-slate-500/10',  text: 'text-slate-400' }
    case 'trial':  return { bg: 'bg-amber-500/10',  text: 'text-amber-400' }
    default:       return { bg: 'bg-amber-500/10',  text: 'text-amber-400' }
  }
}

function resolvePlanId(selectedPlan: string | null, subscriptionStatus: string | null): string {
  if (selectedPlan) return selectedPlan
  if (subscriptionStatus === 'trialing') return 'trial'
  return 'trial'
}

export default function BillingTile({ selectedPlan, subscriptionStatus, onOpenSheet }: Props) {
  const planId = resolvePlanId(selectedPlan, subscriptionStatus)
  const entitlements = getPlanEntitlements(planId)
  const badge = planBadgeStyle(planId)
  const showUpgradeNudge = planId !== 'pro'

  return (
    <button
      onClick={onOpenSheet}
      className="rounded-2xl p-4 card-surface flex flex-col gap-3 text-left w-full hover:bg-hover transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 10h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Plan</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 opacity-0 group-hover:opacity-100 transition-opacity">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Plan badge + minutes */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
            {entitlements.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs t2 flex-1">Minutes / month</span>
          <span className="text-xs t1 font-semibold">{entitlements.minutes}</span>
        </div>
      </div>

      {/* Upgrade nudge */}
      {showUpgradeNudge && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-primary)' }}>
          Upgrade →
        </p>
      )}
    </button>
  )
}
