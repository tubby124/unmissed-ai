'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import KnowledgeEngineCard from '@/components/dashboard/settings/KnowledgeEngineCard'
import AgentKnowledgeCard from '@/components/dashboard/settings/AgentKnowledgeCard'
import { buildClientAgentConfig } from '@/lib/build-client-agent-config'
import KnowledgeGaps from '@/components/dashboard/knowledge/KnowledgeGaps'
import PendingSuggestions from '@/components/dashboard/knowledge/PendingSuggestions'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import PlanGate from '@/components/dashboard/PlanGate'

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
  const config = buildClientAgentConfig(client)

  return (
    <div className="space-y-6">
      {/* ── Needs Attention ──────────────────────────────────────────────────── */}

      {/* Questions from calls the agent couldn't answer */}
      <KnowledgeGaps clientId={client.id} isAdmin={isAdmin} />

      {/* Knowledge chunks waiting for review */}
      <PendingSuggestions clientId={client.id} />

      {/* ── Current knowledge ────────────────────────────────────────────────── */}

      {/* Summary card — what the agent currently knows */}
      <AgentKnowledgeCard client={client} clientId={client.id} isAdmin={isAdmin} config={config} />

      {/* ── Test & manage ────────────────────────────────────────────────────── */}

      {/* Knowledge engine (pgvector) — includes Test Query and chunk library */}
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
        <KnowledgeEngineCard
          client={client}
          isAdmin={isAdmin}
          previewMode={previewMode}
          onClientUpdate={() => {}}
        />
      </PlanGate>

      {/* ── Add knowledge ────────────────────────────────────────────────────── */}

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
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
        <WebsiteKnowledgeCard
          client={client}
          isAdmin={isAdmin}
          previewMode={previewMode}
        />
      </PlanGate>
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
