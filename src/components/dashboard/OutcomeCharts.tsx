'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, ResponsiveContainer,
} from 'recharts'

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

// Shared dark-theme tooltip for all charts
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => p.value > 0)
  if (!rows.length) return null
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-900 px-3 py-2 text-[11px] shadow-2xl">
      {label && <p className="text-zinc-600 mb-1.5 font-mono uppercase tracking-wider text-[9px]">{label}</p>}
      {rows.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.fill }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="text-zinc-100 font-mono font-semibold ml-auto pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Recharts donut with hover tooltip + animated slices
function DonutChart({ counts, total }: { counts: Record<string, number>; total: number }) {
  const data = STATUSES
    .filter(s => (counts[s] ?? 0) > 0)
    .map(s => ({ name: STATUS_COLORS[s].label, value: counts[s] ?? 0, fill: STATUS_COLORS[s].fill, dataKey: s }))

  if (total === 0) {
    return (
      <div className="w-[120px] h-[120px] flex items-center justify-center shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative w-[120px] h-[120px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={34}
            outerRadius={50}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            animationBegin={80}
            animationDuration={600}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} opacity={0.88} />
            ))}
          </Pie>
          <Tooltip content={<DarkTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label — pointer-events-none so it doesn't block tooltip */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold font-mono text-zinc-100 leading-none">{total}</span>
        <span className="text-[10px] text-zinc-600 mt-0.5">calls</span>
      </div>
    </div>
  )
}

// Recharts stacked bar chart — clickable days, hover tooltip
function DayBarChart({
  days,
  onDayClick,
  selectedDay,
}: {
  days: { label: string; dateStr: string; counts: Record<string, number>; total: number }[]
  onDayClick?: (dateStr: string | null) => void
  selectedDay?: string | null
}) {
  const data = days.map(d => ({
    label: d.label,
    dateStr: d.dateStr,
    HOT: d.counts.HOT ?? 0,
    WARM: d.counts.WARM ?? 0,
    COLD: d.counts.COLD ?? 0,
    JUNK: d.counts.JUNK ?? 0,
  }))

  function handleClick(state: { activePayload?: { payload: { dateStr: string } }[] } | null) {
    if (!state?.activePayload?.[0]) return
    const d = state.activePayload[0].payload
    onDayClick?.(selectedDay === d.dateStr ? null : d.dateStr)
  }

  return (
    <div style={{ height: 80 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barSize={14}
          onClick={handleClick}
          style={{ cursor: onDayClick ? 'pointer' : 'default' }}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<DarkTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 } as object}
          />
          <Bar dataKey="JUNK" name="Junk" stackId="a" fill="#52525b" opacity={0.65} />
          <Bar dataKey="COLD" name="Cold" stackId="a" fill="#60a5fa" opacity={0.65} />
          <Bar dataKey="WARM" name="Warm" stackId="a" fill="#f59e0b" opacity={0.65} />
          <Bar dataKey="HOT" name="Hot" stackId="a" fill="#ef4444" opacity={0.65} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Conversion funnel — 4 horizontal bars (unchanged)
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
          <DonutChart counts={counts} total={classified.length} />
          <div className="space-y-1.5 flex-1 min-w-0">
            {STATUSES.map(s => (
              <div key={s} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[s].bg}`} />
                <span className="text-[11px] text-zinc-500 flex-1">{STATUS_COLORS[s].label}</span>
                <span className="text-[11px] font-mono text-zinc-400">{counts[s]}</span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {classified.length > 0 ? `${Math.round((counts[s] ?? 0) / classified.length * 100)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stacked bar chart — 7-day volume */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Last 7 Days</p>
        <DayBarChart days={days} onDayClick={onDayClick} selectedDay={selectedDay} />
        <p className="text-[10px] text-zinc-700 mt-1 font-mono">{todayCount} today</p>
      </div>

      {/* Conversion funnel */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 sm:col-span-2 lg:col-span-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Funnel</p>
        <ConversionFunnel calls={classified} />
      </div>
    </div>
  )
}
