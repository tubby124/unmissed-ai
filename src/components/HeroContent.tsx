'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand'

export default function HeroContent(_props: { callsStat?: string } = {}) {
  return (
    <div className="text-center z-10">
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
          className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6"
          style={{ color: 'var(--color-text-1)' }}
        >
          Every call answered.
          <br />
          Every lead captured.
          <br />
          <span style={{ color: 'var(--color-primary)' }}>Even at 2am.</span>
        </h1>
      </motion.div>

      {/* Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
      >
        <p
          className="text-lg md:text-xl leading-relaxed mb-4 max-w-2xl mx-auto"
          style={{ color: 'var(--color-text-2)' }}
        >
          You&apos;re on the job. A customer calls. 3 rings. They hang up.
          That&apos;s a $400 job gone — to a competitor who picked up.
        </p>
        <p
          className="text-lg md:text-xl font-semibold mb-10 max-w-2xl mx-auto"
          style={{ color: 'var(--color-text-1)' }}
        >
          {BRAND_NAME} fixes that — for good.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.35 }}
      >
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/onboard"
            className="block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Get My Agent
          </Link>
        </motion.div>
        <Link
          href="#demo"
          className="text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--color-primary)' }}
        >
          Hear a Demo →
        </Link>
      </motion.div>

      {/* Trust line */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.5 }}
      >
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          No contracts · Cancel anytime · Setup in 5 minutes
        </p>
      </motion.div>
    </div>
  )
}
