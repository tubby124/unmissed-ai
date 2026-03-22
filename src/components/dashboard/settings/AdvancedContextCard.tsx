'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from './usePatchSettings'

interface AdvancedContextCardProps {
  clientId: string
  isAdmin: boolean
  initialFacts: string
  initialQA: { q: string; a: string }[]
  initialContextData: string
  initialContextDataLabel: string
  prompt: string
  previewMode?: boolean
}

export default function AdvancedContextCard({
  clientId,
  isAdmin,
  initialFacts,
  initialQA,
  initialContextData,
  initialContextDataLabel,
  prompt,
  previewMode,
}: AdvancedContextCardProps) {
  const [facts, setFacts] = useState(initialFacts)
  const [qa, setQa] = useState<{ q: string; a: string }[]>(initialQA)
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false)

  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  async function save() {
    await patch({
      business_facts: facts,
      extra_qa: qa,
      context_data: initialContextData,
      context_data_label: initialContextDataLabel,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">{isAdmin ? 'Advanced Context' : 'Your Business Knowledge'}</p>
            <p className="text-[11px] t3 mt-0.5">{isAdmin ? 'Extra knowledge injected at call time — not stored in the prompt' : 'Information your agent uses to help callers'}</p>
          </div>
          <button
            onClick={save}
            disabled={saving || previewMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              saved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-zinc-700 hover:bg-zinc-600 t1'
            } disabled:opacity-40`}
          >
            {saving ? 'Saving\u2026' : saved ? '\u2713 Active on next call' : 'Save'}
          </button>
        </div>

        {/* Business Facts */}
        <div className="space-y-1.5 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-[11px] t3 block">What your agent knows</label>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">Persistent</span>
          </div>
          <p className="text-[11px] t3">
            Core business info — hours, location, team members, services. Your agent uses this to answer caller questions.
          </p>
          <textarea
            value={facts}
            onChange={e => setFacts(e.target.value)}
            rows={4}
            className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
            placeholder="e.g. Parking is free out front. We're near the Walmart on 22nd St. Our lead tech is Ryan. Closed Christmas Day and Boxing Day."
          />
        </div>

        {/* Extra Q&A pairs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] t3 block">Common questions callers ask</label>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">Persistent</span>
              </div>
              <p className="text-[11px] t3">Add questions and answers. Your agent uses these to respond to callers directly.</p>
            </div>
            {qa.length < 10 && (
              <button
                type="button"
                onClick={() => setQa(prev => [...prev, { q: '', a: '' }])}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium t2 border b-theme hover:t1 hover:b-theme transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Add
              </button>
            )}
          </div>

          {qa.length === 0 && (
            <p className="text-[11px] t3 py-1">No Q&amp;A pairs yet — add up to 10.</p>
          )}

          <div className="space-y-2">
            {qa.map((pair, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                <input
                  type="text"
                  value={pair.q}
                  onChange={e => {
                    const updated = [...qa]
                    updated[idx] = { ...updated[idx], q: e.target.value }
                    setQa(updated)
                  }}
                  placeholder="Question\u2026"
                  className="bg-black/20 border b-theme rounded-xl px-3 py-2 text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <input
                  type="text"
                  value={pair.a}
                  onChange={e => {
                    const updated = [...qa]
                    updated[idx] = { ...updated[idx], a: e.target.value }
                    setQa(updated)
                  }}
                  placeholder="Answer\u2026"
                  className="bg-black/20 border b-theme rounded-xl px-3 py-2 text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setQa(prev => prev.filter((_, i) => i !== idx))}
                  className="p-2 rounded-xl t3 hover:text-red-400 hover:bg-red-500/[0.07] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prompt Preview */}
        <div className="mt-5 pt-4 border-t b-theme">
          <button
            onClick={() => setPromptPreviewOpen(prev => !prev)}
            className="flex items-center gap-2 text-[11px] t3 hover:t2 transition-colors w-full"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="font-medium">Current system prompt</span>
            <span className="text-[10px] t3 ml-1">({prompt.length} chars — context data &amp; facts appended at call time)</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              className="ml-auto shrink-0 transition-transform duration-200"
              style={{ transform: promptPreviewOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {promptPreviewOpen && (
              <motion.div
                key="prompt-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <pre className="mt-3 p-4 rounded-xl bg-black/30 border b-theme text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                  {prompt || 'No prompt configured'}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
