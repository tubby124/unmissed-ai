'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { fmtDate } from './shared'

interface WebsiteKnowledgeCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

type ScrapeStatus = 'idle' | 'scraping' | 'extracted' | 'approved' | 'failed'

function resolveStatus(client: ClientConfig): ScrapeStatus {
  if (client.website_scrape_status === 'approved' && client.website_knowledge_approved) return 'approved'
  if (client.website_scrape_status === 'extracted' && client.website_knowledge_preview) return 'extracted'
  if (client.website_scrape_status === 'scraping') return 'scraping'
  if (client.website_scrape_status === 'failed') return 'failed'
  return 'idle'
}

const STATUS_BADGE: Record<ScrapeStatus, { label: string; cls: string }> = {
  idle:      { label: 'Not scraped',  cls: 'bg-hover t3 b-theme' },
  scraping:  { label: 'Scraping...',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  extracted: { label: 'Ready to approve', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved:  { label: 'Live',         cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:    { label: 'Failed',       cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default function WebsiteKnowledgeCard({ client, isAdmin, previewMode }: WebsiteKnowledgeCardProps) {
  const [localStatus, setLocalStatus] = useState<ScrapeStatus | null>(null)
  const status = localStatus ?? resolveStatus(client)
  const badge = STATUS_BADGE[status]
  const [rescrapeBusy, setRescrapeBusy] = useState(false)
  const [approveBusy, setApproveBusy] = useState(false)
  const [urlInput, setUrlInput] = useState(client.website_url ?? '')
  const [urlSaving, setUrlSaving] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)

  const preview = client.website_knowledge_preview
  const approved = client.website_knowledge_approved
  const knowledgeLive = client.knowledge_backend === 'pgvector' && status === 'approved'

  // Selection state — all checked by default when preview loads
  const previewFactsList = preview?.businessFacts?.filter(f => f?.trim()) ?? []
  const previewQaList = preview?.extraQa?.filter(q => q.q?.trim()) ?? []
  const [selectedFacts, setSelectedFacts] = useState<Set<number>>(
    () => new Set(previewFactsList.map((_, i) => i))
  )
  const [selectedQa, setSelectedQa] = useState<Set<number>>(
    () => new Set(previewQaList.map((_, i) => i))
  )

  const toggleFact = (i: number) => setSelectedFacts(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
  })
  const toggleQa = (i: number) => setSelectedQa(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
  })

  const handleScrapeUrl = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setUrlSaving(true)
    try {
      // Save URL to settings first
      const saveRes = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: trimmed, ...(isAdmin ? { client_id: client.id } : {}) }),
      })
      if (!saveRes.ok) throw new Error('Failed to save URL')
      // Then trigger scrape
      const scrapeRes = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: trimmed }),
      })
      const scrapeData = await scrapeRes.json().catch(() => ({}))
      if (!scrapeRes.ok) {
        throw new Error(scrapeData.error ?? 'Scrape failed')
      }
      if (scrapeData.status === 'failed') {
        throw new Error('Could not extract content from that URL — try a different page or check the URL')
      }
      toast.success('Website scraped — refresh to review and add to your agent')
      setEditingUrl(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setUrlSaving(false)
    }
  }

  const handleRescrape = async () => {
    if (!client.website_url) return
    setRescrapeBusy(true)
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: client.website_url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Scrape failed')
      }
      if (data.status === 'failed') {
        throw new Error('Could not extract content from that URL — try a different page or check the URL')
      }
      toast.success('Website scraped — refresh to review and add to your agent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setRescrapeBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!preview) return
    setApproveBusy(true)
    try {
      const res = await fetch('/api/dashboard/approve-website-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          approved: {
            businessFacts: previewFactsList.filter((_, i) => selectedFacts.has(i)),
            extraQa: previewQaList.filter((_, i) => selectedQa.has(i)),
            serviceTags: preview.serviceTags,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Approval failed')
      }
      setLocalStatus('approved')
      toast.success('Website knowledge added to your agent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproveBusy(false)
    }
  }

  // ── Empty state: no URL configured ──────────────────────────────
  if (!client.website_url && status === 'idle') {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <GlobeIcon />
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Website Knowledge</p>
        </div>
        <p className="text-xs t3 leading-relaxed mb-3">
          Add your website so your agent can learn your services, FAQs, and business info.
        </p>
        {!previewMode && (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://yourbusiness.com"
              className="flex-1 text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
            />
            <button
              onClick={() => handleScrapeUrl(urlInput)}
              disabled={urlSaving || !urlInput.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {urlSaving ? 'Saving...' : 'Scrape'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Stat helpers ────────────────────────────────────────────────
  const previewFacts = preview?.businessFacts?.filter(f => f?.trim()).length ?? 0
  const previewQa = preview?.extraQa?.filter(q => q.q?.trim()).length ?? 0
  const previewTags = preview?.serviceTags?.length ?? 0
  const approvedFacts = approved?.businessFacts?.filter(f => f?.trim()).length ?? 0
  const approvedQa = approved?.extraQa?.filter(q => q.q?.trim()).length ?? 0
  const approvedTags = approved?.serviceTags?.length ?? 0
  const pages = client.website_scrape_pages?.length ?? 0
  // When we just approved in this session, show preview counts (not yet written back to approved column)
  const justApproved = localStatus === 'approved'
  const displayFacts = (status === 'approved' && !justApproved) ? approvedFacts : previewFacts
  const displayQa = (status === 'approved' && !justApproved) ? approvedQa : previewQa
  const displayTags = (status === 'approved' && !justApproved) ? approvedTags : previewTags

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GlobeIcon />
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Website Knowledge</p>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* URL + meta row */}
      {editingUrl ? (
        <div className="flex gap-2 mb-3">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            className="flex-1 text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 font-mono"
            autoFocus
          />
          <button
            onClick={() => handleScrapeUrl(urlInput)}
            disabled={urlSaving || !urlInput.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {urlSaving ? 'Saving...' : 'Scrape'}
          </button>
          <button
            onClick={() => { setEditingUrl(false); setUrlInput(client.website_url ?? '') }}
            className="px-3 py-2 rounded-lg text-xs t3 hover:t1 border b-theme"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs t2 font-mono truncate flex-1">{client.website_url}</span>
          {client.website_last_scraped_at && (
            <span className="text-[10px] t3 shrink-0">{fmtDate(client.website_last_scraped_at)}</span>
          )}
          {!previewMode && (
            <button
              onClick={() => setEditingUrl(true)}
              className="text-[10px] t3 hover:t1 underline underline-offset-2 shrink-0"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* Stats grid */}
      {(status === 'extracted' || status === 'approved') && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatCell label="Facts" value={displayFacts} active={displayFacts > 0} />
          <StatCell label="Q&A" value={displayQa} active={displayQa > 0} />
          <StatCell
            label={pages > 0 ? `${pages} page${pages !== 1 ? 's' : ''}` : 'Tags'}
            value={displayTags}
            active={displayTags > 0}
            sublabel={pages > 0 ? 'Service Tags' : undefined}
          />
        </div>
      )}

      {/* Knowledge sync indicator */}
      {status === 'approved' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${
          knowledgeLive
            ? 'bg-purple-500/[0.04] border-purple-500/15'
            : 'bg-hover b-theme'
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${knowledgeLive ? 'bg-purple-400/80' : 'bg-hover'}`} style={knowledgeLive ? undefined : { backgroundColor: 'var(--color-text-3)' }} />
          <p className="text-[10px] t2 leading-relaxed">
            {knowledgeLive ? (
              <>
                <span className="font-semibold text-purple-400/90">Searchable</span>
                {' '}&mdash; website knowledge is indexed and available during calls.
              </>
            ) : (
              <>
                <span className="font-semibold t3">Not indexed</span>
                {' '}&mdash; enable Knowledge Engine to make website data searchable.
              </>
            )}
          </p>
        </div>
      )}

      {/* Error message */}
      {status === 'failed' && client.website_scrape_error && (
        <p className="text-[10px] text-red-400/80 leading-relaxed mb-3 px-1">
          {client.website_scrape_error}
        </p>
      )}

      {/* Extracted but not yet approved hint + review + approve button */}
      {status === 'extracted' && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
            <p className="text-[10px] t2 leading-relaxed">
              <span className="font-semibold text-blue-400/90">Ready to add</span>
              {' '}&mdash; {previewFacts} fact{previewFacts !== 1 ? 's' : ''}{previewQa > 0 ? ` and ${previewQa} Q&A${previewQa !== 1 ? 's' : ''}` : ''} extracted from your website.
            </p>
          </div>
          {preview && (previewFacts > 0 || previewQa > 0) && (
            <SelectablePreview
              facts={previewFactsList}
              qa={previewQaList}
              selectedFacts={selectedFacts}
              selectedQa={selectedQa}
              onToggleFact={toggleFact}
              onToggleQa={toggleQa}
            />
          )}
          {!previewMode && preview && (
            <button
              onClick={handleApprove}
              disabled={approveBusy || (selectedFacts.size === 0 && selectedQa.size === 0)}
              className="w-full mb-3 text-[11px] font-semibold text-white rounded-xl px-3 py-2.5 transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {approveBusy
                ? 'Adding to agent…'
                : `Add ${selectedFacts.size + selectedQa.size} item${selectedFacts.size + selectedQa.size !== 1 ? 's' : ''} to Agent`}
            </button>
          )}
        </>
      )}

      {/* Scraping spinner */}
      {status === 'scraping' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.04] border border-amber-500/15 mb-3">
          <svg className="w-3 h-3 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <p className="text-[10px] t2 leading-relaxed">
            Scraping your website &mdash; this usually takes under a minute.
          </p>
        </div>
      )}

      {/* Action row */}
      {!previewMode && (status === 'failed' || status === 'approved' || status === 'idle') && client.website_url && (
        <button
          onClick={handleRescrape}
          disabled={rescrapeBusy}
          className="w-full text-[10px] font-medium t3 hover:t1 border b-theme rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
        >
          {rescrapeBusy ? 'Scraping...' : status === 'failed' ? 'Retry Scrape' : 'Rescrape Website'}
        </button>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

type KnowledgePreview = {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
}

interface SelectablePreviewProps {
  facts: string[]
  qa: { q: string; a: string }[]
  selectedFacts: Set<number>
  selectedQa: Set<number>
  onToggleFact: (i: number) => void
  onToggleQa: (i: number) => void
}

function SelectablePreview({ facts, qa, selectedFacts, selectedQa, onToggleFact, onToggleQa }: SelectablePreviewProps) {
  const [expanded, setExpanded] = useState(true)
  const allFactsSelected = facts.every((_, i) => selectedFacts.has(i))
  const allQaSelected = qa.every((_, i) => selectedQa.has(i))

  return (
    <div className="mb-2 rounded-xl border b-theme overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] t3 hover:t1 text-left transition-colors"
        type="button"
      >
        <span className="font-medium">
          Select items to add
          <span className="ml-1.5 t3 font-normal">
            ({selectedFacts.size + selectedQa.size} of {facts.length + qa.length} selected)
          </span>
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className={`transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t b-theme space-y-3">
          {facts.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] t3">
                  Facts ({facts.length})
                </p>
                <button
                  type="button"
                  className="text-[9px] t3 hover:t1 underline underline-offset-2"
                  onClick={() => {
                    if (allFactsSelected) {
                      facts.forEach((_, i) => { if (selectedFacts.has(i)) onToggleFact(i) })
                    } else {
                      facts.forEach((_, i) => { if (!selectedFacts.has(i)) onToggleFact(i) })
                    }
                  }}
                >
                  {allFactsSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <ul className="space-y-1">
                {facts.map((f, i) => (
                  <li key={i}>
                    <label className="flex gap-2 items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedFacts.has(i)}
                        onChange={() => onToggleFact(i)}
                        className="mt-[3px] shrink-0 accent-[var(--color-primary)]"
                      />
                      <span className={`text-[10px] leading-relaxed transition-colors ${selectedFacts.has(i) ? 't2' : 't3 line-through opacity-50'}`}>
                        {f}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {qa.length > 0 && (
            <div className={facts.length > 0 ? 'pt-1 border-t b-theme' : 'pt-2'}>
              <div className="flex items-center justify-between mb-1.5 pt-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] t3">
                  Q&amp;A ({qa.length})
                </p>
                <button
                  type="button"
                  className="text-[9px] t3 hover:t1 underline underline-offset-2"
                  onClick={() => {
                    if (allQaSelected) {
                      qa.forEach((_, i) => { if (selectedQa.has(i)) onToggleQa(i) })
                    } else {
                      qa.forEach((_, i) => { if (!selectedQa.has(i)) onToggleQa(i) })
                    }
                  }}
                >
                  {allQaSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <ul className="space-y-2">
                {qa.map((item, i) => (
                  <li key={i}>
                    <label className="flex gap-2 items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQa.has(i)}
                        onChange={() => onToggleQa(i)}
                        className="mt-[3px] shrink-0 accent-[var(--color-primary)]"
                      />
                      <div className={`text-[10px] leading-relaxed transition-colors ${selectedQa.has(i) ? '' : 'opacity-50'}`}>
                        <p className={`font-medium ${selectedQa.has(i) ? 't1' : 't3 line-through'}`}>{item.q}</p>
                        <p className="t3 mt-0.5">{item.a}</p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, active, sublabel }: { label: string; value: number; active: boolean; sublabel?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-colors ${
      active
        ? 'border-green-500/20 bg-green-500/[0.04]'
        : 'b-theme bg-hover'
    }`}>
      <span className={`text-sm font-semibold ${active ? 't1' : 't3'}`}>{value}</span>
      <span className="text-[9px] t3 text-center leading-tight">{sublabel ?? label}</span>
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
