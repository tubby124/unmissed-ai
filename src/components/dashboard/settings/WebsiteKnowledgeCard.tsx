'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { fmtDate } from './shared'
import { ScrapeSelectablePreview } from '@/components/shared/ScrapeSelectablePreview'

interface WebsiteKnowledgeCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

type ScrapeStatus = 'idle' | 'scraping' | 'extracted' | 'approved' | 'failed'

type WebsiteSource = {
  id: string
  url: string
  scrape_status: string
  last_scraped_at: string | null
  chunk_count: number | null
  scrape_error: string | null
}

function resolveStatus(client: ClientConfig): ScrapeStatus {
  if (client.website_scrape_status === 'approved') return 'approved'
  if (client.website_scrape_status === 'extracted' && client.website_knowledge_preview) return 'extracted'
  if (client.website_scrape_status === 'scraping') return 'scraping'
  if (client.website_scrape_status === 'failed') return 'failed'
  return 'idle'
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  idle:      { label: 'Not scraped',      cls: 'bg-hover t3 b-theme' },
  pending:   { label: 'Pending',          cls: 'bg-hover t3 b-theme' },
  scraping:  { label: 'Scraping...',      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  extracted: { label: 'Ready to approve', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved:  { label: 'Live',             cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:    { label: 'Failed',           cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default function WebsiteKnowledgeCard({ client, isAdmin, previewMode }: WebsiteKnowledgeCardProps) {
  // ── Scrape / approve state ────────────────────────────────────────
  const [localStatus, setLocalStatus] = useState<ScrapeStatus | null>(null)
  const status = localStatus ?? resolveStatus(client)
  const badge = STATUS_BADGE[status]
  const [rescrapeBusy, setRescrapeBusy] = useState(false)
  const [approveBusy, setApproveBusy] = useState(false)
  const [urlInput, setUrlInput] = useState(client.website_url ?? '')
  const [urlSaving, setUrlSaving] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)
  const [showAddUrl, setShowAddUrl] = useState(false)

  // ── Multi-URL sources ─────────────────────────────────────────────
  const [sources, setSources] = useState<WebsiteSource[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [maxUrls, setMaxUrls] = useState(3)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [rescrapingUrl, setRescrapingUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/website-sources?client_id=${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSources(data.sources ?? [])
          setMaxUrls(data.maxWebsiteUrls ?? 3)
        }
      })
      .catch(() => {})
      .finally(() => setSourcesLoaded(true))
  }, [client.id])

  const atLimit = sources.length >= maxUrls
  const multiMode = sourcesLoaded && sources.length > 0

  // ── Preview / selection state ─────────────────────────────────────
  const preview = client.website_knowledge_preview
  const approved = client.website_knowledge_approved
  const knowledgeLive = client.knowledge_backend === 'pgvector' && status === 'approved'

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

  // ── Refresh helper ────────────────────────────────────────────────
  async function refreshSources() {
    const r = await fetch(`/api/dashboard/website-sources?client_id=${client.id}`).catch(() => null)
    if (!r?.ok) return
    const data = await r.json().catch(() => null)
    if (data?.sources) { setSources(data.sources); setMaxUrls(data.maxWebsiteUrls ?? maxUrls) }
  }

  // ── Handlers ──────────────────────────────────────────────────────

  // First URL: save to clients.website_url + trigger scrape (single-URL compat)
  async function handleScrapeUrl(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    setUrlSaving(true)
    try {
      const saveRes = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: trimmed, ...(isAdmin ? { client_id: client.id } : {}) }),
      })
      if (!saveRes.ok) throw new Error('Failed to save URL')
      const scrapeRes = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: trimmed }),
      })
      const scrapeData = await scrapeRes.json().catch(() => ({}))
      if (!scrapeRes.ok) throw new Error(scrapeData.error ?? 'Scrape failed')
      if (scrapeData.status === 'failed') throw new Error('Could not extract content from that URL — try a different page or check the URL')
      toast.success('Website scraped — refresh to review and add to your agent')
      setEditingUrl(false)
      await refreshSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setUrlSaving(false)
    }
  }

  // Additional URLs: only trigger scrape (multi-URL mode)
  async function handleAddNewUrl(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    setUrlSaving(true)
    const tempId = 'temp-' + Date.now()
    setSources(prev => [...prev, { id: tempId, url: trimmed, scrape_status: 'scraping', last_scraped_at: null, chunk_count: null, scrape_error: null }])
    setShowAddUrl(false)
    setUrlInput('')
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
      if (data.status === 'failed') throw new Error('Could not extract content from that URL')
      await refreshSources()
      toast.success('URL scraped — review and approve to train your agent')
    } catch (err) {
      setSources(prev => prev.filter(s => s.id !== tempId))
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setUrlSaving(false)
    }
  }

  async function handleRescrape(url?: string) {
    const targetUrl = url ?? client.website_url
    if (!targetUrl) return
    if (url) {
      setRescrapingUrl(url)
      setSources(prev => prev.map(s => s.url === url ? { ...s, scrape_status: 'scraping' } : s))
    } else {
      setRescrapeBusy(true)
    }
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: targetUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
      if (data.status === 'failed') throw new Error('Could not extract content from that URL — try a different page or check the URL')
      if (url) await refreshSources()
      toast.success('Website scraped — refresh to review and add to your agent')
    } catch (err) {
      if (url) setSources(prev => prev.map(s => s.url === url ? { ...s, scrape_status: 'failed' } : s))
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      if (url) setRescrapingUrl(null)
      else setRescrapeBusy(false)
    }
  }

  async function handleRemoveSource(url: string) {
    setDeletingUrl(url)
    try {
      const res = await fetch('/api/dashboard/website-sources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url }),
      })
      if (!res.ok) throw new Error('Failed to remove')
      setSources(prev => prev.filter(s => s.url !== url))
      toast.success('URL removed')
    } catch {
      toast.error('Failed to remove URL')
    } finally {
      setDeletingUrl(null)
    }
  }

  async function handleApprove() {
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
      // Reflect approval in source list
      if (client.website_url) {
        setSources(prev => prev.map(s => s.url === client.website_url ? { ...s, scrape_status: 'approved' } : s))
      }
      toast.success('Website knowledge added to your agent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproveBusy(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────
  const previewFacts = preview?.businessFacts?.filter(f => f?.trim()).length ?? 0
  const previewQa = preview?.extraQa?.filter(q => q.q?.trim()).length ?? 0
  const previewTags = preview?.serviceTags?.length ?? 0
  const approvedFacts = approved?.businessFacts?.filter(f => f?.trim()).length ?? 0
  const approvedQa = approved?.extraQa?.filter(q => q.q?.trim()).length ?? 0
  const approvedTags = approved?.serviceTags?.length ?? 0
  const pages = client.website_scrape_pages?.length ?? 0
  const justApproved = localStatus === 'approved'
  const displayFacts = (status === 'approved' && !justApproved) ? approvedFacts : previewFacts
  const displayQa = (status === 'approved' && !justApproved) ? approvedQa : previewQa
  const displayTags = (status === 'approved' && !justApproved) ? approvedTags : previewTags

  // ── Shared approval section ────────────────────────────────────────
  const approvalSection = status === 'extracted' && preview ? (
    <>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mb-2">
        <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
        <p className="text-[10px] t2 leading-relaxed">
          <span className="font-semibold text-blue-400/90">Ready to add</span>
          {' '}&mdash; {previewFacts} fact{previewFacts !== 1 ? 's' : ''}{previewQa > 0 ? ` and ${previewQa} Q&A${previewQa !== 1 ? 's' : ''}` : ''} extracted from {client.website_url}.
        </p>
      </div>
      {(previewFacts > 0 || previewQa > 0) && (
        <ScrapeSelectablePreview
          facts={previewFactsList}
          qa={previewQaList}
          selectedFacts={selectedFacts}
          selectedQa={selectedQa}
          onToggleFact={toggleFact}
          onToggleQa={toggleQa}
        />
      )}
      {!previewMode && (
        <button
          onClick={handleApprove}
          disabled={approveBusy || (selectedFacts.size === 0 && selectedQa.size === 0)}
          className="w-full mb-3 text-[11px] font-semibold text-white rounded-xl px-3 py-2.5 transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {approveBusy ? 'Adding to agent…' : `Add ${selectedFacts.size + selectedQa.size} item${selectedFacts.size + selectedQa.size !== 1 ? 's' : ''} to Agent`}
        </button>
      )}
    </>
  ) : null

  // ── Empty state (no sources, no URL) ──────────────────────────────
  if (!multiMode && !client.website_url && status === 'idle') {
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

  // ── Multi-URL list mode ────────────────────────────────────────────
  if (multiMode) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GlobeIcon />
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Website Knowledge</p>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            atLimit ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-hover t3 b-theme'
          }`}>
            {sources.length}/{maxUrls} URLs
          </span>
        </div>

        {/* URL list */}
        <div className="space-y-1.5 mb-3">
          {sources.map(source => {
            const srcBadge = STATUS_BADGE[source.scrape_status] ?? STATUS_BADGE.idle
            const isScraping = source.scrape_status === 'scraping' || rescrapingUrl === source.url
            const isDeleting = deletingUrl === source.url
            return (
              <div
                key={source.url}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border b-theme"
                style={{ backgroundColor: 'var(--color-hover)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono t2 truncate">{source.url}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {source.last_scraped_at && (
                      <span className="text-[10px] t3">{fmtDate(source.last_scraped_at)}</span>
                    )}
                    {source.chunk_count != null && source.chunk_count > 0 && (
                      <span className="text-[10px] t3">{source.chunk_count} chunk{source.chunk_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${srcBadge.cls}`}>
                  {srcBadge.label}
                </span>
                {!previewMode && (
                  <>
                    <button
                      onClick={() => handleRescrape(source.url)}
                      disabled={isScraping || isDeleting}
                      title="Rescrape"
                      className="w-6 h-6 flex items-center justify-center rounded border b-theme bg-surface text-[11px] t3 hover:t1 disabled:opacity-40 shrink-0"
                    >
                      {isScraping ? (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                        </svg>
                      ) : '↺'}
                    </button>
                    <button
                      onClick={() => handleRemoveSource(source.url)}
                      disabled={isDeleting || isScraping}
                      title="Remove"
                      className="w-6 h-6 flex items-center justify-center rounded border border-red-500/20 text-red-400/70 hover:text-red-400 text-sm disabled:opacity-40 shrink-0"
                    >
                      {isDeleting ? '…' : '×'}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Add URL section */}
        {!previewMode && (
          atLimit ? (
            <p className="text-[10px] t3 text-center py-2 px-1">
              {sources.length}/{maxUrls} URL limit reached —{' '}
              <a href="/dashboard/settings?tab=billing" className="text-blue-400 hover:underline">upgrade plan</a>
              {' '}to add more.
            </p>
          ) : showAddUrl ? (
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://yourbusiness.com/another-page"
                className="flex-1 text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) handleAddNewUrl(urlInput) }}
              />
              <button
                onClick={() => handleAddNewUrl(urlInput)}
                disabled={urlSaving || !urlInput.trim()}
                className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {urlSaving ? '...' : 'Scrape'}
              </button>
              <button
                onClick={() => { setShowAddUrl(false); setUrlInput('') }}
                className="px-3 py-2 rounded-lg text-xs t3 hover:t1 border b-theme"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddUrl(true)}
              className="w-full text-[11px] font-medium t3 hover:t1 border b-theme rounded-xl px-3 py-2 transition-colors"
            >
              + Add URL ({sources.length}/{maxUrls} used)
            </button>
          )
        )}

        {/* Approval flow for most recently extracted URL */}
        {status === 'extracted' && preview && (
          <>
            <div className="border-t b-theme mt-3 mb-3" />
            {approvalSection}
          </>
        )}
      </div>
    )
  }

  // ── Single-URL legacy mode ─────────────────────────────────────────
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

      {/* URL row */}
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
          knowledgeLive ? 'bg-purple-500/[0.04] border-purple-500/15' : 'bg-hover b-theme'
        }`}>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${knowledgeLive ? 'bg-purple-400/80' : ''}`}
            style={knowledgeLive ? undefined : { backgroundColor: 'var(--color-text-3)' }}
          />
          <p className="text-[10px] t2 leading-relaxed">
            {knowledgeLive ? (
              <><span className="font-semibold text-purple-400/90">Searchable</span>{' '}&mdash; website knowledge is indexed and available during calls.</>
            ) : (
              <><span className="font-semibold t3">Not indexed</span>{' '}&mdash; enable Knowledge Engine to make website data searchable.</>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'failed' && client.website_scrape_error && (
        <p className="text-[10px] text-red-400/80 leading-relaxed mb-3 px-1">
          {client.website_scrape_error}
        </p>
      )}

      {/* Approval flow */}
      {approvalSection}

      {/* Scraping spinner */}
      {status === 'scraping' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.04] border border-amber-500/15 mb-3">
          <svg className="w-3 h-3 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <p className="text-[10px] t2 leading-relaxed">Scraping your website &mdash; this usually takes under a minute.</p>
        </div>
      )}

      {/* Rescrape button */}
      {!previewMode && (status === 'failed' || status === 'approved' || status === 'idle') && client.website_url && (
        <button
          onClick={() => handleRescrape()}
          disabled={rescrapeBusy}
          className="w-full text-[10px] font-medium t3 hover:t1 border b-theme rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
        >
          {rescrapeBusy ? 'Scraping...' : status === 'failed' ? 'Retry Scrape' : 'Rescrape Website'}
        </button>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function StatCell({ label, value, active, sublabel }: { label: string; value: number; active: boolean; sublabel?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-colors ${
      active ? 'border-green-500/20 bg-green-500/[0.04]' : 'b-theme bg-hover'
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
