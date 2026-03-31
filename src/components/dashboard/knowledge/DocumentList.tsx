'use client'

import { useState, useEffect, useCallback } from 'react'

interface KnowledgeDoc {
  id: string
  filename: string
  char_count: number
  created_at: string | null
}

interface DocumentListProps {
  clientId: string
  refreshTrigger?: number
}

export default function DocumentList({ clientId, refreshTrigger }: DocumentListProps) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchDocs = useCallback(() => {
    setLoading(true)
    fetch(`/api/dashboard/knowledge/docs?client_id=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.docs) setDocs(data.docs)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs, refreshTrigger])

  async function handleDelete(doc: KnowledgeDoc) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return
    setDeleting(doc.id)
    setError('')
    try {
      const res = await fetch(
        `/api/dashboard/knowledge/docs?id=${doc.id}&client_id=${clientId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Delete failed')
      }
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return null
  if (docs.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Uploaded Documents</p>
      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
      <div className="space-y-1.5">
        {docs.map(doc => {
          const date = doc.created_at
            ? new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : null
          const kb = Math.round(doc.char_count / 1000)
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border b-theme bg-surface"
            >
              {/* file icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium t1 truncate">{doc.filename}</p>
                <p className="text-[10px] t3">
                  {kb}K chars{date ? ` · ${date}` : ''}
                </p>
              </div>

              <button
                onClick={() => handleDelete(doc)}
                disabled={deleting === doc.id}
                className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-40 shrink-0"
                title="Delete document"
              >
                {deleting === doc.id ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin text-red-400">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-red-400/70">
                    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
