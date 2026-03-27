'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface CallContextPreviewProps {
  facts: string
  qa: { q: string; a: string }[]
  injectedNote?: string
  contextData?: string
  contextDataLabel?: string
  knowledgeEnabled?: boolean
  timezone?: string
}

export default function CallContextPreview({
  facts,
  qa,
  injectedNote,
  contextData,
  contextDataLabel,
  knowledgeEnabled,
  timezone,
}: CallContextPreviewProps) {
  const [open, setOpen] = useState(false)

  const preview = useMemo(() => {
    const tz = timezone || 'America/Regina'
    const now = new Date()
    const todayIso = now.toLocaleDateString('en-CA', { timeZone: tz })
    const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
    const timeNow = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })

    const lines: string[] = []
    lines.push(`TODAY: ${todayIso} (${dayOfWeek})`)
    lines.push(`CURRENT TIME: ${timeNow} (${tz})`)
    lines.push(`CALLER PHONE: [caller's number]`)
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

    if (contextData?.trim()) {
      sections.push(`## ${contextDataLabel || 'Reference Data'}\n${contextData.trim()}`)
    }

    const knowledgeLine = knowledgeEnabled
      ? '🔍 queryKnowledge tool active — agent searches knowledge base when caller asks something not in the context above'
      : '(No knowledge base configured — agent relies on facts and Q&A above only)'

    return { contextBlock: sections.join('\n\n'), knowledgeLine }
  }, [facts, qa, injectedNote, knowledgeEnabled, timezone, contextData, contextDataLabel])

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Call-time context</p>
          <p className="text-[11px] t3 mt-0.5">What your agent sees on every call</p>
        </div>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15 shrink-0">
          Live preview
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          className="t3 ml-1 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-4 space-y-3">
              <p className="text-[10px] t3">
                This context is assembled fresh on every call — it includes your business facts, Q&amp;A, any active update, and the caller&apos;s info. It is never stored in the agent&apos;s base prompt.
              </p>
              <pre className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/15 text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                {preview.contextBlock}
              </pre>
              <p className="text-[10px] t3 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${knowledgeEnabled ? 'bg-purple-400/80' : 'bg-zinc-500/50'}`} />
                {preview.knowledgeLine}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
