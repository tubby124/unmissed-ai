'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'

interface CallLog {
  call_status: string | null
  started_at: string
  duration_seconds: number | null
}

const THEMES = {
  zinc: {
    border: 'border-white/[0.07]', bg: 'bg-white/[0.02]', glow: undefined,
    num: 'text-zinc-50', label: 'text-zinc-500', sub: 'text-zinc-600',
    dot: 'bg-zinc-500', spark: 'rgba(161,161,170,0.55)', pulse: false,
    accent: 'rgba(255,255,255,0.03)',
  },
  red: {
    border: 'border-red-500/20', bg: 'bg-[#0e0505]',
    glow: '0 0 0 1px rgba(239,68,68,0.06), 0 0 35px rgba(239,68,68,0.08)',
    num: 'text-red-300', label: 'text-red-400/70', sub: 'text-red-400/50',
    dot: 'bg-red-500', spark: 'rgba(239,68,68,0.65)', pulse: false,
    accent: 'rgba(239,68,68,0.12)',
  },
  blue: {
    border: 'border-blue-500/20', bg: 'bg-[#03060e]',
    glow: '0 0 0 1px rgba(59,130,246,0.06), 0 0 35px rgba(59,130,246,0.07)',
    num: 'text-blue-200', label: 'text-blue-400/70', sub: 'text-blue-400/50',
    dot: 'bg-blue-500', spark: 'rgba(96,165,250,0.65)', pulse: false,
    accent: 'rgba(59,130,246,0.12)',
  },
  green: {
    border: 'border-green-500/25', bg: 'bg-[#030e06]',
    glow: '0 0 0 1px rgba(34,197,94,0.08), 0 0 35px rgba(34,197,94,0.1)',
    num: 'text-green-300', label: 'text-green-400/70', sub: 'text-green-400/50',
    dot: 'bg-green-500', spark: 'rgba(34,197,94,0.65)', pulse: true,
    accent: 'rgba(34,197,94,0.15)',
  },
  purple: {
    border: 'border-purple-500/20', bg: 'bg-[#07030e]',
    glow: '0 0 0 1px rgba(168,85,247,0.06), 0 0 35px rgba(168,85,247,0.08)',
    num: 'text-purple-200', label: 'text-purple-400/70', sub: 'text-purple-400/50',
    dot: 'bg-purple-500', spark: 'rgba(168,85,247,0.65)', pulse: false,
    accent: 'rgba(168,85,247,0.14)',
  },
}

