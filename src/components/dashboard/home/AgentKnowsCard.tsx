'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

interface Gap {
  query: string
  count: number
  last_seen: string
}

interface AgentKnowsCardProps {
  factsText: string | null
  faqCount: number
  servicesCount: number
  approvedChunkCount: number
  clientId: string | null
  /** If true, keep the empty-state copy out; still render summary line. */
  alwaysExpanded?: boolean
}

/**
 * D290 — unified "What your agent knows" surface.
 *
 * Shows Facts · FAQ · Services · KB counts + inline-collapsed Gaps section.
 * Gaps section hides entirely when N=0.
 *
 * Replaces AgentKnowledgeTile + KnowledgeInlineTile + KnowledgeSourcesTile
 * on the Overview render path.
 */
export default function AgentKnowsCard({
  factsText,
  faqCount,
  servicesCount,
  approvedChunkCount,
  clientId,
  alwaysExpanded = false,
}: AgentKnowsCardProps) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [gapsLoaded, setGapsLoaded] = useState(false)
  const [gapsExpanded, setGapsExpanded] = useState(false)

  const factCount = (factsText ?? '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .length

  const hasAnything = factCount > 0 || faqCount > 0 || servicesCount > 0 || approvedChunkCount > 0

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    fetch(`/api/dashboard/knowledge/gaps?days=30`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : { gaps: [] })
      .then(j => {
        if (cancelled) return
        setGaps(Array.isArray(j.gaps) ? j.gaps.slice(0, 10) : [])
        setGapsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setGapsLoaded(true)
      })
    return () => { cancelled = true }
  }, [clientId])

  const gapCount = gaps.length
  const showGaps = gapsLoaded && gapCount > 0

  // Empty state — binary switch, never shown alongside counts
  if (!hasAnything) {
    return (
      <div className="rounded-2xl card-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase t3">
            What your agent knows
          </p>
        </div>
        <p className="text-[13px] t2 leading-relaxed">
          Add your website or business facts so your agent can answer questions.
        </p>
        <Link
          href="/dashboard/knowledge"
          className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          Connect website →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl card-surface p-5 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase t3">
            What your agent knows
          </p>
        </div>
        <Link
          href="/dashboard/knowledge"
          className="text-[11px] font-semibold hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          View knowledge →
        </Link>
      </div>

      {/* Count pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CountPill label="Facts" count={factCount} href="/dashboard/knowledge?tab=add&source=manual" />
        <CountPill label="FAQ" count={faqCount} href="/dashboard/knowledge?tab=add&source=manual" />
        <CountPill label="Services" count={servicesCount} href="/dashboard/settings?tab=services" />
        <CountPill label="KB" count={approvedChunkCount} unit="chunk" href="/dashboard/knowledge" />
      </div>

      {/* Gaps — inline-collapsed; hidden entirely when none */}
      <AnimatePresence initial={false}>
        {showGaps && (
          <motion.div
            key="gaps"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
            className="border-t b-theme pt-3"
          >
            <button
              type="button"
              onClick={() => setGapsExpanded(x => !x)}
              aria-expanded={gapsExpanded}
              aria-controls="agent-knows-gaps-panel"
              className="flex items-center gap-2 text-left w-full rounded-lg px-1 py-1 hover:bg-hover transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/60"
            >
              <span className="text-[11px] font-semibold" style={{ color: 'rgb(251,191,36)' }}>
                ⚠ Gaps ({gapCount})
              </span>
              <span className="text-[11px] t3 truncate">
                {gapsExpanded ? 'Questions your agent couldn\'t answer' : 'Click to review'}
              </span>
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                className="ml-auto shrink-0 transition-transform duration-200"
                style={{ color: 'var(--color-text-3)', transform: gapsExpanded ? 'rotate(90deg)' : undefined }}
              >
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <AnimatePresence initial={false}>
              {gapsExpanded && (
                <motion.div
                  key="gaps-panel"
                  id="agent-knows-gaps-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                  className="mt-2"
                >
                  <ul className="space-y-1.5">
                    {gaps.slice(0, 5).map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] t2">
                        <span className="shrink-0 mt-0.5 t3 font-mono tabular-nums">
                          ×{g.count}
                        </span>
                        <span className="flex-1 truncate">&ldquo;{g.query}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                  {gapCount > 5 && (
                    <Link
                      href="/dashboard/knowledge#gaps"
                      className="inline-block mt-2 text-[11px] font-semibold hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Review {gapCount - 5} more →
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {alwaysExpanded ? null : null}
    </div>
  )
}

function CountPill({ label, count, unit, href }: { label: string; count: number; unit?: string; href: string }) {
  const isEmpty = count === 0
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl transition-colors hover:bg-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/60"
      style={{
        backgroundColor: isEmpty ? 'var(--color-bg-raised, var(--color-hover))' : 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
        border: `1px solid ${isEmpty ? 'var(--color-border)' : 'color-mix(in srgb, var(--color-primary) 15%, transparent)'}`,
        minHeight: 44,
      }}
    >
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 leading-none">
        {label}
      </span>
      <span
        className="text-[15px] font-bold leading-tight"
        style={{ color: isEmpty ? 'var(--color-text-3)' : 'var(--color-text-1)' }}
      >
        {count}
        {unit && count !== 0 && (
          <span className="text-[11px] font-normal t3 ml-1">{unit}{count !== 1 ? 's' : ''}</span>
        )}
      </span>
    </Link>
  )
}
