'use client'

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

function DonutChart({ counts, total }: { counts: Record<string, number>; total: number }) {
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
  const statuses = ['HOT', 'WARM', 'COLD', 'JUNK']
  let offset = 0

  const slices = statuses.map(s => {
    const pct = (counts[s] ?? 0) / total
    const dash = pct * C
    const slice = { status: s, dash, offset }
    offset += dash
    return slice
  })

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        {slices.map(s => s.dash > 0 && (
          <circle
            key={s.status}
            cx="48" cy="48" r={R}
            fill="none"
            stroke={STATUS_COLORS[s.status].fill}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            style={{ opacity: 0.85 }}
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

function BarChart({
  days,
  onDayClick,
  selectedDay,
}: {
  days: { label: string; dateStr: string; count: number }[]
  onDayClick?: (dateStr: string | null) => void
  selectedDay?: string | null
}) {
  const max = Math.max(...days.map(d => d.count), 1)
  const clickable = !!onDayClick
  return (
    <div className="flex items-end gap-1 h-14">
      {days.map(d => {
        const isSelected = selectedDay === d.dateStr
        return (
          <div
            key={d.label}
            className={`flex-1 flex flex-col items-center gap-1 ${clickable ? 'cursor-pointer group' : ''}`}
            onClick={() => {
              if (!onDayClick) return
              onDayClick(isSelected ? null : d.dateStr)
            }}
          >
            <div
              className={`w-full rounded-sm transition-all duration-300 ${
                isSelected
                  ? 'bg-blue-400 ring-1 ring-blue-400/60'
                  : clickable
                  ? 'bg-blue-500/40 group-hover:bg-blue-500/65'
                  : 'bg-blue-500/40'
              }`}
              style={{ height: `${Math.max(2, (d.count / max) * 48)}px` }}
              title={`${d.label}: ${d.count}`}
            />
            <span className={`text-[9px] font-mono transition-colors ${isSelected ? 'text-blue-400' : 'text-zinc-700'}`}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function OutcomeCharts({ calls, onDayClick, selectedDay }: OutcomeChartsProps) {
  const classified = calls.filter(c => ['HOT', 'WARM', 'COLD', 'JUNK'].includes(c.call_status ?? ''))

  const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, JUNK: 0 }
  for (const c of classified) {
    if (c.call_status) counts[c.call_status] = (counts[c.call_status] ?? 0) + 1
  }

  // Last 7 days bar chart
  const now = Date.now()
  const DAY = 86400000
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * DAY)
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)
    const start = new Date(d).setHours(0, 0, 0, 0)
    const end = start + DAY
    const dateStr = new Date(start).toISOString().slice(0, 10)
    const count = calls.filter(c => {
      const t = new Date(c.started_at).getTime()
      return t >= start && t < end
    }).length
    return { label, dateStr, count }
  })

  if (classified.length === 0 && calls.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Donut — lead outcomes */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Outcomes</p>
        <div className="flex items-center gap-4">
          <DonutChart counts={counts} total={classified.length} />
          <div className="space-y-1.5 flex-1">
            {(['HOT', 'WARM', 'COLD', 'JUNK'] as const).map(s => (
              <div key={s} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[s].bg}`} />
                <span className="text-[11px] text-zinc-500 flex-1">{STATUS_COLORS[s].label}</span>
                <span className="text-[11px] font-mono text-zinc-400">{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bars — 7-day volume */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Last 7 Days</p>
        <BarChart days={days} onDayClick={onDayClick} selectedDay={selectedDay} />
        <p className="text-[10px] text-zinc-700 mt-2 font-mono">
          {calls.filter(c => {
            const t = new Date(c.started_at).getTime()
            return t >= new Date().setHours(0, 0, 0, 0)
          }).length} today
        </p>
      </div>
    </div>
  )
}
