'use client'

import { motion } from 'motion/react'
import CallMeNowWidget from './CallMeNowWidget'
import { TRIAL, FOUNDING_PROMO, BASE_PLAN } from '@/lib/pricing'
import { HERO } from '@/lib/marketing-content'

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
          {HERO.eyebrow}
        </p>

        <h1
          className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black leading-[1.08] mb-6"
          style={{ color: 'var(--color-text-1)' }}
        >
          {HERO.headline[0]}
          <br />
          {HERO.headline[1]}
          <br />
          <span style={{ color: 'var(--color-primary)' }}>{HERO.headline[2]}</span>
        </h1>
      </motion.div>

      {/* Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
      >
        <p
          className="text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0"
          style={{ color: 'var(--color-text-2)' }}
        >
          {HERO.subtitle}
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
          {HERO.ctaLabel}
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
