'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import Link from 'next/link'

interface CallLog {
  call_status: string | null
  started_at: string
  duration_seconds: number | null
}

const THEMES = {
  zinc: {
    border: 'border-[var(--color-border)]', bg: 'bg-[var(--color-surface)]', glow: undefined,
    num: 'text-[var(--color-text-1)]', label: 'text-[var(--color-text-3)]', sub: 'text-[var(--color-text-3)]',
    dot: 'bg-zinc-500', spark: 'rgba(161,161,170,0.55)', pulse: false,
    accent: 'rgba(255,255,255,0.03)',
  },
  red: {
    border: 'border-red-200 dark:border-red-500/20', bg: 'bg-red-50 dark:bg-[#0e0505]',
    glow: '0 0 0 1px rgba(239,68,68,0.06), 0 0 35px rgba(239,68,68,0.08)',
    num: 'text-red-600 dark:text-red-300', label: 'text-red-500/80 dark:text-red-400/70', sub: 'text-red-500/60 dark:text-red-400/50',
    dot: 'bg-red-500', spark: 'rgba(239,68,68,0.65)', pulse: false,
    accent: 'rgba(239,68,68,0.12)',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-500/20', bg: 'bg-blue-50 dark:bg-[#03060e]',
    glow: '0 0 0 1px rgba(59,130,246,0.06), 0 0 35px rgba(59,130,246,0.07)',
    num: 'text-blue-600 dark:text-blue-200', label: 'text-blue-500/80 dark:text-blue-400/70', sub: 'text-blue-500/60 dark:text-blue-400/50',
    dot: 'bg-blue-500', spark: 'rgba(96,165,250,0.65)', pulse: false,
    accent: 'rgba(59,130,246,0.12)',
  },
  green: {
    border: 'border-green-200 dark:border-green-500/25', bg: 'bg-green-50 dark:bg-[#030e06]',
    glow: '0 0 0 1px rgba(34,197,94,0.08), 0 0 35px rgba(34,197,94,0.1)',
    num: 'text-green-600 dark:text-green-300', label: 'text-green-500/80 dark:text-green-400/70', sub: 'text-green-500/60 dark:text-green-400/50',
    dot: 'bg-green-500', spark: 'rgba(34,197,94,0.65)', pulse: true,
    accent: 'rgba(34,197,94,0.15)',
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-500/20', bg: 'bg-purple-50 dark:bg-[#07030e]',
    glow: '0 0 0 1px rgba(168,85,247,0.06), 0 0 35px rgba(168,85,247,0.08)',
    num: 'text-purple-600 dark:text-purple-200', label: 'text-purple-500/80 dark:text-purple-400/70', sub: 'text-purple-500/60 dark:text-purple-400/50',
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
    <span className={`text-[10px] font-mono font-semibold tabular-nums ${up ? 'text-green-600 dark:text-green-400/80' : 'text-red-500 dark:text-red-400/70'}`}>
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
  footerLink?: { label: string; href: string }
}

function StatCard({ label, value, sub, theme, format, sparkValues, delta, liveOrb, index, footerLink }: StatCardProps) {
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
    <div className={`relative rounded-2xl border ${t.border} ${t.bg} p-5 overflow-hidden hover:border-[var(--color-hover)] transition-colors cursor-pointer`} style={{ boxShadow: t.glow }}>
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
      {footerLink && (
        <Link
          href={footerLink.href}
          className="mt-1.5 text-[10px] font-medium transition-opacity hover:opacity-80 inline-flex items-center gap-1"
          style={{ color: 'var(--color-primary)' }}
          onClick={e => e.stopPropagation()}
        >
          {footerLink.label}
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      )}
    </div>
  )
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
  missedCalls: number
  calls: CallLog[]
}

export default function StatsGrid({ totalCalls, hotLeads, missedCalls, calls }: StatsGridProps) {
  // Classify calls
  const classified = calls.filter(c => ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED', 'UNKNOWN'].includes(c.call_status ?? ''))

  // Sparklines
  const isHOT = (c: CallLog) => c.call_status === 'HOT'
  const totalSpark = weekBuckets(classified, 0)
  const totalPrior = weekBuckets(classified, 1)
  const hotSpark = weekBuckets(classified, 0, isHOT)
  const hotPrior = weekBuckets(classified, 1, isHOT)

  // Answer rate — (HOT+WARM+COLD+UNKNOWN) / (HOT+WARM+COLD+UNKNOWN+MISSED)
  // UNKNOWN = AI picked up but classification failed — still counts as answered
  const answeredCount = calls.filter(c => ['HOT', 'WARM', 'COLD', 'UNKNOWN'].includes(c.call_status ?? '')).length
  const callableTotal = calls.filter(c => ['HOT', 'WARM', 'COLD', 'UNKNOWN', 'MISSED'].includes(c.call_status ?? '')).length
  const answerRate = Math.round(answeredCount / Math.max(callableTotal, 1) * 100)

  // Hours saved
  const junkCount = classified.filter(c => c.call_status === 'JUNK').length
  const resolvedCalls = classified.filter(c => ['HOT', 'WARM', 'COLD'].includes(c.call_status ?? ''))
  const avgDurMin = resolvedCalls.length > 0
    ? resolvedCalls.reduce((a, c) => a + (c.duration_seconds ?? 90), 0) / resolvedCalls.length / 60
    : 1.5
  const hoursSaved = Math.round((junkCount * 1.5 + resolvedCalls.length * avgDurMin) / 60 * 10) / 10

  const stats: StatCardProps[] = [
    {
      label: 'AI handled', value: totalCalls, sub: 'calls this month', theme: 'zinc',
      sparkValues: totalSpark, delta: delta(totalSpark, totalPrior), index: 0,
    },
    {
      label: 'Hot leads', value: hotLeads, sub: 'need callback now', theme: 'red',
      sparkValues: hotSpark, delta: delta(hotSpark, hotPrior), index: 1,
      footerLink: hotLeads > 0 ? { label: 'View queue →', href: '/dashboard/leads' } : undefined,
    },
    {
      label: 'Answer rate', value: answerRate, sub: `${answeredCount} of ${callableTotal} real calls`,
      theme: 'blue', format: (n: number) => `${n}%`, index: 2,
    },
    {
      label: 'Hours saved', value: hoursSaved, sub: '~1.5 min avg handle',
      theme: 'green', format: (n: number) => `${n}h`, index: 3,
    },
    {
      label: 'Auto-screened', value: junkCount,
      sub: `${Math.round(junkCount / Math.max(classified.length, 1) * 100)}% of total volume`,
      theme: 'purple', index: 4,
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
