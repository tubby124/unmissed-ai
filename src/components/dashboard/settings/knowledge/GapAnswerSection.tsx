'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface GapEntry {
  query: string
  count: number
  last_seen: string
}

interface GapAnswerSectionProps {
  clientId: string
  gaps: GapEntry[]
  gapsCount: number
  isAdmin: boolean
  previewMode?: boolean
  extraQa: { q: string; a: string }[]
  onClientUpdate?: (updates: Partial<ClientConfig>) => void
  onGapResolved: (query: string) => void
  onGapsCountDecrement: () => void
}

export default function GapAnswerSection({
  clientId,
  gaps,
  gapsCount,
  isAdmin,
  previewMode,
  extraQa,
  onClientUpdate,
  onGapResolved,
  onGapsCountDecrement,
}: GapAnswerSectionProps) {
  const [answeringGap, setAnsweringGap] = useState<string | null>(null)
  const [gapAnswer, setGapAnswer] = useState('')
  const [gapSaving, setGapSaving] = useState(false)
  const [gapError, setGapError] = useState<string | null>(null)
  const [gapSuccess, setGapSuccess] = useState<string | null>(null)
  // Local accumulator so in-session saves stack correctly even when onClientUpdate is a no-op
  const [localExtraQa, setLocalExtraQa] = useState(extraQa)

  async function handleAddGapAnswer(query: string, destination: 'faq' | 'knowledge') {
    if (!gapAnswer.trim()) return
    setGapSaving(true)
    setGapError(null)
    setGapSuccess(null)
    try {
      if (destination === 'faq') {
        const newQa = [...localExtraQa, { q: query, a: gapAnswer.trim() }]
        const res = await fetch('/api/dashboard/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, extra_qa: newQa }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to save FAQ' }))
          throw new Error(data.error ?? 'Failed to save FAQ')
        }
        setLocalExtraQa(newQa)
        onClientUpdate?.({ extra_qa: newQa })
      } else {
        const content = `Q: ${query}\nA: ${gapAnswer.trim()}`
        const res = await fetch('/api/dashboard/knowledge/chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            content,
            chunk_type: 'gap_answer',
            trust_tier: 'high',
            source: 'gap_resolution',
            auto_approve: isAdmin,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to save chunk' }))
          throw new Error(data.error ?? 'Failed to save chunk')
        }
      }
      await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query, resolution_type: destination }),
      })
      onGapResolved(query)
      onGapsCountDecrement()
      const msg = destination === 'faq'
        ? 'Added as FAQ — agent will know this every call'
        : 'Added to knowledge base — agent will search this when relevant'
      setGapSuccess(msg)
      toast.success(msg)
      setAnsweringGap(null)
      setGapAnswer('')
      setTimeout(() => setGapSuccess(null), 4000)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save answer'
      setGapError(errMsg)
      toast.error(errMsg)
    } finally {
      setGapSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-amber-400">Unanswered Questions</p>
        {gapsCount > 0 && (
          <span className="text-[9px] font-mono text-amber-400/60">{gapsCount} total</span>
        )}
      </div>

      {gapSuccess && (
        <p className="text-[10px] text-green-400" aria-live="polite">{gapSuccess}</p>
      )}

      <div className="space-y-1.5">
        {gaps.map((gap) => (
          <div key={gap.query}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] t2 leading-relaxed line-clamp-1 flex-1">&ldquo;{gap.query}&rdquo;</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] font-mono ${gap.count >= 3 ? 'text-red-400' : gap.count >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {gap.count}x
                </span>
                {gap.count >= 3 && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 whitespace-nowrap">
                    Add as FAQ
                  </span>
                )}
                {!previewMode && (
                  <button
                    onClick={() => {
                      setAnsweringGap(answeringGap === gap.query ? null : gap.query)
                      setGapAnswer('')
                      setGapError(null)
                    }}
                    className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  >
                    {answeringGap === gap.query ? 'Cancel' : 'Add Answer'}
                  </button>
                )}
              </div>
            </div>

            {/* Inline answer form */}
            {answeringGap === gap.query && (
              <div className="mt-2 ml-2 space-y-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.03] p-2.5">
                <p className="text-[10px] t3">
                  Teach your agent the answer to: &ldquo;{gap.query}&rdquo;
                </p>
                <textarea
                  value={gapAnswer}
                  onChange={e => setGapAnswer(e.target.value)}
                  placeholder="Type the answer..."
                  rows={2}
                  className="w-full bg-transparent border b-theme rounded-lg px-2.5 py-1.5 text-xs t1 placeholder:t3 focus:outline-none focus:border-blue-500/50 resize-none"
                />
                {gapError && (
                  <p className="text-[10px] text-red-400">{gapError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddGapAnswer(gap.query, 'faq')}
                    disabled={gapSaving || !gapAnswer.trim()}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                    title="Injected into every call — best for frequently asked questions"
                  >
                    {gapSaving ? '...' : 'Add as FAQ'}
                    <span className="block text-[10px] font-normal opacity-70">Always knows</span>
                  </button>
                  <button
                    onClick={() => handleAddGapAnswer(gap.query, 'knowledge')}
                    disabled={gapSaving || !gapAnswer.trim()}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                    title="Searched via RAG when relevant — best for detailed or rare questions"
                  >
                    {gapSaving ? '...' : 'Add to Knowledge'}
                    <span className="block text-[10px] font-normal opacity-70">Searched when needed</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {gaps.length > 0 && !answeringGap && (
        <p className="text-[9px] t3">Click &ldquo;Add Answer&rdquo; to teach your agent. FAQ = every call. Knowledge = searched when relevant.</p>
      )}
    </div>
  )
}
