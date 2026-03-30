'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import type { ClientAgentConfig } from '@/types/client-agent-config'
import { usePatchSettings } from './usePatchSettings'
import KnowledgeTextInput from '@/components/dashboard/knowledge/KnowledgeTextInput'
import { knowledgeRoutes } from '@/lib/dashboard-routes'

interface AgentKnowledgeCardProps {
  client: ClientConfig
  clientId?: string
  isAdmin?: boolean
  config?: ClientAgentConfig
}

export default function AgentKnowledgeCard({ client, clientId, isAdmin = false, config }: AgentKnowledgeCardProps) {
  const id = clientId ?? client.id
  const [qa, setQa] = useState<{ q: string; a: string }[]>(client.extra_qa ?? [])
  const [adding, setAdding] = useState(false)
  const [pastingText, setPastingText] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const { saving, knowledgeReseeded, patch } = usePatchSettings(id, isAdmin)

  const _rawFacts = config?.knowledge.businessFacts ?? client.business_facts
  const factCount = Array.isArray(_rawFacts) ? _rawFacts.filter(l => l.trim()).length : ((_rawFacts as string | null)?.split('\n').filter(l => l.trim()).length ?? 0)
  const faqCount = config ? config.knowledge.extraQa.length : qa.filter(p => p.q?.trim() && p.a?.trim()).length
  const hoursSet = !!(config?.hours.hoursWeekday ?? client.business_hours_weekday)
  const bookingConnected = !!(client.booking_enabled && client.calendar_auth_status === 'connected')
  const voiceStyle = config?.persona.voicePreset ?? client.voice_style_preset ?? 'default'
  const knowledgeActive = config ? config.capabilities.knowledgeEnabled : client.knowledge_backend === 'pgvector'
  const hasWebsite = config ? config.knowledge.scrapeStatus === 'complete' : client.website_scrape_status === 'approved'

  async function saveNewQa() {
    const trimQ = newQ.trim()
    const trimA = newA.trim()
    if (!trimQ || !trimA) return
    const existingIdx = qa.findIndex(p => p.q.trim().toLowerCase() === trimQ.toLowerCase())
    const updated = existingIdx >= 0
      ? qa.map((p, i) => i === existingIdx ? { q: trimQ, a: trimA } : p)
      : [...qa, { q: trimQ, a: trimA }]
    await patch({ extra_qa: updated })
    setQa(updated)
    setNewQ('')
    setNewA('')
    setAdding(false)
  }

  function cancelAdd() {
    setNewQ('')
    setNewA('')
    setAdding(false)
  }

  const knowledgeEnabled = client.knowledge_backend === 'pgvector'

  // Fetch knowledge source breakdown when pgvector is active
  const [sources, setSources] = useState<{ source: string; approved: number }[] | null>(null)
  useEffect(() => {
    if (!knowledgeEnabled) return
    const url = `/api/dashboard/knowledge/stats?client_id=${id}`
    fetch(url).then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.bySource) return
      const entries = Object.entries(data.bySource as Record<string, number>)
        .map(([source, count]) => ({ source, approved: count }))
        .filter(e => e.approved > 0)
        .sort((a, b) => b.approved - a.approved)
      setSources(entries)
    }).catch(() => {})
  }, [knowledgeEnabled, id])

  const stats = [
    {
      label: 'Business Facts',
      value: factCount > 0 ? `${factCount}` : '0',
      active: factCount > 0,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Q&A Pairs',
      value: `${faqCount}`,
      active: faqCount > 0,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 9a3 3 0 015.12 2.13c0 1.5-2.12 2-2.12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
      ),
    },
    {
      label: 'Hours',
      value: hoursSet ? 'Set' : 'Not set',
      active: hoursSet,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Booking',
      value: bookingConnected ? 'Connected' : 'Off',
      active: bookingConnected,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Voice Style',
      value: formatPreset(voiceStyle),
      active: voiceStyle !== 'default',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Knowledge Docs',
      value: knowledgeActive ? 'Active' : 'Off',
      active: knowledgeActive,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Your Agent Knows</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-colors ${
              stat.active
                ? 'border-green-500/20 bg-green-500/[0.04]'
                : 'b-theme bg-hover'
            }`}
          >
            <span className={stat.active ? 'text-green-400' : 't3'}>{stat.icon}</span>
            <span className={`text-sm font-semibold ${stat.active ? 't1' : 't3'}`}>{stat.value}</span>
            <span className="text-[9px] t3 text-center leading-tight">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mt-3">
        <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
        <p className="text-[10px] t2 leading-relaxed">
          <span className="font-semibold text-blue-400/90">Always knows</span>
          {' '}&mdash; business facts and Q&A are available on every call.
        </p>
      </div>

      {/* Knowledge sources breakdown — only when pgvector has chunks */}
      {knowledgeEnabled && sources && sources.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[9px] font-semibold tracking-[0.1em] uppercase t3">Knowledge sources</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map(s => (
              <span key={s.source} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/[0.07] border border-purple-500/15 text-[9px] text-purple-300/90">
                <span className="w-1 h-1 rounded-full bg-green-400/80" title="Live — active in calls" />
                {knowledgeSourceLabel(s.source)}
                <span className="font-mono text-purple-400/70">{s.approved}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick-add inputs — Q&A or raw text paste (one at a time) */}
      {!adding && !pastingText && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border b-theme bg-transparent hover:bg-hover text-xs t3 hover:t2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Quick add Q&amp;A
          </button>
          {knowledgeEnabled && (
            <button
              onClick={() => setPastingText(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border b-theme bg-transparent hover:bg-hover text-xs t3 hover:t2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Paste text
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="Question your agent should know..."
            autoFocus
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Answer..."
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNewQa() }}
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveNewQa}
              disabled={saving || !newQ.trim() || !newA.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              {saving ? 'Saving…' : 'Add Q&A'}
            </button>
            <button
              onClick={cancelAdd}
              className="px-3 py-1.5 rounded-xl text-xs t3 hover:t2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pastingText && (
        <div className="mt-3">
          <KnowledgeTextInput
            clientId={id}
            isAdmin={isAdmin}
            compact
            onSuccess={() => setPastingText(false)}
          />
          {/* Cancel button for when KnowledgeTextInput is collapsed inside compact mode */}
        </div>
      )}

      {/* Knowledge reseed confirmation */}
      {knowledgeReseeded && (
        <p className="mt-2 text-[10px] text-blue-400/80">
          Knowledge base updated — new Q&amp;A is searchable on the next call.
        </p>
      )}

      {/* Website scrape hint — only when no website URL configured */}
      {!hasWebsite && !adding && !pastingText && (
        <a
          href={knowledgeRoutes.add('website')}
          className="mt-3 flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-amber-400/80 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-semibold text-amber-400/90">Teach your agent more</span>
          <span className="t3">— add your website in Knowledge →</span>
        </a>
      )}
    </div>
  )
}

function formatPreset(preset: string): string {
  return preset
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function knowledgeSourceLabel(source: string): string {
  switch (source) {
    case 'website_scrape': return 'Website'
    case 'settings_edit': return 'Settings'
    case 'knowledge_doc': return 'Documents'
    case 'dashboard_manual': return 'Dashboard'
    case 'manual': return 'Manual'
    case 'bulk_import': return 'Import'
    case 'gap_resolution': return 'Gap answers'
    case 'niche_template': return 'Template'
    default: return source.replace(/_/g, ' ')
  }
}
