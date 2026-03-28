'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'
import { stripPromptMarkers } from '@/lib/prompt-sections'

interface Props {
  systemPrompt: string | null
  isAdmin: boolean
}

function charCountBadge(chars: number) {
  if (chars > 12000) return { label: `${chars.toLocaleString()} chars`, color: 'bg-red-500/10 text-red-400/80 border-red-500/15' }
  if (chars > 8000)  return { label: `${chars.toLocaleString()} chars`, color: 'bg-amber-500/10 text-amber-400/80 border-amber-500/15' }
  return { label: `${chars.toLocaleString()} chars`, color: 'bg-zinc-500/10 text-zinc-400/70 border-zinc-500/15' }
}

export default function PromptPreviewCard({ systemPrompt, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  const stripped = stripPromptMarkers(systemPrompt ?? '')
  const charCount = stripped.length
  const badge = charCountBadge(charCount)

  if (!stripped) return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        {/* Document icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Agent script</p>
          <p className="text-[11px] t3 mt-0.5">The base instructions your agent follows on every call</p>
        </div>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${badge.color}`}>
          {badge.label}
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
              {charCount > 12000 && (
                <p className="text-[10px] text-red-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 shrink-0" />
                  Prompt exceeds 12,000 character limit — this may cause agent errors. Contact support to compress it.
                </p>
              )}
              {charCount > 8000 && charCount <= 12000 && (
                <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shrink-0" />
                  Prompt is large ({charCount.toLocaleString()} chars). Consider keeping it under 8,000 for best performance.
                </p>
              )}
              <pre className="p-4 rounded-xl bg-zinc-500/[0.03] border border-zinc-500/15 text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                {stripped}
              </pre>
              <p className="text-[10px] t3">
                {isAdmin ? (
                  <>
                    Script is managed via{' '}
                    <Link href="/dashboard/settings?tab=general" className="underline underline-offset-2">
                      Settings → Agent
                    </Link>
                    . Changes take effect on the next call.
                  </>
                ) : (
                  'Your agent script is managed by your provider. Changes take effect on the next call.'
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
