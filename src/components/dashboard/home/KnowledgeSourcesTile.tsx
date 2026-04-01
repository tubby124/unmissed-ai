'use client'

import { useState, useRef } from 'react'
import type { HomeData } from '../ClientHome'
import PlacesAutocomplete from '@/components/onboard/PlacesAutocomplete'

interface Props {
  gbpData?: HomeData['gbpData']
  editableFields: HomeData['editableFields']
  websiteScrapeStatus: string | null
  clientId: string
  onMutate?: () => void
}

// ── Address parsing ───────────────────────────────────────────────────────────
function parseAddressParts(address: string) {
  const parts = address.split(',').map(s => s.trim())
  const provincePattern = /^([A-Z]{2})\b/
  const provinceIdx = parts.findIndex(p => provincePattern.test(p))
  if (provinceIdx >= 1) {
    return {
      city: parts[provinceIdx - 1] || '',
      state: parts[provinceIdx].match(provincePattern)?.[1] || '',
    }
  }
  return { city: parts[1] || '', state: (parts[2] || '').split(' ')[0] || '' }
}

// ── StarRating ────────────────────────────────────────────────────────────────
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

// ── FactRow ───────────────────────────────────────────────────────────────────
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

// ── Website status badge ──────────────────────────────────────────────────────
function WebsiteStatusBadge({ status }: { status: string | null }) {
  if (status === 'approved') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Active
      </span>
    )
  }
  if (status === 'extracted') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pending review
      </span>
    )
  }
  if (status === 'scraping') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold t3 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-hover)' }}>
        <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Scanning…
      </span>
    )
  }
  return null
}

// ── Pending place type ────────────────────────────────────────────────────────
interface PendingPlace {
  placeId: string
  name: string | null
  address: string | null
  rating: number | null
  reviewCount: number | null
  photoUrl: string | null
  editorialSummary: string | null
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function KnowledgeSourcesTile({ gbpData, editableFields, websiteScrapeStatus, clientId, onMutate }: Props) {
  const rawFacts = editableFields.businessFacts ?? ''
  const initialLines = rawFacts.split('\n').map(l => l.trim()).filter(Boolean)

  const [facts, setFacts] = useState<string[]>(initialLines)
  const [newFact, setNewFact] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  // GBP connect state
  const [localGbp, setLocalGbp] = useState(gbpData ?? null)
  const [gbpSearchOpen, setGbpSearchOpen] = useState(false)
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null)
  const [gbpSaving, setGbpSaving] = useState(false)
  const [gbpError, setGbpError] = useState<string | null>(null)
  const [placesKey, setPlacesKey] = useState(0)

  const hasGbp = !!(localGbp?.placeId || localGbp?.rating)
  const hasWebsite = websiteScrapeStatus === 'approved' || websiteScrapeStatus === 'extracted' || websiteScrapeStatus === 'scraping'
  const websiteUrl = editableFields.websiteUrl

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
      onMutate?.()
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

