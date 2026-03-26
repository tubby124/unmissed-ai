'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'

interface KnowledgeEngineCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  onClientUpdate?: (updates: Partial<ClientConfig>) => void
}

interface ChunkStats {
  total: number
  approved: number
  pending: number
  rejected: number
  byType: Record<string, number>
  bySource: Record<string, number>
  sourceCount: number
  maxSources: number
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'website_scrape': return 'Website'
    case 'settings_edit': return 'Manual entries'
    case 'knowledge_doc': return 'Documents'
    case 'gap_resolution': return 'Gap answers'
    case 'manual': return 'Manual'
    case 'niche_template': return 'Template'
    case 'call_learning': return 'Call learning'
    default: return source.replace(/_/g, ' ')
  }
}

interface TestResult {
  content: string
  chunk_type: string
  source: string
  similarity: number
  rrf_score: number
  trust_tier: string
}

interface GapEntry {
  query: string
  count: number
  last_seen: string
}

interface WebsiteChunk {
  id: string
  content: string
  status: string
  trust_tier: string
  source: string
}

export default function KnowledgeEngineCard({ client, isAdmin, previewMode, onClientUpdate }: KnowledgeEngineCardProps) {
  const enabled = client.knowledge_backend === 'pgvector'
  const [stats, setStats] = useState<ChunkStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  // Toggle state
  const [toggling, setToggling] = useState(false)
  const [localEnabled, setLocalEnabled] = useState(enabled)
  const [toggleSaved, setToggleSaved] = useState(false)

  // Gaps preview state
  const [gaps, setGaps] = useState<GapEntry[]>([])
  const [gapsCount, setGapsCount] = useState(0)

  // Local FAQ state — tracks accumulated in-session saves even when onClientUpdate is a no-op
  const [localExtraQa, setLocalExtraQa] = useState<{ q: string; a: string }[]>(
    Array.isArray(client.extra_qa) ? client.extra_qa : []
  )

  // Inline gap answer state
  const [answeringGap, setAnsweringGap] = useState<string | null>(null)
  const [gapAnswer, setGapAnswer] = useState('')
  const [gapSaving, setGapSaving] = useState(false)
  const [gapError, setGapError] = useState<string | null>(null)
  const [gapSuccess, setGapSuccess] = useState<string | null>(null)

  // Test query state
  const [testQuery, setTestQuery] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [testError, setTestError] = useState('')

  // Website chunk browser state
  const [websiteChunks, setWebsiteChunks] = useState<WebsiteChunk[]>([])
  const [websiteChunksLoading, setWebsiteChunksLoading] = useState(false)
  const [showWebsiteChunks, setShowWebsiteChunks] = useState(false)
  const [chunkActioning, setChunkActioning] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      // Two parallel fetches instead of 4 sequential ones (K17)
      const [statsRes, gapsRes] = await Promise.all([
        fetch(`/api/dashboard/knowledge/stats?client_id=${client.id}`),
        fetch(`/api/dashboard/knowledge/gaps?client_id=${client.id}&days=30`),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          total: data.total ?? 0,
          approved: data.approved ?? 0,
          pending: data.pending ?? 0,
          rejected: data.rejected ?? 0,
          byType: data.byType ?? {},
          bySource: data.bySource ?? {},
          sourceCount: data.sourceCount ?? 0,
          maxSources: data.maxSources ?? 3,
        })
      }

      if (gapsRes.ok) {
        const gapsData = await gapsRes.json()
        setGaps((gapsData.gaps ?? []).slice(0, 3))
        setGapsCount(gapsData.total_unanswered_queries ?? 0)
      }
    } catch {
      // silent
    } finally {
      setStatsLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    if (localEnabled) fetchStats()
  }, [localEnabled, fetchStats])

  // L5-GAP: Listen for refresh signal from ImprovementHints (after transcript gaps are POSTed)
  useEffect(() => {
    function handleRefresh() {
      if (localEnabled) fetchStats()
    }
    window.addEventListener('knowledge-gaps-refresh', handleRefresh)
    return () => window.removeEventListener('knowledge-gaps-refresh', handleRefresh)
  }, [localEnabled, fetchStats])

  // Sync status from API response
  const [toggleSyncStatus, setToggleSyncStatus] = useState<'synced' | 'failed' | null>(null)

  async function handleToggle() {
    const newVal = !localEnabled
    setToggling(true)
    setToggleSaved(false)
    setToggleSyncStatus(null)
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
      const data = await res.json().catch(() => ({}))
      setLocalEnabled(newVal)
      setToggleSaved(true)
      setToggleSyncStatus(data.ultravox_synced === true ? 'synced' : data.ultravox_synced === false ? 'failed' : null)
      toast.success(newVal ? 'Knowledge base enabled' : 'Knowledge base disabled')
      setTimeout(() => { setToggleSaved(false); setToggleSyncStatus(null) }, 5000)
    } catch {
      toast.error('Failed to update knowledge setting')
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

  async function fetchWebsiteChunks() {
    setWebsiteChunksLoading(true)
    try {
      const res = await fetch(`/api/dashboard/knowledge/chunks?client_id=${client.id}&source=website_scrape&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setWebsiteChunks(data.chunks ?? [])
      }
    } catch { /* silent */ } finally {
      setWebsiteChunksLoading(false)
    }
  }

  async function handleChunkAction(chunkId: string, action: 'approve' | 'reject' | 'delete') {
    setChunkActioning(chunkId)
    try {
      if (action === 'delete') {
        await fetch(`/api/dashboard/knowledge/chunks?id=${chunkId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/dashboard/knowledge/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkId, action }),
        })
      }
      setWebsiteChunks(prev => action === 'delete'
        ? prev.filter(c => c.id !== chunkId)
        : prev.map(c => c.id === chunkId ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' } : c)
      )
      // Refresh stats after action
      fetchStats()
    } catch { /* silent */ } finally {
      setChunkActioning(null)
    }
  }

  async function handleAddGapAnswer(query: string, destination: 'faq' | 'knowledge') {
    if (!gapAnswer.trim()) return
    setGapSaving(true)
    setGapError(null)
    setGapSuccess(null)

    try {
      if (destination === 'faq') {
        // Add to extra_qa via settings PATCH — use localExtraQa to accumulate in-session saves
        const newQa = [...localExtraQa, { q: query, a: gapAnswer.trim() }]
        const res = await fetch('/api/dashboard/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: client.id, extra_qa: newQa }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to save FAQ' }))
          throw new Error(data.error ?? 'Failed to save FAQ')
        }
        setLocalExtraQa(newQa)
        onClientUpdate?.({ extra_qa: newQa })
      } else {
        // Add to knowledge_chunks via chunks POST
        const content = `Q: ${query}\nA: ${gapAnswer.trim()}`
        const res = await fetch('/api/dashboard/knowledge/chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: client.id,
            content,
            chunk_type: 'gap_answer',
            trust_tier: 'high',
            source: 'gap_resolution',
            auto_approve: isAdmin,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to save chunk' }))
          throw new Error(data.error ?? 'Failed to save chunk')
        }
      }

      // Mark gap as resolved
      await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          query,
          resolution_type: destination,
        }),
      })

      // Remove from local list
      setGaps(prev => prev.filter(g => g.query !== query))
      setGapsCount(prev => Math.max(0, prev - 1))
      const msg = destination === 'faq' ? 'Added as FAQ — agent will know this every call' : 'Added to knowledge base — agent will search this when relevant'
      setGapSuccess(msg)
      toast.success(msg)
      setAnsweringGap(null)
      setGapAnswer('')
      setTimeout(() => setGapSuccess(null), 4000)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save answer'
      setGapError(errMsg)
      toast.error(errMsg)
    } finally {
      setGapSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      {/* Header row — split into two siblings to avoid nested <button> (H2) */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand Knowledge Engine' : 'Collapse Knowledge Engine'}
          className="flex items-center gap-2 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Knowledge Engine</p>

          {/* Status badge */}
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
            localEnabled
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-hover t3 border b-theme'
          }`}>
            {localEnabled ? 'active' : 'off'}
          </span>

          {/* Chunk count badge */}
          {localEnabled && stats && !statsLoading && (
            <span className="text-[9px] font-mono t3 tabular-nums">
              {stats.approved} chunk{stats.approved !== 1 ? 's' : ''}
              {stats.pending > 0 && (
                <span className="text-amber-400"> + {stats.pending} pending</span>
              )}
            </span>
          )}

          {/* Uploaded doc count badge — only when docs exist or at limit */}
          {localEnabled && stats && !statsLoading && (stats.sourceCount > 0 || stats.sourceCount >= stats.maxSources) && (
            <span className={`text-[9px] font-mono tabular-nums ${
              stats.sourceCount >= stats.maxSources ? 'text-amber-400' : 't3'
            }`}>
              {stats.sourceCount}/{stats.maxSources} doc{stats.maxSources !== 1 ? 's' : ''}
            </span>
          )}

          {/* Gaps badge */}
          {localEnabled && gapsCount > 0 && !statsLoading && (
            <span className="text-[9px] font-mono text-amber-400/70 tabular-nums">
              {gapsCount} gap{gapsCount !== 1 ? 's' : ''}
            </span>
          )}

          {toggleSaved && (
            <span className={`text-[10px] ${toggleSyncStatus === 'failed' ? 'text-amber-400' : 'text-green-400'}`}>
              {toggleSyncStatus === 'synced'
                ? '\u2713 Tool updated'
                : toggleSyncStatus === 'failed'
                ? '\u26A0 Saved'
                : '\u2713 Saved'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 ml-2 shrink-0">
          {/* Admin toggle — sibling of collapse button, not nested inside it */}
          {isAdmin && (
            <PremiumToggle
              checked={localEnabled}
              onChange={async () => { await handleToggle() }}
              disabled={toggling || previewMode}
            />
          )}

          {/* Collapse chevron — separate button */}
          <button
            onClick={() => setCollapsed(v => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              className={`t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Description when collapsed */}
      {collapsed && (
        <p className="text-[11px] t3 mt-1 ml-5">
          {localEnabled
            ? `Agent searches ${stats?.approved ?? '...'} knowledge chunks during calls for detailed answers.`
            : 'Enable to let the agent search embedded knowledge during calls.'}
        </p>
      )}

      {/* Toggle sync detail */}
      {toggleSaved && toggleSyncStatus === 'synced' && (
        <p className="text-[10px] text-green-400/70 mt-1.5 ml-5">
          {localEnabled
            ? 'queryKnowledge tool registered on agent — searches active on next call'
            : 'queryKnowledge tool removed from agent — searches disabled'}
        </p>
      )}
      {toggleSaved && toggleSyncStatus === 'failed' && (
        <p className="text-[10px] text-amber-400/70 mt-1.5 ml-5">
          Saved to DB but agent sync failed — tool change may not take effect until next deploy
        </p>
      )}

      {/* Knowledge layer explainer (8b) */}
      {localEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/[0.04] border border-purple-500/15 mt-3 ml-0">
          <span className="w-2 h-2 rounded-full bg-purple-400/80 shrink-0" />
          <p className="text-[10px] t2 leading-relaxed">
            <span className="font-semibold text-purple-400/90">Searched when needed</span>
            {' '}&mdash; your agent only searches this during a call when the question is relevant. Not loaded every call.
          </p>
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && localEnabled && (
        <div className="mt-4 space-y-4">
          {/* Current knowledge sources — what types of content are actually present */}
          {stats && Object.keys(stats.bySource).length > 0 && (
            <div className="px-3 py-2.5 rounded-xl border b-theme bg-hover space-y-2">
              <p className="text-[10px] font-semibold t3">Current sources</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <span key={src} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/[0.07] border border-purple-500/15 text-[9px] text-purple-300/90">
                      {sourceLabel(src)}
                      <span className="text-purple-400/50 font-mono">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Uploaded document limit — separate from source types above */}
          {stats && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
              stats.sourceCount >= stats.maxSources
                ? 'border-amber-500/25 bg-amber-500/[0.06]'
                : 'b-theme bg-hover'
            }`}>
              <span className="text-[11px] t2">
                Uploaded documents: <span className="font-semibold t1">{stats.sourceCount}</span>
                <span className="t3"> / {stats.maxSources}</span>
              </span>
              {stats.sourceCount >= stats.maxSources && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const res = await fetch('/api/billing/upgrade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId: client.id, planId: 'pro', billing: 'monthly' }),
                      })
                      const data = await res.json()
                      if (data.url) window.location.href = data.url
                    } catch { /* silent */ }
                  }}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  Upgrade for more
                </button>
              )}
            </div>
          )}

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

          {/* Website chunk browser */}
          {stats && (stats.bySource.website_scrape ?? 0) > 0 && (
            <div className="rounded-xl border b-theme p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold t3">Website Content</p>
                <button
                  onClick={() => {
                    const next = !showWebsiteChunks
                    setShowWebsiteChunks(next)
                    if (next && websiteChunks.length === 0) fetchWebsiteChunks()
                  }}
                  className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors focus-visible:outline-none"
                >
                  {showWebsiteChunks ? 'Hide' : `View ${stats.bySource.website_scrape} chunk${stats.bySource.website_scrape !== 1 ? 's' : ''}`}
                </button>
              </div>

              {showWebsiteChunks && (
                <div className="space-y-2">
                  {websiteChunksLoading ? (
                    <div className="flex items-center gap-2 text-[11px] t3">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading...
                    </div>
                  ) : websiteChunks.length === 0 ? (
                    <p className="text-[10px] t3">No website chunks found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {websiteChunks.map((chunk) => (
                        <div key={chunk.id} className="rounded-lg border b-theme p-2 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] t2 leading-relaxed flex-1 line-clamp-2">
                              {chunk.content.length > 140 ? chunk.content.slice(0, 140) + '…' : chunk.content}
                            </p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                              chunk.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : chunk.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {chunk.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {chunk.status !== 'approved' && (
                              <button
                                onClick={() => handleChunkAction(chunk.id, 'approve')}
                                disabled={chunkActioning === chunk.id}
                                className="text-[9px] font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition-colors focus-visible:outline-none cursor-pointer"
                              >
                                ✓ Approve
                              </button>
                            )}
                            {chunk.status !== 'rejected' && (
                              <button
                                onClick={() => handleChunkAction(chunk.id, 'reject')}
                                disabled={chunkActioning === chunk.id}
                                className="text-[9px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition-colors focus-visible:outline-none cursor-pointer"
                              >
                                ✗ Reject
                              </button>
                            )}
                            <button
                              onClick={() => handleChunkAction(chunk.id, 'delete')}
                              disabled={chunkActioning === chunk.id}
                              className="text-[9px] font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors focus-visible:outline-none cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent gaps — unanswered caller questions */}
          {(gaps.length > 0 || gapSuccess) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-amber-400">Unanswered Questions</p>
                {gapsCount > 0 && (
                  <span className="text-[9px] font-mono text-amber-400/60">{gapsCount} total</span>
                )}
              </div>

              {gapSuccess && (
                <p className="text-[10px] text-green-400" aria-live="polite">{gapSuccess}</p>
              )}

              <div className="space-y-1.5">
                {gaps.map((gap) => (
                  <div key={gap.query}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] t2 leading-relaxed line-clamp-1 flex-1">&ldquo;{gap.query}&rdquo;</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-mono ${gap.count >= 3 ? 'text-red-400' : gap.count >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {gap.count}x
                        </span>
                        {gap.count >= 3 && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 whitespace-nowrap">
                            Add as FAQ
                          </span>
                        )}
                        {!previewMode && (
                          <button
                            onClick={() => {
                              setAnsweringGap(answeringGap === gap.query ? null : gap.query)
                              setGapAnswer('')
                              setGapError(null)
                            }}
                            className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                          >
                            {answeringGap === gap.query ? 'Cancel' : 'Add Answer'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline answer form */}
                    {answeringGap === gap.query && (
                      <div className="mt-2 ml-2 space-y-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.03] p-2.5">
                        <p className="text-[10px] t3">
                          Teach your agent the answer to: &ldquo;{gap.query}&rdquo;
                        </p>
                        <textarea
                          value={gapAnswer}
                          onChange={e => setGapAnswer(e.target.value)}
                          placeholder="Type the answer..."
                          rows={2}
                          className="w-full bg-transparent border b-theme rounded-lg px-2.5 py-1.5 text-xs t1 placeholder:t3 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                        {gapError && (
                          <p className="text-[10px] text-red-400">{gapError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddGapAnswer(gap.query, 'faq')}
                            disabled={gapSaving || !gapAnswer.trim()}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                            title="Injected into every call — best for frequently asked questions"
                          >
                            {gapSaving ? '...' : 'Add as FAQ'}
                            <span className="block text-[10px] font-normal opacity-70">Always knows</span>
                          </button>
                          <button
                            onClick={() => handleAddGapAnswer(gap.query, 'knowledge')}
                            disabled={gapSaving || !gapAnswer.trim()}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                            title="Searched via RAG when relevant — best for detailed or rare questions"
                          >
                            {gapSaving ? '...' : 'Add to Knowledge'}
                            <span className="block text-[10px] font-normal opacity-70">Searched when needed</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {gaps.length > 0 && !answeringGap && (
                <p className="text-[9px] t3">Click &ldquo;Add Answer&rdquo; to teach your agent. FAQ = every call. Knowledge = searched when relevant.</p>
              )}
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
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
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
                  testResults.slice(0, 3).map((result) => (
                    <div key={`${result.source}-${result.chunk_type}-${(result.similarity * 10000).toFixed(0)}`} className="rounded-lg border b-theme p-2 space-y-1">
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
              className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              {toggling ? 'Enabling...' : 'Enable Knowledge Engine'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
