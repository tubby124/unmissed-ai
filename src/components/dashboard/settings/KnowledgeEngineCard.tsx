'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'
import ChunkBrowserSection from './knowledge/ChunkBrowserSection'
import GapAnswerSection from './knowledge/GapAnswerSection'
import TestQuerySection from './knowledge/TestQuerySection'
import { sourceLabel } from './knowledge/ChunkBrowserSection'
import FieldSyncStatusChip from './FieldSyncStatusChip'
import { recordFieldSyncStatus, type FieldSyncEntry } from './usePatchSettings'

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

interface GapEntry {
  query: string
  count: number
  last_seen: string
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
  const [toggleSyncStatus, setToggleSyncStatus] = useState<'synced' | 'failed' | null>(null)

  // Gaps state (managed here so the header badge stays in sync)
  const [gaps, setGaps] = useState<GapEntry[]>([])
  const [gapsCount, setGapsCount] = useState(0)

  const pathname = usePathname()

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
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
    } catch { /* silent */ } finally {
      setStatsLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    if (localEnabled) fetchStats()
  }, [localEnabled, fetchStats])

  // L5-GAP: refresh gaps after transcript gap posts
  useEffect(() => {
    function handleRefresh() { if (localEnabled) fetchStats() }
    window.addEventListener('knowledge-gaps-refresh', handleRefresh)
    return () => window.removeEventListener('knowledge-gaps-refresh', handleRefresh)
  }, [localEnabled, fetchStats])

  async function handleToggle() {
    const newVal = !localEnabled
    setToggling(true)
    setToggleSaved(false)
    setToggleSyncStatus(null)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, knowledge_backend: newVal ? 'pgvector' : null }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json().catch(() => ({}))
      const entry = (data.field_sync_status as Record<string, FieldSyncEntry> | undefined)?.knowledge_backend
      if (entry) recordFieldSyncStatus(client.id, 'knowledge_backend', entry)
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

  async function retryKnowledgeSync(_fieldKey: string, currentValue: unknown) {
    const value = currentValue === 'pgvector' ? 'pgvector' : null
    setToggling(true)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, knowledge_backend: value }),
      })
      if (!res.ok) throw new Error('Failed to retry')
      const data = await res.json().catch(() => ({}))
      const entry = (data.field_sync_status as Record<string, FieldSyncEntry> | undefined)?.knowledge_backend
      if (entry) recordFieldSyncStatus(client.id, 'knowledge_backend', entry)
      setToggleSaved(true)
      setToggleSyncStatus(data.ultravox_synced === true ? 'synced' : data.ultravox_synced === false ? 'failed' : null)
    } catch {
      toast.error('Failed to retry knowledge sync')
    } finally {
      setToggling(false)
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

          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
            localEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-hover t3 border b-theme'
          }`}>
            {localEnabled ? 'active' : 'off'}
          </span>

          {localEnabled && stats && !statsLoading && (
            <span className="text-[9px] font-mono t3 tabular-nums">
              {stats.approved} chunk{stats.approved !== 1 ? 's' : ''}
              {stats.pending > 0 && <span className="text-amber-400"> + {stats.pending} pending</span>}
            </span>
          )}

          {localEnabled && stats && !statsLoading && (stats.sourceCount > 0 || stats.sourceCount >= stats.maxSources) && (
            <span className={`text-[9px] font-mono tabular-nums ${stats.sourceCount >= stats.maxSources ? 'text-amber-400' : 't3'}`}>
              {stats.sourceCount}/{stats.maxSources} doc{stats.maxSources !== 1 ? 's' : ''}
            </span>
          )}

          {localEnabled && gapsCount > 0 && !statsLoading && (
            <span className="text-[9px] font-mono text-amber-400/70 tabular-nums">
              {gapsCount} gap{gapsCount !== 1 ? 's' : ''}
            </span>
          )}

          {toggleSaved && (
            <span className={`text-[10px] ${toggleSyncStatus === 'failed' ? 'text-amber-400' : 'text-green-400'}`}>
              {toggleSyncStatus === 'synced' ? '\u2713 Tool updated' : toggleSyncStatus === 'failed' ? '\u26A0 Saved' : '\u2713 Saved'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 ml-2 shrink-0">
          {isAdmin && (
            <PremiumToggle
              checked={localEnabled}
              onChange={async () => { await handleToggle() }}
              disabled={toggling || previewMode}
            />
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}>
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
          {localEnabled ? 'queryKnowledge tool registered on agent — searches active on next call' : 'queryKnowledge tool removed from agent — searches disabled'}
        </p>
      )}
      {toggleSaved && toggleSyncStatus === 'failed' && (
        <p className="text-[10px] text-amber-400/70 mt-1.5 ml-5">
          Saved to DB but agent sync failed — tool change may not take effect until next deploy
        </p>
      )}
      <div className="ml-5">
        <FieldSyncStatusChip
          clientId={client.id}
          fieldKey="knowledge_backend"
          currentValue={localEnabled ? 'pgvector' : null}
          onRetry={retryKnowledgeSync}
        />
      </div>

      {/* Knowledge layer explainer */}
      {localEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/[0.04] border border-purple-500/15 mt-3 ml-0">
          <span className="w-2 h-2 rounded-full bg-purple-400/80 shrink-0" />
          <p className="text-[10px] t2 leading-relaxed">
            <span className="font-semibold text-purple-400/90">Searched when needed</span>
            {' '}&mdash; your agent only searches this during a call when the question is relevant. Not loaded every call.
          </p>
        </div>
      )}

      {/* Expanded + enabled */}
      {!collapsed && localEnabled && (
        <div className="mt-4 space-y-4">
          {/* Current knowledge sources */}
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

          {/* Uploaded document limit */}
          {stats && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
              stats.sourceCount >= stats.maxSources ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'b-theme bg-hover'
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

          {/* Chunk browser */}
          {stats && stats.approved + stats.pending + stats.rejected > 0 && (
            <ChunkBrowserSection
              clientId={client.id}
              stats={stats}
              onStatsRefresh={fetchStats}
            />
          )}

          {/* Gap answers */}
          {gaps.length > 0 && (
            <GapAnswerSection
              clientId={client.id}
              gaps={gaps}
              gapsCount={gapsCount}
              isAdmin={isAdmin}
              previewMode={previewMode}
              extraQa={Array.isArray(client.extra_qa) ? client.extra_qa : []}
              onClientUpdate={onClientUpdate}
              onGapResolved={(query) => setGaps(prev => prev.filter(g => g.query !== query))}
              onGapsCountDecrement={() => setGapsCount(prev => Math.max(0, prev - 1))}
            />
          )}

          {/* Quick test */}
          <TestQuerySection clientId={client.id} previewMode={previewMode} />

          {/* Navigation hint */}
          {!pathname?.includes('/dashboard/knowledge') && (
            <p className="text-[10px] t3">
              Manage chunks, approve suggestions, and run full searches in the{' '}
              <a href="/dashboard/knowledge" className="font-medium t2 underline underline-offset-2 hover:opacity-75 transition-opacity">Knowledge</a> tab.{' '}
              <a href="/dashboard/knowledge" className="font-medium text-[var(--color-primary)] hover:opacity-75 transition-opacity">Manage documents →</a>
            </p>
          )}
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
