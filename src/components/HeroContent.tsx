'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, PhoneCall } from 'lucide-react'
import CallMeNowWidget from './CallMeNowWidget'
import { TRIAL, PUBLIC_PLANS, getPlanDisplayMonthly } from '@/lib/pricing'
import { HERO } from '@/lib/marketing-content'
import { trackEvent } from '@/lib/analytics'
import { BOOK_WALKTHROUGH_HREF } from '@/lib/booking'

export default function HeroContent() {
  const ctaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent('hero_cta_visible')
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
        ref={ctaRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.35 }}
        className="max-w-md mx-auto lg:mx-0 space-y-5"
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <Link
            href="/onboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-white font-semibold text-sm transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Get Your AI Number
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/try"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm border transition-colors"
            style={{
              color: 'var(--color-text-1)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg)',
            }}
          >
            <PhoneCall className="w-4 h-4" />
            Try the Agent
          </Link>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          Prefer a walkthrough first?{' '}
          <a
            href={BOOK_WALKTHROUGH_HREF}
            className="font-medium underline underline-offset-2 transition-colors"
            style={{ color: 'var(--color-text-2)' }}
          >
            Book a 15-min walkthrough
          </a>
        </p>
        <p
          className="text-sm font-semibold"
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
          {`Flat $${getPlanDisplayMonthly(PUBLIC_PLANS[0])}/mo founding rate · ${TRIAL.label} · No contracts · Cancel anytime`}
        </p>
      </motion.div>
    </div>
  )
}
