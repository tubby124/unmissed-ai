'use client'

import { useState } from 'react'
import RecomposeConfirmDialog from './RecomposeConfirmDialog'

interface AdminRecomposePanelProps {
  clientId: string
}

export default function AdminRecomposePanel({ clientId }: AdminRecomposePanelProps) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ promptChanged: boolean; charCount: number | null } | null>(null)

  return (
    <div className="p-5 border-b b-theme">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Admin: Recompose Prompt</p>
      <p className="text-[11px] t3 mb-3 leading-relaxed">
        Rebuilds this client&apos;s system prompt from current slot defaults (PERSONA, LINGUISTIC_ANCHORS, NICHE_DEFAULTS)
        and syncs to Ultravox. Safe to run multiple times — no-op if prompt hasn&apos;t changed.
        Only works on slot-format prompts. <strong>Preview the diff before confirming</strong> — any hand
        edits to overridden sections will be overwritten.
      </p>

      {result && (
        <p className={`text-[11px] mb-2 font-medium ${result.promptChanged ? 'text-emerald-400' : 'text-white/40'}`}>
          {result.promptChanged
            ? `Recomposed — ${result.charCount?.toLocaleString() ?? '?'} chars. Synced to Ultravox.`
            : 'No changes — prompt was already up to date.'}
        </p>
      )}

      <button
        onClick={() => {
          setResult(null)
          setOpen(true)
        }}
        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
      >
        Recompose Prompt…
      </button>

      <RecomposeConfirmDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        onConfirmed={setResult}
      />
    </div>
  )
}
