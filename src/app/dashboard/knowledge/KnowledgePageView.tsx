'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import KnowledgeEngineCard from '@/components/dashboard/settings/KnowledgeEngineCard'
import AgentKnowledgeCard from '@/components/dashboard/settings/AgentKnowledgeCard'

// ─── Inner card group — keyed on client.id so state resets on client switch ──

function KnowledgeCards({
  client,
  isAdmin,
  previewMode,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}) {
  const knowledgeActive = client.knowledge_backend === 'pgvector'
  const factCount = client.business_facts?.split('\n').filter(l => l.trim()).length ?? 0
  const faqCount = client.extra_qa?.filter(p => p.q?.trim() && p.a?.trim()).length ?? 0
  const websiteSet = !!client.website_url

  return (
    <div className="space-y-4">
      {/* Summary card — what the agent currently knows */}
      <AgentKnowledgeCard client={client} />

      {/* Business facts & FAQs */}
      <AdvancedContextCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialFacts={client.business_facts ?? ''}
        initialQA={client.extra_qa ?? []}
        initialContextData={client.context_data ?? ''}
        initialContextDataLabel={client.context_data_label ?? ''}
        prompt={client.system_prompt ?? ''}
        injectedNote={client.injected_note ?? ''}
        knowledgeEnabled={knowledgeActive}
        timezone={client.timezone ?? 'America/Regina'}
        previewMode={previewMode}
      />

      {/* Website knowledge */}
      <WebsiteKnowledgeCard
        client={client}
        isAdmin={isAdmin}
        previewMode={previewMode}
      />

      {/* Knowledge engine (pgvector) */}
      <KnowledgeEngineCard
        client={client}
        isAdmin={isAdmin}
        previewMode={previewMode}
        onClientUpdate={() => {}}
      />

      {/* Behavior summary */}
      <div className="rounded-2xl border b-theme bg-surface px-5 py-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">What your agent knows</p>
        <p className="text-xs t2 leading-relaxed">
          {factCount > 0 ? (
            <><span className="font-medium t1">{factCount} business fact{factCount !== 1 ? 's' : ''}</span> loaded. </>
          ) : 'No business facts added yet. '}
          {faqCount > 0 ? (
            <><span className="font-medium t1">{faqCount} FAQ{faqCount !== 1 ? 's' : ''}</span> configured. </>
          ) : null}
          Knowledge base:{' '}
          <span className="font-medium t1">
            {knowledgeActive ? 'pgvector search active' : 'standard only'}
          </span>.
          {websiteSet ? (
            <> Website: <span className="font-medium t1">connected</span>.</>
          ) : <> Website: <span className="font-medium t1">not connected</span>.</>}
        </p>
      </div>
    </div>
  )
}

// ─── Admin client dropdown ────────────────────────────────────────────────────

function AdminDropdown({
  clients,
  selectedId,
  onSelect,
}: {
  clients: ClientConfig[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selected = clients.find(c => c.id === selectedId) ?? clients[0]
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border b-theme bg-surface hover:bg-hover transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium t1 truncate">{selected?.business_name}</span>
          {selected?.niche && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-hover t3 shrink-0">{selected.niche}</span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className={`t3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl border b-theme bg-surface shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-hover transition-colors ${c.id === selectedId ? 'bg-hover' : ''}`}
            >
              <span className="text-sm t1 truncate flex-1">{c.business_name}</span>
              {c.niche && <span className="text-[11px] t3 shrink-0">{c.niche}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface KnowledgePageViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  previewMode?: boolean
  initialClientId?: string
}

export default function KnowledgePageView({ clients, isAdmin, previewMode, initialClientId }: KnowledgePageViewProps) {
  const [selectedId, setSelectedId] = useState(
    initialClientId && clients.find(c => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? ''
  )

  useEffect(() => {
    if (initialClientId && clients.find(c => c.id === initialClientId)) {
      setSelectedId(initialClientId)
    }
  }, [initialClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <KnowledgeCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
