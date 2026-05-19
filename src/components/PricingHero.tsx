'use client'

import { motion } from 'motion/react'
import { TRIAL, POLICIES, PLANS, FOUNDING_PROMO } from '@/lib/pricing'

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
        {TRIAL.label} · {POLICIES.contracts} · {POLICIES.dataOwnership}
      </p>
      <p className="text-green-300/80 text-xs mt-2">
        {POLICIES.moneyBack}
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
          {FOUNDING_PROMO.enabled
            ? `Plans from $${FOUNDING_PROMO.foundingMonthly}/mo. Activate a real AI number.`
            : `From $${PLANS[0].monthly}/mo. Your agent answers forwarded missed calls.`}
        </motion.h1>
        <motion.p
          className="text-gray-400 text-xl leading-relaxed mb-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          Start with Solo, or use AI Receptionist at $119/mo with 250 included minutes
          when you want business knowledge, booking, and lead ranking.
        </motion.p>
        <motion.p
          className="text-white text-xl font-semibold mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          {TRIAL.label}. Card required to activate your number. Cancel anytime.
        </motion.p>
      </div>
    </section>
  )
}
