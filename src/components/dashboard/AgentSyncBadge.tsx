'use client'

import Link from 'next/link'

/**
 * AgentSyncBadge — Shows the last Ultravox agent sync status.
 *
 * Reads from the home API's `agentSync` field (G0.5 sync instrumentation).
 * Built in Phase A (G4) — dashboard placement deferred to Phase D.
 */

interface AgentSyncBadgeProps {
  lastSyncAt: string | null
  lastSyncStatus: string | null
}

export function AgentSyncBadge({ lastSyncAt, lastSyncStatus }: AgentSyncBadgeProps) {
  if (!lastSyncStatus) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Never synced
      </span>
    )
  }

  const isSuccess = lastSyncStatus === 'success'
  const isError = lastSyncStatus === 'error'

  const timeAgo = lastSyncAt ? formatTimeAgo(lastSyncAt) : null

  const badgeContent = (
    <>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isSuccess ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-zinc-400'
        }`}
      />
      {isSuccess ? 'Synced' : isError ? 'Sync failed' : lastSyncStatus}
      {timeAgo && <span className="text-[10px] opacity-70">{timeAgo}</span>}
    </>
  )

  const className = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
    isSuccess
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : isError
        ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer transition-colors'
        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
  }`

  if (isError) {
    return (
      <Link
        href="/dashboard/settings?tab=general"
        className={className}
        title={lastSyncAt ? `Last sync: ${new Date(lastSyncAt).toLocaleString()} — Click to open settings` : 'Click to open settings'}
      >
        {badgeContent}
      </Link>
    )
  }

  return (
    <span
      className={className}
      title={lastSyncAt ? `Last sync: ${new Date(lastSyncAt).toLocaleString()}` : undefined}
    >
      {badgeContent}
    </span>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
