'use client'

import { useState, useEffect } from 'react'

interface Gap {
  query: string
  count: number
  first_seen: string
  last_seen: string
}

interface KnowledgeGapsProps {
  clientId: string
  isAdmin: boolean
  onAddAnswer?: (query: string) => void
}

export default function KnowledgeGaps({ clientId, isAdmin, onAddAnswer }: KnowledgeGapsProps) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [totalUnanswered, setTotalUnanswered] = useState(0)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    async function fetch_gaps() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ client_id: clientId, days: String(days) })
        const res = await fetch(`/api/dashboard/knowledge/gaps?${params}`)
        if (!res.ok) throw new Error('Failed to load gaps')
        const data = await res.json()
        setGaps(data.gaps ?? [])
        setTotalUnanswered(data.total_unanswered_queries ?? 0)
      } catch {
        setGaps([])
      } finally {
        setLoading(false)
      }
    }
    fetch_gaps()
  }, [clientId, days])

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-200">Knowledge Gaps</p>
        </div>
        <div className="p-6 text-center">
          <svg className="animate-spin h-4 w-4 mx-auto text-zinc-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-zinc-200">Knowledge Gaps</p>
          {totalUnanswered > 0 && (
            <span className="text-[10px] font-mono text-amber-400/80">
              {totalUnanswered} unanswered
            </span>
          )}
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500/50"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {gaps.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs text-zinc-500">
            No unanswered questions in the last {days} days. Your knowledge base is covering caller questions well.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {gaps.map((gap, i) => (
            <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 leading-relaxed">&ldquo;{gap.query}&rdquo;</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-mono ${gap.count >= 3 ? 'text-red-400' : gap.count >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {gap.count}x
                  </span>
                  {gap.count >= 3 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                      Recommended: Add as FAQ
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600">
                    {gap.count > 1 ? `${new Date(gap.first_seen).toLocaleDateString()} — ${new Date(gap.last_seen).toLocaleDateString()}` : new Date(gap.last_seen).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {(isAdmin || onAddAnswer) && (
                <button
                  onClick={() => onAddAnswer?.(gap.query)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  Add Answer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
