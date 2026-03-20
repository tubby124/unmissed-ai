'use client'

import { useState, useEffect, useCallback } from 'react'

interface PendingChunk {
  id: string
  content: string
  source: string
  chunk_type: string
  trust_tier: string
  created_at: string
}

interface PendingSuggestionsProps {
  clientId: string
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

export default function PendingSuggestions({ clientId }: PendingSuggestionsProps) {
  const [chunks, setChunks] = useState<PendingChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        status: 'pending',
        limit: '20',
        offset: '0',
      })
      const res = await fetch(`/api/dashboard/knowledge/chunks?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setChunks(data.chunks ?? [])
    } catch {
      setChunks([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  async function handleAction(chunkId: string, action: 'approve' | 'reject') {
    setActionLoading(chunkId)
    try {
      const res = await fetch('/api/dashboard/knowledge/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId, action }),
      })
      if (!res.ok) throw new Error('Action failed')
      setChunks(prev => prev.filter(c => c.id !== chunkId))
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return null

  return (
    <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center gap-2">
        <p className="text-xs font-semibold text-zinc-200">Pending Review</p>
        {chunks.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-yellow-400/15 text-yellow-400 text-[10px] font-bold px-1.5">
            {chunks.length}
          </span>
        )}
      </div>

      {chunks.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-zinc-500">All caught up -- no pending suggestions</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {chunks.map(chunk => (
            <div key={chunk.id} className="px-4 py-3 space-y-2">
              <p className="text-xs text-zinc-200 leading-relaxed">
                {chunk.content.length > 300
                  ? chunk.content.slice(0, 300) + '...'
                  : chunk.content}
              </p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono">{chunk.source}</span>
                  <TrustTierBadge tier={chunk.trust_tier} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAction(chunk.id, 'reject')}
                    disabled={actionLoading === chunk.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === chunk.id ? '...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleAction(chunk.id, 'approve')}
                    disabled={actionLoading === chunk.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === chunk.id ? '...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
