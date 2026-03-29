'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { knowledgeRoutes } from '@/lib/dashboard-routes'

interface StatsResponse {
  approved: number
  pending: number
  bySource: Record<string, number>
  coverage: number | null
}

interface SourceDef {
  id: string
  label: string
  sources: string[]
  actionHref: string
  icon: React.ReactNode
}

const SOURCE_DEFS: SourceDef[] = [
  {
    id: 'website',
    label: 'Website',
    sources: ['website_scrape'],
    actionHref: knowledgeRoutes.add('website'),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'manual',
    label: 'Facts & Q&A',
    sources: ['settings_edit'],
    actionHref: knowledgeRoutes.add('manual'),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text Imports',
    sources: ['bulk_import', 'dashboard_manual', 'manual', 'manual_text'],
    actionHref: knowledgeRoutes.add('text'),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M9 12h6M9 16h6M9 8h6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'ai_compiler',
    label: 'AI Compiler',
    sources: ['compiled_import'],
    actionHref: knowledgeRoutes.add('text'),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'docs',
    label: 'Documents',
    sources: ['knowledge_doc'],
    actionHref: knowledgeRoutes.browse(),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'gbp',
    label: 'Google Profile',
    sources: ['gbp'],
    actionHref: knowledgeRoutes.browse(),
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function KnowledgeSourceRegistry({
  clientId,
}: {
  clientId: string
}) {
  const [stats, setStats] = useState<StatsResponse | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/knowledge/stats?client_id=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data) })
      .catch(() => {})
  }, [clientId])

  const bySource = stats?.bySource ?? {}

  const entries = SOURCE_DEFS.map(def => {
    const count = def.sources.reduce((sum, s) => sum + (bySource[s] ?? 0), 0)
    return { ...def, count }
  })

  const activeCount = entries.filter(e => e.count > 0).length
  const totalApproved = stats?.approved ?? 0

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Knowledge Sources</p>
        </div>
        {totalApproved > 0 && (
          <span className="text-[10px] font-mono t3">
            {totalApproved} chunk{totalApproved !== 1 ? 's' : ''} live
            {stats?.coverage != null && (
              <span className="ml-1.5 text-blue-400/70">{stats.coverage}% coverage</span>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {entries.map(entry => {
          const isActive = entry.count > 0
          return (
            <Link
              key={entry.id}
              href={entry.actionHref}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors hover:border-blue-500/30 hover:bg-blue-500/[0.03] ${
                isActive
                  ? 'border-green-500/20 bg-green-500/[0.04]'
                  : 'b-theme bg-surface'
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${isActive ? 'text-green-400' : 't3'}`}>
                {entry.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${isActive ? 't1' : 't2'}`}>
                  {entry.label}
                </p>
                {isActive ? (
                  <p className="text-[10px] text-green-400/70 truncate">
                    {entry.count} chunk{entry.count !== 1 ? 's' : ''} active
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-400/70 truncate">Not added yet</p>
                )}
              </div>
              {!isActive && activeCount < SOURCE_DEFS.length && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="t3 mt-1 shrink-0">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
              {isActive && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="t3 mt-1 shrink-0">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Link>
          )
        })}
      </div>

      {activeCount === 0 && (
        <p className="mt-3 text-[10px] t3 text-center">
          No knowledge sources added yet — pick one above to get started.
        </p>
      )}
    </div>
  )
}
