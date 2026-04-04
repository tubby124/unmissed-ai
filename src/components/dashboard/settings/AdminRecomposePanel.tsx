'use client'

import { useState } from 'react'

interface AdminRecomposePanelProps {
  clientId: string
}

export default function AdminRecomposePanel({ clientId }: AdminRecomposePanelProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ promptChanged: boolean; charCount: number | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRecompose() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/recompose-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Recompose failed')
      setResult({ promptChanged: data.promptChanged, charCount: data.charCount })
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-5 border-b b-theme">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Admin: Recompose Prompt</p>
      <p className="text-[11px] t3 mb-3 leading-relaxed">
        Rebuilds this client&apos;s system prompt from current slot defaults (PERSONA, LINGUISTIC_ANCHORS, NICHE_DEFAULTS)
        and syncs to Ultravox. Safe to run multiple times — no-op if prompt hasn&apos;t changed.
        Only works on slot-format prompts.
      </p>

      {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}

      {result && (
        <p className={`text-[11px] mb-2 font-medium ${result.promptChanged ? 'text-emerald-400' : 'text-white/40'}`}>
          {result.promptChanged
            ? `Recomposed — ${result.charCount?.toLocaleString() ?? '?'} chars. Synced to Ultravox.`
            : 'No changes — prompt was already up to date.'}
        </p>
      )}

      <button
        disabled={loading}
        onClick={handleRecompose}
        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? 'Recomposing…' : 'Recompose Prompt'}
      </button>
    </div>
  )
}
