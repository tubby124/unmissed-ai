'use client'

import { useState, useRef } from 'react'

interface BulkImportPanelProps {
  clientId: string
  isAdmin: boolean
  previewMode?: boolean
  onChunkAdded: () => void
}

export default function BulkImportPanel({ clientId, isAdmin, previewMode, onChunkAdded }: BulkImportPanelProps) {
  const [bulkJson, setBulkJson] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{
    ok: boolean
    succeeded: number
    failed: number
    errors?: { index: number; error: string }[]
  } | null>(null)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  async function handleBulkImport() {
    if (!bulkJson.trim()) return
    setBulkLoading(true)
    setBulkResult(null)
    try {
      let chunks: unknown[]
      try {
        const parsed = JSON.parse(bulkJson)
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
        onChunkAdded()
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
    reader.onload = () => { setBulkJson(reader.result as string) }
    reader.readAsText(file)
    e.target.value = ''
  }

  const chunkCount = (() => {
    if (!bulkJson.trim()) return null
    try {
      const p = JSON.parse(bulkJson)
      const arr = Array.isArray(p) ? p : p.chunks
      return Array.isArray(arr) ? arr.length : null
    } catch {
      return null
    }
  })()

  return (
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
          {chunkCount !== null ? `${chunkCount} chunks detected` : bulkJson.trim() ? 'Invalid JSON' : 'Paste or upload JSON'}
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
  )
}
