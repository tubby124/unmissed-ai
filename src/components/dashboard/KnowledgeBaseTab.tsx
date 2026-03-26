'use client'

import { useState, useCallback, useRef } from 'react'
import ChunkBrowser from './knowledge/ChunkBrowser'
import PendingSuggestions from './knowledge/PendingSuggestions'
import KnowledgeGaps from './knowledge/KnowledgeGaps'

interface KnowledgeBaseTabProps {
  clientId: string
  clientSlug: string
  isAdmin: boolean
  previewMode?: boolean
  knowledgeEnabled: boolean
  onToggleEnabled?: (enabled: boolean) => Promise<void>
  websiteUrl?: string
  onGapCountChange?: (count: number) => void
}

interface TestResult {
  content: string
  chunk_type: string
  source: string
  similarity: number
  rrf_score: number
  trust_tier: string
}

export default function KnowledgeBaseTab({
  clientId,
  clientSlug,
  isAdmin,
  previewMode,
  knowledgeEnabled,
  onToggleEnabled,
  websiteUrl: initialWebsiteUrl,
  onGapCountChange,
}: KnowledgeBaseTabProps) {
  // Test query state
  const [testQuery, setTestQuery] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [testError, setTestError] = useState('')
  const [togglingEnabled, setTogglingEnabled] = useState(false)

  // Add chunk state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addContent, setAddContent] = useState('')
  const [addType, setAddType] = useState<'fact' | 'qa' | 'manual'>('manual')
  const [addTier, setAddTier] = useState<'high' | 'medium' | 'low'>('medium')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  // Website scrape state
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl || '')
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [scrapePreview, setScrapePreview] = useState<{
    businessFacts?: string[]
    extraQa?: { q: string; a: string }[]
    serviceTags?: string[]
    warnings?: string[]
  } | null>(null)
  const [scrapeStatus, setScrapeStatus] = useState<string>('idle')
  const [approveLoading, setApproveLoading] = useState(false)

  // Selection state for scrape preview items
  const [selectedFacts, setSelectedFacts] = useState<Set<number>>(new Set())
  const [selectedQa, setSelectedQa] = useState<Set<number>>(new Set())

  // File upload state
  const [fileUploadOpen, setFileUploadOpen] = useState(false)
  const [fileDragging, setFileDragging] = useState(false)
  const docFileInputRef = useRef<HTMLInputElement>(null)

  // File upload preview flow
  const [uploadPreviewStatus, setUploadPreviewStatus] = useState<'idle' | 'loading' | 'preview' | 'approving' | 'done'>('idle')
  const [uploadPreviewData, setUploadPreviewData] = useState<{
    filename: string
    charCount: number
    truncated: boolean
    chunkCount: number
    contentType: { type: string; label: string; description: string; emoji: string }
    chunks: string[]
    hasMore: boolean
  } | null>(null)
  const [uploadPreviewError, setUploadPreviewError] = useState('')
  const [uploadDoneResult, setUploadDoneResult] = useState<{ filename: string; chunksCreated: number } | null>(null)
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set())

  // Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ ok: boolean; succeeded: number; failed: number; errors?: { index: number; error: string }[] } | null>(null)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  // Export state
  const [exportLoading, setExportLoading] = useState(false)

  // Refresh trigger for child components
  const [refreshKey, setRefreshKey] = useState(0)
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  async function handleTestQuery() {
    if (!testQuery.trim()) return
    setTestLoading(true)
    setTestError('')
    setTestResults(null)
    try {
      const res = await fetch('/api/dashboard/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query: testQuery.trim() }),
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

  async function handleToggleEnabled() {
    if (!onToggleEnabled) return
    setTogglingEnabled(true)
    await onToggleEnabled(!knowledgeEnabled)
    setTogglingEnabled(false)
  }

  async function handleAddChunk() {
    if (!addContent.trim()) return
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      const shouldAutoApprove = isAdmin
      const res = await fetch('/api/dashboard/knowledge/chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          content: addContent.trim(),
          chunk_type: addType,
          trust_tier: addTier,
          auto_approve: shouldAutoApprove,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to add' }))
        throw new Error(err.error ?? 'Failed to add chunk')
      }
      const data = await res.json()

      setAddContent('')
      setAddSuccess(data.chunk?.status === 'approved' ? 'Added — your agent knows this now' : 'Added as pending — needs approval')
      setTimeout(() => setAddSuccess(''), 4000)
      setShowAddForm(false)
      triggerRefresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add chunk')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleScrape() {
    if (!websiteUrl.trim()) return
    setScrapeLoading(true)
    setScrapeError('')
    setScrapePreview(null)
    setScrapeStatus('scraping')
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, url: websiteUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setScrapePreview(data.preview)
      setScrapeStatus(data.status)
      // Select all items by default
      const facts = data.preview?.businessFacts ?? []
      const qa = data.preview?.extraQa ?? []
      setSelectedFacts(new Set(facts.map((_: string, i: number) => i)))
      setSelectedQa(new Set(qa.map((_: { q: string; a: string }, i: number) => i)))
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed')
      setScrapeStatus('failed')
    } finally {
      setScrapeLoading(false)
    }
  }

  function toggleFact(idx: number) {
    setSelectedFacts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function toggleQa(idx: number) {
    setSelectedQa(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const selectedCount = selectedFacts.size + selectedQa.size

  async function handleBulkImport() {
    if (!bulkJson.trim()) return
    setBulkLoading(true)
    setBulkResult(null)
    try {
      let chunks: unknown[]
      try {
        const parsed = JSON.parse(bulkJson)
        // Support both {chunks: [...]} wrapper and raw array
        chunks = Array.isArray(parsed) ? parsed : parsed.chunks
        if (!Array.isArray(chunks)) throw new Error('Expected an array')
      } catch {
        setBulkResult({ ok: false, succeeded: 0, failed: 0, errors: [{ index: 0, error: 'Invalid JSON — must be an array of {content, chunk_type?, trust_tier?}' }] })
        setBulkLoading(false)
        return
      }

      const res = await fetch('/api/dashboard/knowledge/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, chunks, auto_approve: isAdmin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bulk import failed')
      setBulkResult(data)
      if (data.succeeded > 0) {
        triggerRefresh()
        setBulkJson('')
      }
    } catch (err) {
      setBulkResult({ ok: false, succeeded: 0, failed: 0, errors: [{ index: 0, error: err instanceof Error ? err.message : 'Import failed' }] })
    } finally {
      setBulkLoading(false)
    }
  }

  function handleBulkFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setBulkJson(reader.result as string)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleDocFileUpload(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = new Set(['pdf', 'txt', 'docx', 'csv'])
    if (!allowed.has(ext)) {
      setUploadPreviewError('Unsupported file type. Allowed: PDF, TXT, DOCX, CSV')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadPreviewError('File too large (max 5MB)')
      return
    }
    setUploadPreviewStatus('loading')
    setUploadPreviewError('')
    setUploadPreviewData(null)
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
      setUploadPreviewData(data)
      setSelectedChunks(new Set(data.chunks.map((_: string, i: number) => i)))
      setUploadPreviewStatus('preview')
    } catch (err) {
      setUploadPreviewError(err instanceof Error ? err.message : 'Failed to read file')
      setUploadPreviewStatus('idle')
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
    if (!uploadPreviewData) return
    if (selectedChunks.size === uploadPreviewData.chunks.length) {
      setSelectedChunks(new Set())
    } else {
      setSelectedChunks(new Set(uploadPreviewData.chunks.map((_, i) => i)))
    }
  }

  async function handleApproveUpload() {
    if (!uploadPreviewData) return
    setUploadPreviewStatus('approving')
    setUploadPreviewError('')
    try {
      const chunks = uploadPreviewData.chunks
        .filter((_, i) => selectedChunks.has(i))
        .map(content => ({
          content,
          chunk_type: 'document',
          trust_tier: 'high',
          source: 'knowledge_doc',
        }))
      if (chunks.length === 0) return

      // Batch if needed (bulk-import limit is 100)
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

      setUploadDoneResult({ filename: uploadPreviewData.filename, chunksCreated: totalSucceeded })
      setUploadPreviewStatus('done')
      triggerRefresh()
    } catch (err) {
      setUploadPreviewError(err instanceof Error ? err.message : 'Failed to add chunks')
      setUploadPreviewStatus('preview')
    }
  }

  function resetUploadFlow() {
    setUploadPreviewStatus('idle')
    setUploadPreviewData(null)
    setUploadPreviewError('')
    setUploadDoneResult(null)
    setSelectedChunks(new Set())
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const params = new URLSearchParams({ client_id: clientId })
      const res = await fetch(`/api/dashboard/knowledge/export?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `knowledge-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent — could add error state if needed
    } finally {
      setExportLoading(false)
    }
  }

  function handleGapAnswered() {
    triggerRefresh()
  }

  async function handleApproveWebsiteKnowledge() {
    if (selectedCount === 0) return
    setApproveLoading(true)
    setScrapeError('')
    try {
      // Build approved package with only the selected items
      const approvedPackage = {
        businessFacts: (scrapePreview?.businessFacts ?? []).filter((_, i) => selectedFacts.has(i)),
        extraQa: (scrapePreview?.extraQa ?? []).filter((_, i) => selectedQa.has(i)),
        serviceTags: scrapePreview?.serviceTags ?? [],
      }
      const res = await fetch('/api/dashboard/approve-website-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, approved: approvedPackage, auto_approve: isAdmin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approval failed')
      setScrapeStatus('approved')
      triggerRefresh()
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproveLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold t1">Knowledge Base</h3>
          <p className="text-xs t3 mt-1">
            Your agent searches this knowledge base to answer detailed questions during calls.
          </p>
        </div>
        {isAdmin && onToggleEnabled && (
          <button
            onClick={handleToggleEnabled}
            disabled={togglingEnabled || previewMode}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              knowledgeEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                : 'bg-hover t3 border b-theme hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20'
            } disabled:opacity-40`}
          >
            {togglingEnabled ? '...' : knowledgeEnabled ? 'Enabled' : 'Enable'}
          </button>
        )}
      </div>

      {/* Disabled state */}
      {!knowledgeEnabled && (
        <div className="rounded-xl border b-theme bg-hover p-6 text-center space-y-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto t3">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p className="text-sm font-medium t2">Knowledge base not enabled</p>
            <p className="text-xs t3 mt-1">Enable the knowledge base to let your agent answer detailed questions from embedded knowledge chunks.</p>
          </div>
          {isAdmin && onToggleEnabled && (
            <button
              onClick={handleToggleEnabled}
              disabled={togglingEnabled || previewMode}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
            >
              {togglingEnabled ? 'Enabling...' : 'Enable Knowledge Base'}
            </button>
          )}
        </div>
      )}

      {/* Only show when enabled */}
      {knowledgeEnabled && (
        <>
          {/* Add Knowledge + Website Scrape section */}
          <div className="rounded-xl border b-theme overflow-hidden">
            <div className="px-4 py-3 border-b b-theme flex items-center justify-between">
              <p className="text-xs font-semibold t2">Add Knowledge</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddForm(v => !v); setBulkImportOpen(false); setFileUploadOpen(false); setScrapeStatus('idle'); setScrapePreview(null) }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    showAddForm
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-hover t2 border b-theme hover:opacity-80'
                  }`}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => { setFileUploadOpen(v => !v); setShowAddForm(false); setBulkImportOpen(false); setScrapeStatus('idle'); setScrapePreview(null); resetUploadFlow() }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    fileUploadOpen
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-hover t2 border b-theme hover:opacity-80'
                  }`}
                >
                  File Upload
                </button>
                <button
                  onClick={() => { setBulkImportOpen(v => !v); setShowAddForm(false); setFileUploadOpen(false); setScrapeStatus('idle'); setScrapePreview(null) }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    bulkImportOpen
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-hover t2 border b-theme hover:opacity-80'
                  }`}
                >
                  Bulk Import
                </button>
                <button
                  onClick={handleExport}
                  disabled={exportLoading || previewMode}
                  className="px-3 py-1 rounded-lg text-[11px] font-medium bg-hover t2 border b-theme hover:opacity-80 disabled:opacity-50 transition-colors"
                >
                  {exportLoading ? '...' : 'Export'}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Manual entry form */}
              {showAddForm && (
                <div className="space-y-3">
                  <textarea
                    value={addContent}
                    onChange={e => setAddContent(e.target.value)}
                    rows={3}
                    placeholder="Type a fact, Q&A pair, or any knowledge your agent should know..."
                    className="w-full bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/50 resize-y"
                    maxLength={5000}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] t3 font-medium">Type:</label>
                      <select
                        value={addType}
                        onChange={e => setAddType(e.target.value as 'fact' | 'qa' | 'manual')}
                        className="bg-hover border b-theme rounded px-2 py-1 text-[11px] t2 focus:outline-none"
                      >
                        <option value="manual">General</option>
                        <option value="fact">Fact</option>
                        <option value="qa">Q&A</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] t3 font-medium">Trust:</label>
                      <select
                        value={addTier}
                        onChange={e => setAddTier(e.target.value as 'high' | 'medium' | 'low')}
                        className="bg-hover border b-theme rounded px-2 py-1 text-[11px] t2 focus:outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[10px] t3">{addContent.length}/5000</span>
                      <button
                        onClick={handleAddChunk}
                        disabled={addLoading || !addContent.trim() || previewMode}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {addLoading ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                  {addError && (
                    <p className="text-[11px] text-red-400">{addError}</p>
                  )}
                  {addSuccess && (
                    <p className="text-[11px] text-green-400">{addSuccess}</p>
                  )}
                </div>
              )}

              {/* File upload form */}
              {fileUploadOpen && (
                <div className="space-y-3">

                  {/* ── Drop zone (idle) ─────────────────────────────────── */}
                  {uploadPreviewStatus === 'idle' && (
                    <>
                      <p className="text-xs t3">
                        Upload a PDF, TXT, DOCX, or CSV file. We&apos;ll extract the content and let you review it before it goes into the knowledge base.
                      </p>
                      <div
                        onDragOver={e => { e.preventDefault(); setFileDragging(true) }}
                        onDragLeave={e => { e.preventDefault(); setFileDragging(false) }}
                        onDrop={e => {
                          e.preventDefault()
                          setFileDragging(false)
                          const file = e.dataTransfer.files[0]
                          if (file) handleDocFileUpload(file)
                        }}
                        onClick={() => docFileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-all ${
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
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleDocFileUpload(file)
                            e.target.value = ''
                          }}
                        />
                      </div>
                      {uploadPreviewError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                          {uploadPreviewError}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Loading orb (extracting) ─────────────────────────── */}
                  {uploadPreviewStatus === 'loading' && (
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

                  {/* ── Preview (review chunks) ──────────────────────────── */}
                  {uploadPreviewStatus === 'preview' && uploadPreviewData && (
                    <div className="space-y-3">
                      {/* Content type detection badge */}
                      <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                        <span className="text-xl leading-none">{uploadPreviewData.contentType.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-emerald-300">{uploadPreviewData.contentType.label}</p>
                          <p className="text-[10px] t3">{uploadPreviewData.contentType.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-mono font-bold text-emerald-400">{uploadPreviewData.chunkCount}</p>
                          <p className="text-[10px] t3">chunks</p>
                        </div>
                      </div>

                      {/* File + size */}
                      <div className="flex items-center gap-2 px-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-xs t2 font-medium truncate">{uploadPreviewData.filename}</span>
                        <span className="text-[10px] t3 shrink-0 ml-auto">
                          {uploadPreviewData.charCount >= 1000
                            ? `${(uploadPreviewData.charCount / 1000).toFixed(1)}K chars`
                            : `${uploadPreviewData.charCount} chars`}
                          {uploadPreviewData.truncated && ' (truncated to 50K)'}
                        </span>
                      </div>

                      {/* Chunk list */}
                      <div className="rounded-lg border b-theme overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b b-theme">
                          <p className="text-[10px] t3 font-semibold">
                            {selectedChunks.size} of {uploadPreviewData.chunks.length} chunks selected
                            {uploadPreviewData.hasMore && ' (first 50 shown)'}
                          </p>
                          <button onClick={toggleAllChunks} className="text-[11px] text-blue-400 hover:opacity-75 transition-opacity">
                            {selectedChunks.size === uploadPreviewData.chunks.length ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div className="max-h-52 overflow-y-auto divide-y divide-[var(--border-color,rgba(255,255,255,0.08))]">
                          {uploadPreviewData.chunks.map((chunk, i) => (
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

                      {uploadPreviewError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                          {uploadPreviewError}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={resetUploadFlow}
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

                  {/* ── Embedding orb (approving) ────────────────────────── */}
                  {uploadPreviewStatus === 'approving' && (
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

                  {/* ── Success card ─────────────────────────────────────── */}
                  {uploadPreviewStatus === 'done' && uploadDoneResult && (
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
                            <strong className="text-green-400">{uploadDoneResult.chunksCreated}</strong> chunk{uploadDoneResult.chunksCreated !== 1 ? 's' : ''} from <strong className="t2">{uploadDoneResult.filename}</strong> are now searchable by your agent.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetUploadFlow}
                        className="w-full px-4 py-2 rounded-lg text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
                      >
                        Upload Another File
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* Bulk import form */}
              {bulkImportOpen && (
                <div className="space-y-3">
                  <p className="text-xs t3">
                    Paste a JSON array of chunks or upload a JSON file. Each chunk needs a <code className="text-[10px] bg-hover px-1 rounded">content</code> field.
                    Optional: <code className="text-[10px] bg-hover px-1 rounded">chunk_type</code>, <code className="text-[10px] bg-hover px-1 rounded">trust_tier</code>.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                    >
                      Upload JSON File
                    </button>
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleBulkFileUpload}
                      className="hidden"
                    />
                  </div>
                  <textarea
                    value={bulkJson}
                    onChange={e => setBulkJson(e.target.value)}
                    rows={6}
                    placeholder={`[\n  {"content": "We are open Monday to Friday, 9am to 5pm", "chunk_type": "fact", "trust_tier": "high"},\n  {"content": "Q: Do you offer free estimates?\\nA: Yes, all estimates are free.", "chunk_type": "qa"}\n]`}
                    className="w-full bg-transparent border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono placeholder:t3 focus:outline-none focus:border-purple-500/50 resize-y"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] t3">
                      {bulkJson.trim() ? (() => { try { const p = JSON.parse(bulkJson); const arr = Array.isArray(p) ? p : p.chunks; return `${Array.isArray(arr) ? arr.length : 0} chunks detected` } catch { return 'Invalid JSON' } })() : 'Paste or upload JSON'}
                    </span>
                    <button
                      onClick={handleBulkImport}
                      disabled={bulkLoading || !bulkJson.trim() || previewMode}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors"
                    >
                      {bulkLoading ? 'Importing...' : 'Import All'}
                    </button>
                  </div>
                  {bulkResult && (
                    <div className={`rounded-lg px-3 py-2 text-xs ${bulkResult.ok ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                      {bulkResult.ok
                        ? `Imported ${bulkResult.succeeded} chunks successfully.`
                        : `${bulkResult.succeeded} succeeded, ${bulkResult.failed} failed.${bulkResult.errors?.length ? ` Errors: ${bulkResult.errors.map(e => e.error).join('; ')}` : ''}`
                      }
                    </div>
                  )}
                </div>
              )}

              {/* Website scrape section */}
              {!showAddForm && !bulkImportOpen && !fileUploadOpen && (
                <div className="space-y-3">
                  <p className="text-xs t3">
                    Scrape a website to extract business facts and Q&A. Extracted content goes to pending review before your agent can use it.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="flex-1 bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 font-mono placeholder:t3 focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={handleScrape}
                      disabled={scrapeLoading || !websiteUrl.trim() || previewMode}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
                    >
                      {scrapeLoading ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : 'Scrape Website'}
                    </button>
                  </div>

                  {scrapeError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
                      {scrapeError}
                    </div>
                  )}

                  {/* Scrape preview */}
                  {scrapeStatus === 'extracted' && scrapePreview && (
                    <div className="space-y-3 rounded-lg border b-theme p-3">
                      <p className="text-[10px] font-semibold t3 uppercase tracking-wider">Extracted Preview</p>

                      {scrapePreview.businessFacts && scrapePreview.businessFacts.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] t3 font-medium">{selectedFacts.size}/{scrapePreview.businessFacts.length} Facts selected</p>
                            <button
                              onClick={() => {
                                if (selectedFacts.size === scrapePreview.businessFacts!.length) {
                                  setSelectedFacts(new Set())
                                } else {
                                  setSelectedFacts(new Set(scrapePreview.businessFacts!.map((_, i) => i)))
                                }
                              }}
                              className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer"
                            >
                              {selectedFacts.size === scrapePreview.businessFacts.length ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                          <ul className="space-y-0.5">
                            {scrapePreview.businessFacts.map((fact, i) => (
                              <li
                                key={i}
                                onClick={() => toggleFact(i)}
                                className={`text-[11px] leading-relaxed flex items-start gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                                  selectedFacts.has(i)
                                    ? 't2 hover:bg-hover'
                                    : 't3 line-through hover:bg-hover'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFacts.has(i)}
                                  onChange={() => toggleFact(i)}
                                  className="mt-0.5 shrink-0 accent-blue-500"
                                />
                                {fact}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {scrapePreview.extraQa && scrapePreview.extraQa.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] t3 font-medium">{selectedQa.size}/{scrapePreview.extraQa.length} Q&A Pairs selected</p>
                            <button
                              onClick={() => {
                                if (selectedQa.size === scrapePreview.extraQa!.length) {
                                  setSelectedQa(new Set())
                                } else {
                                  setSelectedQa(new Set(scrapePreview.extraQa!.map((_, i) => i)))
                                }
                              }}
                              className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer"
                            >
                              {selectedQa.size === scrapePreview.extraQa.length ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {scrapePreview.extraQa.map((qa, i) => (
                              <div
                                key={i}
                                onClick={() => toggleQa(i)}
                                className={`rounded-lg border p-2 cursor-pointer transition-colors ${
                                  selectedQa.has(i)
                                    ? 'bg-black/10 b-theme'
                                    : 'bg-transparent b-theme opacity-40'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedQa.has(i)}
                                    onChange={() => toggleQa(i)}
                                    className="mt-0.5 shrink-0 accent-blue-500"
                                  />
                                  <div>
                                    <p className={`text-[11px] font-medium ${selectedQa.has(i) ? 't1' : 't3'}`}>Q: {qa.q}</p>
                                    <p className={`text-[11px] mt-0.5 ${selectedQa.has(i) ? 't2' : 't3'}`}>A: {qa.a}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {scrapePreview.warnings && scrapePreview.warnings.length > 0 && (
                        <div className="space-y-1">
                          {scrapePreview.warnings.map((w, i) => (
                            <p key={i} className="text-[10px] text-amber-400/80">{w}</p>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={handleApproveWebsiteKnowledge}
                        disabled={approveLoading || previewMode || selectedCount === 0}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-40"
                      >
                        {approveLoading
                          ? 'Processing...'
                          : selectedCount === 0
                            ? 'Select items to add'
                            : isAdmin
                              ? `Approve ${selectedCount} item${selectedCount !== 1 ? 's' : ''} to Knowledge Base`
                              : `Submit ${selectedCount} item${selectedCount !== 1 ? 's' : ''} for Review`}
                      </button>
                    </div>
                  )}

                  {scrapeStatus === 'approved' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/[0.07] border border-green-500/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[11px] text-green-400/90">
                        Website knowledge added to the knowledge base. {isAdmin ? 'Chunks auto-approved.' : 'Chunks pending review.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test Query */}
          <div className="rounded-xl border b-theme overflow-hidden">
            <div className="px-4 py-3 border-b b-theme flex items-center gap-2">
              <p className="text-xs font-semibold t2">Test Query</p>
              <span className="text-[9px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">pgvector</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs t3">
                Ask a question to see what your agent would find in the knowledge base. Only approved chunks are searched.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={e => setTestQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
                  placeholder="e.g. What areas do you cover?"
                  className="flex-1 bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={handleTestQuery}
                  disabled={testLoading || !testQuery.trim() || previewMode}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {testLoading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : 'Search'}
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
                    <p className="text-xs t3 py-2">No matching chunks found. The agent would say it's not sure and offer to follow up.</p>
                  ) : (
                    <>
                      <p className="text-[10px] t3">{testResults.length} chunk{testResults.length !== 1 ? 's' : ''} matched</p>
                      {testResults.map((result, i) => (
                        <div key={i} className="rounded-lg border b-theme p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                result.trust_tier === 'high' ? 'bg-green-400/10 text-green-400'
                                  : result.trust_tier === 'low' ? 'bg-red-400/10 text-red-400'
                                  : 'bg-amber-400/10 text-amber-400'
                              }`}>
                                {result.trust_tier}
                              </span>
                              <span className="text-[10px] font-medium t3 truncate">{result.source}</span>
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 ${
                              result.similarity >= 0.7 ? 'text-green-400' : result.similarity >= 0.4 ? 'text-amber-400' : 't3'
                            }`}>
                              {(result.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs t2 leading-relaxed whitespace-pre-wrap">{result.content}</p>
                          <div className="flex items-center gap-3 text-[10px] t3">
                            <span>type: {result.chunk_type}</span>
                            <span>rrf: {result.rrf_score.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Gaps — unanswered caller questions */}
          <KnowledgeGaps clientId={clientId} isAdmin={isAdmin} onAnswered={handleGapAnswered} onGapCountChange={onGapCountChange} key={`gaps-${refreshKey}`} />

          {/* Pending suggestions + Chunk browser */}
          <PendingSuggestions clientId={clientId} key={`pending-${refreshKey}`} />
          <ChunkBrowser clientId={clientId} isAdmin={isAdmin} key={`browser-${refreshKey}`} />
        </>
      )}
    </div>
  )
}
