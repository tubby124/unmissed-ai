'use client'

import { useMemo } from 'react'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import type { PlanIdOrTrial } from '@/lib/plan-entitlements'

interface PlanInfoCardProps {
  selectedPlan: string | null
  subscriptionStatus: string | null
  secondsUsedThisMonth: number | null
  monthlyMinuteLimit: number | null
  bonusMinutes: number
  trialExpiresAt: string | null
  trialConverted: boolean | null
}

const PLAN_COLORS: Record<string, string> = {
  lite: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  core: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  pro: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  trial: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export default function PlanInfoCard({
  selectedPlan,
  subscriptionStatus,
  secondsUsedThisMonth,
  monthlyMinuteLimit,
  bonusMinutes,
  trialExpiresAt,
  trialConverted,
}: PlanInfoCardProps) {
  const isTrialing = subscriptionStatus === 'trialing'
  const effectivePlanId: PlanIdOrTrial = isTrialing ? 'trial' : (selectedPlan as PlanIdOrTrial) ?? 'lite'
  const entitlements = getPlanEntitlements(effectivePlanId)

  const minutesUsed = Math.ceil((secondsUsedThisMonth ?? 0) / 60)
  const minuteLimit = (monthlyMinuteLimit ?? entitlements.minutes) + (bonusMinutes ?? 0)
  const minutePercent = minuteLimit > 0 ? Math.min(100, Math.round((minutesUsed / minuteLimit) * 100)) : 0

  const trialDaysLeft = useMemo(() => {
    if (!isTrialing || !trialExpiresAt) return null
    const diff = new Date(trialExpiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [isTrialing, trialExpiresAt])

  const isTrialExpired = isTrialing && trialDaysLeft !== null && trialDaysLeft <= 0 && !trialConverted
  const isTrialExpiring = isTrialing && trialDaysLeft !== null && trialDaysLeft <= 3 && trialDaysLeft > 0

  const badgeColor = PLAN_COLORS[effectivePlanId] ?? PLAN_COLORS.lite

  const capabilities = [
    { label: 'SMS follow-up', enabled: entitlements.smsEnabled },
    { label: 'Knowledge base', enabled: entitlements.knowledgeEnabled },
    { label: 'Learning Loop', enabled: entitlements.learningLoopEnabled },
    { label: 'Lead scoring', enabled: entitlements.leadScoringEnabled },
    { label: 'Calendar booking', enabled: entitlements.bookingEnabled },
    { label: 'Live transfer', enabled: entitlements.transferEnabled },
  ]

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full border ${badgeColor}`}>
            {entitlements.name}
          </span>
          {isTrialing && trialDaysLeft !== null && (
            <span className={`text-[10px] font-medium ${isTrialExpired ? 'text-red-400' : isTrialExpiring ? 'text-amber-400' : 'text-zinc-400'}`}>
              {isTrialExpired ? 'Trial expired' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left`}
            </span>
          )}
        </div>
        {(isTrialing || effectivePlanId === 'lite') && (
          <a
            href="/pricing"
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
          >
            Upgrade
          </a>
        )}
      </div>

      {/* Minutes usage */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] t3">Minutes this month</span>
          <span className="text-xs font-mono t1">
            {minutesUsed} <span className="t3">/ {minuteLimit}</span>
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              minutePercent >= 90 ? 'bg-red-500' : minutePercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${minutePercent}%` }}
          />
        </div>
      </div>

      {/* Capabilities grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {capabilities.map(cap => (
          <div key={cap.label} className="flex items-center gap-1.5">
            {cap.enabled ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-zinc-600 shrink-0">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            <span className={`text-[11px] ${cap.enabled ? 't2' : 't3 line-through opacity-60'}`}>
              {cap.label}
            </span>
          </div>
        ))}
      </div>

      {/* Trial expired blocking CTA */}
      {isTrialExpired && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-300 mb-2">
            Your trial has ended. Choose a plan to keep your agent active.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Choose a Plan
          </a>
        </div>
      )}

      {/* Trial expiring warning */}
      {isTrialExpiring && !isTrialExpired && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 flex items-center justify-between">
          <p className="text-[11px] text-amber-300">
            Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} — choose a plan to keep all features.
          </p>
          <a
            href="/pricing"
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors shrink-0 ml-3"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  )
}
