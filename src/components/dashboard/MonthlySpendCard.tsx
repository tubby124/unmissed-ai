'use client'

import Link from 'next/link'

interface ClientSpend {
  name: string
  slug: string
  cents: number
  seconds: number
  calls: number
}

interface MonthlySpendCardProps {
  totalCents: number
  totalSeconds: number
  totalCalls: number
  topClients: ClientSpend[]
  rangeLabel: string
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtMin(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${(seconds / 60).toFixed(1)}m`
}

export default function MonthlySpendCard({
  totalCents,
  totalSeconds,
  totalCalls,
  topClients,
  rangeLabel,
}: MonthlySpendCardProps) {
  return (
    <div className="rounded-2xl border b-theme overflow-hidden bg-surface">
      <div className="px-4 py-2.5 border-b b-theme bg-surface flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
          Platform Spend — {rangeLabel}
        </p>
        <Link
          href="/dashboard/costs"
          className="text-[10px] font-mono uppercase tracking-widest underline t2 hover:t1"
        >
          Full breakdown →
        </Link>
      </div>

      <div className="px-4 py-4 border-b b-theme flex items-baseline gap-4 flex-wrap">
        <div>
          <p className="text-2xl font-semibold t1 leading-none">{fmtUsd(totalCents)}</p>
          <p className="text-[10px] font-mono t3 mt-1">Ultravox + Twilio inbound variable cost</p>
        </div>
        <div className="t3 text-[11px] font-mono">
          {totalCalls} billable calls · {fmtMin(totalSeconds)} billed
        </div>
      </div>

      {topClients.length === 0 ? (
        <div className="px-4 py-4 text-[12px] t3">No billed calls this period.</div>
      ) : (
        <div>
          {topClients.map((c, i) => {
            const pct = totalCents > 0 ? (c.cents / totalCents) * 100 : 0
            return (
              <div
                key={c.slug || c.name}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors${i < topClients.length - 1 ? ' border-b b-theme' : ''}`}
              >
                <div className="min-w-0 w-40 shrink-0">
                  <p className="text-[12px] font-medium truncate t1">{c.name}</p>
                  <p className="text-[10px] font-mono truncate t3">{c.slug || '—'}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono t3">
                      {c.calls} calls · {fmtMin(c.seconds)}
                    </span>
                    <span className="text-[10px] font-mono t3">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-hover">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-[12px] font-mono t1 w-16 text-right">
                  {fmtUsd(c.cents)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
