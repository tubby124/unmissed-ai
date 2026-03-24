'use client'

import { motion } from 'motion/react'
import CallMeNowWidget from './CallMeNowWidget'
import { TRIAL, FOUNDING_PROMO, BASE_PLAN } from '@/lib/pricing'

export default function HeroContent() {
  return (
    <div className="text-center lg:text-left z-10">
      {/* Eyebrow + H1 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
      >
        <p
          className="text-xs font-mono uppercase tracking-widest mb-4"
          style={{ color: 'var(--color-primary)' }}
        >
          AI Receptionist for Service Businesses
        </p>

        <h1
          className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black leading-[1.08] mb-6"
          style={{ color: 'var(--color-text-1)' }}
        >
          Every call answered.
          <br />
          Every lead captured.
          <br />
          <span style={{ color: 'var(--color-primary)' }}>Even at 2am.</span>
        </h1>
      </motion.div>

      {/* Subtitle — pain story with stats woven in */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
      >
        <p
          className="text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0"
          style={{ color: 'var(--color-text-2)' }}
        >
          62% of service businesses miss calls daily. 85% of those callers
          won&apos;t call back. That&apos;s a $400 job — gone to whoever picked up.
        </p>
      </motion.div>

      {/* PRIMARY CTA — Phone input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.35 }}
        className="max-w-md mx-auto lg:mx-0"
      >
        <p
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-1)' }}
        >
          Hear it yourself — we&apos;ll call you in 10 seconds:
        </p>
        <CallMeNowWidget compact niche="unmissed_demo" />
      </motion.div>

      {/* Trust line */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.5 }}
        className="mt-5"
      >
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          {TRIAL.label} · {FOUNDING_PROMO.enabled ? `$${FOUNDING_PROMO.foundingMonthly}/mo` : `$${BASE_PLAN.monthly}/mo`} after · No contracts · Cancel anytime
        </p>
      </motion.div>
    </div>
  )
}
