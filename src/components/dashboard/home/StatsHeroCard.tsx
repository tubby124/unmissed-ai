'use client'

/**
 * StatsHeroCard — extracted from ClientHome lines 438–492
 * Shows agent status header + call count + minute usage bar.
 * Rendered for paid_ready and expired phases (when there are real calls).
 */

interface StatsHeroCardProps {
  agentName: string
  agentStatus: string | null
  isTrial: boolean
  isExpired: boolean
  totalCalls: number
  callsTrend: number | null
  minutesUsed: number
  totalAvailable: number
  bonusMinutes: number
  onUpgrade?: () => void
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const isUp = value > 0
  return (
    <span className={`text-[11px] font-medium ${isUp ? 'text-green-400' : value < 0 ? 'text-red-400' : 't3'}`}>
      {isUp ? '+' : ''}{value}%
    </span>
  )
}

export default function StatsHeroCard({
  agentName,
  agentStatus,
  isTrial,
  isExpired,
  totalCalls,
  callsTrend,
  minutesUsed,
  totalAvailable,
  bonusMinutes,
  onUpgrade,
}: StatsHeroCardProps) {
  const usagePct = totalAvailable > 0 ? Math.min((minutesUsed / totalAvailable) * 100, 100) : 0
  const usageHigh = usagePct >= 80

  return (
    <div data-tour="agent-hero" className="rounded-2xl p-5 sm:p-6 card-surface">
      {/* Header row: calls on left, agent identity on right */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-3xl font-bold t1 tracking-tight">
            {totalCalls}
            <span className="text-sm font-normal t3 ml-2">
              call{totalCalls !== 1 ? 's' : ''} this month
            </span>
          </p>
          <TrendBadge value={callsTrend} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2 h-2 rounded-full ${agentStatus === 'active' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <span className="text-sm font-semibold t1">{agentName}</span>
          {isTrial ? (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              isExpired
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-amber-400'}`} />
              {isExpired ? 'Trial ended' : 'Trial'}
            </span>
          ) : (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: agentStatus === 'active' ? 'var(--color-success-tint)' : 'var(--color-warning-tint)',
                color: agentStatus === 'active' ? 'var(--color-success)' : 'var(--color-warning)',
              }}
            >
              {agentStatus === 'active' ? 'Live' : agentStatus ?? 'Unknown'}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[12px] t3">
            <span className={`font-semibold ${usageHigh ? 'text-amber-400' : 't1'}`}>{minutesUsed}</span> of {totalAvailable} minutes used
          </p>
          <p className="text-[11px] t3">{Math.round(usagePct)}%</p>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-hover)' }}>
          <div
            className={`h-full rounded-full transition-all ${usageHigh ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        {bonusMinutes > 0 && (
          <p className="text-[11px] t3 mt-1">Includes {bonusMinutes} bonus minutes</p>
        )}
        {usageHigh && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="text-[11px] font-semibold mt-2 transition-opacity hover:opacity-75"
            style={{ color: 'var(--color-warning)' }}
          >
            Get more minutes →
          </button>
        )}
      </div>
    </div>
  )
}
