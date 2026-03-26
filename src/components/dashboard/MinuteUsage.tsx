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
    usagePct >= 95 ? 'bg-red-500' :
    usagePct >= 80 ? 'bg-amber-500' :
    'bg-blue-500'

  // Position of divider between base and bonus on the bar (% of total)
  const basePct = totalAvailable > 0 ? (minuteLimit / totalAvailable) * 100 : 100

  const now = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const fmtShort = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="rounded-2xl overflow-hidden p-4 mb-4 card-surface">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
          Minutes
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono font-semibold tabular-nums ${
            usagePct > 100 ? 'text-red-400' :
            usagePct >= 95 ? 'text-red-400' :
            usagePct >= 80 ? 'text-amber-400' :
            't1'
          }`}>
            {minutesUsed} / {totalAvailable}
          </span>
          {bonusMinutes > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
              +{bonusMinutes}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-hover)' }}>
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(usagePct, 100)}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          style={usagePct > 90 ? { animation: 'pulse 2s infinite' } : undefined}
        />
        {bonusMinutes > 0 && basePct < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-indigo-400/50"
            style={{ left: `${basePct}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        {usagePct > 100 ? (
          <p className="text-[11px] text-red-400 font-medium">
            Over limit —{' '}
            <Link href="/dashboard/settings" className="underline hover:text-red-300">
              buy more minutes
            </Link>
          </p>
        ) : usagePct >= 80 ? (
          <p className="text-[11px] text-amber-400">
            {remaining} min remaining —{' '}
            <Link href="/dashboard/settings" className="underline hover:text-amber-300">
              reload
            </Link>
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {remaining} min remaining
          </p>
        )}
        <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>
          {fmtShort(cycleStart)} – {fmtShort(cycleEnd)}
        </p>
      </div>
    </div>
  )
}
