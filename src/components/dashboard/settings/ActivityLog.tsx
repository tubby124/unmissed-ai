'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface PromptVersion {
  id: string
  version: number
  change_description: string | null
  created_at: string
  triggered_by_role: string | null
  char_count: number | null
  prev_char_count: number | null
}

interface ActivityLogProps {
  clientId: string
  isAdmin: boolean
}

export default function ActivityLog({ clientId, isAdmin }: ActivityLogProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const url = isAdmin
      ? `/api/dashboard/settings/prompt-versions?client_id=${clientId}`
      : '/api/dashboard/settings/prompt-versions'
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setVersions((data.versions ?? []).slice(0, 8)))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [open, clientId, isAdmin])

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  function charDelta(v: PromptVersion) {
    if (v.char_count == null || v.prev_char_count == null) return null
    const d = v.char_count - v.prev_char_count
    if (d === 0) return null
    return d > 0 ? `+${d}` : `${d}`
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-3 flex items-center gap-2 text-left"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
          <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Recent Changes</span>
        <span className="text-[10px] t3 ml-1">Prompt version history</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          className="ml-auto shrink-0 t3 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="activity-log"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-4 space-y-1.5">
              {loading && (
                <div className="flex items-center gap-2 py-3 text-[11px] t3">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              )}

              {!loading && versions.length === 0 && (
                <p className="text-[11px] t3 py-2">No prompt versions recorded yet.</p>
              )}

              {!loading && versions.map(v => {
                const delta = charDelta(v)
                return (
                  <div key={v.id} className="flex items-start gap-3 py-1.5 border-b b-theme last:border-0">
                    <span className="text-[10px] font-mono t3 shrink-0 w-8 text-right tabular-nums">v{v.version}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] t2 leading-relaxed truncate">
                        {v.change_description || 'Prompt updated'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] t3">{timeAgo(v.created_at)}</span>
                        {v.triggered_by_role && (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                            v.triggered_by_role === 'admin'
                              ? 'bg-amber-500/10 text-amber-400/70 border border-amber-500/15'
                              : 'bg-blue-500/10 text-blue-400/70 border border-blue-500/15'
                          }`}>
                            {v.triggered_by_role}
                          </span>
                        )}
                        {delta && (
                          <span className={`text-[9px] font-mono ${
                            delta.startsWith('+') ? 'text-green-400/70' : 'text-red-400/70'
                          }`}>
                            {delta} chars
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
