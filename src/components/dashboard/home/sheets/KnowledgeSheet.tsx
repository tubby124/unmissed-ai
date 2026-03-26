'use client'

/**
 * KnowledgeSheet — knowledge management inside HomeSideSheet.
 * Shows FAQ editor, business facts, website scrape status + approve CTA.
 */

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Faq { q: string; a: string }

interface Props {
  clientId: string
  isAdmin: boolean
  editableFields: {
    businessFacts: string | null
    faqs: Faq[]
    websiteUrl: string | null
  }
  websiteScrapeStatus: string | null
  knowledge: {
    pending_review_count: number
    source_types: string[]
  }
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function KnowledgeSheet({
  clientId,
  isAdmin,
  editableFields,
  websiteScrapeStatus,
  knowledge,
  markDirty,
  markClean,
  onSave,
}: Props) {
  const [facts, setFacts] = useState(editableFields.businessFacts ?? '')
  const [faqs, setFaqs] = useState<Faq[]>(editableFields.faqs)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  const isDirty =
    facts !== (editableFields.businessFacts ?? '') ||
    JSON.stringify(faqs) !== JSON.stringify(editableFields.faqs)

  async function save() {
    const res = await patch({
      business_facts: facts,
      extra_qa: faqs,
    })
    if (res?.ok) {
      markClean()
    }
  }

  function addFaq() {
    if (!newQ.trim() || !newA.trim()) return
    const updated = [...faqs, { q: newQ.trim(), a: newA.trim() }]
    setFaqs(updated)
    setNewQ('')
    setNewA('')
    markDirty()
  }

  function removeFaq(i: number) {
    const updated = faqs.filter((_, idx) => idx !== i)
    setFaqs(updated)
    markDirty()
  }

  async function approveWebsiteKnowledge() {
    setApproving(true)
    setApproveError(null)
    try {
      const res = await fetch('/api/dashboard/approve-website-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed (${res.status})`)
      }
      setApproved(true)
      onSave()
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending website review */}
      {knowledge.pending_review_count > 0 && !approved && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0 mt-0.5">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p className="text-xs font-semibold text-amber-400">Website content pending review</p>
              <p className="text-[11px] text-amber-400/80 mt-0.5 leading-relaxed">
                {knowledge.pending_review_count} chunks from your website need approval before your agent can use them.
              </p>
            </div>
          </div>
          <button
            onClick={approveWebsiteKnowledge}
            disabled={approving}
            className="w-full py-2 rounded-lg text-xs font-semibold text-amber-900 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'rgba(245,158,11,0.25)' }}
          >
            {approving ? 'Approving…' : 'Approve & activate website knowledge'}
          </button>
          {approveError && <p className="text-xs text-red-400">{approveError}</p>}
        </div>
      )}

      {approved && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: 'var(--color-success-tint)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-success)' }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>Website knowledge activated</p>
        </div>
      )}

      {/* Business facts */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Business Facts</label>
        <textarea
          value={facts}
          onChange={e => { setFacts(e.target.value); markDirty() }}
          placeholder="One fact per line. e.g.&#10;We're located at 123 Main St&#10;Open Mon-Fri 9am-5pm"
          rows={5}
          className="w-full rounded-xl px-3.5 py-2.5 text-xs t1 outline-none resize-none transition-colors leading-relaxed"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        />
      </div>

      {/* FAQs */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">FAQs ({faqs.length})</p>

        {faqs.length > 0 && (
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: 'var(--color-hover)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium t1 truncate">{faq.q}</p>
                  <p className="text-[11px] t3 truncate">{faq.a}</p>
                </div>
                <button
                  onClick={() => removeFaq(i)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-400/10 transition-colors"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new FAQ */}
        <div className="space-y-2 rounded-xl p-3" style={{ border: '1px dashed var(--color-border)' }}>
          <input
            type="text"
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="Question"
            className="w-full rounded-lg px-3 py-2 text-xs t1 outline-none"
            style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
          />
          <input
            type="text"
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Answer"
            className="w-full rounded-lg px-3 py-2 text-xs t1 outline-none"
            style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFaq() } }}
          />
          <button
            onClick={addFaq}
            disabled={!newQ.trim() || !newA.trim()}
            className="w-full py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            Add FAQ
          </button>
        </div>
      </div>

      {/* Save */}
      {(isDirty || saved) && (
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Knowledge'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Link to full knowledge settings */}
      <a
        href="/dashboard/settings?tab=knowledge"
        className="block text-center text-xs font-semibold"
        style={{ color: 'var(--color-text-3)' }}
      >
        Advanced knowledge settings →
      </a>
    </div>
  )
}
