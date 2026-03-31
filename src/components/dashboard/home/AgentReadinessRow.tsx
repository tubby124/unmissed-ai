'use client'

/**
 * D128/D249 — Agent Readiness Row
 * Compact 6-dimension readiness strip shown on home.
 * Dimensions: Hours, Routing (TRIAGE_DEEP), Services, FAQs, Calendar (booking mode only), Knowledge.
 * Blockers (red/amber if missing): Hours, Calendar (booking mode).
 * Enhancers (blue/gray if missing): Services, FAQs, Knowledge.
 * Shows a single "Fix this first" CTA for highest-priority incomplete item.
 * Disappears once all 5 applicable dimensions are satisfied.
 */

import Link from 'next/link'

interface Dimension {
  key: string
  label: string
  done: boolean
  count?: number
  href: string
  isBlocker: boolean
}

interface Props {
  hoursWeekday: string | null
  activeServicesCount: number
  faqCount: number
  calendarConnected: boolean
  callHandlingMode: string | null
  approvedKnowledgeCount: number
  pendingKnowledgeCount: number
  hasTriage: boolean
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function DotIcon({ isBlocker }: { isBlocker: boolean }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: isBlocker ? 'rgb(245,158,11)' : 'rgba(99,102,241,0.5)' }}
    />
  )
}

export default function AgentReadinessRow({
  hoursWeekday,
  activeServicesCount,
  faqCount,
  calendarConnected,
  callHandlingMode,
  approvedKnowledgeCount,
  pendingKnowledgeCount,
  hasTriage,
}: Props) {
  const isBookingMode = callHandlingMode === 'appointment_booking'

  const dimensions: Dimension[] = [
    {
      key: 'hours',
      label: 'Hours',
      done: !!hoursWeekday,
      href: '/dashboard/actions#hours',
      isBlocker: true,
    },
    {
      key: 'routing',
      label: 'Routing',
      done: hasTriage,
      href: '/dashboard/settings?tab=agent#call-routing',
      isBlocker: false,
    },
    {
      key: 'services',
      label: 'Services',
      done: activeServicesCount > 0,
      count: activeServicesCount > 0 ? activeServicesCount : undefined,
      href: '/dashboard/actions',
      isBlocker: false,
    },
    {
      key: 'faqs',
      label: 'FAQs',
      done: faqCount > 0,
      count: faqCount > 0 ? faqCount : undefined,
      href: '/dashboard/settings?tab=general#knowledge',
      isBlocker: false,
    },
    ...(isBookingMode ? [{
      key: 'calendar',
      label: 'Calendar',
      done: calendarConnected,
      href: '/dashboard/settings?tab=general#booking',
      isBlocker: true,
    }] : []),
    {
      key: 'knowledge',
      label: pendingKnowledgeCount > 0 ? `Review (${pendingKnowledgeCount})` : 'Knowledge',
      done: approvedKnowledgeCount > 0,
      count: approvedKnowledgeCount > 0 ? approvedKnowledgeCount : undefined,
      href: '/dashboard/settings?tab=general#knowledge',
      isBlocker: false,
    },
  ]

  const allDone = dimensions.every(d => d.done)
  if (allDone) return null

  // Highest priority incomplete item for CTA
  const firstBlocker = dimensions.find(d => d.isBlocker && !d.done)
  const firstEnhancer = dimensions.find(d => !d.isBlocker && !d.done)
  const ctaDimension = firstBlocker ?? firstEnhancer

  const ctaText: Record<string, string> = {
    hours: 'Set business hours',
    routing: 'Set up call routing',
    calendar: 'Connect Google Calendar',
    services: 'Add your services',
    faqs: 'Add FAQs',
    knowledge: pendingKnowledgeCount > 0 ? `Review ${pendingKnowledgeCount} scraped pages` : 'Add knowledge',
  }

  const doneCount = dimensions.filter(d => d.done).length

  return (
    <div
      className="rounded-2xl p-4"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Agent readiness</p>
          <span className="text-[10px] font-mono t3">{doneCount}/{dimensions.length}</span>
        </div>
        {ctaDimension && (
          <Link
            href={ctaDimension.href}
            className="text-[11px] font-semibold hover:opacity-75 transition-opacity shrink-0"
            style={{ color: ctaDimension.isBlocker ? 'rgb(245,158,11)' : 'var(--color-primary)' }}
          >
            {ctaText[ctaDimension.key] ?? 'Fix →'} →
          </Link>
        )}
      </div>

      {/* Dimension icons */}
      <div className="flex items-center gap-2 flex-wrap">
        {dimensions.map(dim => (
          <Link
            key={dim.key}
            href={dim.href}
            title={dim.done ? `${dim.label}${dim.count !== undefined ? ` (${dim.count})` : ''} — done` : `${dim.label} — not set up`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:scale-[1.03]"
            style={{
              backgroundColor: dim.done
                ? 'rgba(34,197,94,0.07)'
                : dim.isBlocker
                ? 'rgba(245,158,11,0.07)'
                : 'var(--color-hover)',
              border: `1px solid ${dim.done ? 'rgba(34,197,94,0.2)' : dim.isBlocker ? 'rgba(245,158,11,0.2)' : 'var(--color-border)'}`,
              color: dim.done ? 'rgb(34,197,94)' : dim.isBlocker ? 'rgb(245,158,11)' : 'var(--color-text-3)',
            }}
          >
            {dim.done ? (
              <CheckIcon />
            ) : (
              <DotIcon isBlocker={dim.isBlocker} />
            )}
            {dim.label}
            {dim.count !== undefined && (
              <span className="text-[10px] opacity-70">({dim.count})</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
