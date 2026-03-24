'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings, type CardMode } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'

interface AdvancedContextCardProps {
  clientId: string
  isAdmin: boolean
  initialFacts: string
  initialQA: { q: string; a: string }[]
  initialContextData: string
  initialContextDataLabel: string
  prompt: string
  injectedNote?: string
  knowledgeEnabled?: boolean
  timezone?: string
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
}

export default function AdvancedContextCard({
  clientId,
  isAdmin,
  initialFacts,
  initialQA,
  initialContextData,
  initialContextDataLabel,
  prompt,
  injectedNote,
  knowledgeEnabled,
  timezone,
  previewMode,
  mode = 'settings',
  onSave,
}: AdvancedContextCardProps) {
  const [facts, setFacts] = useState(initialFacts)
  const [qa, setQa] = useState<{ q: string; a: string }[]>(initialQA)
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false)
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })
  const { markDirty, markClean } = useDirtyGuard('advanced-context-' + clientId)

  async function save() {
    const res = await patch({
      business_facts: facts,
      extra_qa: qa,
      context_data: initialContextData,
      context_data_label: initialContextDataLabel,
    })
    if (res?.ok) markClean()
  }

  // Assemble a preview of what the agent sees at call time
  const assembledPreview = useMemo(() => {
    const tz = timezone || 'America/Regina'
    const now = new Date()
    const todayIso = now.toLocaleDateString('en-CA', { timeZone: tz })
    const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
    const timeNow = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })

    const lines: string[] = []
    lines.push(`TODAY: ${todayIso} (${dayOfWeek})`)
    lines.push(`CURRENT TIME: ${timeNow} (${tz})`)
    lines.push('CALLER PHONE: [caller\'s number]')
    if (injectedNote?.trim()) {
      lines.push(`RIGHT NOW: ${injectedNote.trim()}`)
    }

    const sections: string[] = []
    sections.push(`[${lines.join('\n')}]`)

    if (facts.trim()) {
      sections.push(`## Business Facts\n${facts.trim()}`)
    }

    const validQa = qa.filter(p => p.q?.trim() && p.a?.trim())
    if (validQa.length > 0) {
      const qaStr = validQa.map(p => `"${p.q}" → "${p.a}"`).join('\n')
      sections.push(`## Q&A\n${qaStr}`)
    }

    if (initialContextData?.trim()) {
      sections.push(`## ${initialContextDataLabel || 'Reference Data'}\n${initialContextData.trim()}`)
    }

    const knowledgeLine = knowledgeEnabled
      ? '🔍 queryKnowledge tool active — agent searches pgvector when caller asks something not covered above'
      : '(No knowledge base configured — agent relies on facts and Q&A above only)'

    return { contextBlock: sections.join('\n\n'), knowledgeLine }
  }, [facts, qa, injectedNote, knowledgeEnabled, timezone, initialContextData, initialContextDataLabel])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">{mode === 'onboarding' ? 'Teach Your Agent' : isAdmin ? 'Advanced Context' : 'Your Business Knowledge'}</p>
            <p className="text-[11px] t3 mt-0.5">{mode === 'onboarding' ? 'Add info so your agent can answer caller questions about your business' : isAdmin ? 'Extra knowledge injected at call time — not stored in the prompt' : 'Information your agent uses to help callers'}</p>
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
            {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save'}
          </button>
        </div>
        {/* Save confirmation detail */}
        <AnimatePresence>
          {saved && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] text-green-400/80 mb-3 -mt-2"
            >
              Injected on every call — not stored in the prompt. Changes take effect on the next call.
            </motion.p>
          )}
        </AnimatePresence>
        {error && (
          <p className="text-[11px] text-red-400 mb-3 -mt-2">{error}</p>
        )}

        {/* Knowledge layer explainer (8b) */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mb-4">
          <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
          <p className="text-[10px] t2 leading-relaxed">
            <span className="font-semibold text-blue-400/90">Always knows</span>
            {' '}&mdash; this info is given to your agent on every call. It never needs to search for it.
          </p>
        </div>

        {/* Business Facts */}
        <div className="space-y-1.5 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-[11px] t3 block">What your agent knows</label>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">Every call</span>
          </div>
          <p className="text-[11px] t3">
            Core business info — hours, location, team members, services. Your agent uses this to answer caller questions.
          </p>
          <textarea
            value={facts}
            onChange={e => { setFacts(e.target.value); markDirty() }}
            rows={4}
            className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 resize-y min-h-[96px] focus:outline-none focus:border-blue-500/40 transition-colors"
            placeholder="e.g. Parking is free out front. We're near the Walmart on 22nd St. Our lead tech is Ryan. Closed Christmas Day and Boxing Day."
          />
        </div>

        {/* Extra Q&A pairs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] t3 block">Common questions callers ask</label>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">Every call</span>
              </div>
              <p className="text-[11px] t3">Add questions and answers. Your agent uses these to respond to callers directly.</p>
            </div>
            {qa.length < 10 && (
              <button
                type="button"
                onClick={() => { setQa(prev => [...prev, { q: '', a: '' }]); markDirty() }}
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
                    markDirty()
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
                    markDirty()
                  }}
                  placeholder="Answer\u2026"
                  className="bg-black/20 border b-theme rounded-xl px-3 py-2 text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => { setQa(prev => prev.filter((_, i) => i !== idx)); markDirty() }}
                  className="p-2 rounded-xl t3 hover:text-red-400 hover:bg-red-500/[0.07] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prompt Preview */}
        {mode !== 'onboarding' && (
        <div className="mt-5 pt-4 border-t b-theme space-y-3">
          {/* Stored system prompt */}
          <button
            onClick={() => setPromptPreviewOpen(prev => !prev)}
            className="flex items-center gap-2 text-[11px] t3 hover:t2 transition-colors w-full"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="font-medium">Current system prompt</span>
            <span className="text-[10px] t3 ml-1">({prompt.length} chars — stored in agent)</span>
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
                <pre className="mt-1 p-4 rounded-xl bg-black/30 border b-theme text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                  {prompt || 'No prompt configured'}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What your agent sees at call time */}
          <button
            onClick={() => setContextPreviewOpen(prev => !prev)}
            className="flex items-center gap-2 text-[11px] t3 hover:t2 transition-colors w-full"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-medium">What your agent sees at call time</span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">Live preview</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              className="ml-auto shrink-0 transition-transform duration-200"
              style={{ transform: contextPreviewOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {contextPreviewOpen && (
              <motion.div
                key="context-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="mt-1 space-y-2">
                  <p className="text-[10px] t3">
                    This is the context block appended to the system prompt when a call starts. It includes your business facts, Q&amp;A, today&apos;s update, and caller info.
                  </p>
                  <pre className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/15 text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                    {assembledPreview.contextBlock}
                  </pre>
                  <p className="text-[10px] t3 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${knowledgeEnabled ? 'bg-purple-400/80' : 'bg-zinc-500/50'}`} />
                    {assembledPreview.knowledgeLine}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>
    </motion.div>
  )
}
