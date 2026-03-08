'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'

interface Stat {
  label: string
  value: number
  sub?: string
  accent?: boolean
  format?: (n: number) => string
}

function fmtDur(secs: number) {
  if (!secs) return '0:00'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function StatCard({ stat }: { stat: Stat }) {
  const numRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = numRef.current
    if (!el) return
    const controls = animate(0, stat.value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate(v) {
        el.textContent = stat.format ? stat.format(Math.round(v)) : String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [stat.value, stat.format])

  return (
    <div className={`relative rounded-2xl border p-5 overflow-hidden ${
      stat.accent
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-white/[0.06] bg-white/[0.02]'
    }`}>
      {stat.accent && (
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
      )}
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
        {stat.label}
      </p>
      <p className="text-3xl font-bold tracking-tight text-zinc-50">
        <span ref={numRef}>0</span>
      </p>
      {stat.sub && (
        <p className="text-xs text-zinc-500 mt-1">{stat.sub}</p>
      )}
    </div>
  )
}

interface StatsGridProps {
  totalCalls: number
  hotLeads: number
  avgDurationSecs: number
  activeNow: number
}

export default function StatsGrid({ totalCalls, hotLeads, avgDurationSecs, activeNow }: StatsGridProps) {
  const stats: Stat[] = [
    { label: 'Total Calls', value: totalCalls, sub: 'all time' },
    { label: 'HOT Leads', value: hotLeads, sub: 'classified hot', accent: true },
    { label: 'Avg Duration', value: avgDurationSecs, sub: 'per call', format: fmtDur },
    { label: 'Active Now', value: activeNow, sub: activeNow > 0 ? 'call in progress' : 'no active calls' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{ animationDelay: `${i * 50}ms` }}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <StatCard stat={stat} />
        </div>
      ))}
    </div>
  )
}
