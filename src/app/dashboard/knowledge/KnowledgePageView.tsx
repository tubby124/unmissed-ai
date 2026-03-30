'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import AgentKnowledgeCard from '@/components/dashboard/settings/AgentKnowledgeCard'
import ChunkBrowser from '@/components/dashboard/knowledge/ChunkBrowser'
import KnowledgeSourceRegistry from '@/components/dashboard/knowledge/KnowledgeSourceRegistry'
import CallContextPreview from '@/components/dashboard/knowledge/CallContextPreview'
import { buildClientAgentConfig } from '@/lib/build-client-agent-config'
import KnowledgeGaps from '@/components/dashboard/knowledge/KnowledgeGaps'
import PendingSuggestions from '@/components/dashboard/knowledge/PendingSuggestions'
import KnowledgeCompiler from '@/components/dashboard/knowledge/KnowledgeCompiler'
import KnowledgeProvenanceCard from '@/components/dashboard/knowledge/KnowledgeProvenanceCard'
import PromptPreviewCard from '@/components/dashboard/knowledge/PromptPreviewCard'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import { useCallContext } from '@/contexts/CallContext'
import { toast } from 'sonner'
import {
  parseKnowledgeTab,
  parseAddSource,
  type KnowledgeTab,
  type AddSource,
} from '@/lib/dashboard-routes'

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function KnowledgeTabBar({
  activeTab,
  searchParams,
}: {
  activeTab: KnowledgeTab
  searchParams: ReturnType<typeof useSearchParams>
}) {
  const tabs: { id: KnowledgeTab; label: string }[] = [
    { id: 'browse', label: 'Browse' },
    { id: 'add', label: 'Add Knowledge' },
    { id: 'gaps', label: 'Questions & Gaps' },
  ]
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-hover)' }}>
      {tabs.map(({ id, label }) => {
        const p = new URLSearchParams(searchParams.toString())
        p.set('tab', id)
        p.delete('source')
        return (
          <Link
            key={id}
            href={`?${p.toString()}`}
            replace
            className="flex-1 py-2 text-center text-sm font-medium rounded-lg transition-colors"
            style={
              activeTab === id
                ? {
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-1)',
                    boxShadow: 'var(--shadow-sm)',
                  }
                : { color: 'var(--color-text-3)' }
            }
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Add-source sub-tabs ──────────────────────────────────────────────────────

function AddSourceTabBar({
  activeSource,
  searchParams,
}: {
  activeSource: AddSource
  searchParams: ReturnType<typeof useSearchParams>
}) {
  const sources: { id: AddSource; label: string }[] = [
    { id: 'website', label: 'Website' },
    { id: 'manual', label: 'Manual' },
    { id: 'text', label: 'AI Compiler' },
  ]
  return (
    <div className="flex gap-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
      {sources.map(({ id, label }) => {
        const p = new URLSearchParams(searchParams.toString())
        p.set('tab', 'add')
        p.set('source', id)
        const isActive = activeSource === id
        return (
          <Link
            key={id}
            href={`?${p.toString()}`}
            replace
            className="px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={
              isActive
                ? { color: 'var(--color-primary)', borderBottomColor: 'var(--color-primary)' }
                : { color: 'var(--color-text-3)', borderBottomColor: 'transparent' }
            }
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Browse tab ───────────────────────────────────────────────────────────────

function BrowseTab({ client, isAdmin }: { client: ClientConfig; isAdmin: boolean }) {
  const config = buildClientAgentConfig(client)
  return (
    <div className="space-y-3">
      {/* Source registry — where knowledge comes from */}
      <KnowledgeSourceRegistry clientId={client.id} />
      {/* Call-time context preview — what the agent sees on every call */}
      <CallContextPreview
        facts={Array.isArray(client.business_facts) ? client.business_facts.join('\n') : (client.business_facts ?? '')}
        qa={client.extra_qa ?? []}
        injectedNote={client.injected_note ?? ''}
        contextData={client.context_data ?? ''}
        contextDataLabel={client.context_data_label ?? ''}
        knowledgeEnabled={client.knowledge_backend === 'pgvector'}
        timezone={client.timezone ?? 'America/Regina'}
      />
      {/* Provenance — where the knowledge was imported from */}
      <KnowledgeProvenanceCard client={client} />
      {/* Agent script — read-only prompt preview */}
      <PromptPreviewCard systemPrompt={client.system_prompt} isAdmin={isAdmin} />
      {/* Summary — what the agent currently knows */}
      <AgentKnowledgeCard client={client} clientId={client.id} isAdmin={isAdmin} config={config} />
      {/* All knowledge chunks — visible to all users, actions gated inside */}
      <ChunkBrowser clientId={client.id} isAdmin={isAdmin} />
    </div>
  )
}

// ─── Add Knowledge tab ────────────────────────────────────────────────────────

function AddTab({
  client,
  isAdmin,
  previewMode,
  activeSource,
  searchParams,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  activeSource: AddSource
  searchParams: ReturnType<typeof useSearchParams>
}) {
  const knowledgeActive = client.knowledge_backend === 'pgvector'
  return (
    <div className="space-y-3">
      <AddSourceTabBar activeSource={activeSource} searchParams={searchParams} />

      {activeSource === 'website' && (
        <WebsiteKnowledgeCard client={client} isAdmin={isAdmin} previewMode={previewMode} />
      )}

      {activeSource === 'manual' && (
        <AdvancedContextCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialFacts={Array.isArray(client.business_facts) ? client.business_facts.join('\n') : (client.business_facts ?? '')}
          initialQA={client.extra_qa ?? []}
          initialContextData={client.context_data ?? ''}
          initialContextDataLabel={client.context_data_label ?? ''}
          prompt={client.system_prompt ?? ''}
          injectedNote={client.injected_note ?? ''}
          knowledgeEnabled={knowledgeActive}
          timezone={client.timezone ?? 'America/Regina'}
          previewMode={previewMode}
        />
      )}

      {activeSource === 'text' && (
        <KnowledgeCompiler clientId={client.id} isAdmin={isAdmin} />
      )}
    </div>
  )
}

// ─── Gaps tab ─────────────────────────────────────────────────────────────────

function GapsTab({ client, isAdmin }: { client: ClientConfig; isAdmin: boolean }) {
  return (
    <div className="space-y-3">
      <KnowledgeGaps clientId={client.id} isAdmin={isAdmin} />
      <PendingSuggestions clientId={client.id} />
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

export default function KnowledgePageView({
  clients,
  isAdmin,
  previewMode,
  initialClientId,
}: KnowledgePageViewProps) {
  const searchParams = useSearchParams()
  const activeTab = parseKnowledgeTab(searchParams.get('tab'))
  const activeSource = parseAddSource(searchParams.get('source'))

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
      {/* Header row */}
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
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.67-1.67a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {testCallLoading ? 'Connecting...' : callActive ? 'In Call' : 'Talk to Agent'}
        </button>
      </div>

      {/* Tab bar */}
      <KnowledgeTabBar activeTab={activeTab} searchParams={searchParams} />

      {/* Tab content — keyed on client.id so state resets on admin client switch */}
      {activeTab === 'browse' && (
        <BrowseTab key={client.id} client={client} isAdmin={isAdmin} />
      )}

      {activeTab === 'add' && (
        <AddTab
          key={client.id}
          client={client}
          isAdmin={isAdmin}
          previewMode={previewMode}
          activeSource={activeSource}
          searchParams={searchParams}
        />
      )}

      {activeTab === 'gaps' && (
        <GapsTab key={client.id} client={client} isAdmin={isAdmin} />
      )}
    </div>
  )
}
