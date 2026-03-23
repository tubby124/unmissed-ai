'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { PromptVersion } from './constants'

interface PromptVersionsCardProps {
  clientId: string
  isAdmin: boolean
  onRestore: (content: string) => void
}

export default function PromptVersionsCard({ clientId, isAdmin, onRestore }: PromptVersionsCardProps) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [viewing, setViewing] = useState<PromptVersion | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = isAdmin ? `?client_id=${clientId}` : ''
    const res = await fetch(`/api/dashboard/settings/prompt-versions${params}`)
    if (res.ok) {
      const data = await res.json()
      setVersions(data.versions || [])
    }
    setLoading(false)
  }, [clientId, isAdmin])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next) setShowAll(false)
    if (next && versions.length === 0) await load()
  }

  async function restore(versionId: string) {
    setRestoring(versionId)
    const body: Record<string, unknown> = { version_id: versionId }
    if (isAdmin) body.client_id = clientId
    const res = await fetch('/api/dashboard/settings/prompt-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const restoredContent = data.restored_content as string | undefined
      if (restoredContent) onRestore(restoredContent)
      setOpen(false)
      await load()
    }
    setRestoring(null)
  }

  return (
    <>
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
        >
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Prompt History</p>
            <p className="text-[11px] t3 mt-0.5">View and restore previous system prompt versions</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            className={`t3 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="versions-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="border-t b-theme">
                {loading ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-xs t3">
                    <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-400 animate-spin" />
                    Loading history&hellip;
                  </div>
                ) : versions.length === 0 ? (
                  <p className="px-5 py-4 text-xs t3">No saved versions yet. Saving the prompt creates a version.</p>
                ) : (
                  <>
                    <div className="divide-y divide-[var(--color-border)]">
                      {(showAll ? versions : versions.slice(0, 5)).map(v => (
                        <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold t2">v{v.version}</span>
                              {v.is_active && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">Active</span>
                              )}
                              <span className="text-[11px] t3">
                                {new Date(v.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              {v.triggered_by_role && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-hover t3 border b-theme">{v.triggered_by_role}</span>
                              )}
                              {v.char_count != null && v.prev_char_count != null && v.char_count !== v.prev_char_count && (
                                <span className={`text-[9px] font-mono ${v.char_count > v.prev_char_count ? 'text-green-400' : 'text-amber-400'}`}>
                                  {v.char_count > v.prev_char_count ? '+' : ''}{v.char_count - v.prev_char_count}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] t3 truncate mt-0.5">{v.change_description}</p>
                          </div>
                          <button
                            onClick={() => setViewing(v)}
                            className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-hover t2 hover:bg-hover hover:t1 border b-theme transition-all"
                          >
                            View &rarr;
                          </button>
                          {!v.is_active && isAdmin && (
                            <button
                              onClick={() => restore(v.id)}
                              disabled={restoring === v.id}
                              className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-hover t2 hover:bg-hover hover:t1 border b-theme transition-all disabled:opacity-40"
                            >
                              {restoring === v.id ? 'Restoring\u2026' : 'Restore'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!showAll && versions.length > 5 && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full px-5 py-2 text-[11px] t3 hover:t1 transition-colors"
                      >
                        Show {versions.length - 5} older versions
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Version View Modal */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setViewing(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[80vh] mx-4 rounded-2xl border b-theme bg-surface overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b b-theme shrink-0">
              <div>
                <span className="text-xs font-mono font-semibold t2">v{viewing.version}</span>
                {viewing.is_active && (
                  <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">Active</span>
                )}
                <span className="text-[11px] t3 ml-2">
                  {new Date(viewing.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {viewing.change_description && (
                  <p className="text-[11px] t3 mt-0.5">{viewing.change_description}</p>
                )}
              </div>
              <button onClick={() => setViewing(null)} className="t3 hover:t1 transition-colors text-xl leading-none ml-4">&times;</button>
            </div>
            <pre className="flex-1 overflow-auto px-5 py-4 text-xs t2 font-mono whitespace-pre-wrap">{viewing.content}</pre>
          </div>
        </div>
      )}
    </>
  )
}
