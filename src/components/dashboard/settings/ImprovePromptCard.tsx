'use client'

import { useState } from 'react'
import type { ImproveResult } from './constants'

interface ImprovePromptCardProps {
  clientId: string
  isAdmin: boolean
  onApply: (prompt: string) => void
}

export default function ImprovePromptCard({ clientId, isAdmin, onApply }: ImprovePromptCardProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImproveResult | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setState('loading')
    setError('')
    setResult(null)
    const body: Record<string, unknown> = {}
    if (isAdmin) body.client_id = clientId
    try {
      const res = await fetch('/api/dashboard/settings/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.')
        setState('error')
        return
      }
      setResult(data)
      setState('done')
    } catch {
      setError('Network error. Try again.')
      setState('error')
    }
  }

  function apply() {
    if (!result) return
    onApply(result.improved_prompt)
    setResult(null)
    setState('idle')
  }

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-purple-400/80">AI Improve</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">Beta</span>
        </div>
        {(state === 'idle' || state === 'error') && (
          <button
            onClick={generate}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
          >
            Generate Improvement
          </button>
        )}
      </div>
      <p className="text-[11px] t3 mb-4">
        AI reads your last 10 calls and your current prompt to suggest targeted improvements. Review before applying.
      </p>

      {state === 'loading' && (
        <div className="flex items-center gap-2 py-4 t2 text-xs">
          <div className="w-4 h-4 rounded-full border border-purple-400/30 border-t-purple-400 animate-spin shrink-0" />
          Analyzing recent calls and your prompt&hellip;
        </div>
      )}

      {state === 'error' && (
        <div className="px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {state === 'done' && result && (
        <div className="space-y-3">
          {!result.has_enough_data && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 text-xs text-amber-400/90">
              Only {result.call_count} calls recorded &mdash; improvement is based on your business profile. More calls = better results.
            </div>
          )}

          {result.changes.length > 0 && (
            <div className="px-3 py-3 rounded-xl bg-hover border b-theme">
              <p className="text-[10px] font-semibold t3 uppercase tracking-wider mb-2">What changed</p>
              <ul className="space-y-1">
                {result.changes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs t2">
                    <span className="text-purple-400 mt-0.5 shrink-0">&middot;</span>
                    <span><span className="font-semibold t1">{item.section}</span> &mdash; {item.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            readOnly
            value={result.improved_prompt}
            className="w-full h-48 bg-black/20 border b-theme rounded-xl p-4 text-xs t2 font-mono resize-none focus:outline-none leading-relaxed"
          />

          <div className="flex gap-2">
            <button
              onClick={apply}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-white transition-all"
            >
              Apply to Editor
            </button>
            <button
              onClick={() => { setResult(null); setState('idle') }}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold t3 hover:t1 border b-theme hover:b-theme transition-all"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[10px] t3">
            After applying, review the prompt above and click &ldquo;Save Changes&rdquo; to deploy it live.
          </p>
        </div>
      )}
    </div>
  )
}
