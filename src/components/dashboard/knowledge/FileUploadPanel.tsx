'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface FileUploadPanelProps {
  clientId: string
  previewMode?: boolean
  onChunkAdded: () => void
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemKind =
  | 'business_fact'
  | 'faq_pair'
  | 'operating_policy'
  | 'call_behavior_instruction'
  | 'pricing_or_offer'
  | 'hours_or_availability'
  | 'location_or_service_area'
  | 'unsupported_or_ambiguous'
  | 'conflict_flag'

interface NormalizedItem {
  kind: ItemKind
  question: string
  answer: string
  fact_text: string
  confidence: number
  requires_manual_review: boolean
  review_reason: string
}

// Per-file queue entry
interface QueuedFile {
  file: File
  id: string // stable key for React rendering
}

// Result after applying or skipping a file
interface BatchResult {
  filename: string
  applied: boolean
  faqsAdded: number
  chunksCreated: number
}

// ── Kind metadata (mirrors KnowledgeCompiler.tsx) ─────────────────────────────

const KIND_META: Record<ItemKind, { label: string; color: string; approvable: boolean }> = {
  business_fact:             { label: 'Fact',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       approvable: true },
  faq_pair:                  { label: 'FAQ',       color: 'bg-green-500/10 text-green-400 border-green-500/20',    approvable: true },
  operating_policy:          { label: 'Policy',    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    approvable: true },
  pricing_or_offer:          { label: 'Pricing',   color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', approvable: true },
  hours_or_availability:     { label: 'Hours',     color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',       approvable: true },
  location_or_service_area:  { label: 'Location',  color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',      approvable: true },
  call_behavior_instruction: { label: 'Behavior',  color: 'bg-red-500/10 text-red-400 border-red-500/20',         approvable: false },
  unsupported_or_ambiguous:  { label: 'Ambiguous', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',      approvable: false },
  conflict_flag:             { label: 'Conflict',  color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', approvable: false },
}

const HIGH_RISK_KINDS = new Set<ItemKind>([
  'pricing_or_offer',
  'hours_or_availability',
  'location_or_service_area',
  'operating_policy',
])

// ── Sub-components ────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: ItemKind }) {
  const meta = KIND_META[kind]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.9 ? 'bg-green-400' : value >= 0.7 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`}
      title={`Confidence: ${Math.round(value * 100)}%`}
    />
  )
}

let queueIdCounter = 0
function nextQueueId() {
  return `qf-${++queueIdCounter}`
}

export default function FileUploadPanel({ clientId, previewMode, onChunkAdded }: FileUploadPanelProps) {
  const [fileDragging, setFileDragging] = useState(false)
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const [quota, setQuota] = useState<{ used: number; max: number } | null>(null)

  // ── Batch queue ────────────────────────────────────────────────────────────
  // Files waiting to be processed (shown before any processing starts)
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  // Index into fileQueue of the file currently being processed
  const [batchIndex, setBatchIndex] = useState(0)
  // Results from completed files (applied or skipped)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  // Whether we are actively working through the queue
  const [batchActive, setBatchActive] = useState(false)

  // Dedup state — set when a pending file matches an existing doc
  const [dupWarning, setDupWarning] = useState<{
    file: File
    existingDocId: string
    existingFilename: string
    existingChunkCount: number
  } | null>(null)

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

  // status flow: idle → extracting → analyzing → review → applying → done
  // batch wraps the above: queue building happens in idle (batchActive=false)
  type Status = 'idle' | 'extracting' | 'analyzing' | 'review' | 'applying' | 'done'
  const [status, setStatus] = useState<Status>('idle')

  // File metadata from upload-preview
  const [fileInfo, setFileInfo] = useState<{
    filename: string
    charCount: number
    truncated: boolean
    chunkCount: number
    contentType: { type: string; label: string; description: string; emoji: string }
  } | null>(null)

  // Compile results
  const [items, setItems] = useState<NormalizedItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [approved, setApproved] = useState<boolean[]>([])
  const [verifiedHighRisk, setVerifiedHighRisk] = useState<Set<number>>(new Set())

  // Fallback: raw paragraphs if compile returns 0 items
  const [fallbackMode, setFallbackMode] = useState(false)
  const [rawChunks, setRawChunks] = useState<string[]>([])
  const [selectedRawChunks, setSelectedRawChunks] = useState<Set<number>>(new Set())

  const [previewError, setPreviewError] = useState('')
  const [doneResult, setDoneResult] = useState<{ filename: string; faqsAdded: number; chunksCreated: number } | null>(null)

  // ── File queue helpers ─────────────────────────────────────────────────────

  const ALLOWED_EXTS = new Set(['pdf', 'txt', 'docx', 'csv'])

  function addFilesToQueue(files: File[]) {
    const valid: QueuedFile[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTS.has(ext)) {
        setPreviewError(`"${file.name}" is not a supported type (PDF, TXT, DOCX, CSV)`)
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setPreviewError(`"${file.name}" exceeds the 5MB limit`)
        continue
      }
      valid.push({ file, id: nextQueueId() })
    }
    if (valid.length > 0) {
      setPreviewError('')
      setFileQueue(prev => [...prev, ...valid])
    }
  }

  function removeFromQueue(id: string) {
    setFileQueue(prev => prev.filter(q => q.id !== id))
  }

  // ── File upload → extract → compile ─────────────────────────────────────────

  const processFile = useCallback(async (file: File, skipDedupCheck = false) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTS.has(ext)) {
      setPreviewError('Unsupported file type. Allowed: PDF, TXT, DOCX, CSV')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPreviewError('File too large (max 5MB)')
      return
    }

    // ── Dedup check: warn if a doc with the same filename already exists ──────
    if (!skipDedupCheck) {
      try {
        const docsRes = await fetch(`/api/dashboard/knowledge/docs?client_id=${clientId}`)
        if (docsRes.ok) {
          const docsData = await docsRes.json() as { docs: Array<{ id: string; filename: string; char_count: number }> }
          const existing = docsData.docs?.find(d => d.filename === file.name)
          if (existing) {
            const approxChunks = Math.max(1, Math.round((existing.char_count ?? 0) / 500))
            setDupWarning({ file, existingDocId: existing.id, existingFilename: existing.filename, existingChunkCount: approxChunks })
            return
          }
        }
      } catch {
        // Non-fatal — proceed with upload if check fails
      }
    }

    setDupWarning(null)
    setStatus('extracting')
    setPreviewError('')
    setFileInfo(null)
    setItems([])
    setWarnings([])
    setApproved([])
    setVerifiedHighRisk(new Set())
    setFallbackMode(false)
    setRawChunks([])
    setSelectedRawChunks(new Set())

    // Step 1: extract text from file
    let extractedChunks: string[] = []
    let extractedFilename = file.name
    let extractedCharCount = 0
    let extractedTruncated = false
    let extractedChunkCount = 0
    let contentType: { type: string; label: string; description: string; emoji: string } | null = null

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

      extractedChunks = data.chunks as string[]
      extractedFilename = data.filename as string
      extractedCharCount = data.charCount as number
      extractedTruncated = data.truncated as boolean
      extractedChunkCount = data.chunkCount as number
      contentType = data.contentType as { type: string; label: string; description: string; emoji: string }

      setFileInfo({
        filename: extractedFilename,
        charCount: extractedCharCount,
        truncated: extractedTruncated,
        chunkCount: extractedChunkCount,
        contentType: contentType!,
      })
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to read file')
      setStatus('idle')
      return
    }

    // Step 2: pass extracted text through the AI compile pipeline
    setStatus('analyzing')

    const rawText = extractedChunks.join('\n\n')
    const compileInput = rawText.slice(0, 20_000)

    try {
      const res = await fetch('/api/dashboard/knowledge/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: compileInput, client_id: clientId }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.warn('[FileUploadPanel] compile failed, falling back to raw chunks:', data.error)
        setFallbackMode(true)
        setRawChunks(extractedChunks)
        setSelectedRawChunks(new Set(extractedChunks.map((_, i) => i)))
        setStatus('review')
        return
      }

      const compiledItems = (data.items ?? []) as NormalizedItem[]
      setWarnings(data.warnings ?? [])

      if (compiledItems.length === 0) {
        setFallbackMode(true)
        setRawChunks(extractedChunks)
        setSelectedRawChunks(new Set(extractedChunks.map((_, i) => i)))
        setStatus('review')
        return
      }

      setItems(compiledItems)
      setApproved(compiledItems.map(item =>
        KIND_META[item.kind].approvable && !item.requires_manual_review
      ))
      setStatus('review')
    } catch (err) {
      console.warn('[FileUploadPanel] compile error, falling back:', err)
      setFallbackMode(true)
      setRawChunks(extractedChunks)
      setSelectedRawChunks(new Set(extractedChunks.map((_, i) => i)))
      setStatus('review')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // ── Start batch processing ─────────────────────────────────────────────────

  async function startBatch() {
    if (fileQueue.length === 0) return
    setBatchActive(true)
    setBatchIndex(0)
    setBatchResults([])
    await processFile(fileQueue[0].file)
  }

  // Advance to next file in batch, recording the result of the current file
  async function advanceBatch(result: BatchResult) {
    setBatchResults(prev => [...prev, result])
    const nextIndex = batchIndex + 1
    if (nextIndex >= fileQueue.length) {
      // All files done — show summary
      setBatchActive(false)
      setStatus('done')
      setDoneResult(null) // summary will use batchResults instead
    } else {
      setBatchIndex(nextIndex)
      await processFile(fileQueue[nextIndex].file)
    }
  }

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  function toggleItem(i: number) {
    setApproved(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  function toggleVerified(i: number) {
    setVerifiedHighRisk(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleRawChunk(i: number) {
    setSelectedRawChunks(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAllRawChunks() {
    if (selectedRawChunks.size === rawChunks.length) {
      setSelectedRawChunks(new Set())
    } else {
      setSelectedRawChunks(new Set(rawChunks.map((_, i) => i)))
    }
  }

  // ── Apply (AI compile path) ────────────────────────────────────────────────

  async function handleApplyCompiled() {
    if (!fileInfo) return
    const faqItems: { q: string; a: string }[] = []
    const factItems: { kind: string; text: string }[] = []
    const conflictItems: { content: string; review_reason: string }[] = []

    items.forEach((item, i) => {
      if (item.kind === 'conflict_flag') {
        conflictItems.push({ content: item.fact_text || item.review_reason, review_reason: item.review_reason })
        return
      }
      if (!approved[i]) return
      if (item.kind === 'faq_pair') {
        faqItems.push({ q: item.question, a: item.answer })
      } else if (KIND_META[item.kind].approvable) {
        factItems.push({ kind: item.kind, text: item.fact_text })
      }
    })

    if (faqItems.length === 0 && factItems.length === 0) return

    setStatus('applying')
    setPreviewError('')
    try {
      const res = await fetch('/api/dashboard/knowledge/compile/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faq_items: faqItems, fact_items: factItems, conflict_items: conflictItems, client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')

      onChunkAdded()

      const result: BatchResult = {
        filename: fileInfo.filename,
        applied: true,
        faqsAdded: data.faqsAdded ?? 0,
        chunksCreated: data.chunksCreated ?? 0,
      }

      if (batchActive && fileQueue.length > 1) {
        await advanceBatch(result)
      } else {
        setDoneResult({ filename: fileInfo.filename, faqsAdded: data.faqsAdded ?? 0, chunksCreated: data.chunksCreated ?? 0 })
        setStatus('done')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to save knowledge')
      setStatus('review')
    }
  }

  // ── Apply (fallback raw paragraphs path) ───────────────────────────────────

  async function handleApplyRaw() {
    if (!fileInfo) return
    const chunks = rawChunks
      .filter((_, i) => selectedRawChunks.has(i))
      .map(content => ({
        content,
        chunk_type: 'document',
        trust_tier: 'high',
        source: 'knowledge_doc',
      }))
    if (chunks.length === 0) return

    setStatus('applying')
    setPreviewError('')
    try {
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

      onChunkAdded()

      const result: BatchResult = {
        filename: fileInfo.filename,
        applied: true,
        faqsAdded: 0,
        chunksCreated: totalSucceeded,
      }

      if (batchActive && fileQueue.length > 1) {
        await advanceBatch(result)
      } else {
        setDoneResult({ filename: fileInfo.filename, faqsAdded: 0, chunksCreated: totalSucceeded })
        setStatus('done')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to add chunks')
      setStatus('review')
    }
  }

  // ── Skip current file in batch ─────────────────────────────────────────────

  async function handleSkipFile() {
    if (!fileInfo) return
    const result: BatchResult = {
      filename: fileInfo.filename,
      applied: false,
      faqsAdded: 0,
      chunksCreated: 0,
    }
    if (batchActive && fileQueue.length > 1) {
      await advanceBatch(result)
    } else {
      // Single file or last file — just reset
      reset()
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function reset() {
    setStatus('idle')
    setFileInfo(null)
    setItems([])
    setWarnings([])
    setApproved([])
    setVerifiedHighRisk(new Set())
    setFallbackMode(false)
    setRawChunks([])
    setSelectedRawChunks(new Set())
    setPreviewError('')
    setDoneResult(null)
    setDupWarning(null)
    setFileQueue([])
    setBatchIndex(0)
    setBatchResults([])
    setBatchActive(false)
  }

  // ── Dedup action handlers ──────────────────────────────────────────────────

  async function handleReplaceExisting() {
    if (!dupWarning) return
    try {
      await fetch(`/api/dashboard/knowledge/docs?id=${dupWarning.existingDocId}&client_id=${clientId}`, {
        method: 'DELETE',
      })
    } catch {
      // Non-fatal — proceed anyway
    }
    void processFile(dupWarning.file, true)
  }

  function handleKeepBoth() {
    if (!dupWarning) return
    void processFile(dupWarning.file, true)
  }

  // ── Derived state for review step ──────────────────────────────────────────

  const approvedCount = approved.filter(Boolean).length
  const approvableItems = items.filter(item => KIND_META[item.kind].approvable)
  const flaggedItems = items.filter(item => !KIND_META[item.kind].approvable)
  const hasFaqItems = items.some(item => item.kind === 'faq_pair')
  const unverifiedHighRisk = items.filter((item, i) =>
    approved[i] && HIGH_RISK_KINDS.has(item.kind) && !verifiedHighRisk.has(i)
  ).length
  const canApplyCompiled = approvedCount > 0 && unverifiedHighRisk === 0 && !previewMode
  const canApplyRaw = selectedRawChunks.size > 0 && !previewMode

  // Batch-aware label helpers
  const isBatch = batchActive && fileQueue.length > 1
  const batchLabel = isBatch ? `Processing ${batchIndex + 1} of ${fileQueue.length} — ${fileInfo?.filename ?? ''}` : null
  const batchSummaryApplied = batchResults.filter(r => r.applied).length
  const batchSummarySkipped = batchResults.filter(r => !r.applied).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── DUP WARNING ──────────────────────────────────────────────────── */}
      {dupWarning && status === 'idle' && (
        <div
          className="rounded-xl border p-3 space-y-2"
          style={{ borderColor: 'rgba(234,179,8,0.4)', backgroundColor: 'rgba(234,179,8,0.06)' }}
        >
          <div className="flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(234,179,8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="space-y-0.5">
              <p className="text-xs font-medium" style={{ color: 'rgb(234,179,8)' }}>
                You&apos;ve already uploaded &apos;{dupWarning.existingFilename}&apos;
              </p>
              <p className="text-[11px] t3">
                Replace it (removes old content) or keep both?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplaceExisting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: 'rgb(234,179,8)' }}
            >
              Replace
            </button>
            <button
              onClick={handleKeepBoth}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
            >
              Keep both
            </button>
            <button
              onClick={() => setDupWarning(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium t3 hover:t2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── IDLE — drop zone + queue builder ─────────────────────────────── */}
      {status === 'idle' && !dupWarning && (
        <>
          {quota !== null && (
            <div
              className="rounded-lg border px-3 py-2.5 space-y-1.5"
              style={{
                borderColor: atLimit ? 'rgba(239,68,68,0.3)' : 'var(--color-border)',
                backgroundColor: atLimit ? 'rgba(239,68,68,0.05)' : 'var(--color-hover)',
              }}
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
            Upload one or more PDF, TXT, DOCX, or CSV files. The AI will classify and extract each piece of knowledge for your review before saving.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { if (!atLimit) { e.preventDefault(); setFileDragging(true) } }}
            onDragLeave={e => { e.preventDefault(); setFileDragging(false) }}
            onDrop={e => {
              e.preventDefault()
              setFileDragging(false)
              if (atLimit) return
              const files = Array.from(e.dataTransfer.files)
              if (files.length > 0) addFilesToQueue(files)
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
            <p className="text-xs font-medium t2">Drop files here or click to upload</p>
            <p className="text-[10px] t3 mt-1">PDF, TXT, DOCX, or CSV — max 5MB each — multiple files supported</p>
            <input
              ref={docFileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.csv"
              multiple
              className="hidden"
              disabled={atLimit}
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0) addFilesToQueue(files)
                e.target.value = ''
              }}
            />
          </div>

          {/* Queue list */}
          {fileQueue.length > 0 && (
            <div className="rounded-xl border b-theme overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b b-theme">
                <p className="text-[11px] font-semibold t2">
                  {fileQueue.length} file{fileQueue.length !== 1 ? 's' : ''} ready
                </p>
                <button
                  onClick={() => setFileQueue([])}
                  className="text-[10px] t3 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="divide-y divide-[var(--border-color,rgba(255,255,255,0.08))]">
                {fileQueue.map(qf => (
                  <div key={qf.id} className="flex items-center gap-2 px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] t2 flex-1 truncate">{qf.file.name}</span>
                    <span className="text-[10px] t3 shrink-0">
                      {qf.file.size >= 1024 * 1024
                        ? `${(qf.file.size / 1024 / 1024).toFixed(1)}MB`
                        : `${Math.round(qf.file.size / 1024)}KB`}
                    </span>
                    <button
                      onClick={() => removeFromQueue(qf.id)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 t3 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2.5 border-t b-theme">
                <button
                  onClick={startBatch}
                  disabled={atLimit}
                  className="w-full px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Process {fileQueue.length > 1 ? `all ${fileQueue.length} files` : 'file'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {previewError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}
        </>
      )}

      {/* ── BATCH PROGRESS STRIP (shown during processing) ───────────────── */}
      {batchLabel && (status === 'extracting' || status === 'analyzing' || status === 'review' || status === 'applying') && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 border b-theme bg-surface">
          <div className="flex gap-0.5 items-center shrink-0">
            {fileQueue.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < batchIndex
                    ? 'w-3 bg-emerald-500'
                    : i === batchIndex
                      ? 'w-3 bg-blue-400 animate-pulse'
                      : 'w-3 bg-zinc-600'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] t3 truncate">{batchLabel}</p>
        </div>
      )}

      {/* ── EXTRACTING ───────────────────────────────────────────────────── */}
      {status === 'extracting' && (
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
            <p className="text-xs t3 mt-1">Extracting content</p>
          </div>
        </div>
      )}

      {/* ── ANALYZING ────────────────────────────────────────────────────── */}
      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-10 gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: '1.4s' }} />
            <div className="absolute inset-1.5 rounded-full bg-blue-500/25 animate-pulse" />
            <div className="absolute inset-3.5 rounded-full bg-blue-400/70 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium t2">Analyzing with AI...</p>
            <p className="text-xs t3 mt-1">Classifying knowledge items — this takes a few seconds</p>
          </div>
        </div>
      )}

      {/* ── REVIEW — AI classified items ─────────────────────────────────── */}
      {status === 'review' && fileInfo && !fallbackMode && (
        <div className="space-y-3">
          {/* File info bar */}
          <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
            <span className="text-xl leading-none">{fileInfo.contentType.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-300">{fileInfo.contentType.label}</p>
              <p className="text-[10px] t3 truncate">{fileInfo.filename}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-mono font-bold text-blue-400">{items.length}</p>
              <p className="text-[10px] t3">items found</p>
            </div>
          </div>

          {/* Stat line */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] t3">
              {approvedCount} of {approvableItems.length} items selected
              {unverifiedHighRisk > 0 && (
                <span className="ml-1 text-amber-400">· {unverifiedHighRisk} need verification</span>
              )}
            </p>
            <span className="text-[10px] t3">
              {fileInfo.charCount >= 1000
                ? `${(fileInfo.charCount / 1000).toFixed(1)}K chars`
                : `${fileInfo.charCount} chars`}
              {fileInfo.truncated && ' (truncated)'}
            </span>
          </div>

          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-400">{w}</p>
              ))}
            </div>
          )}

          {hasFaqItems && (
            <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <p className="text-[11px] text-blue-400 leading-snug">
                <span className="font-semibold">Note:</span> FAQs approved here are managed in{' '}
                <a href="/dashboard/settings?tab=knowledge" className="underline underline-offset-2 hover:opacity-75">Settings → FAQ</a>.
              </p>
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {items.map((item, i) => {
              const meta = KIND_META[item.kind]
              const isApprovable = meta.approvable
              const isApproved = approved[i]
              const displayText = item.kind === 'faq_pair'
                ? `Q: ${item.question}\nA: ${item.answer}`
                : item.fact_text

              return (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition-colors ${
                    isApprovable
                      ? isApproved
                        ? 'b-theme bg-green-500/5'
                        : 'b-theme bg-surface'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isApprovable ? (
                      <button
                        onClick={() => toggleItem(i)}
                        className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isApproved
                            ? 'bg-green-500 border-green-500'
                            : 'border-zinc-500 bg-surface'
                        }`}
                      >
                        {isApproved && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div className="mt-0.5 w-4 h-4 rounded border border-red-500/30 bg-red-500/10 shrink-0 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <KindBadge kind={item.kind} />
                        <ConfidenceDot value={item.confidence} />
                        {item.requires_manual_review && (
                          <span className="text-[9px] font-medium text-amber-400">review needed</span>
                        )}
                      </div>
                      <p className="text-[11px] t2 whitespace-pre-wrap break-words leading-relaxed">{displayText}</p>
                      {item.review_reason && (
                        <p className="text-[10px] text-amber-400/80 italic">{item.review_reason}</p>
                      )}
                      {isApprovable && isApproved && HIGH_RISK_KINDS.has(item.kind) && (
                        <label className="flex items-start gap-1.5 cursor-pointer mt-1 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <input
                            type="checkbox"
                            checked={verifiedHighRisk.has(i)}
                            onChange={() => toggleVerified(i)}
                            className="mt-0.5 w-3 h-3 accent-amber-500 shrink-0"
                          />
                          <span className="text-[10px] text-amber-400/90 leading-snug">
                            I&apos;ve verified this is current and accurate
                          </span>
                        </label>
                      )}
                      {!isApprovable && (
                        <p className="text-[10px] text-red-400/80">
                          {item.kind === 'call_behavior_instruction'
                            ? 'Behavior instructions require manual review — add them to the prompt directly.'
                            : 'Cannot be auto-imported — review and add manually if needed.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {flaggedItems.length > 0 && (
            <p className="text-[10px] t3">
              {flaggedItems.length} item{flaggedItems.length !== 1 ? 's' : ''} flagged for manual review — not included in import.
            </p>
          )}

          {previewError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}

          <div className="flex items-center gap-2">
            {!isBatch && (
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg text-xs t3 border b-theme hover:bg-hover transition-colors"
              >
                Cancel
              </button>
            )}
            {isBatch && (
              <button
                onClick={handleSkipFile}
                className="px-3 py-2 rounded-lg text-xs font-medium t3 border b-theme hover:bg-hover transition-colors whitespace-nowrap"
              >
                Skip →
              </button>
            )}
            <button
              onClick={handleApplyCompiled}
              disabled={!canApplyCompiled}
              title={
                previewMode
                  ? 'Preview mode — sign in to save'
                  : unverifiedHighRisk > 0
                    ? `Verify ${unverifiedHighRisk} item${unverifiedHighRisk !== 1 ? 's' : ''} before importing`
                    : undefined
              }
              className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
            >
              {isBatch
                ? `Apply ${approvedCount} item${approvedCount !== 1 ? 's' : ''}`
                : `Add ${approvedCount} item${approvedCount !== 1 ? 's' : ''} to Knowledge Base`}
            </button>
          </div>
        </div>
      )}

      {/* ── REVIEW — fallback raw paragraphs ─────────────────────────────── */}
      {status === 'review' && fileInfo && fallbackMode && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
            <span className="text-xl leading-none">{fileInfo.contentType.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-300">Manual review needed</p>
              <p className="text-[10px] t3">AI couldn&apos;t classify this document — review paragraphs manually</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-mono font-bold text-amber-400">{rawChunks.length}</p>
              <p className="text-[10px] t3">chunks</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs t2 font-medium truncate">{fileInfo.filename}</span>
            <span className="text-[10px] t3 shrink-0 ml-auto">
              {fileInfo.charCount >= 1000
                ? `${(fileInfo.charCount / 1000).toFixed(1)}K chars`
                : `${fileInfo.charCount} chars`}
              {fileInfo.truncated && ' (truncated to 50K)'}
            </span>
          </div>

          <div className="rounded-lg border b-theme overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b b-theme">
              <p className="text-[10px] t3 font-semibold">
                {selectedRawChunks.size} of {rawChunks.length} chunks selected
              </p>
              <button onClick={toggleAllRawChunks} className="text-[11px] text-blue-400 hover:opacity-75 transition-opacity">
                {selectedRawChunks.size === rawChunks.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-[var(--border-color,rgba(255,255,255,0.08))]">
              {rawChunks.map((chunk, i) => (
                <div
                  key={i}
                  onClick={() => toggleRawChunk(i)}
                  className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-hover ${
                    selectedRawChunks.has(i) ? '' : 'opacity-35'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRawChunks.has(i)}
                    onChange={() => toggleRawChunk(i)}
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
            {!isBatch && (
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg text-xs t3 border b-theme hover:bg-hover transition-colors"
              >
                Cancel
              </button>
            )}
            {isBatch && (
              <button
                onClick={handleSkipFile}
                className="px-3 py-2 rounded-lg text-xs font-medium t3 border b-theme hover:bg-hover transition-colors whitespace-nowrap"
              >
                Skip →
              </button>
            )}
            <button
              onClick={handleApplyRaw}
              disabled={!canApplyRaw}
              className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
            >
              {isBatch
                ? `Apply ${selectedRawChunks.size} chunk${selectedRawChunks.size !== 1 ? 's' : ''}`
                : `Add ${selectedRawChunks.size} chunk${selectedRawChunks.size !== 1 ? 's' : ''} to Knowledge Base`}
            </button>
          </div>
        </div>
      )}

      {/* ── APPLYING ─────────────────────────────────────────────────────── */}
      {status === 'applying' && (
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
            <p className="text-xs t3 mt-1">
              {fallbackMode
                ? `Adding ${selectedRawChunks.size} chunk${selectedRawChunks.size !== 1 ? 's' : ''}`
                : `Adding ${approvedCount} item${approvedCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      )}

      {/* ── DONE — single file ────────────────────────────────────────────── */}
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
              <div className="text-[11px] t3 mt-0.5 space-y-0.5">
                {doneResult.faqsAdded > 0 && (
                  <p><strong className="text-green-400">{doneResult.faqsAdded}</strong> FAQ{doneResult.faqsAdded !== 1 ? 's' : ''} added to Q&amp;A</p>
                )}
                {doneResult.chunksCreated > 0 && (
                  <p><strong className="text-green-400">{doneResult.chunksCreated}</strong> knowledge chunk{doneResult.chunksCreated !== 1 ? 's' : ''} from <strong className="t2">{doneResult.filename}</strong> are now searchable</p>
                )}
                {doneResult.faqsAdded === 0 && doneResult.chunksCreated === 0 && (
                  <p>Items saved (may have been duplicates)</p>
                )}
              </div>
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

      {/* ── DONE — batch summary ──────────────────────────────────────────── */}
      {status === 'done' && !doneResult && batchResults.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-green-400">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-300">
                  {batchResults.length} file{batchResults.length !== 1 ? 's' : ''} processed
                  {batchSummaryApplied > 0 && ` — ${batchSummaryApplied} applied`}
                  {batchSummarySkipped > 0 && `, ${batchSummarySkipped} skipped`}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {batchResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  {r.applied ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500/30 flex items-center justify-center shrink-0">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-600/40 flex items-center justify-center shrink-0">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="t3">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </div>
                  )}
                  <span className="text-[11px] t2 truncate flex-1">{r.filename}</span>
                  {r.applied && (r.faqsAdded > 0 || r.chunksCreated > 0) && (
                    <span className="text-[10px] text-green-400 shrink-0">
                      {[
                        r.faqsAdded > 0 && `${r.faqsAdded} FAQ${r.faqsAdded !== 1 ? 's' : ''}`,
                        r.chunksCreated > 0 && `${r.chunksCreated} chunk${r.chunksCreated !== 1 ? 's' : ''}`,
                      ].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {!r.applied && (
                    <span className="text-[10px] t3 shrink-0">skipped</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full px-4 py-2 rounded-lg text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
          >
            Upload More Files
          </button>
        </div>
      )}
    </div>
  )
}
