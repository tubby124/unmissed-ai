'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

export default function EmptyState({ phone }: { phone?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Phone icon with ripple rings */}
      <div className="relative mb-6">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid rgba(59,130,246,0.3)',
              animation: `sonar-ring 2s ease-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
        <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text-2)' }}>No calls yet</h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--color-text-3)' }}>
        {phone
          ? <>Your agent is live at <span className="font-mono" style={{ color: 'var(--color-text-2)' }}>{phone}</span>. Make a test call to see it in action.</>
          : "Your agent is live. Make a test call to see it in action."
        }
      </p>

      <p className="text-xs mb-4" style={{ color: 'var(--color-text-3)' }}>
        No phone? {' '}
        <Link href="/dashboard/lab" className="underline" style={{ color: 'var(--color-accent)' }}>
          Test in your browser
        </Link>
        {' '} — no phone needed.
      </p>

      {phone && (
        <div className="w-full max-w-sm rounded-xl p-4 text-left space-y-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-2)' }}>How to make your first test call</p>
          <ol className="space-y-3">
            {[
              { num: '1', title: 'Call your AI number', desc: <>Dial <span className="font-mono" style={{ color: 'var(--color-text-2)' }}>{phone}</span> from your personal phone</> },
              { num: '2', title: 'Have a test conversation', desc: 'Try asking a question or leaving a message' },
              { num: '3', title: 'Check back here', desc: 'The call log updates in real-time after the call ends' },
            ].map((step, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.15, type: "spring", stiffness: 300, damping: 24 }}
                className="flex items-start gap-3"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-semibold">{step.num}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>{step.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{step.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </motion.div>
  )
}
