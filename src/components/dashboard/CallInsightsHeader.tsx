'use client'

/**
 * CallInsightsHeader — Grounded call metrics summary bar.
 *
 * Shows only data with explicit source-of-truth, never inference.
 * When data is insufficient, shows "Not enough data" instead of guessing.
 *
 * Source-of-truth rules (from Phase D plan):
 * - Call count: call_logs count this month → exact
 * - Avg quality: call_logs.quality_score avg → exact if >5 calls, else "Not enough data"
 * - Knowledge coverage: approved / total chunks → exact if chunks exist
 */

interface CallInsightsHeaderProps {
  totalCalls: number
  avgQuality: number | null
  knowledgeCoverage: number | null  // 0-100 or null when no knowledge
  openGaps: number
}

export function CallInsightsHeader({
  totalCalls,
  avgQuality,
  knowledgeCoverage,
  openGaps,
}: CallInsightsHeaderProps) {
  // Don't render if there's literally no data
  if (totalCalls === 0 && knowledgeCoverage === null && openGaps === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCell
        label="Calls this month"
        value={totalCalls.toString()}
        subtext={null}
      />
      <MetricCell
        label="Avg quality"
        value={avgQuality !== null && totalCalls >= 5
          ? `${avgQuality}/10`
          : null}
        subtext={totalCalls < 5 ? 'Not enough data' : null}
      />
      <MetricCell
        label="Knowledge coverage"
        value={knowledgeCoverage !== null ? `${knowledgeCoverage}%` : null}
        subtext={knowledgeCoverage === null ? 'No knowledge added' : null}
      />
      <MetricCell
        label="Unanswered questions"
        value={openGaps.toString()}
        subtext={openGaps > 0 ? 'Review in Knowledge tab' : null}
        alert={openGaps > 3}
      />
    </div>
  )
}

function MetricCell({
  label,
  value,
  subtext,
  alert,
}: {
  label: string
  value: string | null
  subtext: string | null
  alert?: boolean
}) {
  return (
    <div className="rounded-xl px-3 py-3 card-surface">
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-3)' }}>
        {label}
      </p>
      {value ? (
        <p
          className="text-lg font-semibold mt-0.5"
          style={{ color: alert ? 'rgb(239,68,68)' : 'var(--color-text-1)' }}
        >
          {value}
        </p>
      ) : (
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>
          {subtext ?? '—'}
        </p>
      )}
      {value && subtext && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
          {subtext}
        </p>
      )}
    </div>
  )
}
