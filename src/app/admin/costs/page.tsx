'use client'

import { useEffect, useState, useCallback } from 'react'

type ClientCostRow = {
  client_id: string
  business_name: string
  slug: string
  call_direction: 'inbound' | 'outbound'
  twilio_rate: number
  calls: number
  minutes_computed: number
  minutes_billed_ultravox: number | null
  twilio_cost: number
  ultravox_cost_computed: number
  ultravox_cost_live: number | null
  number_cost: number
  total_cost_computed: number
  total_cost_live: number
  cost_per_call: number
}

type DailyRow = {
  date: string
  twilio: number
  ultravox: number
  total: number
}

type Summary = {
  total_cost_live: number
  twilio_cost_computed: number
  twilio_cost_actual: number | null
  twilio_minutes_actual: number | null
  ultravox_cost_live: number
  number_cost: number
  total_minutes_computed: number
  total_calls: number
  range_label: string
  from: string
  to: string
}

type CostData = {
  summary: Summary
  by_client: ClientCostRow[]
  daily: DailyRow[]
  pricing: {
    twilio_inbound_per_min: number
    twilio_outbound_per_min: number
    twilio_number_per_month: number
    ultravox_per_min: number
  }
  ultravox_live_total_calls: number
  ultravox_live_total_billed_seconds: number
}

type Range = 'today' | 'week' | 'month' | 'all'

const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  week: '7 Days',
  month: 'This Month',
  all: 'All Time',
}

const MARKUPS = [50, 100, 150]