type Theme = keyof typeof THEMES

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const W = 64, H = 24
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * W},${H - (v / max) * (H - 3) - 1.5}`
  ).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null || !isFinite(pct)) return null
  const up = pct >= 0
  return (
    <span className={`text-[10px] font-mono font-semibold tabular-nums ${up ? 'text-green-400/80' : 'text-red-400/70'}`}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(pct))}%
    </span>
  )
}

interface StatCardProps {
  label: string
  value: number
  sub: string
  theme: Theme
  format?: (n: number) => string
  sparkValues?: number[]
  delta?: number | null
  liveOrb?: boolean
  index: number
}

function StatCard({ label, value, sub, theme, format, sparkValues, delta, liveOrb, index }: StatCardProps) {
  const numRef = useRef<HTMLSpanElement>(null)
  const t = THEMES[theme]

  useEffect(() => {
    const el = numRef.current
    if (!el) return
    const controls = animate(0, value, {
      duration: 0.9,
      delay: index * 0.08,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        el.textContent = format ? format(Math.round(v)) : String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, format, index])

  return (
    <div className={`relative rounded-2xl border ${t.border} ${t.bg} p-5 overflow-hidden hover:border-white/[0.12] transition-colors cursor-pointer`} style={{ boxShadow: t.glow }}>
      {/* Radial accent */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${t.accent} 0%, transparent 70%)` }}
      />

      {/* Live orb */}
      {liveOrb && value > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 120%, rgba(34,197,94,0.18) 0%, transparent 65%)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${t.label}`}>{label}</p>
        <span className="relative flex w-1.5 h-1.5">
          {t.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-75`} />}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${t.dot} opacity-60`} />
        </span>
      </div>

      <p className={`text-[2.25rem] font-bold tracking-tight font-mono tabular-nums leading-none ${t.num}`}>
        <span ref={numRef}>0</span>
      </p>

      <div className="flex items-end justify-between mt-2.5 gap-2">
        <div className="min-w-0">
          <p className={`text-[11px] ${t.sub}`}>{sub}</p>
          {delta !== undefined && <div className="mt-0.5"><DeltaBadge pct={delta ?? null} /></div>}
        </div>
        {sparkValues && <Sparkline values={sparkValues} color={t.spark} />}
      </div>
    </div>
  )
}

function fmtDur(secs: number) {
  if (!secs) return '0:00'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// 7-day bucketed values — offset 0 = current week, offset 1 = prior week
function weekBuckets(
  calls: CallLog[],
  weekOffset: number,
  filterFn?: (c: CallLog) => boolean,
  metricFn?: (c: CallLog) => number
): number[] {
  const DAY = 86400000
  const now = Date.now()
  return Array.from({ length: 7 }, (_, i) => {
    const start = now - ((7 * (weekOffset + 1)) - i) * DAY
    const end = start + DAY
    const day = calls.filter(c => {
      const t = new Date(c.started_at).getTime()
      return t >= start && t < end && (!filterFn || filterFn(c))
    })
    if (metricFn) {
      const vals = day.map(metricFn).filter(v => v > 0)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }
    return day.length
  })
}

function delta(curr: number[], prior: number[]): number | null {
  const c = curr.reduce((a, b) => a + b, 0)
  const p = prior.reduce((a, b) => a + b, 0)
  if (p === 0) return null
  return ((c - p) / p) * 100
}

interface StatsGridProps {
  totalCalls: number
  hotLeads: number
  avgDurationSecs: number
  missedCalls: number
  calls: CallLog[]
}

export default function StatsGrid({ totalCalls, hotLeads, avgDurationSecs, missedCalls, calls }: StatsGridProps) {
  const classified = calls.filter(c => ['HOT', 'WARM', 'COLD', 'JUNK'].includes(c.call_status ?? ''))

  // Sparklines
  const isHOT = (c: CallLog) => c.call_status === 'HOT'
  const dur = (c: CallLog) => c.duration_seconds ?? 0

  const totalSpark = weekBuckets(classified, 0)
  const totalPrior = weekBuckets(classified, 1)

  const hotSpark = weekBuckets(classified, 0, isHOT)
  const hotPrior = weekBuckets(classified, 1, isHOT)

  const durSpark = weekBuckets(classified, 0, undefined, dur)
  const durPrior = weekBuckets(classified, 1, undefined, dur)

  // Containment rate — quality calls (HOT+WARM+COLD) / answered calls (non-JUNK classified)
  const qualityCalls = classified.filter(c => c.call_status !== 'JUNK').length
  const containmentRate = Math.round(qualityCalls / Math.max(classified.length, 1) * 100)

  const stats: StatCardProps[] = [
    {
      label: 'Total Calls', value: totalCalls, sub: 'classified calls', theme: 'zinc',
      sparkValues: totalSpark, delta: delta(totalSpark, totalPrior), index: 0,
    },
    {
      label: 'Hot Leads', value: hotLeads, sub: 'high-intent callers', theme: 'red',
      sparkValues: hotSpark, delta: delta(hotSpark, hotPrior), index: 1,
    },
    {
      label: 'Avg Duration', value: avgDurationSecs, sub: 'per classified call', theme: 'blue',
      format: fmtDur, sparkValues: durSpark, delta: delta(durSpark, durPrior), index: 2,
    },
    {
      label: 'Missed Calls', value: missedCalls, sub: 'in last 7 days',
      theme: missedCalls > 0 ? 'red' : 'zinc', index: 3,
    },
    {
      label: 'Containment', value: containmentRate, sub: 'quality calls handled', theme: 'purple',
      format: (n: number) => `${n}%`, index: 4,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{ animationDelay: `${i * 55}ms` }}
          className={`animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both${i === stats.length - 1 ? ' col-span-2 md:col-span-1' : ''}`}
        >
          <StatCard {...stat} />
        </div>
      ))}
    </div>
  )
}
