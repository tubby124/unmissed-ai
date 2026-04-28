'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Check } from 'lucide-react'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import { PLANS } from '@/lib/pricing'

// ── Per-plan short highlights for the modal (3 lines max) ────────────
// Edit these to change what shows inside the upgrade modal.
// Full feature lists live in lib/pricing.ts → PLANS[x].features.
const PLAN_MODAL_HIGHLIGHTS: Record<string, string[]> = {
  lite: [
    'Answers every call, 24/7',
    '100 minutes/month included',
    'Call summary texted to you',
  ],
  core: [
    'Full AI receptionist — live call handling',
    '200 minutes/month included',
    'Website & Google Business knowledge',
  ],
  pro: [
    'Calendar booking + live call transfer',
    '1,000 minutes/month included',
    'Everything in AI Receptionist',
  ],
}

const VALID_PLANS = PLANS.map(p => p.id)
type PlanId = typeof VALID_PLANS[number]

function isValidPlan(id: string | null | undefined): id is PlanId {
  return !!id && VALID_PLANS.includes(id as PlanId)
}

export default function UpgradeModal() {
  const { isOpen, source, clientId, daysRemaining, selectedPlan: contextPlan, closeUpgradeModal } = useUpgradeModal()
  const defaultPlan: PlanId = isValidPlan(contextPlan) ? contextPlan : 'core'
  const [activePlan, setActivePlan] = useState<PlanId>(defaultPlan)
  const [loading, setLoading] = useState(false)

  // Sync activePlan when modal opens with a different context plan
  // (handles multiple open/close cycles)
  const resolvedDefault = isValidPlan(contextPlan) ? contextPlan : 'core'

  async function handleUpgrade() {
    if (loading) return
    setLoading(true)
    trackEvent('upgrade_modal_cta_clicked', { source, planId: activePlan })
    trackEvent('checkout_started', { source, planId: activePlan })
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: activePlan, billing: 'monthly', clientId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    trackEvent('upgrade_modal_dismissed', { source })
    closeUpgradeModal()
  }

  function handleOpen() {
    // Reset to the context-provided plan whenever the modal opens
    setActivePlan(resolvedDefault)
  }

  const plan = PLANS.find(p => p.id === activePlan) ?? PLANS[1]

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl pointer-events-auto relative"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {/* Close */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 t3" />
              </button>

              {/* Header */}
              <div className="mb-5 pr-8">
                <h2 className="font-semibold text-base t1 leading-snug">
                  Ready to go live?
                </h2>
                <p className="text-xs t3 mt-1 leading-relaxed">
                  Pick a plan. You get a real phone number and everything you set up carries over.
                </p>
              </div>

              {/* Plan picker */}
              <div className="space-y-2 mb-5">
                {PLANS.map((p) => {
                  const isActive = activePlan === p.id
                  const highlights = PLAN_MODAL_HIGHLIGHTS[p.id] ?? []
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePlan(p.id)}
                      className={[
                        'w-full text-left rounded-xl border-2 px-3.5 py-3 transition-all cursor-pointer',
                        isActive
                          ? 'border-[var(--color-primary)] bg-[var(--color-accent-tint,rgba(37,99,235,0.07))]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Radio dot */}
                          <div className={[
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            isActive
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                              : 'border-[var(--color-border)]',
                          ].join(' ')}>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-semibold t1">{p.name}</span>
                          {p.isPopular && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white leading-none">
                              Popular
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold t1 shrink-0">
                          ${p.monthly}
                          <span className="text-[11px] font-normal t3">/mo</span>
                        </span>
                      </div>

                      {/* Highlights — only visible when selected */}
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.ul
                            key="highlights"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="overflow-hidden mt-2 space-y-1 pl-6"
                          >
                            {highlights.map((h) => (
                              <li key={h} className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-[11px] t2">{h}</span>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </button>
                  )
                })}
              </div>

              {/* CTA */}
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer mb-2"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loading
                  ? 'Setting up…'
                  : `Continue with ${plan.name} — $${plan.monthly}/mo`}
              </button>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl text-sm cursor-pointer transition-colors hover:bg-hover t3"
              >
                Keep testing for now
              </button>

              {daysRemaining !== undefined && daysRemaining > 0 && (
                <p className="text-[11px] text-center t3 mt-3">
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left in your trial.
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
