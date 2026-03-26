'use client'

import { trackEvent } from '@/lib/analytics'

interface TrialExpiredHeroProps {
  clientId: string | null
  onUpgradeClick: (source: string, clientId: string | null) => void
}

export default function TrialExpiredHero({ clientId, onUpgradeClick }: TrialExpiredHeroProps) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, var(--color-surface) 100%)',
        border: '1px solid rgba(239,68,68,0.2)',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(239,68,68)' }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-base font-semibold t1 mb-1">Your free trial has ended</h2>
      <p className="text-sm t3 mb-4 leading-relaxed max-w-sm mx-auto">
        Get a real phone number and start taking calls from actual customers.
      </p>
      <button
        onClick={() => {
          trackEvent('expired_upgrade_clicked')
          onUpgradeClick('trial_expired_hero', clientId)
        }}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Get Your Phone Number
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
