'use client'

import { motion } from 'motion/react'
import { Phone, Users, Zap, Clock } from 'lucide-react'

const PROOF_STATS = [
  { icon: Phone, value: '8,400+', label: 'Calls handled', delay: 0 },
  { icon: Users, value: '2,100+', label: 'Leads captured', delay: 0.1 },
  { icon: Zap, value: '<1s', label: 'Answer time', delay: 0.2 },
  { icon: Clock, value: '24/7', label: 'Always on', delay: 0.3 },
]

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
        {/* Heading */}
        <p
          className="text-center text-xs font-mono uppercase tracking-widest mb-6"
          style={{ color: 'var(--color-text-3)' }}
        >
          Trusted by service businesses across Canada
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {PROOF_STATS.map((stat) => (
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
