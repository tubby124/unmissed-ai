'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LearningStatus } from './constants'

interface LearningLoopCardProps {
  clientId: string
  isAdmin: boolean
  onRequestImprovement?: () => void
}

export default function LearningLoopCard({ clientId, isAdmin, onRequestImprovement }: LearningLoopCardProps) {
  const [learning, setLearning] = useState<LearningStatus | null>(null)
  const [learningState, setLearningState] = useState<'checking' | 'analyzing' | 'ready' | 'idle'>('checking')
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(`learning_dismissed_${clientId}`) === '1' } catch { return false }
  })

  const dismiss = useCallback(() => {
    try { sessionStorage.setItem(`learning_dismissed_${clientId}`, '1') } catch { /* ignore */ }
    setDismissed(true)
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    setLearning(null)
    setLearningState('checking')
    try { setDismissed(sessionStorage.getItem(`learning_dismissed_${clientId}`) === '1') } catch { setDismissed(false) }

    async function check() {
      const params = isAdmin ? `?client_id=${clientId}` : ''
      const res = await fetch(`/api/dashboard/settings/learning-status${params}`)
      if (!res.ok || cancelled) return
      const data: LearningStatus = await res.json()
      if (cancelled) return
      setLearning(data)

      if (data.should_analyze) {
        setLearningState('analyzing')
        try {
          const body: Record<string, unknown> = {}
          if (isAdmin) body.client_id = clientId
          await fetch('/api/dashboard/analyze-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        } catch { /* silent */ }
        if (cancelled) return
        const res2 = await fetch(`/api/dashboard/settings/learning-status${params}`)
        if (!res2.ok || cancelled) { setLearningState('idle'); return }
        const data2: LearningStatus = await res2.json()
        if (cancelled) return
        setLearning(data2)
        setLearningState(data2.pending_report ? 'ready' : 'idle')
      } else if (data.pending_report) {
        setLearningState('ready')
      } else {
        setLearningState('idle')
      }
    }

    check().catch(() => setLearningState('idle'))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // Checking state
  if (learningState === 'checking') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-page border b-theme text-xs t3">
        <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-400 animate-spin shrink-0" />
        Checking call patterns&hellip;
      </div>
    )
  }

  // Analyzing state
  if (learningState === 'analyzing') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/20 text-xs text-blue-400/80">
        <div className="w-3 h-3 rounded-full border border-blue-500/30 border-t-blue-400 animate-spin shrink-0" />
        Analyzing {learning?.calls_since_last_analysis ?? 'recent'} calls for prompt improvements&hellip;
      </div>
    )
  }

  // Ready with recommendations
  if (learningState === 'ready' && learning?.pending_report && !dismissed) {
    return (
      <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.04] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-blue-400/80">Learning Loop</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">Auto</span>
            </div>
            <p className="text-xs t2">
              {learning.trigger_reason === 'friction_call' && 'A recent call had friction \u2014 agent may need a prompt update.'}
              {learning.trigger_reason === 'unknown_status' && "A call couldn't be classified \u2014 reviewing prompt gaps."}
              {learning.trigger_reason === 'frustrated' && 'A caller sounded frustrated \u2014 checking for prompt issues.'}
              {learning.trigger_reason === 'short_call' && 'A caller hung up fast \u2014 checking if the agent is missing something.'}
              {learning.trigger_reason === 'cadence' && `${learning.calls_since_last_analysis} new calls since last analysis.`}
              {!learning.trigger_reason && 'New learning insights available.'}
              {' '}Found {learning.pending_report.recommendations_count} suggestion{learning.pending_report.recommendations_count !== 1 ? 's' : ''}.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-[10px] t3 hover:t1 transition-colors shrink-0 mt-0.5"
          >
            Dismiss
          </button>
        </div>

        {learning.pending_report.top_recs.length > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-page border b-theme space-y-2">
            {learning.pending_report.top_recs.map((rec, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
                    rec.priority === 'high'
                      ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                      : rec.priority === 'medium'
                      ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                      : 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20'
                  }`}>{rec.priority}</span>
                  <span className="t1 font-medium">{rec.title}</span>
                </div>
                <p className="t3 leading-relaxed">{rec.rationale}</p>
              </div>
            ))}
          </div>
        )}

        {onRequestImprovement && (
          <button
            onClick={onRequestImprovement}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all"
          >
            Apply Suggestions to Prompt
          </button>
        )}
      </div>
    )
  }

  // Idle — nothing to show
  return null
}
