'use client'

import { useState } from 'react'
import WebsiteScrapePanel from './WebsiteScrapePanel'
import FileUploadPanel from './FileUploadPanel'
import BulkImportPanel from './BulkImportPanel'

interface ManualAddFormProps {
  clientId: string
  isAdmin: boolean
  previewMode?: boolean
  websiteUrl?: string
  onChunkAdded: () => void
}

export default function ManualAddForm({
  clientId,
  isAdmin,
  previewMode,
  websiteUrl: initialWebsiteUrl,
  onChunkAdded,
}: ManualAddFormProps) {
  const [activePanel, setActivePanel] = useState<'scrape' | 'manual' | 'upload' | 'bulk'>('scrape')

  // Manual add state (kept here — it's small enough not to warrant a sub-component)
  const [addContent, setAddContent] = useState('')
  const [addType, setAddType] = useState<'fact' | 'qa' | 'manual'>('manual')
  const [addTier, setAddTier] = useState<'high' | 'medium' | 'low'>('medium')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  // Export (header-level action)
  const [exportLoading, setExportLoading] = useState(false)

  async function handleAddChunk() {
    if (!addContent.trim()) return
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      const res = await fetch('/api/dashboard/knowledge/chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          content: addContent.trim(),
          chunk_type: addType,
          trust_tier: addTier,
          auto_approve: isAdmin,
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
      setActivePanel('scrape')
      onChunkAdded()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add chunk')
    } finally {
      setAddLoading(false)
    }
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
      // silent
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="rounded-xl border b-theme overflow-hidden">
      <div className="px-4 py-3 border-b b-theme flex items-center justify-between">
        <p className="text-xs font-semibold t2">Add Knowledge</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('manual')}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              activePanel === 'manual'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-hover t2 border b-theme hover:opacity-80'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActivePanel('upload')}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              activePanel === 'upload'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-hover t2 border b-theme hover:opacity-80'
            }`}
          >
            File Upload
          </button>
          <button
            onClick={() => setActivePanel('bulk')}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              activePanel === 'bulk'
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
        {/* Manual entry */}
        {activePanel === 'manual' && (
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
            {addError && <p className="text-[11px] text-red-400">{addError}</p>}
            {addSuccess && <p className="text-[11px] text-green-400">{addSuccess}</p>}
          </div>
        )}

        {/* File upload */}
        {activePanel === 'upload' && (
          <FileUploadPanel
            clientId={clientId}
            previewMode={previewMode}
            onChunkAdded={onChunkAdded}
          />
        )}

        {/* Bulk import */}
        {activePanel === 'bulk' && (
          <BulkImportPanel
            clientId={clientId}
            isAdmin={isAdmin}
            previewMode={previewMode}
            onChunkAdded={onChunkAdded}
          />
        )}

        {/* Website scrape (default) */}
        {activePanel === 'scrape' && (
          <WebsiteScrapePanel
            clientId={clientId}
            isAdmin={isAdmin}
            previewMode={previewMode}
            initialWebsiteUrl={initialWebsiteUrl}
            onChunkAdded={onChunkAdded}
          />
        )}
      </div>
    </div>
  )
}
