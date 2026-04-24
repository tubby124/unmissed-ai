'use client'

import Link from 'next/link'

interface AgentRoutesOnCardProps {
  nicheCustomVariables: Record<string, string> | null
  /** True when onboarding has not been fully completed. Drives the empty-state CTA. */
  onboardingIncomplete?: boolean
}

const SAFETY_LIMIT = 90
const OPENING_LIMIT = 140

/**
 * D341 — read-only preview of routing variables on the Overview.
 *
 * Canonical edit surface lives in Settings > Agent tab (PromptVariablesCard).
 * This card surfaces GREETING_LINE / URGENCY_KEYWORDS / FORBIDDEN_EXTRA / CLOSE_PERSON
 * with deep links back into Settings. No save path here by design — avoids
 * duplicate edit surfaces, per D341 decision.
 */
export default function AgentRoutesOnCard({
  nicheCustomVariables,
  onboardingIncomplete = false,
}: AgentRoutesOnCardProps) {
  const vars = nicheCustomVariables ?? {}
  const greeting  = (vars.GREETING_LINE ?? '').trim()
  const urgency   = (vars.URGENCY_KEYWORDS ?? '').trim()
  const forbidden = (vars.FORBIDDEN_EXTRA ?? '').trim()
  const closePerson = (vars.CLOSE_PERSON ?? '').trim()

  const hasAny = !!(greeting || urgency || forbidden || closePerson)

  if (!hasAny) {
    return (
      <div className="rounded-2xl card-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <SwitchIcon />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase t3">
            What your agent routes on
          </p>
        </div>
        <p className="text-[13px] t2 leading-relaxed">
          Your agent&apos;s routing rules will show here after onboarding.
        </p>
        {onboardingIncomplete ? (
          <Link
            href="/onboard"
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Complete setup →
          </Link>
        ) : (
          <Link
            href="/dashboard/settings?tab=agent#variables"
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Edit in Settings →
          </Link>
        )}
      </div>
    )
  }

  const urgencyChips = urgency
    ? urgency.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 10)
    : []

  return (
    <div className="rounded-2xl card-surface p-5 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SwitchIcon />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase t3">
            What your agent routes on
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=agent#variables"
          className="text-[11px] font-semibold hover:opacity-80 transition-opacity focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/60 rounded"
          style={{ color: 'var(--color-primary)' }}
        >
          Edit in Settings →
        </Link>
      </div>

      {/* Rows — four labeled sections */}
      <div className="space-y-2.5">
        <RouteRow
          label="Opening line"
          value={greeting ? truncate(greeting, OPENING_LIMIT) : 'Using niche default'}
          empty={!greeting}
          href="/dashboard/settings?tab=agent#greeting"
        />

        <div>
          <RouteRow
            label="Urgency triggers"
            value={urgencyChips.length === 0 ? 'None configured — using niche default' : null}
            empty={urgencyChips.length === 0}
            href="/dashboard/settings?tab=agent#urgency"
          >
            {urgencyChips.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {urgencyChips.map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{
                      backgroundColor: 'color-mix(in srgb, rgb(239,68,68) 8%, transparent)',
                      color: 'rgb(248,113,113)',
                      border: '1px solid color-mix(in srgb, rgb(239,68,68) 18%, transparent)',
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </RouteRow>
        </div>

        <RouteRow
          label="Safety rules"
          value={forbidden ? truncate(forbidden, SAFETY_LIMIT) : 'Using niche default'}
          empty={!forbidden}
          href="/dashboard/settings?tab=agent#safety"
        />

        <RouteRow
          label="Close person"
          value={closePerson || 'Using niche default'}
          empty={!closePerson}
          href="/dashboard/settings?tab=agent#close-person"
        />
      </div>
    </div>
  )
}

function RouteRow({
  label,
  value,
  href,
  empty,
  children,
}: {
  label: string
  value: string | null
  href: string
  empty?: boolean
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl px-3 py-2 transition-colors hover:bg-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/60"
      style={{ minHeight: 44 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 leading-none mb-1">
            {label}
          </p>
          {value !== null && (
            <p
              className="text-[13px] leading-snug"
              style={{ color: empty ? 'var(--color-text-3)' : 'var(--color-text-1)' }}
            >
              {value}
            </p>
          )}
          {children}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-1" style={{ color: 'var(--color-text-3)' }}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}

function SwitchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
      <path d="M8 3v4m0 0a4 4 0 018 0V7m-8 0a4 4 0 01-8 0M16 7a4 4 0 008 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="15" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function truncate(s: string, limit: number): string {
  const clean = s.trim()
  if (clean.length <= limit) return clean
  return clean.slice(0, limit - 1).trimEnd() + '…'
}
