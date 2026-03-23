'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

interface MinuteUsageProps {
  minutesUsed: number
  minuteLimit: number
  bonusMinutes: number
}

export default function MinuteUsage({ minutesUsed, minuteLimit, bonusMinutes }: MinuteUsageProps) {
  const totalAvailable = minuteLimit + bonusMinutes
  const remaining = totalAvailable - minutesUsed
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  const barColor =
    usagePct > 100 ? 'bg-pink-500' :
    usagePct > 90 ? 'bg-red-500' :
    usagePct > 70 ? 'bg-amber-500' :
    'bg-blue-500'

  const now = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const fmtShort = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="rounded-2xl overflow-hidden p-4 mb-4 card-surface">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
            Minutes Used
          </p>
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>
            {fmtShort(cycleStart)} &ndash; {fmtShort(cycleEnd)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
            {minutesUsed} / {totalAvailable}
          </span>
          {bonusMinutes > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
              +{bonusMinutes} bonus
            </span>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-hover)' }}>
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(usagePct, 100)}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          style={usagePct > 90 ? { animation: 'pulse 2s infinite' } : undefined}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        {usagePct > 100 ? (
          <p className="text-[11px] text-amber-400">
            Over limit &mdash;{' '}
            <Link href="/dashboard/settings?tab=billing" className="underline hover:text-amber-300">
              buy more minutes
            </Link>
          </p>
        ) : usagePct > 80 ? (
          <p className="text-[11px] text-amber-400">
            {remaining} min remaining &mdash;{' '}
            <Link href="/dashboard/settings?tab=billing" className="underline hover:text-amber-300">
              reload
            </Link>
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {remaining} min remaining
          </p>
        )}
        <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>
          Resets {fmtShort(cycleEnd)}
        </p>
      </div>
    </div>
  )
}
