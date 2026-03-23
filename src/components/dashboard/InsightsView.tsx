'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { motion } from 'motion/react'
import { animate } from 'motion'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import ScopedClientLabel from './ScopedClientLabel'
import NoInsights from './empty-states/NoInsights'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

// ─── Types ───────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d'

interface InsightsData {
  summary: {
    totalCalls: number
    hotLeads: number
    avgDuration: number
    avgQuality: number
    trends: {
      callsChange: number | null
      hotChange: number | null
      durationChange: number | null
      qualityChange: number | null
    }
  }
  classification: Record<string, number>
  dailyVolume: Array<{ date: string; count: number }>
  peakHours: Array<{ hour: number; count: number }>
  topCallers: Array<{ phone: string; name: string | null; count: number; lastStatus: string }>
  topTopics: Array<{ topic: string; count: number }>
  sentiment: Record<string, number>
  qualityTrend?: Array<{ date: string; avg: number }>
  range: Range
  totalDays: number
}

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

interface InsightsViewProps {
  clientId: string | null
  isAdmin: boolean
  adminClients: ClientInfo[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  HOT:     { color: '#ef4444', label: 'Hot Leads',    bg: 'bg-red-500' },
  WARM:    { color: '#f59e0b', label: 'Warm',         bg: 'bg-amber-500' },
  COLD:    { color: '#60a5fa', label: 'Cold',         bg: 'bg-blue-400' },
  JUNK:    { color: '#52525b', label: 'Junk/Spam',    bg: 'bg-zinc-600' },
  MISSED:  { color: '#a855f7', label: 'Missed',       bg: 'bg-purple-500' },
  UNKNOWN: { color: '#6b7280', label: 'Unclassified', bg: 'bg-gray-500' },
}

const SENTIMENT_CONFIG: Record<string, { color: string; label: string }> = {
  positive: { color: '#22c55e', label: 'Positive' },
  neutral:  { color: '#6b7280', label: 'Neutral' },
  negative: { color: '#ef4444', label: 'Negative' },
}

// ─── Shared Dark Tooltip ─────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] shadow-2xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-raised)' }}>
      {label && <p className="mb-1.5 font-mono uppercase tracking-wider text-[9px]" style={{ color: 'var(--color-text-3)' }}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color || p.fill || 'var(--color-text-2)' }} />
          <span style={{ color: 'var(--color-text-2)' }}>{p.name}:</span>
          <span className="font-mono font-semibold ml-auto pl-3" style={{ color: 'var(--color-text-1)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedNum({ value, format, delay = 0 }: { value: number; format?: (n: number) => string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controls = animate(0, value, {
      duration: 0.8,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) { el.textContent = format ? format(Math.round(v * 10) / 10) : String(Math.round(v)) },
    })
    return () => controls.stop()
  }, [value, format, delay])
  return <span ref={ref}>0</span>
}

// ─── Trend Badge ─────────────────────────────────────────────────────────────

function TrendBadge({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>--</span>
  const up = value >= 0
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold tabular-nums" style={{ color: up ? 'var(--color-success)' : 'var(--color-error)' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M5 2L8.5 6.5H1.5L5 2Z" fill="currentColor" />
      </svg>
      {Math.abs(Math.round(value))}%
    </span>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, format, trend, accent, delay }: {
  label: string; value: number; format?: (n: number) => string; trend: number | null; accent: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl border p-5 overflow-hidden group hover:border-[color:var(--color-hover)] transition-colors"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)` }} />
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-3)' }}>{label}</p>
      <p className="text-3xl font-bold font-mono tabular-nums leading-none" style={{ color: accent }}>
        <AnimatedNum value={value} format={format} delay={delay} />
      </p>
      <div className="mt-2">
        <TrendBadge value={trend} />
        <span className="text-[10px] ml-1.5" style={{ color: 'var(--color-text-3)' }}>vs prior</span>
      </div>
    </motion.div>
  )
}

// ─── Classification Donut ────────────────────────────────────────────────────

