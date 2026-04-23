'use client'

import { useMemo } from 'react'

interface PromptDiffPreviewProps {
  currentPrompt: string
  previewPrompt: string
  charCountCurrent?: number | null
  charCountPreview?: number | null
  affectedSlots?: string[]
  maxLines?: number
}

type DiffRow = { type: 'same' | 'add' | 'del'; text: string; lineNo?: number }

function computeDiff(a: string, b: string): DiffRow[] {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const m = aLines.length
  const n = bLines.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      rows.push({ type: 'same', text: aLines[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: aLines[i] })
      i++
    } else {
      rows.push({ type: 'add', text: bLines[j] })
      j++
    }
  }
  while (i < m) { rows.push({ type: 'del', text: aLines[i++] }) }
  while (j < n) { rows.push({ type: 'add', text: bLines[j++] }) }
  return rows
}

function collapseUnchanged(rows: DiffRow[], keepContext = 3): Array<DiffRow | { type: 'gap'; count: number }> {
  const out: Array<DiffRow | { type: 'gap'; count: number }> = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].type !== 'same') {
      out.push(rows[i])
      i++
      continue
    }
    let j = i
    while (j < rows.length && rows[j].type === 'same') j++
    const run = j - i
    const prevIsChange = out.length > 0 && out[out.length - 1].type !== 'gap' && (out[out.length - 1] as DiffRow).type !== 'same'
    const nextIsChange = j < rows.length && rows[j].type !== 'same'
    const headKeep = prevIsChange ? keepContext : 0
    const tailKeep = nextIsChange ? keepContext : 0
    if (run <= headKeep + tailKeep + 1) {
      for (let k = i; k < j; k++) out.push(rows[k])
    } else {
      for (let k = i; k < i + headKeep; k++) out.push(rows[k])
      out.push({ type: 'gap', count: run - headKeep - tailKeep })
      for (let k = j - tailKeep; k < j; k++) out.push(rows[k])
    }
    i = j
  }
  return out
}

export default function PromptDiffPreview({
  currentPrompt,
  previewPrompt,
  charCountCurrent,
  charCountPreview,
  affectedSlots,
  maxLines = 600,
}: PromptDiffPreviewProps) {
  const { rows, added, removed } = useMemo(() => {
    const raw = computeDiff(currentPrompt, previewPrompt)
    const added = raw.filter(r => r.type === 'add').length
    const removed = raw.filter(r => r.type === 'del').length
    const collapsed = collapseUnchanged(raw)
    const limited = collapsed.slice(0, maxLines)
    return { rows: limited, added, removed }
  }, [currentPrompt, previewPrompt, maxLines])

  const currentChars = charCountCurrent ?? currentPrompt.length
  const previewChars = charCountPreview ?? previewPrompt.length
  const charDelta = previewChars - currentChars
  const hasChanges = added > 0 || removed > 0

  if (!hasChanges) {
    return (
      <div className="rounded-xl border b-theme bg-surface p-4">
        <p className="text-[11px] t3">No changes — prompt is already up to date.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border b-theme bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b b-theme bg-[var(--color-hover)]/40">
        <div className="flex items-center gap-3 text-[10px] font-mono t2">
          <span className="text-emerald-400">+{added}</span>
          <span className="text-rose-400">-{removed}</span>
          <span className="t3">·</span>
          <span className="t3">
            {currentChars.toLocaleString()} → {previewChars.toLocaleString()} chars
            <span className={charDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}> ({charDelta >= 0 ? '+' : ''}{charDelta.toLocaleString()})</span>
          </span>
        </div>
        {affectedSlots && affectedSlots.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {affectedSlots.map(slot => (
              <span key={slot} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {slot}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {rows.map((row, idx) => {
          if (row.type === 'gap') {
            return (
              <div key={idx} className="px-3 py-1 t3 bg-[var(--color-hover)]/30 text-[10px] border-y b-theme">
                ··· {row.count} unchanged line{row.count === 1 ? '' : 's'}
              </div>
            )
          }
          const bg = row.type === 'add' ? 'bg-emerald-500/10' : row.type === 'del' ? 'bg-rose-500/10' : ''
          const marker = row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' '
          const markerColor = row.type === 'add' ? 'text-emerald-400' : row.type === 'del' ? 'text-rose-400' : 't3'
          const textColor = row.type === 'add' ? 'text-emerald-100' : row.type === 'del' ? 'text-rose-100 line-through opacity-70' : 't2'
          return (
            <div key={idx} className={`flex px-3 ${bg}`}>
              <span className={`shrink-0 w-4 select-none ${markerColor}`}>{marker}</span>
              <span className={`whitespace-pre-wrap break-all ${textColor}`}>{row.text || '\u00A0'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
