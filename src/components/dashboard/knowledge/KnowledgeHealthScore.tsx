'use client'

/* -------------------------------------------------------------------------- */
/*  Knowledge Health Score                                                     */
/*  Weighted composite score for agent knowledge completeness.                */
/*  Spec: CALLINGAGENTS/Architecture/Phase6-Wave2-Knowledge-Page.md (D310)    */
/* -------------------------------------------------------------------------- */

interface KnowledgeHealthScoreProps {
  factsCount: number
  faqsCount: number
  approvedChunkCount: number
  niche: string | null
  hasHours: boolean
  hasPricing: boolean
  hasServices: boolean
  hasLocation: boolean
  hasFaqs: boolean
  totalItems: number
  staleItemCount: number
  connectedSources: number
  unansweredCount: number
  answeredCount: number
}

/* ---- Niche targets ------------------------------------------------------- */

const NICHE_TARGETS: Record<string, number> = {
  auto_glass: 50,
  plumbing: 40,
  property_mgmt: 60,
  real_estate: 80,
  restaurant: 40,
}
const DEFAULT_NICHE_TARGET = 30

function nicheTarget(niche: string | null): number {
  if (!niche) return DEFAULT_NICHE_TARGET
  return NICHE_TARGETS[niche] ?? DEFAULT_NICHE_TARGET
}

/* ---- Dimension names ----------------------------------------------------- */

const DIMENSION_LABELS: Record<string, string> = {
  completeness: 'Completeness',
  coverage: 'Coverage',
  freshness: 'Freshness',
  sources: 'Sources',
  resolution: 'Resolution',
}

/* ---- Score computation (exported for reuse) ------------------------------ */

export function computeHealthScore(props: KnowledgeHealthScoreProps): {
  score: number
  dimensions: Record<string, number>
  lowestDimension: string
} {
  const target = nicheTarget(props.niche)

  const completeness = Math.min(
    1,
    (props.factsCount + props.faqsCount + props.approvedChunkCount) / target,
  )

  const coverageBools = [
    props.hasHours,
    props.hasPricing,
    props.hasServices,
    props.hasLocation,
    props.hasFaqs,
  ]
  const coverage = coverageBools.filter(Boolean).length / 5

  const freshness =
    props.totalItems > 0 ? 1 - props.staleItemCount / props.totalItems : 0

  const sources = Math.min(1, props.connectedSources / 4)

  const totalQuestions = props.unansweredCount + props.answeredCount
  const resolution = totalQuestions > 0
    ? 1 - props.unansweredCount / totalQuestions
    : 1

  const dimensions: Record<string, number> = {
    completeness,
    coverage,
    freshness,
    sources,
    resolution,
  }

  const score = Math.max(0, Math.min(100, Math.round(
    (completeness * 0.35 +
     coverage * 0.25 +
     freshness * 0.20 +
     sources * 0.15 +
     resolution * 0.05) * 100,
  )))

  // Find lowest
  let lowestDimension = 'completeness'
  let lowestValue = Infinity
  for (const [key, val] of Object.entries(dimensions)) {
    if (val < lowestValue) {
      lowestValue = val
      lowestDimension = key
    }
  }

  return { score, dimensions, lowestDimension }
}

/* ---- Color helpers ------------------------------------------------------- */

function scoreColor(score: number): string {
  if (score < 40) return 'rgb(239,68,68)'
  if (score <= 70) return 'rgb(245,158,11)'
  return 'rgb(34,197,94)'
}

function scoreLabel(score: number): string {
  if (score < 25) return 'Getting started'
  if (score < 50) return 'Building up'
  if (score < 70) return 'Good'
  if (score < 85) return 'Strong'
  return 'Excellent'
}

/* ---- CTA builder --------------------------------------------------------- */

function buildCta(
  props: KnowledgeHealthScoreProps,
  lowestDimension: string,
): string {
  switch (lowestDimension) {
    case 'completeness': {
      const target = nicheTarget(props.niche)
      return `Add more facts and FAQs to reach ${target}`
    }
    case 'coverage': {
      const missing: string[] = []
      if (!props.hasHours) missing.push('hours')
      if (!props.hasPricing) missing.push('pricing')
      if (!props.hasServices) missing.push('services')
      if (!props.hasLocation) missing.push('location')
      if (!props.hasFaqs) missing.push('FAQs')
      return `Fill in missing info: ${missing.join(', ')}`
    }
    case 'freshness':
      return `Review ${props.staleItemCount} items that haven't been updated in 90+ days`
    case 'sources':
      return 'Connect more sources \u2014 website, Google, documents'
    case 'resolution':
      return `Answer ${props.unansweredCount} caller questions to improve your score`
    default:
      return 'Keep adding knowledge to strengthen your agent'
  }
}

/* ---- Component ----------------------------------------------------------- */

export default function KnowledgeHealthScore(
  props: KnowledgeHealthScoreProps,
) {
  const { score, dimensions, lowestDimension } = computeHealthScore(props)
  const color = scoreColor(score)
  const label = scoreLabel(score)
  const cta = buildCta(props, lowestDimension)

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="p-5">
        {/* Top row: score badge + progress bar + label */}
        <div className="flex items-center gap-4">
          {/* Score number */}
          <span
            className="text-3xl font-bold tabular-nums leading-none shrink-0"
            style={{ color }}
          >
            {score}
          </span>

          {/* Right side: label + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1.5">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-1)' }}
              >
                {label}
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: 'var(--color-text-3)' }}
              >
                {score}/100
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-hover)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        </div>

        {/* Stats line */}
        <p
          className="mt-3 text-[11px] tabular-nums"
          style={{ color: 'var(--color-text-3)' }}
        >
          <span style={{ color: 'var(--color-text-2)' }}>
            {'\u2713'} {props.approvedChunkCount} chunks indexed
          </span>
          {' \u00b7 '}
          {props.faqsCount} FAQs
          {props.unansweredCount > 0 && (
            <>
              {' \u00b7 '}
              <span style={{ color: 'rgb(245,158,11)' }}>
                {'\u26a0'} {props.unansweredCount} unanswered
              </span>
            </>
          )}
        </p>

        {/* CTA */}
        <p
          className="mt-2 text-[12px]"
          style={{ color: 'var(--color-text-2)' }}
        >
          {'\u2192'} {cta}
        </p>

        {/* Dimension breakdown */}
        <div className="mt-4 space-y-2">
          {Object.entries(dimensions).map(([key, value]) => {
            const dimPct = Math.round(value * 100)
            const dimColor = scoreColor(dimPct)
            const isLowest = key === lowestDimension

            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="text-[11px] w-[88px] shrink-0"
                  style={{
                    color: isLowest
                      ? 'var(--color-text-1)'
                      : 'var(--color-text-3)',
                    fontWeight: isLowest ? 500 : 400,
                  }}
                >
                  {DIMENSION_LABELS[key]}
                </span>

                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--color-hover)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${dimPct}%`,
                      backgroundColor: dimColor,
                    }}
                  />
                </div>

                <span
                  className="text-[10px] tabular-nums w-7 text-right shrink-0"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  {dimPct}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
