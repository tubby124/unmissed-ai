'use client'

/**
 * TrialKnowledgeCards — inline-editable knowledge cards for the trial dashboard.
 *
 * Pattern: inline card expansion (A).
 * Each card shows current value + Edit/Add button.
 * Clicking expands the form in-place. Save collapses it, shows "✓ Updated · Test it now →".
 * Uses existing usePatchSettings hook → PATCH /api/dashboard/settings.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import { trackEvent } from '@/lib/analytics'
import type { TrialPhase } from '@/lib/trial-display-state'

// ── Shared ───────────────────────────────────────────────────────────────────

interface CommonProps {
  clientId: string
  isAdmin: boolean
  isExpired: boolean
  trialPhase: TrialPhase
  onRetest: () => void
}

function RetestRow({ fieldType, onRetest, label }: { fieldType: string; onRetest: () => void; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="text-[11px] text-green-400">✓ {label}</span>
      <button
        onClick={() => { trackEvent('retest_started_from_dashboard_edit', { field_type: fieldType }); onRetest() }}
        className="text-[11px] font-semibold hover:opacity-75 transition-opacity"
        style={{ color: 'var(--color-primary)' }}
      >
        Test it now →
      </button>
    </div>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-[11px] font-medium hover:bg-hover transition-colors shrink-0"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {label}
    </button>
  )
}

const INPUT_CLS = 'w-full rounded-xl px-3 py-2 text-xs t1 focus:outline-none transition-colors'
const INPUT_STYLE = { background: 'var(--color-hover)', border: '1px solid var(--color-border)' }

function SaveRow({ saving, onSave, onCancel, disabled }: {
  saving: boolean; onSave: () => void; onCancel: () => void; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded-lg text-[11px] t3 hover:t2 transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

// ── Hours card ────────────────────────────────────────────────────────────────

function HoursCard({
  clientId, isAdmin, initialWeekday, initialWeekend, isExpired, trialPhase, onRetest,
}: CommonProps & { initialWeekday: string | null; initialWeekend: string | null }) {
  const [open, setOpen] = useState(false)
  const [weekday, setWeekday] = useState(initialWeekday ?? '')
  const [weekend, setWeekend] = useState(initialWeekend ?? '')
  const [current, setCurrent] = useState(initialWeekday)
  const [showRetest, setShowRetest] = useState(false)
  const { saving, error, patch } = usePatchSettings(clientId, isAdmin)

  function openEdit() {
    setOpen(true); setShowRetest(false)
    trackEvent('knowledge_card_edit_opened', { field_type: 'hours', trial_phase: trialPhase })
  }
  function cancelEdit() {
    setOpen(false); setWeekday(current ?? '')
    trackEvent('knowledge_card_edit_cancelled', { field_type: 'hours' })
  }
  async function save() {
    const res = await patch({ business_hours_weekday: weekday.trim(), business_hours_weekend: weekend.trim() })
    if (res?.ok) {
      setCurrent(weekday.trim() || null)
      setOpen(false); setShowRetest(true)
      trackEvent('hours_updated_from_dashboard', { trial_phase: trialPhase })
    }
  }

  return (
    <div className="rounded-2xl p-4 card-surface">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 mb-0.5">Business hours</p>
          <p className="text-xs t2 truncate">
            {current ?? <span className="t3 italic">Not set yet</span>}
          </p>
        </div>
        {!isExpired && !open && <EditButton label="Edit" onClick={openEdit} />}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="text" value={weekday} onChange={e => setWeekday(e.target.value)}
            placeholder="e.g. Monday to Friday, 9am to 5pm"
            autoFocus className={INPUT_CLS} style={INPUT_STYLE}
          />
          <input
            type="text" value={weekend} onChange={e => setWeekend(e.target.value)}
            placeholder="Weekend hours (leave blank if closed)"
            className={INPUT_CLS} style={INPUT_STYLE}
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <SaveRow saving={saving} onSave={save} onCancel={cancelEdit} />
        </div>
      )}

      {showRetest && !open && <RetestRow fieldType="hours" onRetest={onRetest} label="Business hours updated" />}
    </div>
  )
}

// ── FAQ card ──────────────────────────────────────────────────────────────────

function FaqCard({
  clientId, isAdmin, initialFaqs, isExpired, trialPhase, onRetest,
}: CommonProps & { initialFaqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(false)
  const [faqs, setFaqs] = useState(initialFaqs)
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [showRetest, setShowRetest] = useState(false)
  const { saving, error, patch } = usePatchSettings(clientId, isAdmin)
  const hasExisting = faqs.length > 0

  function openEdit() {
    // Pre-fill with first FAQ if editing, blank if adding
    setQ(faqs[0]?.q ?? ''); setA(faqs[0]?.a ?? '')
    setOpen(true); setShowRetest(false)
    trackEvent('knowledge_card_edit_opened', { field_type: 'faq', trial_phase: trialPhase })
  }
  function cancelEdit() {
    setOpen(false)
    trackEvent('knowledge_card_edit_cancelled', { field_type: 'faq' })
  }
  async function save() {
    const trimQ = q.trim(); const trimA = a.trim()
    if (!trimQ || !trimA) return
    // Replace first FAQ (edit) or append (add)
    const updated = hasExisting
      ? [{ q: trimQ, a: trimA }, ...faqs.slice(1)]
      : [{ q: trimQ, a: trimA }]
    const res = await patch({ extra_qa: updated })
    if (res?.ok) {
      setFaqs(updated)
      setOpen(false); setShowRetest(true)
      trackEvent('faq_updated_from_dashboard', { trial_phase: trialPhase })
    }
  }

  return (
    <div className="rounded-2xl p-4 card-surface">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 mb-0.5">FAQ</p>
          {hasExisting
            ? <>
                <p className="text-xs t2 truncate">{faqs[0].q}</p>
                {faqs.length > 1 && <p className="text-[10px] t3">+{faqs.length - 1} more</p>}
              </>
            : <p className="text-xs t3 italic">No Q&A added yet</p>
          }
        </div>
        {!isExpired && !open && (
          <EditButton label={hasExisting ? 'Edit' : 'Add FAQ'} onClick={openEdit} />
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Question your agent should know…"
            autoFocus className={INPUT_CLS} style={INPUT_STYLE}
          />
          <textarea
            value={a} onChange={e => setA(e.target.value)}
            placeholder="Answer…" rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save() }}
            className={`${INPUT_CLS} resize-none`} style={INPUT_STYLE}
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <SaveRow saving={saving} onSave={save} onCancel={cancelEdit} disabled={!q.trim() || !a.trim()} />
        </div>
      )}

      {showRetest && !open && <RetestRow fieldType="faq" onRetest={onRetest} label="FAQ saved" />}
    </div>
  )
}

// ── Website card ──────────────────────────────────────────────────────────────

type WebsiteStatus = 'idle' | 'saving' | 'scraping' | 'done' | 'error'

function WebsiteCard({
  clientId, isAdmin, initialUrl, isExpired, trialPhase,
}: CommonProps & { initialUrl: string | null }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(initialUrl ?? '')
  const [current, setCurrent] = useState(initialUrl)
  const [status, setStatus] = useState<WebsiteStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { saving } = usePatchSettings(clientId, isAdmin)

  function openEdit() {
    setOpen(true); setErrorMsg(null)
    trackEvent('knowledge_card_edit_opened', { field_type: 'website', trial_phase: trialPhase })
  }
  function cancelEdit() {
    setOpen(false); setUrl(current ?? '')
    trackEvent('knowledge_card_edit_cancelled', { field_type: 'website' })
  }

  async function save() {
    const trimmed = url.trim()
    if (!trimmed) return
    // Basic URL validation
    try { new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`) } catch {
      setErrorMsg('Enter a valid website URL'); return
    }
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`

    setStatus('saving'); setErrorMsg(null)
    try {
      const saveRes = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: normalized, ...(isAdmin ? { client_id: clientId } : {}) }),
        signal: AbortSignal.timeout(15000),
      })
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not save website')
      }
      setCurrent(normalized)
      setUrl(normalized)
      setOpen(false)
      setStatus('scraping')
      trackEvent('website_url_saved_from_dashboard', { trial_phase: trialPhase })

      // Fire scrape — runs in background (~45s). Show status but don't block UX.
      fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, url: normalized }),
      }).then(r => {
        if (r.ok) {
          setStatus('done')
          trackEvent('website_scraped_from_dashboard', { trial_phase: trialPhase })
        } else {
          setStatus('error')
          setErrorMsg('Website saved — scraping failed. Your agent will still know your URL.')
        }
      }).catch(() => {
        setStatus('error')
        setErrorMsg('Website saved — scraping failed. Your agent will still know your URL.')
      })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Could not save website')
    }
  }

  const statusPill =
    status === 'done' ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">Synced</span> :
    status === 'scraping' ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Importing…</span> :
    null

  const displayUrl = current
    ? current.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
    : null

  return (
    <div className="rounded-2xl p-4 card-surface">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3">Website</p>
            {statusPill}
          </div>
          {displayUrl
            ? <p className="text-xs t2 truncate">{displayUrl}</p>
            : <p className="text-xs t3 italic">Not added — your agent can't answer website questions</p>
          }
          {status === 'error' && errorMsg && !open && (
            <p className="text-[10px] text-amber-400 mt-0.5">{errorMsg}</p>
          )}
        </div>
        {!isExpired && !open && (
          <EditButton label={current ? 'Update' : 'Add'} onClick={openEdit} />
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="url" value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            placeholder="https://yourbusiness.com"
            autoFocus className={INPUT_CLS} style={INPUT_STYLE}
          />
          <p className="text-[10px] t3">
            We'll scan your site so your agent can answer questions about your services, pricing, and more.
          </p>
          {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}
          <SaveRow saving={saving || status === 'saving'} onSave={save} onCancel={cancelEdit} disabled={!url.trim()} />
        </div>
      )}

      {status === 'done' && !open && (
        <div className="mt-2">
          <span className="text-[11px] text-green-400">✓ Website imported — your agent now knows your site</span>
        </div>
      )}
      {status === 'scraping' && !open && (
        <div className="mt-2">
          <span className="text-[11px] text-blue-400">Scanning your website… takes about 30 seconds</span>
        </div>
      )}
    </div>
  )
}

// ── Forwarding card ───────────────────────────────────────────────────────────

function ForwardingCard({
  clientId, isAdmin, initialNumber, isExpired, trialPhase, onRetest,
}: CommonProps & { initialNumber: string | null }) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState(initialNumber ?? '')
  const [current, setCurrent] = useState(initialNumber)
  const [showRetest, setShowRetest] = useState(false)
  const { saving, error, patch } = usePatchSettings(clientId, isAdmin)

  function openEdit() {
    setOpen(true); setShowRetest(false)
    trackEvent('knowledge_card_edit_opened', { field_type: 'forwarding', trial_phase: trialPhase })
  }
  function cancelEdit() {
    setOpen(false); setNumber(current ?? '')
    trackEvent('knowledge_card_edit_cancelled', { field_type: 'forwarding' })
  }
  async function save() {
    const res = await patch({ forwarding_number: number.trim() })
    if (res?.ok) {
      setCurrent(number.trim() || null)
      setOpen(false); setShowRetest(true)
      trackEvent('forwarding_updated_from_dashboard', { trial_phase: trialPhase })
    }
  }

  // Basic +1XXXXXXXXXX → (XXX) XXX-XXXX display
  const formatted = current
    ? current.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')
    : null

  return (
    <div className="rounded-2xl p-4 card-surface">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 mb-0.5">Call forwarding</p>
          <p className="text-xs t2 truncate">
            {formatted ?? <span className="t3 italic">Not configured</span>}
          </p>
        </div>
        {!isExpired && !open && (
          <EditButton label={current ? 'Update' : 'Add'} onClick={openEdit} />
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="tel" value={number} onChange={e => setNumber(e.target.value)}
            placeholder="e.g. +13065550101"
            autoFocus className={INPUT_CLS} style={INPUT_STYLE}
          />
          <p className="text-[10px] t3">
            Your agent will offer to transfer callers to this number when needed.
          </p>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <SaveRow saving={saving} onSave={save} onCancel={cancelEdit} />
        </div>
      )}

      {showRetest && !open && <RetestRow fieldType="forwarding" onRetest={onRetest} label="Forwarding number updated" />}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface TrialKnowledgeCardsProps {
  clientId: string
  isAdmin: boolean
  initialHoursWeekday: string | null
  initialHoursWeekend: string | null
  initialFaqs: { q: string; a: string }[]
  initialForwardingNumber: string | null
  initialWebsiteUrl: string | null
  isExpired: boolean
  trialPhase: TrialPhase
  onRetest: () => void
}

export default function TrialKnowledgeCards({
  clientId, isAdmin,
  initialHoursWeekday, initialHoursWeekend,
  initialFaqs, initialForwardingNumber,
  initialWebsiteUrl,
  isExpired, trialPhase, onRetest,
}: TrialKnowledgeCardsProps) {
  const common: CommonProps = { clientId, isAdmin, isExpired, trialPhase, onRetest }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">What your agent knows</p>
        <Link
          href="/dashboard/settings?tab=knowledge"
          className="text-[12px] font-medium hover:opacity-75 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          More →
        </Link>
      </div>
      <div className="space-y-2">
        <WebsiteCard {...common} initialUrl={initialWebsiteUrl} />
        <HoursCard {...common} initialWeekday={initialHoursWeekday} initialWeekend={initialHoursWeekend} />
        <FaqCard {...common} initialFaqs={initialFaqs} />
        <ForwardingCard {...common} initialNumber={initialForwardingNumber} />
      </div>
    </div>
  )
}