function fmt(n: number) {
  return n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

function fmtMin(n: number) {
  if (n < 1) return `${Math.round(n * 60)}s`
  return `${n.toFixed(1)}m`
}

export default function CostsPage() {
  const [range, setRange] = useState<Range>('month')
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/costs?range=${r}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const s = data?.summary
  const maxDaily = data ? Math.max(...data.daily.map(d => d.total), 0.001) : 0.001

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Cost Intelligence</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live infrastructure costs by client — Twilio + Ultravox
          </p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                range === r
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-600 text-sm">
          <span className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          Loading live cost data…
        </div>
      )}

      {data && s && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label={`Total — ${s.range_label}`}
              value={fmt(s.total_cost_live)}
              sub={`${s.total_calls} calls · ${fmtMin(s.total_minutes_computed)}`}
              color="amber"
            />
            <SummaryCard
              label="Twilio"
              value={fmt(s.twilio_cost_computed)}
              sub={
                s.twilio_cost_actual !== null
                  ? `Actual billed: ${fmt(s.twilio_cost_actual)}`
                  : 'Numbers + voice minutes'
              }
              color={
                s.twilio_cost_actual !== null &&
                Math.abs(s.twilio_cost_actual - s.twilio_cost_computed) < s.twilio_cost_computed * 0.15
                  ? 'green'
                  : 'blue'
              }
            />
            <SummaryCard
              label="Ultravox AI"
              value={fmt(s.ultravox_cost_live)}
              sub={`${data.ultravox_live_total_calls} calls · ${fmtMin(data.ultravox_live_total_billed_seconds / 60)} billed`}
              color="violet"
            />
          </div>

          {/* ── Twilio actual vs computed callout ── */}
          {s.twilio_cost_actual !== null && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-zinc-400 font-medium">Twilio Actual Bill</span>
              <span className="text-white font-semibold">{fmt(s.twilio_cost_actual)}</span>
              {s.twilio_minutes_actual != null && (
                <span className="text-zinc-500">{fmtMin(s.twilio_minutes_actual)} billed</span>
              )}
              <span className="text-zinc-600">vs computed {fmt(s.twilio_cost_computed)}</span>
              {(() => {
                const diff = s.twilio_cost_actual - s.twilio_cost_computed
                const pct = Math.abs(diff / (s.twilio_cost_computed || 1)) * 100
                return pct > 15 ? (
                  <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                    {pct.toFixed(0)}% gap — check for outbound calls
                  </span>
                ) : (
                  <span className="text-green-400 text-xs font-semibold bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                    ✓ Within tolerance
                  </span>
                )
              })()}
            </div>
          )}

          {/* ── Per-client table ── */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-zinc-300">Per Client Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Client', 'Direction', 'Calls', 'Minutes', 'Twilio', 'Ultravox', 'Number', 'Total', '$/call'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-zinc-600 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.by_client.map(row => (
                    <tr key={row.client_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{row.business_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          row.call_direction === 'outbound'
                            ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                            : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                        }`}>
                          {row.call_direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{row.calls}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">
                        {fmtMin(row.minutes_computed)}
                        {row.minutes_billed_ultravox !== null && Math.abs(row.minutes_billed_ultravox - row.minutes_computed) > 0.5 && (
                          <span className="text-zinc-600 ml-1">({fmtMin(row.minutes_billed_ultravox)} billed)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{fmt(row.twilio_cost)}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">
                        {fmt(row.ultravox_cost_live ?? row.ultravox_cost_computed)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 tabular-nums">{fmt(row.number_cost)}</td>
                      <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">{fmt(row.total_cost_live)}</td>
                      <td className="px-4 py-3 text-zinc-400 tabular-nums">{row.cost_per_call > 0 ? fmt(row.cost_per_call) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pricing Playground ── */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-300">Pricing Playground</h2>
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5">
                Monthly cost × markup
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-4 py-2.5 text-left text-zinc-600 font-medium">Client</th>
                    <th className="px-4 py-2.5 text-left text-zinc-600 font-medium">Your Cost ({s.range_label})</th>
                    {MARKUPS.map(m => (
                      <th key={m} className="px-4 py-2.5 text-left text-zinc-600 font-medium">
                        {m}x → Charge/mo
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.by_client.map(row => {
                    // Normalize to monthly cost for playground
                    let monthlyCost = row.total_cost_live
                    if (range === 'today') monthlyCost = row.total_cost_live * 30
                    else if (range === 'week') monthlyCost = row.total_cost_live * 4
                    else if (range === 'all' && row.calls > 0) {
                      const days = (new Date(s.to).getTime() - new Date(s.from).getTime()) / 86400000
                      monthlyCost = row.total_cost_live / (days / 30)
                    }
                    return (
                      <tr key={row.client_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{row.business_name}</td>
                        <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">{fmt(monthlyCost)}/mo</td>
                        {MARKUPS.map(m => (
                          <td key={m} className="px-4 py-3 text-green-400 font-semibold tabular-nums">
                            {fmt(monthlyCost * m)}/mo
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-700">
                Monthly figures. Cost includes Twilio voice minutes, phone number rental, and Ultravox AI processing. Multiply by your desired margin to set client pricing.
              </p>
            </div>
          </div>

          {/* ── Daily spend chart (last 30 days) ── */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-4">
              <h2 className="text-sm font-semibold text-zinc-300">Daily Spend — Last 30 Days</h2>
              <div className="flex items-center gap-3 ml-auto text-[10px] text-zinc-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" /> Twilio</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500/60 inline-block" /> Ultravox</span>
              </div>
            </div>
            <div className="px-5 py-4">
              {data.daily.length === 0 ? (
                <p className="text-zinc-700 text-sm text-center py-8">No calls in the last 30 days</p>
              ) : (
                <div className="flex items-end gap-0.5 h-28">
                  {data.daily.map(d => {
                    const twilioH = (d.twilio / maxDaily) * 100
                    const uvH = (d.ultravox / maxDaily) * 100
                    const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col justify-end gap-0 group relative min-w-0"
                        title={`${dayLabel}: ${fmt(d.total)}`}
                      >
                        <div
                          style={{ height: `${uvH}%` }}
                          className="bg-violet-500/50 group-hover:bg-violet-400/70 transition-colors rounded-t-sm min-h-px"
                        />
                        <div
                          style={{ height: `${twilioH}%` }}
                          className="bg-blue-500/50 group-hover:bg-blue-400/70 transition-colors min-h-px"
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="text-zinc-400">{dayLabel}</div>
                          <div className="text-white font-semibold">{fmt(d.total)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {data.daily.length > 0 && (
                <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-700">
                  <span>{new Date(data.daily[0].date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
                  <span>Today</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Pricing assumptions footer ── */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-5 py-4 space-y-1">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Rate Assumptions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-600">
              <div>
                <div className="text-zinc-400 font-medium">Twilio Inbound</div>
                <div className="tabular-nums">${data.pricing.twilio_inbound_per_min.toFixed(4)}/min</div>
                <div className="text-zinc-700 text-[10px]">CA local inbound</div>
              </div>
              <div>
                <div className="text-zinc-400 font-medium">Twilio Outbound</div>
                <div className="tabular-nums">${data.pricing.twilio_outbound_per_min.toFixed(4)}/min</div>
                <div className="text-zinc-700 text-[10px]">Used for Manzil ISA</div>
              </div>
              <div>
                <div className="text-zinc-400 font-medium">Phone Number</div>
                <div className="tabular-nums">${data.pricing.twilio_number_per_month.toFixed(2)}/month each</div>
                <div className="text-zinc-700 text-[10px]">CA local number</div>
              </div>
              <div>
                <div className="text-zinc-400 font-medium">Ultravox AI</div>
                <div className="tabular-nums">${data.pricing.ultravox_per_min.toFixed(2)}/min billed</div>
                <div className="text-zinc-700 text-[10px]">Rounds up to 60s min</div>
              </div>
            </div>
            <p className="text-[10px] text-zinc-700 pt-1">
              Ultravox costs use live billed duration from Ultravox API where available. Twilio costs use computed estimate; compare against Twilio actual above.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Summary card component ────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  sub,
  color = 'amber',
}: {
  label: string
  value: string
  sub: string
  color?: 'amber' | 'blue' | 'violet' | 'green'
}) {
  const colors = {
    amber: 'border-amber-500/20 bg-amber-500/5',
    blue: 'border-blue-500/20 bg-blue-500/5',
    violet: 'border-violet-500/20 bg-violet-500/5',
    green: 'border-green-500/20 bg-green-500/5',
  }
  const textColors = {
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    green: 'text-green-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs text-zinc-500 font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${textColors[color]}`}>{value}</div>
      <div className="text-xs text-zinc-600 mt-1">{sub}</div>
    </div>
  )
}
