'use client'

import { useState, useCallback } from 'react'
import ChunkBrowser from './knowledge/ChunkBrowser'
import PendingSuggestions from './knowledge/PendingSuggestions'
import KnowledgeGaps from './knowledge/KnowledgeGaps'
import KnowledgeTestSearch from './knowledge/KnowledgeTestSearch'
import ManualAddForm from './knowledge/ManualAddForm'

interface KnowledgeBaseTabProps {
  clientId: string
  clientSlug: string
  isAdmin: boolean
  previewMode?: boolean
  knowledgeEnabled: boolean
  onToggleEnabled?: (enabled: boolean) => Promise<void>
  websiteUrl?: string
  onGapCountChange?: (count: number) => void
}

export default function KnowledgeBaseTab({
  clientId,
  clientSlug: _clientSlug,
  isAdmin,
  previewMode,
  knowledgeEnabled,
  onToggleEnabled,
  websiteUrl: initialWebsiteUrl,
  onGapCountChange,
}: KnowledgeBaseTabProps) {
  const [togglingEnabled, setTogglingEnabled] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  async function handleToggleEnabled() {
    if (!onToggleEnabled) return
    setTogglingEnabled(true)
    await onToggleEnabled(!knowledgeEnabled)
    setTogglingEnabled(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold t1">Knowledge Base</h3>
          <p className="text-xs t3 mt-1">
            Your agent searches this knowledge base to answer detailed questions during calls.
          </p>
        </div>
        {isAdmin && onToggleEnabled && (
          <button
            onClick={handleToggleEnabled}
            disabled={togglingEnabled || previewMode}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              knowledgeEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                : 'bg-hover t3 border b-theme hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20'
            } disabled:opacity-40`}
          >
            {togglingEnabled ? '...' : knowledgeEnabled ? 'Enabled' : 'Enable'}
          </button>
        )}
      </div>

      {/* Disabled state */}
      {!knowledgeEnabled && (
        <div className="rounded-xl border b-theme bg-hover p-6 text-center space-y-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto t3">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p className="text-sm font-medium t2">Knowledge base not enabled</p>
            <p className="text-xs t3 mt-1">Enable the knowledge base to let your agent answer detailed questions from embedded knowledge chunks.</p>
          </div>
          {isAdmin && onToggleEnabled && (
            <button
              onClick={handleToggleEnabled}
              disabled={togglingEnabled || previewMode}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
            >
              {togglingEnabled ? 'Enabling...' : 'Enable Knowledge Base'}
            </button>
          )}
        </div>
      )}

      {/* Only show when enabled */}
      {knowledgeEnabled && (
        <>
          <ManualAddForm
            clientId={clientId}
            isAdmin={isAdmin}
            previewMode={previewMode}
            websiteUrl={initialWebsiteUrl}
            onChunkAdded={triggerRefresh}
          />

          <KnowledgeTestSearch
            clientId={clientId}
            isAdmin={isAdmin}
            previewMode={previewMode}
          />

          <KnowledgeGaps
            clientId={clientId}
            isAdmin={isAdmin}
            onAnswered={triggerRefresh}
            onGapCountChange={onGapCountChange}
            key={`gaps-${refreshKey}`}
          />

          <PendingSuggestions clientId={clientId} key={`pending-${refreshKey}`} />
          <ChunkBrowser clientId={clientId} isAdmin={isAdmin} key={`browser-${refreshKey}`} />
        </>
      )}
    </div>
  )
}
