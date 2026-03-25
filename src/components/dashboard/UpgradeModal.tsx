'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, X, CheckCircle2 } from 'lucide-react'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { trackEvent } from '@/lib/analytics'
import { PLANS } from '@/lib/pricing'

export default function UpgradeModal() {
  const { isOpen, source, clientId, daysRemaining, closeUpgradeModal } = useUpgradeModal()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    if (loading) return
    setLoading(true)
    trackEvent('upgrade_modal_cta_clicked', { source })
    trackEvent('checkout_started', { source, planId: 'core' })
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'core', billing: 'monthly', clientId }),
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

  const bullets = [
    'Your own dedicated business phone number',
    'Live inbound call handling — real callers, real conversations',
    "Everything you've set up carries over — hours, FAQs, forwarding",
  ]

  return (
    <AnimatePresence>
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

          {/* Modal container */}
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
              <div className="flex items-start gap-4 mb-5 pr-8">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--color-accent-tint)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
                    <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-base t1 leading-snug">
                    Turn your test agent into a live receptionist
                  </h2>
                  <p className="text-xs t3 mt-1 leading-relaxed">
                    You&apos;ve tested it. Give it a real number and let it handle calls.
                  </p>
                </div>
              </div>

              {/* Value bullets */}
              <div className="space-y-2.5 mb-6">
                {bullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: 'var(--color-primary)' }}
                    />
                    <span className="text-sm t2 leading-relaxed">{bullet}</span>
                  </div>
                ))}
              </div>

              {/* Price line */}
              <p className="text-xs t3 mb-4 text-center">
                Core plan · ${PLANS[1].monthly}/mo CAD · cancel anytime
              </p>

              {/* Primary CTA */}
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer mb-2"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loading ? 'Setting up…' : 'Get Your Phone Number'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              {/* Secondary dismiss */}
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl text-sm cursor-pointer transition-colors hover:bg-hover t3"
              >
                Keep testing for now
              </button>

              {/* Reassurance */}
              {daysRemaining !== undefined && daysRemaining > 0 && (
                <p className="text-[11px] text-center t3 mt-3">
                  You can keep testing for {daysRemaining} more day{daysRemaining !== 1 ? 's' : ''}.
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
