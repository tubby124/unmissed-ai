'use client'

import { useState } from 'react'

interface WebsiteScrapePanelProps {
  clientId: string
  isAdmin: boolean
  previewMode?: boolean
  initialWebsiteUrl?: string
  onChunkAdded: () => void
}

export default function WebsiteScrapePanel({
  clientId,
  isAdmin,
  previewMode,
  initialWebsiteUrl,
  onChunkAdded,
}: WebsiteScrapePanelProps) {
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl || '')
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [scrapePreview, setScrapePreview] = useState<{
    businessFacts?: string[]
    extraQa?: { q: string; a: string }[]
    serviceTags?: string[]
    warnings?: string[]
  } | null>(null)
  const [scrapeStatus, setScrapeStatus] = useState<string>('idle')
  const [approveLoading, setApproveLoading] = useState(false)
  const [selectedFacts, setSelectedFacts] = useState<Set<number>>(new Set())
  const [selectedQa, setSelectedQa] = useState<Set<number>>(new Set())

  const selectedCount = selectedFacts.size + selectedQa.size

  async function handleScrape() {
    if (!websiteUrl.trim()) return
    setScrapeLoading(true)
    setScrapeError('')
    setScrapePreview(null)
    setScrapeStatus('scraping')
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, url: websiteUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setScrapePreview(data.preview)
      setScrapeStatus(data.status)
      const facts = data.preview?.businessFacts ?? []
      const qa = data.preview?.extraQa ?? []
      setSelectedFacts(new Set(facts.map((_: string, i: number) => i)))
      setSelectedQa(new Set(qa.map((_: { q: string; a: string }, i: number) => i)))
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed')
      setScrapeStatus('failed')
    } finally {
      setScrapeLoading(false)
    }
  }

  function toggleFact(idx: number) {
    setSelectedFacts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function toggleQa(idx: number) {
    setSelectedQa(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  async function handleApproveWebsiteKnowledge() {
    if (selectedCount === 0) return
    setApproveLoading(true)
    setScrapeError('')
    try {
      const approvedPackage = {
        businessFacts: (scrapePreview?.businessFacts ?? []).filter((_, i) => selectedFacts.has(i)),
        extraQa: (scrapePreview?.extraQa ?? []).filter((_, i) => selectedQa.has(i)),
        serviceTags: scrapePreview?.serviceTags ?? [],
      }
      const res = await fetch('/api/dashboard/approve-website-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          approved: approvedPackage,
          auto_approve: isAdmin,
          // Thread the URL through so per-URL chunk delete and source row sync
          // target the right row in client_website_sources.
          sourceUrl: websiteUrl.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approval failed')
      setScrapeStatus('approved')
      onChunkAdded()
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproveLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs t3">
        Scrape a website to extract business facts and Q&A. Extracted content goes to pending review before your agent can use it.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={websiteUrl}
          onChange={e => setWebsiteUrl(e.target.value)}
          placeholder="https://yourbusiness.com"
          className="flex-1 bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 font-mono placeholder:t3 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleScrape}
          disabled={scrapeLoading || !websiteUrl.trim() || previewMode}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
        >
          {scrapeLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Scrape Website'}
        </button>
      </div>

      {scrapeError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
          {scrapeError}
        </div>
      )}

      {scrapeStatus === 'extracted' && scrapePreview && (
        <div className="space-y-3 rounded-lg border b-theme p-3">
          <p className="text-[10px] font-semibold t3 uppercase tracking-wider">Extracted Preview</p>

          {scrapePreview.businessFacts && scrapePreview.businessFacts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] t3 font-medium">{selectedFacts.size}/{scrapePreview.businessFacts.length} Facts selected</p>
                <button
                  onClick={() => {
                    if (selectedFacts.size === scrapePreview.businessFacts!.length) {
                      setSelectedFacts(new Set())
                    } else {
                      setSelectedFacts(new Set(scrapePreview.businessFacts!.map((_, i) => i)))
                    }
                  }}
                  className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer"
                >
                  {selectedFacts.size === scrapePreview.businessFacts.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <ul className="space-y-0.5">
                {scrapePreview.businessFacts.map((fact, i) => (
                  <li
                    key={i}
                    onClick={() => toggleFact(i)}
                    className={`text-[11px] leading-relaxed flex items-start gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                      selectedFacts.has(i) ? 't2 hover:bg-hover' : 't3 line-through hover:bg-hover'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFacts.has(i)}
                      onChange={() => toggleFact(i)}
                      className="mt-0.5 shrink-0 accent-blue-500"
                    />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scrapePreview.extraQa && scrapePreview.extraQa.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] t3 font-medium">{selectedQa.size}/{scrapePreview.extraQa.length} Q&A Pairs selected</p>
                <button
                  onClick={() => {
                    if (selectedQa.size === scrapePreview.extraQa!.length) {
                      setSelectedQa(new Set())
                    } else {
                      setSelectedQa(new Set(scrapePreview.extraQa!.map((_, i) => i)))
                    }
                  }}
                  className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer"
                >
                  {selectedQa.size === scrapePreview.extraQa.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5">
                {scrapePreview.extraQa.map((qa, i) => (
                  <div
                    key={i}
                    onClick={() => toggleQa(i)}
                    className={`rounded-lg border p-2 cursor-pointer transition-colors ${
                      selectedQa.has(i) ? 'bg-black/10 b-theme' : 'bg-transparent b-theme opacity-40'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedQa.has(i)}
                        onChange={() => toggleQa(i)}
                        className="mt-0.5 shrink-0 accent-blue-500"
                      />
                      <div>
                        <p className={`text-[11px] font-medium ${selectedQa.has(i) ? 't1' : 't3'}`}>Q: {qa.q}</p>
                        <p className={`text-[11px] mt-0.5 ${selectedQa.has(i) ? 't2' : 't3'}`}>A: {qa.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scrapePreview.warnings && scrapePreview.warnings.length > 0 && (
            <div className="space-y-1">
              {scrapePreview.warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-amber-400/80">{w}</p>
              ))}
            </div>
          )}

          <button
            onClick={handleApproveWebsiteKnowledge}
            disabled={approveLoading || previewMode || selectedCount === 0}
            className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-40"
          >
            {approveLoading
              ? 'Processing...'
              : selectedCount === 0
                ? 'Select items to add'
                : isAdmin
                  ? `Approve ${selectedCount} item${selectedCount !== 1 ? 's' : ''} to Knowledge Base`
                  : `Submit ${selectedCount} item${selectedCount !== 1 ? 's' : ''} for Review`}
          </button>
        </div>
      )}

      {scrapeStatus === 'approved' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/[0.07] border border-green-500/20">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] text-green-400/90">
            Website knowledge added to the knowledge base. {isAdmin ? 'Chunks auto-approved.' : 'Chunks pending review.'}
          </span>
        </div>
      )}
    </div>
  )
}
