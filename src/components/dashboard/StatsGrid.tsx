'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'

interface Stat {
  label: string
  value: number
  sub?: string
  theme: 'zinc' | 'red' | 'blue' | 'green'
  format?: (n: number) => string
  icon: string
}

function fmtDur(secs: number) {
  if (!secs) return '0:00'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

const THEMES = {
  zinc: {
    border: 'border-white/[0.07]',
    bg: 'bg-white/[0.02]',
    glow: undefined,
    num: 'text-zinc-50',
    label: 'text-zinc-500',
    sub: 'text-zinc-600',
    dot: 'bg-zinc-500',
    pulse: false,
  },
  red: {
    border: 'border-red-500/20',
    bg: 'bg-[#0e0505]',
    glow: '0 0 0 1px rgba(239,68,68,0.06), 0 0 35px rgba(239,68,68,0.08)',
    num: 'text-red-300',
    label: 'text-red-400/70',
    sub: 'text-red-400/50',
    dot: 'bg-red-500',
    pulse: false,
  },
  blue: {
    border: 'border-blue-500/20',
    bg: 'bg-[#03060e]',
    glow: '0 0 0 1px rgba(59,130,246,0.06), 0 0 35px rgba(59,130,246,0.07)',
    num: 'text-blue-200',
    label: 'text-blue-400/70',
    sub: 'text-blue-400/50',
    dot: 'bg-blue-500',
    pulse: false,
  },
  green: {
    border: 'border-green-500/25',
    bg: 'bg-[#030e06]',
    glow: '0 0 0 1px rgba(34,197,94,0.08), 0 0 35px rgba(34,197,94,0.1)',
    num: 'text-green-300',
    label: 'text-green-400/70',
    sub: 'text-green-400/50',
    dot: 'bg-green-500',
    pulse: true,
  },
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const numRef = useRef<HTMLSpanElement>(null)
  const t = THEMES[stat.theme]

  useEffect(() => {
    const el = numRef.current
    if (!el) return
    const controls = animate(0, stat.value, {
      duration: 0.9,
      delay: index * 0.08,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        el.textContent = stat.format ? stat.format(Math.round(v)) : String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [stat.value, stat.format, index])

  return (
    <div
      className={`relative rounded-2xl border ${t.border} ${t.bg} p-5 overflow-hidden`}
      style={{ boxShadow: t.glow }}
    >
      {/* Radial gradient accent top-right */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-40 pointer-events-none"
        style={{
          background: stat.theme === 'zinc'
            ? 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)'
            : stat.theme === 'red'
            ? 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)'
            : stat.theme === 'blue'
            ? 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Live dot */}
      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${t.label}`}>
          {stat.label}
        </p>
        <span className="relative flex w-1.5 h-1.5">
          {t.pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${t.dot} opacity-60`} />
        </span>
      </div>

      <p className={`text-[2.25rem] font-bold tracking-tight font-mono tabular-nums leading-none ${t.num}`}>
        <span ref={numRef}>0</span>
      </p>

      {stat.sub && (
        <p className={`text-[11px] mt-2.5 ${t.sub}`}>{stat.sub}</p>
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
    { label: 'Total Calls', value: totalCalls, sub: 'processed all time', theme: 'zinc', icon: '◈' },
    { label: 'Hot Leads', value: hotLeads, sub: 'high-intent callers', theme: 'red', icon: '◉' },
    { label: 'Avg Duration', value: avgDurationSecs, sub: 'seconds per call', theme: 'blue', icon: '◷', format: fmtDur },
    {
      label: 'Active Now',
      value: activeNow,
      sub: activeNow > 0 ? 'call in progress' : 'lines clear',
      theme: activeNow > 0 ? 'green' : 'zinc',
      icon: '◎',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{ animationDelay: `${i * 60}ms` }}
          className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both"
        >
          <StatCard stat={stat} index={i} />
        </div>
      ))}
    </div>
  )
}
