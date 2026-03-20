'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface KnowledgeEngineCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

interface ChunkStats {
  total: number
  approved: number
  pending: number
  rejected: number
  byType: Record<string, number>
}

interface TestResult {
  content: string
  chunk_type: string
  source: string
  similarity: number
  rrf_score: number
  trust_tier: string
}

export default function KnowledgeEngineCard({ client, isAdmin, previewMode }: KnowledgeEngineCardProps) {
  const enabled = client.knowledge_backend === 'pgvector'
  const [stats, setStats] = useState<ChunkStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  // Toggle state
  const [toggling, setToggling] = useState(false)
  const [localEnabled, setLocalEnabled] = useState(enabled)
  const [toggleSaved, setToggleSaved] = useState(false)

  // Test query state
  const [testQuery, setTestQuery] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [testError, setTestError] = useState('')

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/dashboard/knowledge/chunks?client_id=${client.id}&limit=1`)
      if (!res.ok) return
      const data = await res.json()
      // The chunks endpoint returns { chunks, total, ... } — total is the full count
      // We need to fetch counts per status. Use separate calls or estimate from the response.
      // For now, use total from the response and fetch status breakdown.
      const totalCount = data.total ?? 0

      // Fetch approved count
      const approvedRes = await fetch(`/api/dashboard/knowledge/chunks?client_id=${client.id}&status=approved&limit=1`)
      const approvedData = approvedRes.ok ? await approvedRes.json() : { total: 0 }

      const pendingRes = await fetch(`/api/dashboard/knowledge/chunks?client_id=${client.id}&status=pending&limit=1`)
      const pendingData = pendingRes.ok ? await pendingRes.json() : { total: 0 }

      setStats({
        total: totalCount,
        approved: approvedData.total ?? 0,
        pending: pendingData.total ?? 0,
        rejected: totalCount - (approvedData.total ?? 0) - (pendingData.total ?? 0),
        byType: {},
      })
    } catch {
      // silent
    } finally {
      setStatsLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    if (localEnabled) fetchStats()
  }, [localEnabled, fetchStats])

  async function handleToggle() {
    const newVal = !localEnabled
    setToggling(true)
    setToggleSaved(false)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          knowledge_backend: newVal ? 'pgvector' : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setLocalEnabled(newVal)
      setToggleSaved(true)
      setTimeout(() => setToggleSaved(false), 3000)
    } catch {
      // revert on failure
    } finally {
      setToggling(false)
    }
  }

  async function handleTestQuery() {
    if (!testQuery.trim()) return
    setTestLoading(true)
    setTestError('')
    setTestResults(null)
    try {
      const res = await fetch('/api/dashboard/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, query: testQuery.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Query failed' }))
        throw new Error(err.error ?? 'Query failed')
      }
      const data = await res.json()
      setTestResults(data.results ?? [])
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Query failed')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      {/* Header row */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Knowledge Engine</p>

          {/* Status badge */}
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
            localEnabled
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-zinc-500/10 t3 border border-zinc-500/20'
          }`}>
            {localEnabled ? 'active' : 'off'}
          </span>

          {/* Chunk count badge */}
          {localEnabled && stats && !statsLoading && (
            <span className="text-[9px] font-mono t3">
              {stats.approved} chunk{stats.approved !== 1 ? 's' : ''}
              {stats.pending > 0 && (
                <span className="text-amber-400"> + {stats.pending} pending</span>
              )}
            </span>
          )}

          {toggleSaved && <span className="text-[10px] text-green-400">Saved</span>}
        </div>

        <div className="flex items-center gap-3">
          {/* Admin toggle */}
          {isAdmin && (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                await handleToggle()
              }}
              disabled={toggling || previewMode}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                localEnabled ? 'bg-blue-500' : 'bg-zinc-700'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                localEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          )}

          {/* Collapse chevron */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Description when collapsed */}
      {collapsed && (
        <p className="text-[11px] t3 mt-1 ml-5">
          {localEnabled
            ? `Agent searches ${stats?.approved ?? '...'} knowledge chunks during calls for detailed answers.`
            : 'Enable to let the agent search embedded knowledge during calls.'}
        </p>
      )}

      {/* Expanded content */}
      {!collapsed && localEnabled && (
        <div className="mt-4 space-y-4">
          {/* Stats grid */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border b-theme p-3 text-center">
                <p className="text-lg font-semibold t1">{stats.approved}</p>
                <p className="text-[10px] text-green-400">Approved</p>
              </div>
              <div className="rounded-xl border b-theme p-3 text-center">
                <p className="text-lg font-semibold t1">{stats.pending}</p>
                <p className="text-[10px] text-amber-400">Pending</p>
              </div>
              <div className="rounded-xl border b-theme p-3 text-center">
                <p className="text-lg font-semibold t1">{stats.rejected}</p>
                <p className="text-[10px] text-red-400">Rejected</p>
              </div>
            </div>
          )}

          {statsLoading && (
            <div className="flex items-center gap-2 text-[11px] t3">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading stats...
            </div>
          )}

          {/* Quick test query */}
          <div className="rounded-xl border b-theme p-3 space-y-2">
            <p className="text-[10px] font-semibold t3">Quick Test</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent border b-theme rounded-lg px-2.5 py-1.5 text-xs t1 placeholder:t3 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleTestQuery}
                disabled={testLoading || !testQuery.trim() || previewMode}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                {testLoading ? '...' : 'Search'}
              </button>
            </div>

            {testError && (
              <p className="text-[10px] text-red-400">{testError}</p>
            )}

            {testResults !== null && (
              <div className="space-y-1.5">
                {testResults.length === 0 ? (
                  <p className="text-[10px] t3">No matching chunks. Agent would say it's not sure.</p>
                ) : (
                  testResults.slice(0, 3).map((result, i) => (
                    <div key={i} className="rounded-lg border b-theme p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          result.trust_tier === 'high' ? 'bg-green-400/10 text-green-400'
                            : result.trust_tier === 'low' ? 'bg-red-400/10 text-red-400'
                            : 'bg-amber-400/10 text-amber-400'
                        }`}>
                          {result.trust_tier}
                        </span>
                        <span className={`text-[9px] font-mono ${
                          result.similarity >= 0.7 ? 'text-green-400' : result.similarity >= 0.4 ? 'text-amber-400' : 'text-zinc-500'
                        }`}>
                          {(result.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[11px] t2 leading-relaxed line-clamp-2">{result.content}</p>
                    </div>
                  ))
                )}
                {testResults.length > 3 && (
                  <p className="text-[10px] t3">+{testResults.length - 3} more — see full results in Knowledge tab.</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation hint */}
          <p className="text-[10px] t3">
            Manage chunks, approve suggestions, and run full searches in the <span className="font-medium t2">Knowledge</span> tab.
          </p>
        </div>
      )}

      {/* Expanded when disabled */}
      {!collapsed && !localEnabled && (
        <div className="mt-4">
          <p className="text-[11px] t3">
            When enabled, your agent can search through embedded knowledge chunks during calls to answer detailed questions.
            Knowledge is added via website scraping, manual entry, or bulk import.
          </p>
          {isAdmin && (
            <button
              onClick={handleToggle}
              disabled={toggling || previewMode}
              className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
            >
              {toggling ? 'Enabling...' : 'Enable Knowledge Engine'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
