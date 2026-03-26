'use client'

/**
 * NotificationsTile — compact notification channel summary.
 * Shows Telegram connection status and email notification status.
 * CTA opens NotificationsSheet.
 */

interface Props {
  telegramConnected: boolean
  agentName: string
  onOpenSheet: () => void
}

export default function NotificationsTile({ telegramConnected, agentName, onOpenSheet }: Props) {
  return (
    <button
      onClick={onOpenSheet}
      className="rounded-2xl p-4 card-surface flex flex-col gap-3 text-left w-full hover:bg-hover transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Notifications</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 opacity-0 group-hover:opacity-100 transition-opacity">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Channel status */}
      <div className="space-y-2">
        {/* Telegram */}
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={telegramConnected ? 'text-sky-400' : 't3'}>
            <path d="M21 3L3 10.5l7 1.5 2 5 3-3 5 3L21 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs t2 flex-1">Telegram alerts</span>
          {telegramConnected ? (
            <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">Connected</span>
          ) : (
            <span className="text-[10px] font-semibold t3 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-hover)' }}>Not set up</span>
          )}
        </div>

        {/* Email — always enabled */}
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/>
            <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-xs t2 flex-1">Email alerts</span>
          <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">On</span>
        </div>
      </div>

      {/* Nudge if Telegram not connected */}
      {!telegramConnected && (
        <p className="text-[11px] t3 leading-relaxed">
          Connect Telegram to get instant call alerts for <span className="t2">{agentName}</span>.
        </p>
      )}
    </button>
  )
}
