'use client'

import { useState, useRef, useEffect } from 'react'

interface FileUploadPanelProps {
  clientId: string
  previewMode?: boolean
  onChunkAdded: () => void
}

export default function FileUploadPanel({ clientId, previewMode, onChunkAdded }: FileUploadPanelProps) {
  const [fileDragging, setFileDragging] = useState(false)
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const [quota, setQuota] = useState<{ used: number; max: number } | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/knowledge/stats?client_id=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.sourceCount === 'number' && typeof data.maxSources === 'number') {
          setQuota({ used: data.sourceCount, max: data.maxSources })
        }
      })
      .catch(() => {})
  }, [clientId])

  const atLimit = quota !== null && quota.used >= quota.max
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'approving' | 'done'>('idle')
  const [previewData, setPreviewData] = useState<{
    filename: string
    charCount: number
    truncated: boolean
    chunkCount: number
    contentType: { type: string; label: string; description: string; emoji: string }
    chunks: string[]
    hasMore: boolean
  } | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [doneResult, setDoneResult] = useState<{ filename: string; chunksCreated: number } | null>(null)
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set())

  async function handleDocFileUpload(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = new Set(['pdf', 'txt', 'docx', 'csv'])
    if (!allowed.has(ext)) {
      setPreviewError('Unsupported file type. Allowed: PDF, TXT, DOCX, CSV')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPreviewError('File too large (max 5MB)')
      return
    }
    setStatus('loading')
    setPreviewError('')
    setPreviewData(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('client_id', clientId)
      const res = await fetch('/api/dashboard/knowledge/upload-preview', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreviewData(data)
      setSelectedChunks(new Set(data.chunks.map((_: string, i: number) => i)))
      setStatus('preview')
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to read file')
      setStatus('idle')
    }
  }

  function toggleChunk(i: number) {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  function toggleAllChunks() {
    if (!previewData) return
    if (selectedChunks.size === previewData.chunks.length) {
      setSelectedChunks(new Set())
    } else {
      setSelectedChunks(new Set(previewData.chunks.map((_, i) => i)))
    }
  }

  async function handleApproveUpload() {
    if (!previewData) return
    setStatus('approving')
    setPreviewError('')
    try {
      const chunks = previewData.chunks
        .filter((_, i) => selectedChunks.has(i))
        .map(content => ({
          content,
          chunk_type: 'document',
          trust_tier: 'high',
          source: 'knowledge_doc',
        }))
      if (chunks.length === 0) return

      let totalSucceeded = 0
      for (let start = 0; start < chunks.length; start += 100) {
        const batch = chunks.slice(start, start + 100)
        const res = await fetch('/api/dashboard/knowledge/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, chunks: batch, auto_approve: true }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Import failed')
        totalSucceeded += data.succeeded
      }

      setDoneResult({ filename: previewData.filename, chunksCreated: totalSucceeded })
      setStatus('done')
      onChunkAdded()
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to add chunks')
      setStatus('preview')
    }
  }

  function reset() {
    setStatus('idle')
    setPreviewData(null)
    setPreviewError('')
    setDoneResult(null)
    setSelectedChunks(new Set())
  }

  return (
    <div className="space-y-3">
      {status === 'idle' && (
        <>
          {/* D86 — doc quota indicator */}
          {quota !== null && (
            <div className="rounded-lg border px-3 py-2.5 space-y-1.5"
              style={{ borderColor: atLimit ? 'rgba(239,68,68,0.3)' : 'var(--color-border)', backgroundColor: atLimit ? 'rgba(239,68,68,0.05)' : 'var(--color-hover)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: atLimit ? 'rgb(239,68,68)' : 'var(--color-text-2)' }}>
                  {quota.used} of {quota.max} document{quota.max !== 1 ? 's' : ''} used
                </span>
                {atLimit && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' }}>
                    Limit reached
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (quota.used / quota.max) * 100)}%`,
                    backgroundColor: atLimit ? 'rgb(239,68,68)' : quota.used / quota.max > 0.8 ? 'rgb(234,179,8)' : 'rgb(34,197,94)',
                  }}
                />
              </div>
              {atLimit && (
                <p className="text-[11px]" style={{ color: 'rgb(239,68,68)' }}>
                  Upgrade your plan to upload more documents.
                </p>
              )}
            </div>
          )}
          <p className="text-xs t3">
            Upload a PDF, TXT, DOCX, or CSV file. We&apos;ll extract the content and let you review it before it goes into the knowledge base.
          </p>
          <div
            onDragOver={e => { if (!atLimit) { e.preventDefault(); setFileDragging(true) } }}
            onDragLeave={e => { e.preventDefault(); setFileDragging(false) }}
            onDrop={e => {
              e.preventDefault()
              setFileDragging(false)
              if (atLimit) return
              const file = e.dataTransfer.files[0]
              if (file) handleDocFileUpload(file)
            }}
            onClick={() => { if (!atLimit) docFileInputRef.current?.click() }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all ${
              atLimit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            } ${
              fileDragging ? 'border-emerald-500 bg-emerald-500/5' : 'b-theme bg-surface hover:border-emerald-500/50'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`mb-2 ${fileDragging ? 'text-emerald-400' : 't3'}`}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs font-medium t2">Drop a file here or click to upload</p>
            <p className="text-[10px] t3 mt-1">PDF, TXT, DOCX, or CSV — max 5MB</p>
            <input
              ref={docFileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.csv"
              className="hidden"
              disabled={atLimit}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleDocFileUpload(file)
                e.target.value = ''
              }}
            />
          </div>
          {previewError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}
        </>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-10 gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.4s' }} />
            <div className="absolute inset-1.5 rounded-full bg-emerald-500/25 animate-pulse" />
            <div className="absolute inset-3.5 rounded-full bg-emerald-400/70 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium t2">Reading your file...</p>
            <p className="text-xs t3 mt-1">Extracting and splitting content into chunks</p>
          </div>
        </div>
      )}

      {status === 'preview' && previewData && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
            <span className="text-xl leading-none">{previewData.contentType.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-300">{previewData.contentType.label}</p>
              <p className="text-[10px] t3">{previewData.contentType.description}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-mono font-bold text-emerald-400">{previewData.chunkCount}</p>
              <p className="text-[10px] t3">chunks</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs t2 font-medium truncate">{previewData.filename}</span>
            <span className="text-[10px] t3 shrink-0 ml-auto">
              {previewData.charCount >= 1000
                ? `${(previewData.charCount / 1000).toFixed(1)}K chars`
                : `${previewData.charCount} chars`}
              {previewData.truncated && ' (truncated to 50K)'}
            </span>
          </div>

          <div className="rounded-lg border b-theme overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b b-theme">
              <p className="text-[10px] t3 font-semibold">
                {selectedChunks.size} of {previewData.chunks.length} chunks selected
                {previewData.hasMore && ' (first 50 shown)'}
              </p>
              <button onClick={toggleAllChunks} className="text-[11px] text-blue-400 hover:opacity-75 transition-opacity">
                {selectedChunks.size === previewData.chunks.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-[var(--border-color,rgba(255,255,255,0.08))]">
              {previewData.chunks.map((chunk, i) => (
                <div
                  key={i}
                  onClick={() => toggleChunk(i)}
                  className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-hover ${
                    selectedChunks.has(i) ? '' : 'opacity-35'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChunks.has(i)}
                    onChange={() => toggleChunk(i)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 shrink-0 accent-emerald-500"
                  />
                  <p className="text-[11px] t2 leading-relaxed line-clamp-2">{chunk}</p>
                </div>
              ))}
            </div>
          </div>

          {previewError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="px-3 py-2 rounded-lg text-xs t3 border b-theme hover:bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveUpload}
              disabled={selectedChunks.size === 0 || previewMode}
              className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
            >
              Add {selectedChunks.size} chunk{selectedChunks.size !== 1 ? 's' : ''} to Knowledge Base
            </button>
          </div>
        </div>
      )}

      {status === 'approving' && (
        <div className="flex flex-col items-center justify-center py-10 gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '1.2s' }} />
            <div className="absolute inset-1.5 rounded-full bg-green-500/25 animate-pulse" />
            <div className="absolute inset-3.5 rounded-full bg-green-400/70 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium t2">Embedding knowledge...</p>
            <p className="text-xs t3 mt-1">Generating vectors for {selectedChunks.size} chunk{selectedChunks.size !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {status === 'done' && doneResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-400">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-green-300">Knowledge added</p>
              <p className="text-[11px] t3 mt-0.5">
                <strong className="text-green-400">{doneResult.chunksCreated}</strong> chunk{doneResult.chunksCreated !== 1 ? 's' : ''} from <strong className="t2">{doneResult.filename}</strong> are now searchable by your agent.
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full px-4 py-2 rounded-lg text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  )
}
