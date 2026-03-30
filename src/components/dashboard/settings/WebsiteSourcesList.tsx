'use client'

/**
 * D85 — Multi-URL website source management
 * Shows the full list of scraped URLs, their statuses, and actions (add/rescrape/remove).
 * Rendered above WebsiteKnowledgeCard in the knowledge section.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface WebsiteSource {
  id: string
  url: string
  scrape_status: 'pending' | 'scraping' | 'extracted' | 'approved' | 'failed'
  last_scraped_at: string | null
  chunk_count: number
  scrape_error: string | null
  created_at: string
}

interface WebsiteSourcesListProps {
  client: ClientConfig
  isAdmin: boolean
  /** Called when a scrape is triggered so parent can re-render status */
  onScrapeTriggered?: (url: string) => void
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',          cls: 'bg-hover t3 b-theme' },
  scraping:  { label: 'Scraping…',        cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  extracted: { label: 'Ready to approve', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved:  { label: 'Live',             cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:    { label: 'Failed',           cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

function isValidHttpUrl(url: string): boolean {
  try {
    const p = new URL(url)
    return p.protocol === 'http:' || p.protocol === 'https:'
  } catch { return false }
}

export default function WebsiteSourcesList({ client, isAdmin, onScrapeTriggered }: WebsiteSourcesListProps) {
  const [sources, setSources] = useState<WebsiteSource[]>([])
  const [maxUrls, setMaxUrls] = useState(1)
  const [loading, setLoading] = useState(true)
  const [addUrl, setAddUrl] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [busyUrls, setBusyUrls] = useState<Set<string>>(new Set())

  const clientParam = isAdmin ? `?client_id=${client.id}` : ''

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/website-sources${clientParam}`)
      if (!res.ok) return
      const data = await res.json()
      setSources(data.sources ?? [])
      setMaxUrls(data.maxWebsiteUrls ?? 1)
    } finally {
      setLoading(false)
    }
  }, [clientParam])

  useEffect(() => { loadSources() }, [loadSources])

  const handleAdd = async () => {
    const trimmed = addUrl.trim()
    if (!trimmed || !isValidHttpUrl(trimmed)) {
      toast.error('Enter a valid http or https URL')
      return
    }
    setAddBusy(true)
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (data.status === 'failed') throw new Error('Could not extract content from that URL')
      toast.success('Website scraped — scroll down to review and approve')
      setAddUrl('')
      onScrapeTriggered?.(trimmed)
      await loadSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddBusy(false)
    }
  }

  const handleRescrape = async (url: string) => {
    setBusyUrls(prev => new Set(prev).add(url))
    try {
      const res = await fetch('/api/dashboard/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
      if (data.status === 'failed') throw new Error('Could not extract content — try a different URL')
      toast.success('Scraped — scroll down to review and approve')
      onScrapeTriggered?.(url)
      await loadSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setBusyUrls(prev => { const n = new Set(prev); n.delete(url); return n })
    }
  }

  const handleRemove = async (url: string) => {
    setBusyUrls(prev => new Set(prev).add(url))
    try {
      const res = await fetch('/api/dashboard/website-sources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      toast.success('URL removed')
      setSources(prev => prev.filter(s => s.url !== url))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setBusyUrls(prev => { const n = new Set(prev); n.delete(url); return n })
    }
  }

  const atLimit = sources.length >= maxUrls
  const canAdd = !atLimit

  if (loading) return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GlobeIcon />
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Website Sources</p>
        </div>
        <span className="text-[10px] t3 font-mono">
          {sources.length} / {maxUrls} URL{maxUrls !== 1 ? 's' : ''}
        </span>
      </div>

      {/* URL list */}
      {sources.length > 0 ? (
        <div className="space-y-2 mb-3">
          {sources.map(source => {
            const badge = STATUS_BADGE[source.scrape_status] ?? STATUS_BADGE.pending
            const busy = busyUrls.has(source.url)
            return (
              <div
                key={source.url}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border b-theme bg-hover"
              >
                {/* Status dot */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  source.scrape_status === 'approved' ? 'bg-green-400' :
                  source.scrape_status === 'extracted' ? 'bg-blue-400' :
                  source.scrape_status === 'failed' ? 'bg-red-400' :
                  source.scrape_status === 'scraping' ? 'bg-amber-400' :
                  'bg-gray-400'
                }`} />

                {/* URL */}
                <span className="text-xs t2 font-mono truncate flex-1 min-w-0" title={source.url}>
                  {source.url.replace(/^https?:\/\//, '')}
                </span>

                {/* Status badge */}
                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>

                {/* Chunk count (approved) */}
                {source.scrape_status === 'approved' && source.chunk_count > 0 && (
                  <span className="text-[9px] t3 shrink-0">{source.chunk_count} chunks</span>
                )}

                {/* Actions */}
                {!busy ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRescrape(source.url)}
                      className="text-[9px] t3 hover:t1 px-1.5 py-0.5 rounded border b-theme hover:bg-hover transition-colors"
                      title="Re-scrape this URL"
                    >
                      ↻
                    </button>
                    <button
                      onClick={() => handleRemove(source.url)}
                      className="text-[9px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                      title="Remove this URL"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <svg className="w-3 h-3 t3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs t3 leading-relaxed mb-3">
          Add your website so your agent can learn your services, FAQs, and business info.
        </p>
      )}

      {/* Add URL form */}
      {canAdd ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !addBusy && handleAdd()}
            placeholder="https://yourbusiness.com"
            className="flex-1 text-xs t1 bg-hover px-3 py-2 rounded-xl border b-theme focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={addBusy || !addUrl.trim()}
            className="px-3 py-2 rounded-xl text-xs font-medium text-white disabled:opacity-40 transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {addBusy ? 'Scraping…' : 'Add & Scrape'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
          <span className="text-[10px] text-amber-400/80 leading-relaxed">
            URL limit reached ({maxUrls}/{maxUrls}).{' '}
            <a href="/dashboard/billing" className="underline underline-offset-2 hover:text-amber-300">
              Upgrade for more.
            </a>
          </span>
        </div>
      )}
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
