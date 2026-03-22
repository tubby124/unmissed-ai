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
  idle:      { label: 'Not scraped',  cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  scraping:  { label: 'Scraping...',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  extracted: { label: 'Ready to approve', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved:  { label: 'Live',         cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:    { label: 'Failed',       cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default function WebsiteKnowledgeCard({ client, isAdmin, previewMode }: WebsiteKnowledgeCardProps) {
  const status = resolveStatus(client)
  const badge = STATUS_BADGE[status]
  const [rescrapeBusy, setRescrapeBusy] = useState(false)

  const preview = client.website_knowledge_preview
  const approved = client.website_knowledge_approved
  const knowledgeLive = client.knowledge_backend === 'pgvector' && status === 'approved'

  const handleRescrape = async () => {
    if (!client.website_url) return
    setRescrapeBusy(true)
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: client.website_url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Scrape failed')
      }
      toast.success('Website scrape started — refresh in a minute to see results')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setRescrapeBusy(false)
    }
  }

  // ── Empty state: no URL configured ──────────────────────────────
  if (!client.website_url && status === 'idle') {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <GlobeIcon />
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Website Knowledge</p>
        </div>
        <p className="text-xs t3 leading-relaxed">
          No website URL configured. Add one in the setup section to let your agent learn from your site.
        </p>
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

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GlobeIcon />
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Website Knowledge</p>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* URL + meta row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs t2 font-mono truncate flex-1">{client.website_url}</span>
        {client.website_last_scraped_at && (
          <span className="text-[10px] t3 shrink-0">{fmtDate(client.website_last_scraped_at)}</span>
        )}
      </div>

      {/* Stats grid */}
      {(status === 'extracted' || status === 'approved') && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatCell
            label="Facts"
            value={status === 'approved' ? approvedFacts : previewFacts}
            active={status === 'approved' ? approvedFacts > 0 : previewFacts > 0}
          />
          <StatCell
            label="Q&A"
            value={status === 'approved' ? approvedQa : previewQa}
            active={status === 'approved' ? approvedQa > 0 : previewQa > 0}
          />
          <StatCell
            label={pages > 0 ? `${pages} page${pages !== 1 ? 's' : ''}` : 'Tags'}
            value={pages > 0 ? (status === 'approved' ? approvedTags : previewTags) : (status === 'approved' ? approvedTags : previewTags)}
            active={(status === 'approved' ? approvedTags : previewTags) > 0}
            sublabel={pages > 0 ? 'Service Tags' : undefined}
          />
        </div>
      )}

      {/* Knowledge sync indicator */}
      {status === 'approved' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${
          knowledgeLive
            ? 'bg-purple-500/[0.04] border-purple-500/15'
            : 'bg-zinc-500/[0.04] border-zinc-500/15'
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${knowledgeLive ? 'bg-purple-400/80' : 'bg-zinc-400/80'}`} />
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

      {/* Extracted but not yet approved hint */}
      {status === 'extracted' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mb-3">
          <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
          <p className="text-[10px] t2 leading-relaxed">
            <span className="font-semibold text-blue-400/90">Review needed</span>
            {' '}&mdash; scraped data is ready for approval before going live.
          </p>
        </div>
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

function StatCell({ label, value, active, sublabel }: { label: string; value: number; active: boolean; sublabel?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-colors ${
      active
        ? 'border-green-500/20 bg-green-500/[0.04]'
        : 'border-zinc-500/15 bg-zinc-500/[0.02]'
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
