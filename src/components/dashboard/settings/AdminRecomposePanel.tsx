'use client'

import { useState } from 'react'
import PromptDiffPreview from './PromptDiffPreview'

interface AdminRecomposePanelProps {
  clientId: string
}

type Phase = 'idle' | 'previewing' | 'preview_ready' | 'confirming' | 'done'

interface PreviewState {
  currentPrompt: string
  previewPrompt: string
  charCount: number
  promptChanged: boolean
}

export default function AdminRecomposePanel({ clientId }: AdminRecomposePanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [result, setResult] = useState<{ promptChanged: boolean; charCount: number | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    setPhase('previewing')
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/dashboard/variables/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recompose: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview({
        currentPrompt: data.currentPrompt ?? '',
        previewPrompt: data.preview ?? '',
        charCount: data.charCount ?? 0,
        promptChanged: Boolean(data.promptChanged),
      })
      setPhase('preview_ready')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setPhase('idle')
    }
  }

  async function handleConfirm() {
    setPhase('confirming')
    setError(null)
    try {
      const res = await fetch('/api/admin/recompose-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Recompose failed')
      setResult({ promptChanged: data.promptChanged, charCount: data.charCount })
      setPhase('done')
      setPreview(null)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setPhase('preview_ready')
    }
  }

  function handleCancel() {
    setPreview(null)
    setError(null)
    setPhase('idle')
  }

  const isBusy = phase === 'previewing' || phase === 'confirming'

  return (
    <div className="p-5 border-b b-theme">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Admin: Recompose Prompt</p>
      <p className="text-[11px] t3 mb-3 leading-relaxed">
        Rebuilds this client&apos;s system prompt from current slot defaults (PERSONA, LINGUISTIC_ANCHORS, NICHE_DEFAULTS)
        and syncs to Ultravox. Preview the diff before committing. Only works on slot-format prompts.
      </p>

      {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}

      {phase === 'done' && result && (
        <p className={`text-[11px] mb-3 font-medium ${result.promptChanged ? 'text-emerald-400' : 'text-white/40'}`}>
          {result.promptChanged
            ? `Recomposed — ${result.charCount?.toLocaleString() ?? '?'} chars. Synced to Ultravox.`
            : 'No changes — prompt was already up to date.'}
        </p>
      )}

      {(phase === 'preview_ready' || phase === 'confirming') && preview && (
        <div className="mb-3 space-y-2">
          {!preview.promptChanged ? (
            <div className="rounded-xl border b-theme bg-surface p-4">
              <p className="text-[11px] t3">No changes — recompose would be a no-op. You can safely skip.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-amber-400">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-amber-300">Destructive: rewrites the full system prompt</p>
                  <p className="text-[10px] text-amber-200/70 mt-0.5">
                    Any manual prompt edits that don&apos;t come from a slot variable will be lost.
                    Review the diff below, then confirm.
                  </p>
                </div>
              </div>
              <PromptDiffPreview
                currentPrompt={preview.currentPrompt}
                previewPrompt={preview.previewPrompt}
                charCountPreview={preview.charCount}
              />
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {phase === 'idle' || phase === 'done' ? (
          <button
            disabled={isBusy}
            onClick={handlePreview}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {phase === 'done' ? 'Preview Again' : 'Preview Recompose'}
          </button>
        ) : phase === 'previewing' ? (
          <button disabled className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white opacity-50 cursor-not-allowed">
            Loading preview…
          </button>
        ) : (
          <>
            <button
              disabled={isBusy || !preview?.promptChanged}
              onClick={handleConfirm}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {phase === 'confirming' ? 'Committing…' : 'Confirm & Recompose'}
            </button>
            <button
              disabled={isBusy}
              onClick={handleCancel}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-hover hover:bg-[var(--color-hover)]/80 t2 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
