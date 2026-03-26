'use client'

/**
 * NotificationsSheet — Telegram + email notification settings.
 * Shows connection status and links to full notification settings.
 */

interface Props {
  clientId: string
  isAdmin: boolean
  telegramConnected: boolean
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function NotificationsSheet({ telegramConnected, onSave: _onSave }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-xs t3 leading-relaxed">
        Get notified after every call so you never miss a hot lead.
      </p>

      {/* Telegram */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,136,204,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-sky-400">
              <path d="M21 3L3 10.5l7 1.5 2 5 3-3 5 3L21 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold t1">Telegram Alerts</p>
            <p className="text-[11px] t3">Instant call summaries with lead score</p>
          </div>
          {telegramConnected ? (
            <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Connected</span>
          ) : (
            <span className="text-[10px] font-semibold t3 px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--color-hover)' }}>Not set up</span>
          )}
        </div>
        {!telegramConnected && (
          <a
            href="/dashboard/settings?tab=notifications"
            className="block w-full py-2 rounded-lg text-center text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgba(0,136,204,0.8)' }}
          >
            Connect Telegram →
          </a>
        )}
      </div>

      {/* Email */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.15 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/>
            <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold t1">Email Alerts</p>
          <p className="text-[11px] t3">Daily summaries in your inbox</p>
        </div>
        <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Active</span>
      </div>

      <a
        href="/dashboard/settings?tab=notifications"
        className="block text-center text-xs font-semibold"
        style={{ color: 'var(--color-text-3)' }}
      >
        All notification settings →
      </a>
    </div>
  )
}
