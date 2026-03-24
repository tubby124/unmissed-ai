'use client'

import { motion } from 'motion/react'
import { TRIAL, POLICIES, PLANS } from '@/lib/pricing'

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

export function GuaranteeBar() {
  return (
    <motion.div
      className="py-6 px-4 text-center"
      style={{ backgroundColor: "#0D1F0D", borderTop: "1px solid #166534", borderBottom: "1px solid #166534" }}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <p className="text-green-400 font-semibold text-sm">
        {TRIAL.label} · {POLICIES.contracts} · {POLICIES.cancellation}
      </p>
      <p className="text-gray-500 text-xs mt-1">
        {POLICIES.dataOwnership}
      </p>
    </motion.div>
  )
}

export default function PricingHero() {
  return (
    <section className="pt-32 pb-16 px-4 text-center" style={{ backgroundColor: "#0a0a0a" }}>
      <div className="max-w-3xl mx-auto">
        <motion.p
          className="text-xs font-mono uppercase tracking-widest mb-3"
          style={{ color: "var(--color-primary)" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          Pricing
        </motion.p>
        <motion.h1
          className="text-4xl md:text-5xl font-black text-white mb-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          Start at ${PLANS[0].monthly}/mo. Scale when you&apos;re ready.
        </motion.h1>
        <motion.p
          className="text-gray-400 text-xl leading-relaxed mb-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          Other AI receptionists charge per minute — the more your phone
          rings, the more you pay. We charge a flat rate. No overages, ever.
        </motion.p>
        <motion.p
          className="text-white text-xl font-semibold mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          {TRIAL.label}. No credit card required. Cancel anytime.
        </motion.p>
      </div>
    </section>
  )
}
