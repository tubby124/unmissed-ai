'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import KnowledgeCompiler from '@/components/dashboard/knowledge/KnowledgeCompiler'
import ChunkBrowser from '@/components/dashboard/knowledge/ChunkBrowser'
import KnowledgeSourceRegistry from '@/components/dashboard/knowledge/KnowledgeSourceRegistry'
import KnowledgeGaps from '@/components/dashboard/knowledge/KnowledgeGaps'
import PendingSuggestions from '@/components/dashboard/knowledge/PendingSuggestions'
import KnowledgeTextInput from '@/components/dashboard/knowledge/KnowledgeTextInput'
import InlineFactsEditor from '@/components/dashboard/knowledge/InlineFactsEditor'
import InlineFaqEditor from '@/components/dashboard/knowledge/InlineFaqEditor'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import { useCallContext } from '@/contexts/CallContext'
import { toast } from 'sonner'

type ActivePanel = 'website' | 'compiler' | 'search' | null

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
  const [selectedId, setSelectedId] = useState(
    initialClientId && clients.find(c => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? ''
  )
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [testCallLoading, setTestCallLoading] = useState(false)
  const { startCall, endCall, setMeta, callState } = useCallContext()

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

  function togglePanel(panel: ActivePanel) {
    setActivePanel(prev => prev === panel ? null : panel)
  }

  const callActive = callState === 'active' || callState === 'connecting'

  const facts: string[] = Array.isArray(client.business_facts)
    ? (client.business_facts as string[]).filter(Boolean)
    : (client.business_facts ? (client.business_facts as string).split('\n').filter(Boolean) : [])
  const qa: Array<{ q: string; a: string }> = client.extra_qa ?? []

  const actions: { id: ActivePanel; label: string; icon: React.ReactNode }[] = [
    {
      id: 'website',
      label: 'Scrape website',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'compiler',
      label: 'AI Compiler',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Test search',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6 max-w-5xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {isAdmin && clients.length > 1 ? (
          <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <div>
            <h1 className="text-base font-semibold t1">Knowledge</h1>
            <p className="text-[11px] t3 mt-0.5">What your agent knows and how it answers</p>
          </div>
        )}
        {callActive ? (
          <button
            onClick={endCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0"
            style={{ backgroundColor: '#DC2626', color: '#fff' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            End Call
          </button>
        ) : (
          <button
            onClick={handleTestCall}
            disabled={testCallLoading || previewMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.67-1.67a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {testCallLoading ? 'Connecting...' : 'Talk to Agent'}
          </button>
        )}
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {actions.map(action => {
          const isActive = activePanel === action.id
          return (
            <button
              key={action.id as string}
              onClick={() => togglePanel(action.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-2)',
                backgroundColor: isActive ? 'var(--color-accent-tint)' : 'transparent',
              }}
            >
              {action.icon}
              {action.label}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ transform: isActive ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* ── Expandable panels ───────────────────────────────────────────── */}
      {activePanel === 'website' && (
        <WebsiteKnowledgeCard key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
      )}
      {activePanel === 'compiler' && (
        <KnowledgeCompiler key={client.id} clientId={client.id} isAdmin={isAdmin} />
      )}
      {activePanel === 'search' && (
        <ChunkBrowser key={client.id} clientId={client.id} isAdmin={isAdmin} />
      )}

      {/* ── 2-col: What your agent knows | FAQs ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Business facts — inline editable */}
        <div className="card-surface rounded-2xl p-5 space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Your Agent Knows</p>
          <InlineFactsEditor key={client.id} facts={facts} clientId={client.id} />
        </div>

        {/* FAQs — inline editable */}
        <div className="card-surface rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">FAQs</p>
            {qa.length > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}
              >
                {qa.length}
              </span>
            )}
          </div>
          <InlineFaqEditor key={client.id} qa={qa} clientId={client.id} />
        </div>
      </div>

      {/* ── Full-width: Unanswered questions ────────────────────────────── */}
      <KnowledgeGaps key={`gaps-${client.id}`} clientId={client.id} isAdmin={isAdmin} />

      {/* ── 2-col: Auto-suggested FAQs | Teach more + Knowledge base ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PendingSuggestions key={`ps-${client.id}`} clientId={client.id} />

        <div className="space-y-3">
          {/* Teach more */}
          <div className="card-surface rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Teach More</p>
            <KnowledgeTextInput clientId={client.id} isAdmin={isAdmin} compact />
          </div>

          {/* Knowledge sources */}
          <KnowledgeSourceRegistry key={`ksr-${client.id}`} clientId={client.id} />
        </div>
      </div>
    </div>
  )
}
