'use client'

import { useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { PLANS, PUBLIC_PLANS, CURRENCY } from '@/lib/pricing'

interface Props {
  clientId: string
  previewMode?: boolean
}

const defaultPlanId = PLANS.find((p) => p.isPopular)?.id ?? PLANS[0].id

export default function TrialUpgradeSection({ clientId, previewMode }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlanId)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  async function startUpgrade(planId: string) {
    if (previewMode) return
    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billing, clientId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoadingPlan(null)
    } catch {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Trial banner */}
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">
          You&apos;re on a free trial
        </p>
        <p className="text-sm t2">
          Pick a plan to go live and start receiving real calls on your business number.
        </p>
      </div>

      {/* Monthly / Annual animated tab toggle */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl border b-theme bg-surface w-fit"
        role="tablist"
        aria-label="Billing period"
      >
        {(['monthly', 'annual'] as const).map((period) => (
          <button
            key={period}
            role="tab"
            aria-selected={billing === period}
            onClick={() => setBilling(period)}
            className="relative text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {billing === period && (
              <motion.div
                layoutId="trial-billing-bg"
                className="absolute inset-0 rounded-lg bg-blue-500/15 border border-blue-500/30"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 400, damping: 30 }
                }
              />
            )}
            <span
              className={`relative z-10 ${
                billing === period ? 'text-blue-400' : 't3'
              }`}
            >
              {period === 'monthly' ? (
                'Monthly'
              ) : (
                <>
                  Annual{' '}
                  <span className="text-green-400 ml-0.5 text-[10px]">–20%</span>
                </>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Plan radiogroup */}
      <div className="space-y-3" role="radiogroup" aria-label="Select a plan">
        {PUBLIC_PLANS.map((plan) => {
          const price = billing === 'annual' ? plan.annual : plan.monthly
          const isSelected = selectedPlanId === plan.id
          const isLoading = loadingPlan === plan.id

          return (
            <div
              key={plan.id}
              role="radio"
              aria-checked={isSelected}
              aria-expanded={isSelected}
              tabIndex={0}
              onClick={() => setSelectedPlanId(plan.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedPlanId(plan.id)
                }
              }}
              className={`rounded-2xl border cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                isSelected
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'b-theme bg-surface hover:border-blue-500/20'
              }`}
            >
              {/* Collapsed header — always visible */}
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Radio indicator */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        initial={shouldReduceMotion ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 500, damping: 30 }
                        }
                        className="w-2 h-2 rounded-full bg-white"
                      />
                    )}
                  </div>

                  {/* Plan name + tagline */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold t1">{plan.name}</span>
                      {plan.isPopular && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-blue-400 border border-blue-500/30 bg-blue-500/10">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] t3 mt-0.5 leading-snug">{plan.tagline}</p>
                  </div>
                </div>

                {/* Price + minutes — always visible */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="text-right">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`${plan.id}-${billing}`}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="text-lg font-bold t1"
                      >
                        ${price}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-[11px] t3">/mo {CURRENCY}</span>
                  </div>
                  {/* Minutes badge — visible in collapsed view per non-negotiable */}
                  <span className="flex items-center gap-1 text-[10px] t3 font-medium">
                    <Clock size={10} className="flex-shrink-0" />
                    {plan.minutes} min/mo
                  </span>
                </div>
              </div>

              {/* Expanded section — features + annual note + CTA */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 300, damping: 30 }
                    }
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-blue-500/20">
                      <div className="pt-4 space-y-1.5 mb-4">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-start gap-2 text-[11px] t2">
                            <Check
                              size={12}
                              className="text-green-400 flex-shrink-0 mt-0.5"
                            />
                            {f}
                          </div>
                        ))}
                      </div>

                      {billing === 'annual' && (
                        <p className="text-[10px] text-green-400 mb-3">
                          Billed ${plan.annualBilledTotal}/yr
                        </p>
                      )}

                      <button
                        disabled={!!loadingPlan || previewMode}
                        onClick={(e) => {
                          e.stopPropagation()
                          startUpgrade(plan.id)
                        }}
                        className={`w-full text-xs font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer ${
                          plan.isPopular
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'b-theme hover:bg-hover t1'
                        }`}
                      >
                        {isLoading ? 'Redirecting…' : `Get ${plan.name} →`}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