function ClassificationDonut({ classification, total }: { classification: Record<string, number>; total: number }) {
  const data = Object.entries(STATUS_CONFIG)
    .filter(([key]) => (classification[key] ?? 0) > 0)
    .map(([key, cfg]) => ({ name: cfg.label, value: classification[key] ?? 0, fill: cfg.color }))

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>No calls in this period</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-[180px] h-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={75} dataKey="value"
              startAngle={90} endAngle={-270} strokeWidth={0} animationBegin={100} animationDuration={700}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={0.9} />)}
            </Pie>
            <Tooltip content={<DarkTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--color-text-1)' }}>{total}</span>
          <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>total</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 w-full min-w-0">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = classification[key] ?? 0
          const pct = total > 0 ? Math.round(count / total * 100) : 0
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.bg}`} />
                  <span className="text-[11px]" style={{ color: 'var(--color-text-2)' }}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-1)' }}>{count}</span>
                  <span className="text-[10px] font-mono w-8 text-right" style={{ color: cfg.color }}>{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.8 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Volume Area Chart ───────────────────────────────────────────────────────

function VolumeChart({ dailyVolume, range }: { dailyVolume: Array<{ date: string; count: number }>; range: Range }) {
  const data = dailyVolume.map(d => {
    const dt = new Date(d.date + 'T12:00:00')
    let label: string
    if (range === '7d') {
      label = dt.toLocaleDateString('en', { weekday: 'short' })
    } else if (range === '30d') {
      label = dt.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    } else {
      label = dt.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }
    return { label, count: d.count, date: d.date }
  })

  // For 90d, show every ~7th label
  const skipInterval = range === '90d' ? 7 : range === '30d' ? 3 : 1

  if (data.length === 0) return null

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            interval={skipInterval - 1}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<DarkTooltip />}
            cursor={{ stroke: 'rgba(99, 102, 241, 0.2)', strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Calls"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#volumeGrad)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Quality Trend Chart ─────────────────────────────────────────────────────

function QualityTrendChart({ qualityTrend, range }: { qualityTrend: Array<{ date: string; avg: number }>; range: Range }) {
  if (!qualityTrend || qualityTrend.length < 2) {
    return <p className="text-[11px] t3 text-center py-8">Not enough data for quality trend</p>
  }

  const data = qualityTrend.map(d => {
    const dt = new Date(d.date + 'T12:00:00')
    const label = range === '7d'
      ? dt.toLocaleDateString('en', { weekday: 'short' })
      : dt.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    return { label, avg: d.avg, date: d.date }
  })

  const skipInterval = range === '90d' ? 7 : range === '30d' ? 3 : 1

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            interval={skipInterval - 1}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<DarkTooltip />}
            cursor={{ stroke: 'rgba(34, 197, 94, 0.2)', strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="avg"
            name="Quality"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#qualityGrad)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Peak Hours Heatmap ──────────────────────────────────────────────────────

function PeakHoursHeatmap({ peakHours }: { peakHours: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...peakHours.map(h => h.count), 1)

  function formatHour(h: number): string {
    if (h === 0) return '12a'
    if (h < 12) return `${h}a`
    if (h === 12) return '12p'
    return `${h - 12}p`
  }

  return (
    <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
      {peakHours.map(({ hour, count }) => {
        const intensity = count / max
        return (
          <div
            key={hour}
            className="relative rounded-lg aspect-square flex flex-col items-center justify-center cursor-default group"
            style={{
              backgroundColor: count > 0
                ? `rgba(99, 102, 241, ${0.08 + intensity * 0.55})`
                : 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            title={`${formatHour(hour)}: ${count} call${count !== 1 ? 's' : ''}`}
          >
            <span className="text-[9px] font-mono" style={{ color: count > 0 ? `rgba(165, 180, 252, ${0.5 + intensity * 0.5})` : 'var(--color-text-3)' }}>{formatHour(hour)}</span>
            {count > 0 && (
              <span className="text-[10px] font-mono font-bold" style={{ color: `rgba(165, 180, 252, ${0.6 + intensity * 0.4})` }}>{count}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Top Callers Table ───────────────────────────────────────────────────────

function TopCallersTable({ callers }: { callers: Array<{ phone: string; name: string | null; count: number; lastStatus: string }> }) {
  if (callers.length === 0) return <p className="text-[11px] py-4 text-center" style={{ color: 'var(--color-text-3)' }}>No returning callers</p>

  function maskPhone(phone: string): string {
    if (phone.length >= 10) {
      return `***-***-${phone.slice(-4)}`
    }
    return phone
  }

  return (
    <div className="space-y-1">
      {callers.map((c, i) => {
        const cfg = STATUS_CONFIG[c.lastStatus] ?? STATUS_CONFIG.UNKNOWN
        return (
          <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-hover transition-colors">
            <span className="text-[11px] font-mono w-5 shrink-0" style={{ color: 'var(--color-text-3)' }}>{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-mono truncate" style={{ color: 'var(--color-text-1)' }}>
                {c.name || maskPhone(c.phone)}
              </p>
              {c.name && <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>{maskPhone(c.phone)}</p>}
            </div>
            <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: 'var(--color-text-2)' }}>{c.count}x</span>
            <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded-full uppercase"
              style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
              {c.lastStatus}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Top Topics ──────────────────────────────────────────────────────────────

function TopTopics({ topics }: { topics: Array<{ topic: string; count: number }> }) {
  if (topics.length === 0) return <p className="text-[11px] py-4 text-center" style={{ color: 'var(--color-text-3)' }}>No topics extracted yet</p>

  const maxCount = Math.max(...topics.map(t => t.count), 1)

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map(t => {
        const intensity = t.count / maxCount
        return (
          <span
            key={t.topic}
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors"
            style={{
              borderColor: `rgba(99, 102, 241, ${0.15 + intensity * 0.3})`,
              backgroundColor: `rgba(99, 102, 241, ${0.03 + intensity * 0.1})`,
              color: `rgba(165, 180, 252, ${0.6 + intensity * 0.4})`,
            }}
          >
            {t.topic}
            <span className="font-mono font-bold text-[10px]">{t.count}</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── Sentiment Bar ───────────────────────────────────────────────────────────

function SentimentBar({ sentiment }: { sentiment: Record<string, number> }) {
  const total = Object.values(sentiment).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => {
          const count = sentiment[key] ?? 0
          const pct = Math.round(count / total * 100)
          if (pct === 0) return null
          return <div key={key} className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.7 }} />
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => {
          const count = sentiment[key] ?? 0
          const pct = total > 0 ? Math.round(count / total * 100) : 0
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>{cfg.label}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-2)' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <SkeletonBox key={i} className="rounded-2xl h-[120px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <SkeletonBox key={i} className="rounded-2xl h-[280px]" />
        ))}
      </div>
    </div>
  )
}

// ─── Card Wrapper ────────────────────────────────────────────────────────────

function Card({ title, delay, children, className = '' }: { title: string; delay: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`rounded-2xl border p-5 ${className}`}
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--color-text-3)' }}>{title}</p>
      {children}
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InsightsView({ clientId, isAdmin, adminClients }: InsightsViewProps) {
  const { selectedClientId: contextClientId, setSelectedClientId: setContextClient } = useAdminClient()
  const router = useRouter()
  const pathname = usePathname()
  const urlParams = useSearchParams()
  const [range, setRange] = useState<Range>('30d')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    () => contextClientId === 'all' ? null : contextClientId
  )
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ range })
      const cid = isAdmin ? selectedClientId : clientId
      if (cid) params.set('client_id', cid)
      const res = await fetch(`/api/dashboard/insights?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [range, selectedClientId, isAdmin, clientId])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  const ranges: Range[] = ['7d', '30d', '90d']

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-1)' }}>Insights</h1>
            <ScopedClientLabel />
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            {isAdmin && !selectedClientId ? 'All clients' : 'Your call analytics'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin client selector */}
          {isAdmin && adminClients.length > 0 && (
            <select
              value={selectedClientId ?? ''}
              onChange={e => {
                const id = e.target.value || null
                setSelectedClientId(id)
                setContextClient(id ?? 'all')
              }}
              className="text-[12px] rounded-lg px-3 py-2 border appearance-none cursor-pointer"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)' }}
            >
              <option value="">All Clients</option>
              {adminClients.map(c => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
          )}

          {/* Range toggle */}
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-colors"
                style={{
                  backgroundColor: range === r ? 'var(--color-accent-tint)' : 'transparent',
                  color: range === r ? 'var(--color-primary)' : 'var(--color-text-3)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <Skeleton /> : !data ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Failed to load insights</p>
        </div>
      ) : data.summary.totalCalls === 0 ? (
        <NoInsights />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Calls" value={data.summary.totalCalls} trend={data.summary.trends.callsChange} accent="#a5b4fc" delay={0} />
            <KpiCard label="Hot Leads" value={data.summary.hotLeads} trend={data.summary.trends.hotChange} accent="#ef4444" delay={0.08} />
            <KpiCard
              label="Avg Duration"
              value={data.summary.avgDuration}
              format={(n) => {
                const m = Math.floor(n / 60)
                const s = Math.round(n % 60)
                return m > 0 ? `${m}m ${s}s` : `${s}s`
              }}
              trend={data.summary.trends.durationChange}
              accent="#60a5fa"
              delay={0.16}
            />
            <KpiCard
              label="Quality Score"
              value={data.summary.avgQuality}
              format={(n) => `${n}/10`}
              trend={data.summary.trends.qualityChange}
              accent="#22c55e"
              delay={0.24}
            />
          </div>

          {/* Classification + Volume */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card title="Call Outcomes" delay={0.3}>
              <ClassificationDonut classification={data.classification} total={data.summary.totalCalls} />
            </Card>
            <Card title={`Call Volume (${data.range})`} delay={0.35}>
              <VolumeChart dailyVolume={data.dailyVolume} range={data.range as Range} />
            </Card>
          </div>

          {/* Peak Hours + Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card title="Peak Hours" delay={0.4}>
              <PeakHoursHeatmap peakHours={data.peakHours} />
            </Card>
            <Card title="Caller Sentiment" delay={0.45}>
              <SentimentBar sentiment={data.sentiment} />
            </Card>
          </div>

          {/* Quality Trend */}
          {data.qualityTrend && data.qualityTrend.length >= 2 && (
            <Card title="Quality Over Time" delay={0.47}>
              <QualityTrendChart qualityTrend={data.qualityTrend} range={data.range as Range} />
            </Card>
          )}

          {/* Top Callers + Topics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card title="Top Callers" delay={0.5}>
              <TopCallersTable callers={data.topCallers} />
            </Card>
            <Card title="Trending Topics" delay={0.55}>
              <TopTopics topics={data.topTopics} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
