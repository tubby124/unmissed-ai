'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function sourceLabel(source: string): string {
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

export interface WebsiteChunk {
  id: string
  content: string
  status: string
  trust_tier: string
  source: string
}

interface ChunkBrowserStats {
  approved: number
  pending: number
  rejected: number
  bySource: Record<string, number>
}

interface ChunkBrowserSectionProps {
  clientId: string
  stats: ChunkBrowserStats
  onStatsRefresh: () => void
}

export default function ChunkBrowserSection({ clientId, stats, onStatsRefresh }: ChunkBrowserSectionProps) {
  const [websiteChunks, setWebsiteChunks] = useState<WebsiteChunk[]>([])
  const [websiteChunksLoading, setWebsiteChunksLoading] = useState(false)
  const [showWebsiteChunks, setShowWebsiteChunks] = useState(false)
  const [chunkActioning, setChunkActioning] = useState<string | null>(null)
  const [chunkOffset, setChunkOffset] = useState(0)
  const [chunkTotal, setChunkTotal] = useState(0)
  const [chunkLoadingMore, setChunkLoadingMore] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [chunkSourceFilter, setChunkSourceFilter] = useState<string>('all')
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null)

  const totalVisible = stats.approved + stats.pending

  async function fetchWebsiteChunks(offset = 0, sourceFilter = chunkSourceFilter) {
    if (offset === 0) setWebsiteChunksLoading(true)
    else setChunkLoadingMore(true)
    try {
      const sourceParam = sourceFilter !== 'all' ? `&source=${sourceFilter}` : ''
      const res = await fetch(`/api/dashboard/knowledge/chunks?client_id=${clientId}${sourceParam}&limit=20&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        if (offset === 0) setWebsiteChunks(data.chunks ?? [])
        else setWebsiteChunks(prev => [...prev, ...(data.chunks ?? [])])
        setChunkTotal(data.total ?? 0)
        setChunkOffset(offset)
      }
    } catch { /* silent */ } finally {
      setWebsiteChunksLoading(false)
      setChunkLoadingMore(false)
    }
  }

  async function handleChunkAction(chunkId: string, action: 'approve' | 'reject' | 'delete') {
    const prevChunks = websiteChunks
    setWebsiteChunks(prev => action === 'delete'
      ? prev.filter(c => c.id !== chunkId)
      : prev.map(c => c.id === chunkId ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' } : c)
    )
    setChunkActioning(chunkId)
    try {
      let res: Response
      if (action === 'delete') {
        res = await fetch(`/api/dashboard/knowledge/chunks?id=${chunkId}`, { method: 'DELETE' })
      } else {
        res = await fetch('/api/dashboard/knowledge/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkId, action }),
        })
      }
      if (!res.ok) throw new Error('Action failed')
      onStatsRefresh()
      window.dispatchEvent(new CustomEvent('knowledge-chunks-refresh'))
    } catch {
      setWebsiteChunks(prevChunks)
      toast.error(action === 'delete' ? 'Failed to delete chunk' : `Failed to ${action} chunk`)
    } finally {
      setChunkActioning(null)
    }
  }

  async function handleApproveAll() {
    const pendingChunks = websiteChunks.filter(c => c.status === 'pending')
    if (pendingChunks.length === 0) return
    setApprovingAll(true)
    const prevChunks = websiteChunks
    setWebsiteChunks(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'approved' } : c))
    try {
      const results = await Promise.all(pendingChunks.map(c =>
        fetch('/api/dashboard/knowledge/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkId: c.id, action: 'approve' }),
        })
      ))
      if (results.some(r => !r.ok)) throw new Error('Some approvals failed')
      toast.success(`Approved ${pendingChunks.length} chunk${pendingChunks.length !== 1 ? 's' : ''}`)
      onStatsRefresh()
      window.dispatchEvent(new CustomEvent('knowledge-chunks-refresh'))
    } catch {
      setWebsiteChunks(prevChunks)
      toast.error('Failed to approve all chunks')
    } finally {
      setApprovingAll(false)
    }
  }

  return (
    <div className="rounded-xl border b-theme p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold t3">Browse Knowledge</p>
        <div className="flex items-center gap-2">
          {showWebsiteChunks && websiteChunks.some(c => c.status === 'pending') && (
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition-colors focus-visible:outline-none"
            >
              {approvingAll ? '...' : 'Approve All'}
            </button>
          )}
          <button
            onClick={() => {
              const next = !showWebsiteChunks
              setShowWebsiteChunks(next)
              if (next) fetchWebsiteChunks(0, chunkSourceFilter)
            }}
            className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors focus-visible:outline-none"
          >
            {showWebsiteChunks ? 'Hide' : `View ${totalVisible} chunk${totalVisible !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {showWebsiteChunks && (
        <div className="space-y-2">
          {/* Source filter tabs */}
          {Object.keys(stats.bySource).length > 1 && (
            <div className="flex flex-wrap gap-1">
              {(['all', ...Object.keys(stats.bySource)] as string[]).map(src => (
                <button
                  key={src}
                  onClick={() => {
                    setChunkSourceFilter(src)
                    fetchWebsiteChunks(0, src)
                  }}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors focus-visible:outline-none ${
                    chunkSourceFilter === src
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                      : 'bg-hover t3 b-theme hover:t1'
                  }`}
                >
                  {src === 'all' ? `All (${totalVisible})` : `${sourceLabel(src)} (${stats.bySource[src]})`}
                </button>
              ))}
            </div>
          )}

          {websiteChunksLoading ? (
            <div className="flex items-center gap-2 text-[11px] t3">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : websiteChunks.length === 0 ? (
            <p className="text-[10px] t3">No chunks found.</p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {websiteChunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-lg border b-theme p-2 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[11px] t2 leading-relaxed cursor-pointer ${expandedChunk === chunk.id ? '' : 'line-clamp-2'}`}
                          onClick={() => setExpandedChunk(expandedChunk === chunk.id ? null : chunk.id)}
                        >
                          {chunk.content}
                        </p>
                        {chunk.content.length > 140 && expandedChunk !== chunk.id && (
                          <button
                            onClick={() => setExpandedChunk(chunk.id)}
                            className="text-[9px] text-blue-400 hover:text-blue-300 mt-0.5"
                          >
                            Show more
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          chunk.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : chunk.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {chunk.status}
                        </span>
                        <span className="text-[9px] t3">{sourceLabel(chunk.source)}</span>
                      </div>
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
              {chunkTotal > websiteChunks.length && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] t3 font-mono">{websiteChunks.length} of {chunkTotal}</span>
                  <button
                    onClick={() => fetchWebsiteChunks(chunkOffset + 20, chunkSourceFilter)}
                    disabled={chunkLoadingMore}
                    className="text-[10px] font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors focus-visible:outline-none"
                  >
                    {chunkLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
