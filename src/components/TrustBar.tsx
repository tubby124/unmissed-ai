'use client'

import { motion } from 'motion/react'
import { TRUST_BAR } from '@/lib/marketing-content'

export default function TrustBar() {
  return (
    <section
      className="py-8 px-4"
      style={{
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <p
          className="text-center text-xs font-mono uppercase tracking-widest mb-6"
          style={{ color: 'var(--color-text-3)' }}
        >
          {TRUST_BAR.label}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {TRUST_BAR.stats.map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                delay: stat.delay,
              }}
              className="flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.15)',
                }}
              >
                <stat.icon
                  size={18}
                  style={{ color: 'var(--color-primary)' }}
                />
              </div>
              <div>
                <p
                  className="text-lg font-black leading-tight"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
