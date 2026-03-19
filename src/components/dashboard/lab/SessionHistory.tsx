"use client"

import { useState, useCallback, useImperativeHandle, forwardRef } from "react"

// ── Session History ───────────────────────────────────────────────────────────

interface SessionHistoryProps {
  clientId: string | null
}

export interface SessionHistoryHandle {
  addSession: (session: { id: string; created_at: string; transcript_json: unknown[]; prompt_snapshot: string | null }) => void
}

export const SessionHistory = forwardRef<SessionHistoryHandle, SessionHistoryProps>(
  function SessionHistory({ clientId }, ref) {
    const [historyOpen, setHistoryOpen] = useState(false)
    const [sessions, setSessions] = useState<{ id: string; created_at: string; transcript_json: unknown[]; prompt_snapshot: string | null }[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    const loadHistory = useCallback(async () => {
      if (!clientId) return
      setHistoryLoading(true)
      try {
        const res = await fetch(`/api/dashboard/lab-transcripts?clientId=${clientId}`)
        if (res.ok) {
          const data = await res.json()
          setSessions(data.sessions ?? [])
        }
      } finally {
        setHistoryLoading(false)
      }
    }, [clientId])

    useImperativeHandle(ref, () => ({
      addSession: (session) => {
        setSessions(prev => [session, ...prev])
      },
    }))

    return (
      <div className="mt-6 border-t border-slate-200 pt-4">
        <button
          onClick={() => {
            const next = !historyOpen
            setHistoryOpen(next)
            if (next && sessions.length === 0) loadHistory()
          }}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <span>{historyOpen ? '▾' : '▸'}</span>
          Session History
          {historyLoading && <span className="text-xs text-slate-400 ml-1">{`Loading\u2026`}</span>}
        </button>

        {historyOpen && (
          <div className="mt-3 space-y-2">
            {sessions.length === 0 && !historyLoading && (
              <p className="text-sm text-slate-400">No saved sessions yet.</p>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {s.prompt_snapshot && (
                    <span className="text-xs text-indigo-500">{s.prompt_snapshot.slice(0, 40)}{"\u2026"}</span>
                  )}
                </div>
                <p className="text-slate-600 text-xs">
                  {Array.isArray(s.transcript_json) ? `${s.transcript_json.length} transcript entries` : 'Session data'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)
