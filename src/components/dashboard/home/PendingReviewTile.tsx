'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ExternalLink, Check, X } from 'lucide-react'

interface PendingChunk {
  id: string
  content: string
  source: string
  chunk_type: string
  status: string
  created_at: string
}

interface Props {
  clientId: string
  pendingCount: number
  onApproved?: () => void
}

export default function PendingReviewTile({ clientId, pendingCount, onApproved }: Props) {
  const [chunks, setChunks] = useState<PendingChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [approvedCount, setApprovedCount] = useState(0)
  const [dismissedCount, setDismissedCount] = useState(0)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/dashboard/knowledge/chunks?status=pending&limit=20`
      )
      if (!res.ok) return
      const data = await res.json()
      setChunks(data.chunks ?? [])
    } catch {
      // non-critical tile
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  async function handleAction(chunkId: string, action: 'approve' | 'reject') {
    setProcessingIds(prev => new Set(prev).add(chunkId))
    try {
      const res = await fetch('/api/dashboard/knowledge/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId, action }),
      })
      if (res.ok) {
        setChunks(prev => prev.filter(c => c.id !== chunkId))
        if (action === 'approve') {
          setApprovedCount(c => c + 1)
        } else {
          setDismissedCount(c => c + 1)
        }
        onApproved?.()
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(chunkId)
        return next
      })
    }
  }

  async function handleApproveAll() {
    setBulkProcessing(true)
    try {
      // Approve remaining chunks sequentially to avoid race conditions
      for (const chunk of chunks) {
        await fetch('/api/dashboard/knowledge/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkId: chunk.id, action: 'approve' }),
        })
      }
      setApprovedCount(c => c + chunks.length)
      setChunks([])
      onApproved?.()
    } finally {
      setBulkProcessing(false)
    }
  }

  // Hide when no pending items and nothing happened this session
  if (!loading && pendingCount === 0 && chunks.length === 0 && approvedCount === 0) return null

  const totalProcessed = approvedCount + dismissedCount

  return (
    <motion.div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.08 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: 'rgb(251,191,36)' }}>
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[12px] font-semibold t1">Pending Review</span>
          {chunks.length > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: 'rgb(251,191,36)' }}
            >
              {chunks.length}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/knowledge"
          className="flex items-center gap-1 text-[11px] t3 hover:t2 transition-colors"
        >
          Knowledge
          <ExternalLink width={10} height={10} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : chunks.length === 0 && totalProcessed > 0 ? (
        /* All done state */
        <div className="px-5 py-5 text-center space-y-1">
          <p className="text-[12px] font-semibold t1">
            {approvedCount > 0 ? `${approvedCount} item${approvedCount !== 1 ? 's' : ''} approved` : 'All reviewed'}
          </p>
          <p className="text-[11px] t3">Your agent&apos;s knowledge base has been updated</p>
        </div>
      ) : (
        <>
          {/* Approve all bar */}
          {chunks.length > 1 && (
            <div className="flex items-center justify-between px-5 py-2 border-b b-theme" style={{ backgroundColor: 'rgba(251,191,36,0.03)' }}>
              <p className="text-[11px] t3">
                {chunks.length} page{chunks.length !== 1 ? 's' : ''} scraped from your website
              </p>
              <button
                onClick={() => void handleApproveAll()}
                disabled={bulkProcessing}
                className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-70 transition-opacity disabled:opacity-50"
                style={{ color: 'rgb(34,197,94)' }}
              >
                <Check width={11} height={11} />
                {bulkProcessing ? 'Approving...' : 'Approve all'}
              </button>
            </div>
          )}

          {/* Scrollable chunk list */}
          <div
            className="divide-y overflow-y-auto"
            style={{ borderColor: 'var(--color-hover)', maxHeight: '240px' }}
          >
            {chunks.map(chunk => {
              const isProcessing = processingIds.has(chunk.id)
              const preview = chunk.content.length > 100
                ? chunk.content.slice(0, 100) + '...'
                : chunk.content

              return (
                <div
                  key={chunk.id}
                  className={`px-5 py-2.5 flex items-start gap-2 transition-opacity ${isProcessing ? 'opacity-40' : ''}`}
                >
                  <span
                    className="w-1 h-1 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: 'rgb(251,191,36)' }}
                  />
                  <p className="flex-1 text-[11px] t2 leading-relaxed min-w-0 line-clamp-2">
                    {preview}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => void handleAction(chunk.id, 'approve')}
                      disabled={isProcessing}
                      className="p-1 rounded-md hover:bg-green-500/10 transition-colors"
                      title="Approve"
                    >
                      <Check width={12} height={12} style={{ color: 'rgb(34,197,94)' }} />
                    </button>
                    <button
                      onClick={() => void handleAction(chunk.id, 'reject')}
                      disabled={isProcessing}
                      className="p-1 rounded-md hover:bg-red-500/10 transition-colors"
                      title="Dismiss"
                    >
                      <X width={12} height={12} className="t3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </motion.div>
  )
}
