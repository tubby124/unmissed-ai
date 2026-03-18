'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface KnowledgeBaseTabProps {
  clientId: string
  isAdmin: boolean
}

interface CorpusDoc {
  docId: string
  documentId: string
  name: string
  size: number
  status: 'processing' | 'ready' | 'failed' | 'local_only'
  createdAt: string
}

interface TestResult {
  text: string
  score: number
  documentId: string
  documentName?: string
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/epub+zip',
]

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.txt,.md,.ppt,.pptx,.epub'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: CorpusDoc['status'] }) {
  const config = {
    processing: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Processing' },
    ready: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Ready' },
    failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
    local_only: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: 'Local Only' },
  }
  const c = config[status] ?? config.local_only
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {status === 'processing' && (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {c.label}
    </span>
  )
}

export default function KnowledgeBaseTab({ clientId, isAdmin }: KnowledgeBaseTabProps) {
  const [docs, setDocs] = useState<CorpusDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Test query state (admin only)
  const [testQuery, setTestQuery] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [testError, setTestError] = useState('')

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/corpus?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed to load documents')
      const data = await res.json()
      setDocs(data.documents ?? [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // Poll for processing docs
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(fetchDocs, 5000)
    return () => clearInterval(interval)
  }, [docs, fetchDocs])

  async function handleUpload(file: File) {
    setUploadError('')

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large. Maximum size is 10MB (got ${formatFileSize(file.size)}).`)
      return
    }

    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      setUploadError('Unsupported file type. Accepted: PDF, DOC, DOCX, TXT, MD, PPT, PPTX, EPUB.')
      return
    }

    setUploading(true)
    try {
      // Step 1: Get presigned upload URL
      const initRes = await fetch('/api/dashboard/corpus/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      })
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error ?? 'Failed to initiate upload')
      }
      const { uploadUrl, documentId, docId } = await initRes.json()

      // Step 2: PUT file to presigned URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Failed to upload file to storage')

      // Step 3: Confirm upload
      const confirmRes = await fetch('/api/dashboard/corpus/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, docId, documentId }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({ error: 'Confirmation failed' }))
        throw new Error(err.error ?? 'Failed to confirm upload')
      }

      // Step 4: Refresh list
      await fetchDocs()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(docId: string) {
    setDeleting(docId)
    try {
      const res = await fetch(`/api/dashboard/corpus/${docId}?clientId=${clientId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setDocs(prev => prev.filter(d => d.docId !== docId))
      setDeleteConfirm(null)
    } catch {
      setUploadError('Failed to delete document')
    } finally {
      setDeleting(null)
    }
  }

  async function handleTestQuery() {
    if (!testQuery.trim()) return
    setTestLoading(true)
    setTestError('')
    setTestResults(null)
    try {
      const res = await fetch('/api/dashboard/corpus/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, query: testQuery.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Test query failed' }))
        throw new Error(err.error ?? 'Test query failed')
      }
      const data = await res.json()
      setTestResults(data.results ?? [])
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test query failed')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold t1">Knowledge Base</h3>
        <p className="text-xs t3 mt-1">
          Upload business documents so your agent can answer detailed questions during calls
        </p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-blue-400 bg-blue-500/5'
            : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="t3">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <div>
            <p className="text-sm t2 font-medium">
              {uploading ? 'Uploading...' : 'Drop a file here or click to browse'}
            </p>
            <p className="text-xs t3 mt-1">
              PDF, DOC, DOCX, TXT, MD, PPT, PPTX, EPUB &mdash; max 10MB
            </p>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-2 text-xs text-red-400 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {uploadError}
          <button onClick={() => setUploadError('')} className="ml-auto text-red-400 hover:text-red-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* File List */}
      <div className="rounded-xl border b-theme overflow-hidden">
        <div className="px-4 py-3 border-b b-theme">
          <p className="text-xs font-semibold t2">
            Documents {!loading && `(${docs.length})`}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-5 w-5 mx-auto text-zinc-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs t3 mt-2">Loading documents...</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-zinc-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs t3">
              No documents uploaded yet. Upload your menu, price list, FAQ sheet, or policies.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_100px_60px] gap-3 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase t3">
              <span>Name</span>
              <span>Size</span>
              <span>Status</span>
              <span></span>
            </div>
            {docs.map(doc => (
              <div key={doc.docId} className="grid grid-cols-[1fr_80px_100px_60px] gap-3 px-4 py-3 items-center hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 t3">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs t1 truncate">{doc.name}</span>
                </div>
                <span className="text-xs t3 font-mono">{formatFileSize(doc.size)}</span>
                <StatusBadge status={doc.status} />
                <div className="flex justify-end">
                  {deleteConfirm === doc.docId ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(doc.docId)}
                        disabled={deleting === doc.docId}
                        className="text-[10px] font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deleting === doc.docId ? '...' : 'Yes'}
                      </button>
                      <span className="text-zinc-600">/</span>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-[10px] font-medium t3 hover:t1"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(doc.docId)}
                      className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete document"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Query (admin only) */}
      {isAdmin && (
        <div className="rounded-xl border b-theme overflow-hidden">
          <div className="px-4 py-3 border-b b-theme flex items-center gap-2">
            <p className="text-xs font-semibold t2">Test Query</p>
            <span className="text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Admin</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs t3">
              Test how the knowledge base responds to a question. Results show matched content with relevance scores.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
                placeholder="Ask a question about uploaded documents..."
                className="flex-1 bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleTestQuery}
                disabled={testLoading || !testQuery.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {testLoading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Test Query'}
              </button>
            </div>

            {testError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
                {testError}
              </div>
            )}

            {testResults !== null && (
              <div className="space-y-2">
                {testResults.length === 0 ? (
                  <p className="text-xs t3 py-2">No matching results found.</p>
                ) : (
                  testResults.map((result, i) => (
                    <div key={i} className="rounded-lg border b-theme p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium t3 truncate">
                          {result.documentName ?? result.documentId}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 ${
                          result.score >= 0.7 ? 'text-green-400' : result.score >= 0.4 ? 'text-amber-400' : 'text-zinc-500'
                        }`}>
                          {(result.score * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs t2 leading-relaxed whitespace-pre-wrap">{result.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
