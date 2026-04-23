'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RecomposeConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  onConfirmed: (result: { promptChanged: boolean; charCount: number | null }) => void
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; promptChanged: boolean; charCount: number; preview: string; currentPrompt: string }

function splitBySection(prompt: string): { heading: string; body: string }[] {
  const lines = prompt.split('\n')
  const sections: { heading: string; body: string }[] = []
  let current: { heading: string; body: string } | null = null
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      if (current) sections.push(current)
      current = { heading: line.trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      current = { heading: '(prolog)', body: line }
    }
  }
  if (current) sections.push(current)
  return sections
}

function computeSectionDiff(current: string, preview: string) {
  const a = splitBySection(current)
  const b = splitBySection(preview)
  const byHeading = new Map<string, { before?: string; after?: string }>()
  for (const s of a) byHeading.set(s.heading, { ...(byHeading.get(s.heading) ?? {}), before: s.body })
  for (const s of b) byHeading.set(s.heading, { ...(byHeading.get(s.heading) ?? {}), after: s.body })
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []
  const unchanged: string[] = []
  for (const [heading, { before, after }] of byHeading) {
    if (before === undefined && after !== undefined) added.push(heading)
    else if (after === undefined && before !== undefined) removed.push(heading)
    else if (before !== after) modified.push(heading)
    else unchanged.push(heading)
  }
  return { added, removed, modified, unchanged }
}

export default function RecomposeConfirmDialog({
  open,
  onOpenChange,
  clientId,
  onConfirmed,
}: RecomposeConfirmDialogProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [view, setView] = useState<'summary' | 'before' | 'after'>('summary')

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setView('summary')
      setConfirming(false)
      return
    }
    let cancelled = false
    setPreview({ status: 'loading' })
    ;(async () => {
      try {
        const res = await fetch('/api/dashboard/variables/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recompose: true }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setPreview({ status: 'error', error: data.error || `Preview failed (HTTP ${res.status})` })
          return
        }
        setPreview({
          status: 'ready',
          promptChanged: Boolean(data.promptChanged),
          charCount: Number(data.charCount ?? 0),
          preview: String(data.preview ?? ''),
          currentPrompt: String(data.currentPrompt ?? ''),
        })
      } catch (err) {
        if (!cancelled) setPreview({ status: 'error', error: String(err instanceof Error ? err.message : err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const sectionDiff = useMemo(() => {
    if (preview?.status !== 'ready') return null
    return computeSectionDiff(preview.currentPrompt, preview.preview)
  }, [preview])

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await fetch('/api/admin/recompose-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Recompose failed (HTTP ${res.status})`)
      onConfirmed({ promptChanged: Boolean(data.promptChanged), charCount: data.charCount ?? null })
      onOpenChange(false)
    } catch (err) {
      setPreview({ status: 'error', error: String(err instanceof Error ? err.message : err) })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !confirming && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recompose prompt?</DialogTitle>
          <DialogDescription>
            This rebuilds the full system prompt from current slot defaults and syncs to Ultravox.
            Review the diff before confirming — any in-progress hand edits to sections will be overwritten.
          </DialogDescription>
        </DialogHeader>

        {preview?.status === 'loading' && (
          <p className="text-[12px] t3 py-6 text-center">Building preview…</p>
        )}

        {preview?.status === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-[12px] text-red-300 font-medium">Preview failed</p>
            <p className="text-[11px] text-red-300/80 mt-1">{preview.error}</p>
          </div>
        )}

        {preview?.status === 'ready' && sectionDiff && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[11px]">
              <span className={`px-2 py-1 rounded-lg font-medium ${preview.promptChanged ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 t3'}`}>
                {preview.promptChanged ? 'Prompt will change' : 'No changes — safe no-op'}
              </span>
              <span className="t3">
                {preview.currentPrompt.length.toLocaleString()} → {preview.charCount.toLocaleString()} chars
              </span>
              {preview.charCount > 12000 && (
                <span className="px-2 py-1 rounded-lg font-medium bg-red-500/15 text-red-300">
                  Over 12K limit
                </span>
              )}
            </div>

            {preview.promptChanged && (
              <div className="rounded-lg border b-theme bg-surface p-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-2">
                  <span>Sections changed</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {sectionDiff.modified.map((h) => (
                    <span key={`m-${h}`} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px]">
                      ~ {h.replace(/^#{1,3}\s+/, '')}
                    </span>
                  ))}
                  {sectionDiff.added.map((h) => (
                    <span key={`a-${h}`} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">
                      + {h.replace(/^#{1,3}\s+/, '')}
                    </span>
                  ))}
                  {sectionDiff.removed.map((h) => (
                    <span key={`r-${h}`} className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 font-mono text-[10px]">
                      − {h.replace(/^#{1,3}\s+/, '')}
                    </span>
                  ))}
                  {sectionDiff.modified.length === 0 &&
                    sectionDiff.added.length === 0 &&
                    sectionDiff.removed.length === 0 && (
                      <span className="t3">No section-level changes (minor text tweaks only).</span>
                    )}
                </div>
              </div>
            )}

            <div className="flex gap-1 border-b b-theme">
              {(['summary', 'before', 'after'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-[11px] px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                    view === v ? 'border-indigo-500 t1' : 'border-transparent t3 hover:t2'
                  }`}
                >
                  {v === 'summary' ? 'Summary' : v === 'before' ? 'Current' : 'New'}
                </button>
              ))}
            </div>

            {view !== 'summary' && (
              <pre className="text-[11px] font-mono t2 bg-surface border b-theme rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">
                {view === 'before' ? preview.currentPrompt : preview.preview}
              </pre>
            )}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg border b-theme hover:bg-[var(--color-hover)] t2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              confirming ||
              preview?.status !== 'ready' ||
              !preview.promptChanged ||
              preview.charCount > 12000
            }
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {confirming ? 'Recomposing…' : 'Confirm recompose'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
