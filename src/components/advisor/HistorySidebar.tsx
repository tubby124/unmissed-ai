'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  title: string | null
  is_archived: boolean
  model: string | null
  created_at: string
  updated_at: string
}

interface HistorySidebarProps {
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

type TimeGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older'

function groupConversations(conversations: Conversation[]): Record<TimeGroup, Conversation[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<TimeGroup, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  }

  for (const conv of conversations) {
    const created = new Date(conv.created_at)
    if (created >= today) {
      groups.Today.push(conv)
    } else if (created >= yesterday) {
      groups.Yesterday.push(conv)
    } else if (created >= weekAgo) {
      groups['This Week'].push(conv)
    } else {
      groups.Older.push(conv)
    }
  }

  return groups
}

function truncateTitle(title: string | null): string {
  if (!title) return 'Untitled conversation'
  return title.length > 40 ? title.slice(0, 40) + '...' : title
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const GROUP_ORDER: TimeGroup[] = ['Today', 'Yesterday', 'This Week', 'Older']

export default function HistorySidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: HistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  const fetchConversations = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/advisor/conversations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchArchived = useCallback(async () => {
    setArchivedLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/advisor/conversations?archived=true', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setArchivedConversations(data.conversations ?? [])
    } catch {
      // silent
    } finally {
      setArchivedLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (showArchived) {
      fetchArchived()
    }
  }, [showArchived, fetchArchived])

  const handleNewConversation = useCallback(() => {
    onNewConversation()
    fetchConversations()
  }, [onNewConversation, fetchConversations])

  const grouped = groupConversations(conversations)

  return (
    <div
      className="flex h-full w-64 flex-col border-r"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="p-3">
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-hover)]"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-1)',
          }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="h-5 w-5 animate-spin"
              style={{ color: 'var(--color-text-3)' }}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : conversations.length === 0 ? (
          <p
            className="py-8 text-center text-sm"
            style={{ color: 'var(--color-text-3)' }}
          >
            No conversations yet
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = grouped[group]
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-2">
                <p
                  className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  {group}
                </p>
                {items.map((conv) => {
                  const isActive = conv.id === activeConversationId
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => onSelectConversation(conv.id)}
                      className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-hover)] ${
                        isActive ? 'border-l-2 border-amber-500' : ''
                      }`}
                      style={{
                        backgroundColor: isActive ? 'var(--color-bg-raised)' : undefined,
                        color: 'var(--color-text-1)',
                      }}
                    >
                      <span className="truncate text-sm">
                        {truncateTitle(conv.title)}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {formatDate(conv.created_at)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}

        {showArchived && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <p
              className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-3)' }}
            >
              Archived
            </p>
            {archivedLoading ? (
              <div className="flex items-center justify-center py-4">
                <svg
                  className="h-4 w-4 animate-spin"
                  style={{ color: 'var(--color-text-3)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : archivedConversations.length === 0 ? (
              <p
                className="px-2 py-2 text-sm"
                style={{ color: 'var(--color-text-3)' }}
              >
                No archived conversations
              </p>
            ) : (
              archivedConversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left opacity-60 transition-colors hover:bg-[var(--color-hover)] hover:opacity-80"
                  style={{ color: 'var(--color-text-2)' }}
                >
                  <span className="truncate text-sm">
                    {truncateTitle(conv.title)}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    {formatDate(conv.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div
        className="border-t p-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => setShowArchived((prev) => !prev)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-3)' }}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>
    </div>
  )
}
