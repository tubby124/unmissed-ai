'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import FileUploadPanel from '@/components/dashboard/knowledge/FileUploadPanel'
import DocumentList from '@/components/dashboard/knowledge/DocumentList'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import { useCallContext } from '@/contexts/CallContext'
import { toast } from 'sonner'

// ── Conflict types ─────────────────────────────────────────────────────────────
interface ConflictEntry {
  run_id: string
  content: string
  review_reason: string
  created_at: string
}

// ── Conflict modal ─────────────────────────────────────────────────────────────
function ConflictModal({
  conflicts,
  onDismiss,
  onClose,
}: {
  conflicts: ConflictEntry[]
  onDismiss: (runIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismissAll() {
    setDismissing(true)
    const runIds = Array.from(new Set(conflicts.map(c => c.run_id)))
    await onDismiss(runIds)
    setDismissing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-2xl border p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold t1">Knowledge Conflicts</p>
            <p className="text-[11px] t3 mt-0.5">
              These items were flagged as potentially contradicting other knowledge. Review and update your facts as needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg t3 hover:t2 transition-colors"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border p-3 space-y-1"
              style={{ borderColor: 'rgba(251,146,60,0.3)', backgroundColor: 'rgba(251,146,60,0.05)' }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
                  style={{ backgroundColor: 'rgba(251,146,60,0.1)', color: 'rgb(251,146,60)', borderColor: 'rgba(251,146,60,0.2)' }}
                >
                  Conflict
                </span>
                <span className="text-[10px] t3">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[11px] t2 leading-relaxed">{c.content}</p>
              {c.review_reason && (
                <p className="text-[10px] t3 italic">{c.review_reason}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDismissAll}
            disabled={dismissing}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {dismissing ? 'Dismissing…' : 'Dismiss all'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Most Asked Topics card ──────────────────────────────────────────────────
interface TopQuery { query: string; count: number }

function TopQueriesCard({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const [queries, setQueries] = useState<TopQuery[]>([])
  const [loaded, setLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoaded(false)

    const url = isAdmin
      ? `/api/dashboard/knowledge/top-queries?client_id=${clientId}`
      : '/api/dashboard/knowledge/top-queries'

    fetch(url, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!ctrl.signal.aborted && Array.isArray(data?.queries)) {
          setQueries(data.queries as TopQuery[])
        }
        setLoaded(true)
      })
      .catch(() => { setLoaded(true) })

    return () => ctrl.abort()
  }, [clientId, isAdmin])

  if (!loaded || queries.length === 0) return null

  return (
    <div className="card-surface rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        {/* Search icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="t3 shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Callers Have Searched For</p>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}
        >
          {queries.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {queries.map((q, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <span className="text-[11px] t2 leading-snug flex-1 min-w-0 truncate" title={q.query}>
              {q.query}
            </span>
            <span
              className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}
            >
              {q.count}×
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] t3">Based on the last 90 days of calls</p>
    </div>
  )
}

type ActivePanel = 'website' | 'compiler' | 'search' | 'upload' | null

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
  const [uploadRefresh, setUploadRefresh] = useState(0)
  const [testCallLoading, setTestCallLoading] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const { startCall, endCall, setMeta, callState } = useCallContext()

  useEffect(() => {
    if (initialClientId && clients.find(c => c.id === initialClientId)) {
      setSelectedId(initialClientId)
    }
  }, [initialClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find(c => c.id === selectedId) ?? clients[0]

  const fetchConflicts = useCallback((cid: string) => {
    const url = isAdmin ? `/api/dashboard/knowledge/conflicts?client_id=${cid}` : '/api/dashboard/knowledge/conflicts'
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.conflicts) setConflicts(data.conflicts as ConflictEntry[])
      })
      .catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    if (client?.id) fetchConflicts(client.id)
  }, [client?.id, fetchConflicts])

  async function handleDismissConflicts(runIds: string[]) {
    const url = isAdmin && client?.id
      ? `/api/dashboard/knowledge/conflicts?client_id=${client.id}`
      : '/api/dashboard/knowledge/conflicts'
    try {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_ids: runIds }),
      })
      setConflicts([])
      setConflictModalOpen(false)
    } catch {
      toast.error('Failed to dismiss conflicts')
    }
  }

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
      id: 'upload',
      label: 'Upload document',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
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
      {/* ── Conflict banner ──────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <button
          onClick={() => setConflictModalOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors hover:opacity-90"
          style={{
            borderColor: 'rgba(251,146,60,0.4)',
            backgroundColor: 'rgba(251,146,60,0.08)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(251,146,60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-xs font-medium" style={{ color: 'rgb(251,146,60)' }}>
            {conflicts.length} potential conflict{conflicts.length !== 1 ? 's' : ''} found in your knowledge — review before approving
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(251,146,60)" strokeWidth="2.5" strokeLinecap="round" className="ml-auto shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const url = isAdmin && client?.id
                ? `/api/dashboard/knowledge/export?format=csv&client_id=${client.id}`
                : '/api/dashboard/knowledge/export?format=csv'
              window.open(url, '_blank')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
            title="Download approved knowledge as CSV"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          {callActive ? (
            <button
              onClick={endCall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.67-1.67a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {testCallLoading ? 'Connecting...' : 'Talk to Agent'}
            </button>
          )}
        </div>
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
      {activePanel === 'upload' && (
        <div className="card-surface rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold t1">Upload a document</p>
            <p className="text-[11px] t3 mt-0.5">Add PDFs or Word docs — your agent learns from them automatically</p>
          </div>
          <FileUploadPanel
            key={client.id}
            clientId={client.id}
            previewMode={previewMode}
            onChunkAdded={() => setUploadRefresh(n => n + 1)}
          />
          <DocumentList key={`dl-${client.id}`} clientId={client.id} refreshTrigger={uploadRefresh} />
        </div>
      )}
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
          <KnowledgeSourceRegistry key={`ksr-${client.id}`} clientId={client.id} websiteUrl={client.website_url ?? undefined} />
        </div>
      </div>

      {/* ── Most Asked Topics ────────────────────────────────────────────── */}
      <TopQueriesCard key={`tq-${client.id}`} clientId={client.id} isAdmin={isAdmin} />

      {/* ── Conflict modal ──────────────────────────────────────────────── */}
      {conflictModalOpen && conflicts.length > 0 && (
        <ConflictModal
          conflicts={conflicts}
          onDismiss={handleDismissConflicts}
          onClose={() => setConflictModalOpen(false)}
        />
      )}
    </div>
  )
}
