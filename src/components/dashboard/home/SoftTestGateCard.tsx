'use client'

/**
 * D143 — Soft test gate nudge
 * Shown when the owner has made zero test calls.
 * Disappears automatically once testCallCount > 0.
 * Clicking "Start test call" scrolls to the existing TestCallCard rather
 * than duplicating the WebRTC call flow.
 */

interface Props {
  onScrollToTestCall: () => void
}

export default function SoftTestGateCard({ onScrollToTestCall }: Props) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
          <path d="M3 18v-6a9 9 0 0118 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold t1">Hear your agent before going live</p>
        <p className="text-[11px] t3 leading-snug">Make a quick test call to hear exactly how your agent sounds to customers.</p>
      </div>
      <button
        onClick={onScrollToTestCall}
        className="shrink-0 text-[12px] font-semibold hover:opacity-75 transition-opacity"
        style={{ color: 'var(--color-primary)' }}
      >
        Start test call →
      </button>
    </div>
  )
}
