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
  }
  const c = config[status] ?? { bg: 'bg-zinc-400/10', text: 'text-zinc-400' }
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
  }, [clientId, statusFilter, trustTierFilter, offset])

  useEffect(() => {
    fetchChunks(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, statusFilter, trustTierFilter])

  function handleExpand(chunk: KnowledgeChunk) {
    if (expandedId === chunk.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(chunk.id)
    setEditContent(chunk.content)
    setEditTier((chunk.trust_tier as 'high' | 'medium' | 'low') || 'medium')
  }

  async function handleAction(chunkId: string, action: 'approve' | 'reject') {
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

      setChunks(prev =>
        prev.map(c =>
          c.id === chunkId
            ? {
                ...c,
                status: action === 'approve' ? 'approved' : 'rejected',
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

  const hasMore = chunks.length < total

  return (
    <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-zinc-200">
            Knowledge Chunks
          </p>
          {!loading && (
            <span className="text-[10px] font-mono text-zinc-500">
              {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={trustTierFilter}
            onChange={e => setTrustTierFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Tiers</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <svg className="animate-spin h-5 w-5 mx-auto text-zinc-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs text-zinc-500 mt-2">Loading chunks...</p>
        </div>
      ) : chunks.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-xs text-zinc-500">
            No knowledge chunks found{statusFilter !== 'all' || trustTierFilter !== 'all' ? ' for these filters' : ''}.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {chunks.map(chunk => (
            <div key={chunk.id}>
              <button
                type="button"
                onClick={() => handleExpand(chunk)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {expandedId === chunk.id
                        ? chunk.content
                        : chunk.content.length > 200
                          ? chunk.content.slice(0, 200) + '...'
                          : chunk.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-mono">{chunk.source}</span>
                      {chunk.chunk_type && (
                        <span className="text-[10px] text-zinc-600">{chunk.chunk_type}</span>
                      )}
                      <span className="text-[10px] text-zinc-600">
                        {new Date(chunk.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TrustTierBadge tier={chunk.trust_tier} />
                    <ChunkStatusBadge status={chunk.status} />
                  </div>
                </div>
              </button>

              {expandedId === chunk.id && (
                <div className="px-4 pb-4 space-y-3 bg-zinc-800/20">
                  {(isAdmin || chunk.status === 'pending') && (
                    <>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={5}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-blue-500/50 resize-y"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-zinc-500 font-medium">Trust:</label>
                          <select
                            value={editTier}
                            onChange={e => setEditTier(e.target.value as 'high' | 'medium' | 'low')}
                            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
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
        <div className="px-4 py-3 border-t border-zinc-800 text-center">
          <button
            onClick={() => fetchChunks(false)}
            disabled={loadingMore}
            className="px-4 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? 'Loading...' : `Load more (${chunks.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  )
}
