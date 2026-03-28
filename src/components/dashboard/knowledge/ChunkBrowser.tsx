'use client'

import { useState, useEffect, useCallback } from 'react'

interface KnowledgeChunk {
  id: string
  client_id: string
  content: string
  source: string
  chunk_type: string
  status: string
  trust_tier: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  hit_count: number
  last_hit_at: string | null
}

interface ChunkBrowserProps {
  clientId: string
  isAdmin: boolean
}

function TrustTierBadge({ tier }: { tier: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-green-400/10', text: 'text-green-400' },
    medium: { bg: 'bg-amber-400/10', text: 'text-amber-400' },
    low: { bg: 'bg-red-400/10', text: 'text-red-400' },
  }
  const c = config[tier] ?? config.medium
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      {tier}
    </span>
  )
}

function ChunkStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    approved: { bg: 'bg-green-400/10', text: 'text-green-400' },
    pending: { bg: 'bg-yellow-400/10', text: 'text-yellow-400' },
    rejected: { bg: 'bg-red-400/10', text: 'text-red-400' },
    revoked: { bg: 'bg-gray-400/10', text: 'text-gray-400' },
  }
  const c = config[status] ?? { bg: 'bg-hover', text: 't3' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}

export default function ChunkBrowser({ clientId, isAdmin }: ChunkBrowserProps) {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [trustTierFilter, setTrustTierFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [clearingAll, setClearingAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTier, setEditTier] = useState<'high' | 'medium' | 'low'>('medium')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const LIMIT = 50

  const fetchChunks = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        status: statusFilter,
        trust_tier: trustTierFilter,
        limit: String(LIMIT),
        offset: String(currentOffset),
      })
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/dashboard/knowledge/chunks?${params}`)
      if (!res.ok) throw new Error('Failed to load chunks')
      const data = await res.json()

      if (reset) {
        setChunks(data.chunks)
        setOffset(LIMIT)
      } else {
        setChunks(prev => [...prev, ...data.chunks])
        setOffset(currentOffset + LIMIT)
      }
      setTotal(data.total)
    } catch {
      if (reset) setChunks([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [clientId, statusFilter, trustTierFilter, sourceFilter, offset])

  useEffect(() => {
    fetchChunks(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, statusFilter, trustTierFilter, sourceFilter])

  function handleExpand(chunk: KnowledgeChunk) {
    if (expandedId === chunk.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(chunk.id)
    setEditContent(chunk.content)
    setEditTier((chunk.trust_tier as 'high' | 'medium' | 'low') || 'medium')
  }

  async function handleAction(chunkId: string, action: 'approve' | 'reject' | 'revoke') {
    setActionLoading(chunkId)
    try {
      const body: Record<string, unknown> = { chunkId, action }
      if (action === 'approve') {
        body.trustTier = editTier
        body.editedContent = editContent
      }
      const res = await fetch('/api/dashboard/knowledge/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Action failed')

      const newStatus = action === 'approve' ? 'approved' : action === 'revoke' ? 'revoked' : 'rejected'
      setChunks(prev =>
        prev.map(c =>
          c.id === chunkId
            ? {
                ...c,
                status: newStatus,
                trust_tier: action === 'approve' ? editTier : c.trust_tier,
                content: action === 'approve' ? editContent : c.content,
              }
            : c
        )
      )
      setExpandedId(null)
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  async function handleClearAll() {
    const label = sourceFilter !== 'all' ? `all "${sourceFilter}" chunks` : 'ALL knowledge chunks'
    if (!confirm(`Delete ${label} for this client? This cannot be undone.`)) return
    setClearingAll(true)
    try {
      const params = new URLSearchParams({ client_id: clientId, clear_all: 'true' })
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/dashboard/knowledge/chunks?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Clear failed')
      const data = await res.json()
      setChunks([])
      setTotal(0)
      setOffset(0)
      console.log(`[ChunkBrowser] cleared ${data.deleted} chunks`)
    } catch {
      // silent
    } finally {
      setClearingAll(false)
    }
  }

  async function handleDelete(chunkId: string) {
    if (!confirm('Delete this knowledge chunk? This cannot be undone.')) return
    setActionLoading(chunkId)
    try {
      const res = await fetch(`/api/dashboard/knowledge/chunks?id=${chunkId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setChunks(prev => prev.filter(c => c.id !== chunkId))
      setTotal(prev => prev - 1)
      setExpandedId(null)
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  const hasMore = chunks.length < total

  return (
    <div className="rounded-xl border b-theme overflow-hidden">
      <div className="px-4 py-3 border-b b-theme flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold t1">
            Knowledge Chunks
          </p>
          {!loading && (
            <span className="text-[10px] font-mono t3">
              {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-hover border b-theme rounded-lg px-2 py-1 text-[11px] t2 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Sources</option>
            <option value="compiled_import">compiled_import</option>
            <option value="knowledge_doc">knowledge_doc</option>
            <option value="website_scrape">website_scrape</option>
            <option value="settings_edit">settings_edit</option>
            <option value="bulk_import">bulk_import</option>
            <option value="dashboard_manual">dashboard_manual</option>
            <option value="manual_entry">manual_entry</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-hover border b-theme rounded-lg px-2 py-1 text-[11px] t2 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revoked">Revoked</option>
          </select>
          <select
            value={trustTierFilter}
            onChange={e => setTrustTierFilter(e.target.value)}
            className="bg-hover border b-theme rounded-lg px-2 py-1 text-[11px] t2 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Tiers</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {total > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              className="px-3 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              {clearingAll ? 'Clearing...' : sourceFilter !== 'all' ? `Clear ${sourceFilter}` : 'Clear All'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <svg className="animate-spin h-5 w-5 mx-auto t3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs t3 mt-2">Loading chunks...</p>
        </div>
      ) : chunks.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-xs t3">
            No knowledge chunks found{statusFilter !== 'all' || trustTierFilter !== 'all' ? ' for these filters' : ''}.
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {chunks.map(chunk => (
            <div key={chunk.id}>
              <button
                type="button"
                onClick={() => handleExpand(chunk)}
                className="w-full text-left px-4 py-3 hover:bg-hover transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs t1 leading-relaxed">
                      {expandedId === chunk.id
                        ? chunk.content
                        : chunk.content.length > 200
                          ? chunk.content.slice(0, 200) + '...'
                          : chunk.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] t3 font-mono">{chunk.source}</span>
                      {chunk.chunk_type && (
                        <span className="text-[10px] t3">{chunk.chunk_type}</span>
                      )}
                      <span className="text-[10px] t3">
                        {new Date(chunk.created_at).toLocaleDateString()}
                      </span>
                      {chunk.hit_count > 0 && (
                        <span className="text-[10px] font-mono text-blue-400/70" title={chunk.last_hit_at ? `Last hit: ${new Date(chunk.last_hit_at).toLocaleDateString()}` : undefined}>
                          {chunk.hit_count} hit{chunk.hit_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TrustTierBadge tier={chunk.trust_tier} />
                    <ChunkStatusBadge status={chunk.status} />
                  </div>
                </div>
              </button>

              {expandedId === chunk.id && (
                <div className="px-4 pb-4 space-y-3 bg-hover">
                  {(isAdmin || chunk.status === 'pending') && (
                    <>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={5}
                        className="w-full bg-surface border b-theme rounded-lg px-3 py-2 text-xs t1 leading-relaxed focus:outline-none focus:border-blue-500/50 resize-y"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] t3 font-medium">Trust:</label>
                          <select
                            value={editTier}
                            onChange={e => setEditTier(e.target.value as 'high' | 'medium' | 'low')}
                            className="bg-hover border b-theme rounded px-2 py-1 text-[11px] t2 focus:outline-none"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => handleDelete(chunk.id)}
                            disabled={actionLoading === chunk.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-hover t3 border b-theme hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === chunk.id ? '...' : 'Delete'}
                          </button>
                          {chunk.status === 'approved' && chunk.source === 'compiled_import' && (
                            <button
                              onClick={() => handleAction(chunk.id, 'revoke')}
                              disabled={actionLoading === chunk.id}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20 disabled:opacity-50 transition-colors"
                              title="Remove from search results while preserving audit trail"
                            >
                              {actionLoading === chunk.id ? '...' : 'Revoke'}
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(chunk.id, 'reject')}
                            disabled={actionLoading === chunk.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === chunk.id ? '...' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleAction(chunk.id, 'approve')}
                            disabled={actionLoading === chunk.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === chunk.id ? '...' : 'Approve'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="px-4 py-3 border-t b-theme text-center">
          <button
            onClick={() => fetchChunks(false)}
            disabled={loadingMore}
            className="px-4 py-1.5 rounded-lg text-[11px] font-medium bg-hover t2 hover:bg-hover disabled:opacity-50 transition-colors"
          >
            {loadingMore ? 'Loading...' : `Load more (${chunks.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  )
}
