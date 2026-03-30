'use client'

import { useState, useRef } from 'react'
import type { HomeData } from '../ClientHome'

interface Props {
  gbpData?: HomeData['gbpData']
  editableFields: HomeData['editableFields']
  websiteScrapeStatus: string | null
  clientId: string
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= full ? 'currentColor' : i === full + 1 && half ? 'url(#half)' : 'none'} style={{ color: 'rgb(251 191 36)' }}>
          {i === full + 1 && half && (
            <defs>
              <linearGradient id="half">
                <stop offset="50%" stopColor="rgb(251 191 36)" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
          )}
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="rgb(251 191 36)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

function FactRow({
  fact,
  onSave,
  onDelete,
}: {
  fact: string
  onSave: (newVal: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(fact)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const trimmed = val.trim()
    if (!trimmed) { onDelete(); return }
    if (trimmed !== fact) onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { setVal(fact); setEditing(false) } }}
          onBlur={commit}
          autoFocus
          className="flex-1 text-xs bg-transparent border-b outline-none py-0.5"
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
        />
        <button onClick={onDelete} className="t3 hover:text-red-400 transition-colors shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1.5 group/fact">
      <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--color-text-3)' }} />
      <span className="flex-1 text-xs t2 leading-relaxed">{fact}</span>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover/fact:opacity-100 transition-opacity shrink-0 t3 hover:t2"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  )
}

export default function KnowledgeSourcesTile({ gbpData, editableFields, websiteScrapeStatus, clientId }: Props) {
  const rawFacts = editableFields.businessFacts ?? ''
  const initialLines = rawFacts.split('\n').map(l => l.trim()).filter(Boolean)

  const [facts, setFacts] = useState<string[]>(initialLines)
  const [newFact, setNewFact] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  const hasGbp = !!(gbpData?.summary)
  const hasWebsite = websiteScrapeStatus === 'approved' || websiteScrapeStatus === 'extracted'

  async function persistFacts(lines: string[]) {
    setSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_facts: lines }),
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  function updateFact(idx: number, newVal: string) {
    const updated = facts.map((f, i) => i === idx ? newVal : f)
    setFacts(updated)
    persistFacts(updated)
  }

  function deleteFact(idx: number) {
    const updated = facts.filter((_, i) => i !== idx)
    setFacts(updated)
    persistFacts(updated)
  }

  function addFact() {
    const trimmed = newFact.trim()
    if (!trimmed) { setAddingNew(false); return }
    const updated = [...facts, trimmed]
    setFacts(updated)
    setNewFact('')
    setAddingNew(false)
    persistFacts(updated)
  }

  // Build a simple "what your agent says" preview line
  const hoursPreview = editableFields.hoursWeekday
    ? `When asked about hours, your agent says: "${editableFields.hoursWeekday}"`
    : null
  const firstFactPreview = facts[0]
    ? `When asked about your business, your agent mentions: "${facts[0].length > 60 ? facts[0].slice(0, 60) + '…' : facts[0]}"`
    : null
  const agentPreview = hoursPreview ?? firstFactPreview

  return (
    <div className="rounded-2xl p-4 card-surface flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">What Your Agent Knows</p>
        </div>
        {savedFlash && (
          <span className="text-[10px] font-semibold text-green-400">Saved ✓</span>
        )}
        {saving && (
          <span className="text-[10px] t3">Saving…</span>
        )}
      </div>

      {/* Section 1 — GBP / Website source */}
      {hasGbp && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">From your Google listing</p>
          <div className="flex items-start gap-2">
            {gbpData?.photoUrl && (
              <img
                src={gbpData.photoUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs t2 leading-relaxed line-clamp-3">{gbpData!.summary}</p>
              {gbpData?.rating && (
                <div className="flex items-center gap-1.5 mt-1">
                  <StarRating rating={gbpData.rating} />
                  <span className="text-[10px] t3">{gbpData.rating} · {gbpData.reviewCount ?? '?'} reviews</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasGbp && !hasWebsite && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">Sources</p>
          <p className="text-xs t3">
            No website or Google listing connected.{' '}
            <a href="/dashboard/settings?tab=knowledge" className="underline" style={{ color: 'var(--color-primary)' }}>
              Add your website →
            </a>
          </p>
        </div>
      )}

      {/* Divider */}
      {(hasGbp || hasWebsite) && facts.length > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--color-hover)' }} />
      )}

      {/* Section 2 — Business facts (per-line editable) */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">Business facts</p>
        {facts.length === 0 && !addingNew && (
          <p className="text-xs t3">No facts yet. Add key details your agent should always know.</p>
        )}
        <div className="space-y-1.5">
          {facts.map((fact, idx) => (
            <FactRow
              key={idx}
              fact={fact}
              onSave={val => updateFact(idx, val)}
              onDelete={() => deleteFact(idx)}
            />
          ))}
        </div>

        {addingNew ? (
          <div className="flex items-center gap-1.5">
            <input
              value={newFact}
              onChange={e => setNewFact(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFact() } if (e.key === 'Escape') { setNewFact(''); setAddingNew(false) } }}
              onBlur={addFact}
              autoFocus
              placeholder="e.g. We offer free estimates"
              className="flex-1 text-xs bg-transparent border-b outline-none py-0.5 placeholder:t3"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--color-primary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add a fact
          </button>
        )}
      </div>

      {/* Section 3 — "What your agent says" preview */}
      {agentPreview && (
        <>
          <div className="border-t" style={{ borderColor: 'var(--color-hover)' }} />
          <div className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 t3">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[11px] t3 leading-relaxed italic">{agentPreview}</p>
          </div>
        </>
      )}
    </div>
  )
}
