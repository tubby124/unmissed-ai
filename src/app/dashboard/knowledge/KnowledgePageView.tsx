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
import { useCallContext } from '@/contexts/CallContext'
import { toast } from 'sonner'

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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* ── Needs Attention ──────────────────────────────────────────────────── */}

      {/* Questions from calls the agent couldn't answer */}
      <div className="sm:col-span-2">
        <KnowledgeGaps clientId={client.id} isAdmin={isAdmin} />
      </div>

      {/* Knowledge chunks waiting for review */}
      <div className="sm:col-span-2">
        <PendingSuggestions clientId={client.id} />
      </div>

      {/* ── Current knowledge ────────────────────────────────────────────────── */}

      {/* Summary card — what the agent currently knows */}
      <AgentKnowledgeCard client={client} clientId={client.id} isAdmin={isAdmin} config={config} />

      {/* Website knowledge — sits beside AgentKnowledgeCard */}
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
        <WebsiteKnowledgeCard
          client={client}
          isAdmin={isAdmin}
          previewMode={previewMode}
        />
      </PlanGate>

      {/* ── Add knowledge ────────────────────────────────────────────────────── */}

      {/* Business facts & FAQs */}
      <div className="sm:col-span-2">
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
      </div>

      {/* ── Test & manage ────────────────────────────────────────────────────── */}

      {/* Knowledge engine (pgvector) — includes Test Query and chunk library */}
      <div className="sm:col-span-2">
        <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
          <KnowledgeEngineCard
            client={client}
            isAdmin={isAdmin}
            previewMode={previewMode}
            onClientUpdate={() => {}}
          />
        </PlanGate>
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
  const [testCallLoading, setTestCallLoading] = useState(false)
  const { startCall, setMeta, callState } = useCallContext()

  useEffect(() => {
    if (initialClientId && clients.find(c => c.id === initialClientId)) {
      setSelectedId(initialClientId)
    }
  }, [initialClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  async function handleTestCall() {
    setTestCallLoading(true)
    try {
      const res = await fetch('/api/dashboard/agent-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAdmin ? { client_id: client.id } : {}),
      })
      if (!res.ok) {
        toast.error('Failed to start test call')
        return
      }
      const data = await res.json()
      if (!data.joinUrl) {
        toast.error('No agent configured for this client')
        return
      }
      setMeta({
        agentName: client.agent_name ?? client.business_name ?? 'Agent',
        businessName: client.business_name ?? '',
        sourceRoute: '/dashboard/knowledge',
      })
      await startCall(data.joinUrl)
    } catch {
      toast.error('Failed to connect to agent')
    } finally {
      setTestCallLoading(false)
    }
  }

  const callActive = callState === 'active' || callState === 'connecting'

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        {isAdmin && clients.length > 1 ? (
          <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <div />
        )}
        <button
          onClick={handleTestCall}
          disabled={testCallLoading || callActive || previewMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.67-1.67a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          {testCallLoading ? 'Connecting...' : callActive ? 'In Call' : 'Talk to Agent'}
        </button>
      </div>

      <KnowledgeCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
