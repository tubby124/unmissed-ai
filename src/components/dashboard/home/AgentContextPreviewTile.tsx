'use client'

/**
 * AgentContextPreviewTile — read-only snapshot of what buildAgentContext()
 * would inject on the next live call.
 *
 * Surfaces: weekday/weekend hours, business facts count + 2-line preview,
 * FAQ count, knowledge chunk count, and today's injected note (if set).
 * No edits — this is a preview, not a settings card.
 */

import type { HomeData } from '../ClientHome'

interface Props {
  editableFields: HomeData['editableFields']
  knowledge: HomeData['knowledge']
}

function parseFactLines(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw.split('\n').map(l => l.trim()).filter(Boolean)
}

function formatHours(raw: string | null): string {
  if (!raw?.trim()) return 'Not set'
  return raw.trim()
}

export default function AgentContextPreviewTile({ editableFields, knowledge }: Props) {
  const factLines = parseFactLines(editableFields.businessFacts)
  const faqCount = editableFields.faqs.length
  const chunkCount = knowledge.approved_chunk_count
  const note = editableFields.injectedNote?.trim() ?? null

  const rows: { label: string; value: string; accent?: boolean }[] = [
    {
      label: 'Weekday hours',
      value: formatHours(editableFields.hoursWeekday),
    },
    {
      label: 'Weekend hours',
      value: formatHours(editableFields.hoursWeekend),
    },
    {
      label: 'Business facts',
      value: factLines.length > 0
        ? `${factLines.length} fact${factLines.length !== 1 ? 's' : ''}`
        : 'None added',
    },
    {
      label: 'FAQs',
      value: faqCount > 0
        ? `${faqCount} answer${faqCount !== 1 ? 's' : ''}`
        : 'None added',
    },
    ...(chunkCount > 0 ? [{
      label: 'Knowledge base',
      value: `${chunkCount} chunk${chunkCount !== 1 ? 's' : ''} indexed`,
    }] : []),
    ...(note ? [{
      label: "Today's note",
      value: note.length > 50 ? note.slice(0, 50) + '…' : note,
      accent: true,
    }] : []),
  ]

  const factPreview = factLines.slice(0, 2)

  return (
    <div className="rounded-2xl p-4 card-surface flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Agent context</p>
        </div>
        <p className="text-[10px] t3">Next call preview</p>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <p className="text-[11px] t3 shrink-0">{row.label}</p>
            <p
              className="text-[11px] font-medium text-right truncate"
              style={{ color: row.accent ? 'var(--color-primary)' : 'var(--color-text-2)' }}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>

      {/* Facts preview — first 2 lines */}
      {factPreview.length > 0 && (
        <div
          className="rounded-lg px-3 py-2 space-y-0.5"
          style={{ backgroundColor: 'var(--color-hover)' }}
        >
          {factPreview.map((f, i) => (
            <p key={i} className="text-[11px] t3 truncate">{f}</p>
          ))}
          {factLines.length > 2 && (
            <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
              +{factLines.length - 2} more
            </p>
          )}
        </div>
      )}

      {/* Link to edit context */}
      <a
        href="/dashboard/settings?tab=general"
        className="text-[11px] font-semibold self-start hover:opacity-75 transition-opacity"
        style={{ color: 'var(--color-primary)' }}
      >
        Edit context →
      </a>
    </div>
  )
}
