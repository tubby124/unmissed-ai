'use client'

import { useEffect, useState } from 'react'

interface CallLog {
  call_status: string | null
  started_at: string
  duration_seconds: number | null
}

interface OutcomeChartsProps {
  calls: CallLog[]
  onDayClick?: (dateStr: string | null) => void
  selectedDay?: string | null
}

const STATUS_COLORS: Record<string, { fill: string; label: string; bg: string }> = {
  HOT:  { fill: '#ef4444', label: 'Hot',  bg: 'bg-red-500' },
  WARM: { fill: '#f59e0b', label: 'Warm', bg: 'bg-amber-500' },
  COLD: { fill: '#60a5fa', label: 'Cold', bg: 'bg-blue-400' },
  JUNK: { fill: '#52525b', label: 'Junk', bg: 'bg-zinc-600' },
}

const STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK'] as const

// Animated donut — segments draw in sequentially on mount
function AnimatedDonut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  if (total === 0) {
    return (
      <div className="flex items-center justify-center w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
        </svg>
      </div>
    )
  }

  const R = 36
  const C = 2 * Math.PI * R
  let offset = 0

  const slices = STATUSES.map((s, idx) => {
    const pct = (counts[s] ?? 0) / total
    const finalDash = pct * C
    const slice = { status: s, dash: animated ? finalDash : 0, offset, delay: idx * 120, fill: STATUS_COLORS[s].fill }
    offset += finalDash
    return slice
  })

  return (
    <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        {slices.map(s => s.dash > 0 && (
          <circle
            key={s.status}
            cx="48" cy="48" r={R}
            fill="none"
            stroke={s.fill}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            style={{
              opacity: 0.88,
              transition: `stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1) ${s.delay}ms`,
            }}
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold font-mono text-zinc-100 leading-none">{total}</span>
        <span className="text-[10px] text-zinc-600 mt-0.5">calls</span>
      </div>
    </div>
  )
}

// Stacked bar chart — HOT/WARM/COLD/JUNK segments per day
function StackedBarChart({
  days,
  onDayClick,
  selectedDay,
}: {
  days: { label: string; dateStr: string; counts: Record<string, number>; total: number }[]
  onDayClick?: (dateStr: string | null) => void
  selectedDay?: string | null
}) {
  const max = Math.max(...days.map(d => d.total), 1)
  const HEIGHT = 48

  return (
    <div className="flex items-end gap-2" style={{ height: HEIGHT + 16 }}>
      {days.map(d => {
        const isSelected = selectedDay === d.dateStr
        const barH = Math.max(2, (d.total / max) * HEIGHT)

        // Build stacked segments bottom-up: JUNK → COLD → WARM → HOT
        let yFromBottom = 0
        const segments = [...STATUSES].reverse().map(s => {
          const count = d.counts[s] ?? 0
          const h = d.total > 0 ? (count / max) * HEIGHT : 0
          const seg = { status: s, h, y: HEIGHT - yFromBottom - h }
          yFromBottom += h
          return seg
        })

        return (
          <div
            key={d.label}
            className={`flex-1 flex flex-col items-center gap-1 ${onDayClick ? 'cursor-pointer group' : ''}`}
            onClick={() => onDayClick?.(isSelected ? null : d.dateStr)}
          >
            <div
              className="w-full relative overflow-hidden rounded-sm transition-all duration-200"
              style={{ height: barH }}
            >
              {d.total === 0 ? (
                <div className="absolute inset-0 bg-white/[0.04]" />
              ) : (
                <svg width="100%" height="100%" viewBox={`0 0 10 ${HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0">
                  {segments.map(seg => seg.h > 0 && (
                    <rect
                      key={seg.status}
                      x="0"
                      y={seg.y}
                      width="10"
                      height={seg.h}
                      fill={STATUS_COLORS[seg.status].fill}
                      opacity={isSelected ? 1 : 0.65}
                      style={{ transition: 'opacity 0.2s' }}
                    >
                      <title>{STATUS_COLORS[seg.status].label}: {d.counts[seg.status] ?? 0}</title>
                    </rect>
                  ))}
                </svg>
              )}
              {isSelected && (
                <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-sm pointer-events-none" />
              )}
            </div>
            <span className={`text-[9px] font-mono transition-colors ${isSelected ? 'text-blue-400' : 'text-zinc-700'}`}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Conversion funnel — 4 horizontal bars
function ConversionFunnel({ calls }: { calls: CallLog[] }) {
  const classified = calls.filter(c => STATUSES.includes(c.call_status as typeof STATUSES[number]))
  const total = classified.length
  if (total === 0) return <div className="flex items-center justify-center h-full text-zinc-700 text-[11px]">No data</div>

  const answered = classified.filter(c => c.call_status !== 'JUNK').length
  const qualified = classified.filter(c => c.call_status === 'HOT' || c.call_status === 'WARM').length
  const hot = classified.filter(c => c.call_status === 'HOT').length

  const stages = [
    { label: 'Total', count: total, pct: 100, color: '#52525b' },
    { label: 'Answered', count: answered, pct: Math.round((answered / total) * 100), color: '#60a5fa' },
    { label: 'Qualified', count: qualified, pct: Math.round((qualified / total) * 100), color: '#f59e0b' },
    { label: 'Hot', count: hot, pct: Math.round((hot / total) * 100), color: '#ef4444' },
  ]

  return (
    <div className="space-y-2.5 pt-1">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-zinc-500">{stage.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400">{stage.count}</span>
              <span className="text-[10px] font-mono" style={{ color: stage.color }}>{stage.pct}%</span>
            </div>
          </div>
          <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${stage.pct}%`,
                background: `linear-gradient(to right, ${stage.color}99, ${stage.color})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function OutcomeCharts({ calls, onDayClick, selectedDay }: OutcomeChartsProps) {
  const classified = calls.filter(c => STATUSES.includes(c.call_status as typeof STATUSES[number]))

  const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, JUNK: 0 }
  for (const c of classified) {
    if (c.call_status) counts[c.call_status] = (counts[c.call_status] ?? 0) + 1
  }

  // Last 7 days — stacked by status
  const now = Date.now()
  const DAY = 86400000
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * DAY)
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)
    const start = new Date(d).setHours(0, 0, 0, 0)
    const end = start + DAY
    const dateStr = new Date(start).toISOString().slice(0, 10)
    const dayCalls = calls.filter(c => {
      const t = new Date(c.started_at).getTime()
      return t >= start && t < end
    })
    const dayCounts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, JUNK: 0 }
    for (const c of dayCalls) {
      if (c.call_status && STATUSES.includes(c.call_status as typeof STATUSES[number])) {
        dayCounts[c.call_status] = (dayCounts[c.call_status] ?? 0) + 1
      }
    }
    return { label, dateStr, counts: dayCounts, total: dayCalls.length }
  })

  const todayCount = calls.filter(c => {
    const t = new Date(c.started_at).getTime()
    return t >= new Date().setHours(0, 0, 0, 0)
  }).length

  if (classified.length === 0 && calls.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Donut — lead outcomes */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Outcomes</p>
        <div className="flex items-center gap-4">
          <AnimatedDonut counts={counts} total={classified.length} />
          <div className="space-y-1.5 flex-1 min-w-0">
            {STATUSES.map(s => (
              <div key={s} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[s].bg}`} />
                <span className="text-[11px] text-zinc-500 flex-1">{STATUS_COLORS[s].label}</span>
                <span className="text-[11px] font-mono text-zinc-400">{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stacked bar chart — 7-day volume */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Last 7 Days</p>
        <StackedBarChart days={days} onDayClick={onDayClick} selectedDay={selectedDay} />
        <p className="text-[10px] text-zinc-700 mt-2 font-mono">{todayCount} today</p>
      </div>

      {/* Conversion funnel */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 sm:col-span-2 lg:col-span-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Funnel</p>
        <ConversionFunnel calls={classified} />
      </div>
    </div>
  )
}
