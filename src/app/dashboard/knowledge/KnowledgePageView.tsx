'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import KnowledgeEngineCard from '@/components/dashboard/settings/KnowledgeEngineCard'
import AgentKnowledgeCard from '@/components/dashboard/settings/AgentKnowledgeCard'
import KnowledgeGaps from '@/components/dashboard/knowledge/KnowledgeGaps'
import AdminDropdown from '@/components/dashboard/AdminDropdown'

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
    <div className="space-y-6">
      {/* Summary card — what the agent currently knows */}
      <AgentKnowledgeCard client={client} />

      {/* Questions from calls the agent couldn't answer */}
      <KnowledgeGaps clientId={client.id} isAdmin={isAdmin} />

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
    <div className="p-3 sm:p-6 space-y-6 max-w-3xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <KnowledgeCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
