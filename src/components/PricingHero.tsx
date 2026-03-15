'use client'

import { motion } from 'motion/react'

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
        ✅ 30-day money-back guarantee · No contracts · Cancel anytime with 30 days notice
      </p>
      <p className="text-gray-500 text-xs mt-1">
        Your call log data lives in your Google Sheet — you keep it if you ever leave.
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
          One flat rate. Every call answered.
        </motion.h1>
        <motion.p
          className="text-gray-400 text-xl leading-relaxed mb-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          Other AI receptionists charge you per minute — the more your phone
          rings, the more you pay. That punishes success.
        </motion.p>
        <motion.p
          className="text-white text-xl font-semibold mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          We charge one flat monthly rate. No per-minute fees. No overage surprises. Ever.
        </motion.p>
        <motion.div
          className="inline-block px-4 py-2 rounded-full text-sm font-semibold"
          style={{ backgroundColor: "#0d0d0d", color: "#60A5FA", border: "1px solid #1f1f1f" }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.05 }}
        >
          🔒 Founding Member Pricing — locked for life for the first 50 clients
        </motion.div>
      </div>
    </section>
  )
}
