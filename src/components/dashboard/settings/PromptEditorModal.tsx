'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'

interface Props {
  clientId: string
  isAdmin: boolean
  systemPrompt: string
  businessFacts: string        // newline-separated
  extraQA: { q: string; a: string }[]
  hoursWeekday: string
  hoursWeekend: string
  contextData: string
  onClose: () => void
  onSaved?: (updates: {
    system_prompt: string
    business_facts: string
    extra_qa: { q: string; a: string }[]
    business_hours_weekday: string
    business_hours_weekend: string
    context_data: string
  }) => void
}

type SectionId = 'facts' | 'faqs' | 'hours' | 'context'

const SECTIONS: { id: SectionId; label: string; desc: string }[] = [
  { id: 'facts',   label: 'Business facts',       desc: 'Key facts the agent knows about your business' },
  { id: 'faqs',    label: 'FAQs',                  desc: 'Common questions + scripted answers' },
  { id: 'hours',   label: 'Hours & availability',  desc: 'Weekday and weekend operating hours' },
  { id: 'context', label: 'Custom instructions',   desc: 'Reference data, special notes, or extra context' },
]

export default function PromptEditorModal({
  clientId, isAdmin, systemPrompt, businessFacts, extraQA,
  hoursWeekday, hoursWeekend, contextData, onClose, onSaved,
}: Props) {
  const [localPrompt,  setLocalPrompt]  = useState(systemPrompt)
  const [localFacts,   setLocalFacts]   = useState(businessFacts)
  const [localQA,      setLocalQA]      = useState(extraQA)
  const [localWeekday, setLocalWeekday] = useState(hoursWeekday)
  const [localWeekend, setLocalWeekend] = useState(hoursWeekend)
  const [localContext, setLocalContext] = useState(contextData)
  const [expanded,     setExpanded]     = useState<Set<SectionId>>(new Set())
  const [saving,       setSaving]       = useState(false)

  function toggleSection(id: SectionId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        system_prompt:           localPrompt,
        business_facts:          localFacts.split('\n').filter(Boolean),
        extra_qa:                localQA.filter(x => x.q.trim()),
        business_hours_weekday:  localWeekday,
        business_hours_weekend:  localWeekend,
        context_data:            localContext,
        ...(isAdmin ? { client_id: clientId } : {}),
      }
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Saved & deployed')
      onSaved?.({
        system_prompt:           localPrompt,
        business_facts:          localFacts,
        extra_qa:                localQA,
        business_hours_weekday:  localWeekday,
        business_hours_weekend:  localWeekend,
        context_data:            localContext,
      })
      onClose()
    } catch {
      toast.error('Failed to save — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Prompt Editor</span>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border"
              style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}
            >
              Power User
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">

          {/* System prompt */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
              System Prompt
            </p>
            <textarea
              value={localPrompt}
              onChange={e => setLocalPrompt(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full px-3 py-2.5 rounded-xl text-[11px] font-mono border resize-y leading-relaxed focus:outline-none"
              style={{
                backgroundColor: 'var(--color-hover)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-1)',
              }}
              placeholder="System prompt..."
            />
            <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
              {localPrompt.length.toLocaleString()} chars{localPrompt.length > 10000 && <span style={{ color: '#f59e0b' }}> — approaching 12K limit</span>}
            </p>
          </div>

          {/* Context sections */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-3)' }}>
              Context Data Sections
            </p>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              {SECTIONS.map((sec, i) => (
                <div
                  key={sec.id}
                  style={{ borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--color-border)' : undefined }}
                >
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                    style={{ color: 'var(--color-text-1)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <span className="text-[13px] font-medium">{sec.label}</span>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{sec.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                        style={{ color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.25)' }}
                      >
                        INJECTED
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        style={{
                          transform: expanded.has(sec.id) ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s',
                          color: 'var(--color-text-3)',
                        }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </button>

                  <AnimatePresence>
                    {expanded.has(sec.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--color-border)' }}>

                          {sec.id === 'facts' && (
                            <div className="space-y-1.5 pt-3">
                              <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>One fact per line. These are injected as known facts at every call.</p>
                              <textarea
                                value={localFacts}
                                onChange={e => setLocalFacts(e.target.value)}
                                rows={7}
                                className="w-full px-3 py-2 rounded-xl text-xs border resize-y focus:outline-none"
                                style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                placeholder="We offer free estimates&#10;Open 7 days a week&#10;Located at 123 Main St..."
                              />
                            </div>
                          )}

                          {sec.id === 'faqs' && (
                            <div className="space-y-2 pt-3">
                              {localQA.map((qa, idx) => (
                                <div key={idx} className="flex gap-2 items-start">
                                  <div className="flex-1 space-y-1">
                                    <input
                                      value={qa.q}
                                      onChange={e => setLocalQA(prev => prev.map((x, i) => i === idx ? { ...x, q: e.target.value } : x))}
                                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none"
                                      style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                      placeholder="Question..."
                                    />
                                    <input
                                      value={qa.a}
                                      onChange={e => setLocalQA(prev => prev.map((x, i) => i === idx ? { ...x, a: e.target.value } : x))}
                                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none"
                                      style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
                                      placeholder="Answer..."
                                    />
                                  </div>
                                  <button
                                    onClick={() => setLocalQA(prev => prev.filter((_, i) => i !== idx))}
                                    className="mt-1.5 p-1 rounded transition-colors shrink-0"
                                    style={{ color: 'var(--color-text-3)' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => setLocalQA(prev => [...prev, { q: '', a: '' }])}
                                className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', backgroundColor: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                + Add FAQ
                              </button>
                            </div>
                          )}

                          {sec.id === 'hours' && (
                            <div className="space-y-3 pt-3">
                              <div>
                                <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-text-3)' }}>Weekday hours</p>
                                <input
                                  value={localWeekday}
                                  onChange={e => setLocalWeekday(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                                  style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                  placeholder="e.g. Monday to Friday, 9am to 5pm"
                                />
                              </div>
                              <div>
                                <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-text-3)' }}>Weekend hours (leave blank if closed)</p>
                                <input
                                  value={localWeekend}
                                  onChange={e => setLocalWeekend(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                                  style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                  placeholder="e.g. Saturday 10am–3pm"
                                />
                              </div>
                            </div>
                          )}

                          {sec.id === 'context' && (
                            <div className="space-y-1.5 pt-3">
                              <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>Reference data, menu items, pricing tables, or special notes injected at every call.</p>
                              <textarea
                                value={localContext}
                                onChange={e => setLocalContext(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 rounded-xl text-xs border resize-y focus:outline-none"
                                style={{ backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                placeholder="Custom context or reference data..."
                              />
                            </div>
                          )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {saving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Saving...
              </>
            ) : 'Save & deploy prompt'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
