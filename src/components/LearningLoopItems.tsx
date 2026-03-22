'use client'

import { motion } from 'motion/react'
import { BarChart3, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'

const LIST_ITEMS = [
  'Weekly transcript analysis — automated',
  'Unanswered questions flagged and filled',
  'Caller confusion patterns identified',
  'You approve changes before they go live',
]

const REPORT_ITEMS = [
  { Icon: BarChart3, text: '47 calls reviewed this week', color: 'var(--color-primary)' },
  { Icon: AlertTriangle, text: '3 unanswered questions detected', color: '#F59E0B' },
  { Icon: Lightbulb, text: '"What areas do you service?" — added to KB', color: '#22C55E' },
  { Icon: Lightbulb, text: '"Do you do fleet vehicles?" — added to KB', color: '#22C55E' },
  { Icon: CheckCircle2, text: 'Agent updated. Approved by operator.', color: '#22C55E' },
]

export default function LearningLoopItems() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      {/* Left column */}
      <div>
        <p
          className="text-xs font-mono uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-primary)' }}
        >
          Only at {BRAND_NAME}
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: 'var(--color-text-1)' }}
        >
          Your agent gets smarter every week.
        </h2>
        <p
          className="text-lg leading-relaxed mb-6"
          style={{ color: 'var(--color-text-2)' }}
        >
          Every week, your agent reviews its own calls. Common questions get
          flagged. Knowledge gaps get filled. Prompt improvements get suggested
          automatically. No dashboard to check. No work to do.
        </p>
        <p className="font-semibold text-lg mb-4" style={{ color: 'var(--color-text-1)' }}>
          We call it:{' '}
          <span style={{ color: 'var(--color-primary)' }}>The Learning Loop™</span>
        </p>

        <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-2)' }}>
          {LIST_ITEMS.map((item, i) => (
            <motion.li
              key={item}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.08 }}
            >
              <span style={{ color: 'var(--color-primary)' }}>→</span>
              {item}
            </motion.li>
          ))}
        </ul>

        <p
          className="mt-4 text-xs px-3 py-1.5 rounded-full inline-block"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          Included in Pro &amp; Business plans
        </p>
      </div>

      {/* Right column — visual report panel */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p className="text-xs font-mono mb-4" style={{ color: 'var(--color-text-2)' }}>
          // Weekly Learning Loop report
        </p>
        {REPORT_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-3 py-2"
            style={{ borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none' }}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.08 }}
          >
            <item.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: item.color }} />
            <p className="text-sm" style={{ color: item.color }}>
              {item.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
