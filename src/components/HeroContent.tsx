'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

interface HeroContentProps {
  callsStat: string
}

export default function HeroContent({ callsStat }: HeroContentProps) {
  return (
    <div className="text-center z-10">
      {/* Live badge — delay 0.1 */}
      <motion.div
        className="flex justify-center mb-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
      >
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* animate-pulse MUST stay — this is the live indicator dot */}
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--color-live)' }}
          />
          {callsStat} calls answered · live
        </span>
      </motion.div>

      {/* Eyebrow + H1 — delay 0.1 */}
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

      {/* Subtitle paragraphs — delay 0.2 */}
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
          unmissed.ai fixes that — for good.
        </p>
      </motion.div>

      {/* CTA buttons — delay 0.35 */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.35 }}
      >
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="#demo"
            className="block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Hear a Real Demo Call →
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/onboard"
            className="block px-8 py-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            Get My Agent Set Up
          </Link>
        </motion.div>
      </motion.div>

      {/* Trusted-by / calls stat line — delay 0.5 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.5 }}
      >
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          Trusted by service businesses in Alberta · Saskatchewan
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-3)' }}>
          No contracts · Cancel anytime · 30-day money-back guarantee
        </p>
      </motion.div>
    </div>
  )
}
