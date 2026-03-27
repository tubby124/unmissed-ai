'use client'

/**
 * KnowledgeTextInput — Paste unstructured text directly into the pgvector corpus.
 *
 * POST /api/dashboard/knowledge/ingest-text
 * Text is split into chunks, embedded, and auto-approved (high trust).
 *
 * Props:
 *   compact  — true  → renders inline (AgentKnowledgeCard sidebar)
 *              false → renders as a full card (knowledge page)
 */

import { useState } from 'react'
import { toast } from 'sonner'

interface KnowledgeTextInputProps {
  clientId: string
  isAdmin?: boolean
  /** Called after successful ingest with the number of chunks created. */
  onSuccess?: (chunksCreated: number) => void
  /** Compact mode: fewer rows, no outer card shell. */
  compact?: boolean
}

export default function KnowledgeTextInput({
  clientId,
  isAdmin = false,
  onSuccess,
  compact = false,
}: KnowledgeTextInputProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const charCount = text.length
  // Rough chunk estimate: ~800 chars per chunk on average
  const estimatedChunks = charCount > 0 ? Math.max(1, Math.ceil(charCount / 800)) : 0

  function reset() {
    setTitle('')
    setText('')
    setOpen(false)
  }

  async function ingest() {
    const trimText = text.trim()
    if (!trimText) return

    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/knowledge/ingest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimText,
          title: title.trim() || 'Manual text',
          ...(isAdmin ? { client_id: clientId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add knowledge')
      } else {
        toast.success(`${data.chunksCreated} chunk${data.chunksCreated !== 1 ? 's' : ''} added — searchable on next call`)
        onSuccess?.(data.chunksCreated)
        reset()
      }
    } catch {
      toast.error('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  // ── Collapsed trigger ─────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border b-theme bg-transparent hover:bg-hover text-xs t3 hover:t2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Paste knowledge text
      </button>
    )
  }

  // ── Expanded form ─────────────────────────────────────────────────────────────
  const form = (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Label — e.g. Service menu, Return policy, FAQ…"
        maxLength={120}
        className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/40 transition-colors"
      />
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste any text — pricing, policies, procedures, product specs, tenant info…"
        rows={compact ? 5 : 8}
        autoFocus
        className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/40 transition-colors resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] t3 shrink-0">
          {estimatedChunks > 0
            ? `~${estimatedChunks} chunk${estimatedChunks !== 1 ? 's' : ''} · ${charCount.toLocaleString()} chars`
            : 'Auto-split → embedded → searchable'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reset}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl text-xs t3 hover:t2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            Cancel
          </button>
          <button
            onClick={ingest}
            disabled={loading || !text.trim()}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            {loading ? 'Adding…' : 'Add to knowledge'}
          </button>
        </div>
      </div>
    </div>
  )

  // Compact: bare form (caller provides wrapping)
  if (compact) return form

  // Full: wrapped in a card shell matching the knowledge page style
  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 space-y-3">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Paste Text</p>
      </div>
      {form}
    </div>
  )
}