  async function connectGbp() {
    if (!pendingPlace) return
    setGbpSaving(true)
    setGbpError(null)
    const { city, state } = pendingPlace.address ? parseAddressParts(pendingPlace.address) : { city: '', state: '' }
    try {
      const res = await fetch('/api/dashboard/knowledge/ingest-gbp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gbp_place_id: pendingPlace.placeId,
          gbp_summary: pendingPlace.editorialSummary,
          gbp_rating: pendingPlace.rating,
          gbp_review_count: pendingPlace.reviewCount,
          gbp_photo_url: pendingPlace.photoUrl,
          city,
          state,
        }),
      })
      if (res.ok) {
        setLocalGbp({
          placeId: pendingPlace.placeId,
          summary: pendingPlace.editorialSummary,
          rating: pendingPlace.rating,
          reviewCount: pendingPlace.reviewCount,
          photoUrl: pendingPlace.photoUrl,
        })
        setGbpSearchOpen(false)
        setPendingPlace(null)
        onMutate?.()
      } else {
        setGbpError('Failed to connect listing. Please try again.')
      }
    } finally {
      setGbpSaving(false)
    }
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
        {savedFlash && <span className="text-[10px] font-semibold text-green-400">Saved ✓</span>}
        {saving && <span className="text-[10px] t3">Saving…</span>}
      </div>

      {/* Section 1 — Google listing */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">Google listing</p>

        {hasGbp && !gbpSearchOpen ? (
          /* GBP data present */
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              {localGbp?.photoUrl && (
                <img
                  src={localGbp.photoUrl}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                {localGbp!.summary ? (
                  <p className="text-xs t2 leading-relaxed line-clamp-3">{localGbp!.summary}</p>
                ) : (
                  <p className="text-xs t3 italic">Google Business Profile connected</p>
                )}
                {localGbp?.rating && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <StarRating rating={localGbp.rating} />
                    <span className="text-[10px] t3">{localGbp.rating} · {localGbp.reviewCount ?? '?'} reviews</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setGbpSearchOpen(true)}
              className="text-[11px] t3 hover:t2 transition-colors"
            >
              Change listing →
            </button>
          </div>
        ) : gbpSearchOpen ? (
          /* GBP search open */
          <div className="space-y-2">
            <PlacesAutocomplete
              key={placesKey}
              onSelect={result => setPendingPlace({
                placeId: result.placeId,
                name: result.name,
                address: result.address,
                rating: result.rating,
                reviewCount: result.reviewCount,
                photoUrl: result.photoUrl,
                editorialSummary: result.editorialSummary,
              })}
            />

            {pendingPlace && (
              <div
                className="rounded-xl p-3 space-y-2 border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-hover)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold t1 truncate">{pendingPlace.name}</p>
                    {pendingPlace.address && <p className="text-[11px] t3 truncate">{pendingPlace.address}</p>}
                    {pendingPlace.editorialSummary && (
                      <p className="text-[11px] t3 italic line-clamp-2 mt-0.5">
                        &ldquo;{pendingPlace.editorialSummary}&rdquo;
                      </p>
                    )}
                  </div>
                  {pendingPlace.rating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="rgb(251 191 36)">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                      </svg>
                      <span className="text-[10px] font-medium t2">{pendingPlace.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={connectGbp}
                    disabled={gbpSaving}
                    className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {gbpSaving ? 'Connecting…' : 'Connect this listing'}
                  </button>
                  <button
                    onClick={() => { setPendingPlace(null); setPlacesKey(k => k + 1) }}
                    className="text-[11px] t3 hover:t2 transition-colors shrink-0"
                  >
                    Not right
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => { setGbpSearchOpen(false); setPendingPlace(null); setGbpError(null) }}
              className="text-[11px] t3 hover:t2 transition-colors"
            >
              Cancel
            </button>
            {gbpError && (
              <p className="text-[11px] text-red-400">{gbpError}</p>
            )}
          </div>
        ) : (
          /* No GBP — show connect CTA */
          <button
            onClick={() => setGbpSearchOpen(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--color-primary)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Connect Google listing
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: 'var(--color-hover)' }} />

      {/* Section 2 — Website */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">Website</p>
        {hasWebsite ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WebsiteStatusBadge status={websiteScrapeStatus} />
              {websiteUrl && (
                <span className="text-[11px] t3 truncate max-w-[120px]">{websiteUrl.replace(/^https?:\/\//, '')}</span>
              )}
            </div>
            <a
              href="/dashboard/settings?tab=knowledge"
              className="text-[11px] font-medium shrink-0 hover:opacity-75 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              {websiteScrapeStatus === 'extracted' ? 'Review →' : 'Manage →'}
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] t3">Not added.</p>
            <a
              href="/dashboard/settings?tab=knowledge"
              className="text-[11px] font-medium hover:opacity-75 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              Add your website →
            </a>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: 'var(--color-hover)' }} />

      {/* Section 3 — Business facts (per-line editable) */}
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

      {/* Section 4 — "What your agent says" preview */}
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
