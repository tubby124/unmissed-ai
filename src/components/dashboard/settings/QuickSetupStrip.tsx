'use client'

/**
 * D87 — Quick Setup Strip
 * Pinned at the top of settings (non-admin only).
 * Shows 4 setup priorities with completion dots + scroll-to-section.
 * Pure visual — no data writes.
 */

import type { ClientConfig } from '@/app/dashboard/settings/page'

interface QuickSetupItem {
  key: string
  label: string
  done: boolean
  scrollTarget: string
  icon: React.ReactNode
}

interface QuickSetupStripProps {
  client: ClientConfig
  onScrollTo: (section: string) => void
}

function buildItems(client: ClientConfig): QuickSetupItem[] {
  const hasVoice = !!(client.agent_voice_id)
  const hasNotifications = !!(client.telegram_notifications_enabled || client.email_notifications_enabled)
  const hasHours = !!(client.business_hours_weekday)
  const hasKnowledge = !!(
    (client.knowledge_backend === 'pgvector' && (client.approved_knowledge_chunk_count ?? 0) > 0) ||
    client.website_scrape_status === 'approved'
  )

  return [
    {
      key: 'voice',
      label: 'Voice',
      done: hasVoice,
      scrollTarget: 'voice-style',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      label: 'Alerts',
      done: hasNotifications,
      scrollTarget: 'notifications',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      key: 'hours',
      label: 'Hours',
      done: hasHours,
      scrollTarget: 'hours',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      done: hasKnowledge,
      scrollTarget: 'knowledge',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
    },
  ]
}

export default function QuickSetupStrip({ client, onScrollTo }: QuickSetupStripProps) {
  const items = buildItems(client)
  const doneCount = items.filter(i => i.done).length
  const allDone = doneCount === items.length

  if (allDone) return null // Hide once fully set up

  return (
    <div className="rounded-2xl border b-theme bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Quick Setup</p>
        <span className="text-[10px] t3 font-mono">{doneCount}/{items.length} done</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-hover mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(doneCount / items.length) * 100}%`,
            backgroundColor: 'var(--color-primary)',
            opacity: 0.7,
          }}
        />
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-4 gap-2">
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => onScrollTo(item.scrollTarget)}
            className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all hover:scale-[1.02] ${
              item.done
                ? 'border-green-500/20 bg-green-500/[0.04]'
                : 'b-theme bg-hover hover:bg-surface'
            }`}
          >
            {/* Completion dot */}
            <div className="relative">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full ${
                item.done ? 'bg-green-500/15' : 'bg-hover border b-theme'
              }`}>
                {item.done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className={item.done ? 'text-green-400' : 't3'}>{item.icon}</span>
                )}
              </span>
            </div>

            <span className={`text-[9px] font-medium text-center leading-tight ${item.done ? 'text-green-400/80' : 't3'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
