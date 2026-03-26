'use client'

/**
 * ActivationTile — AC-3
 *
 * Diagnostic-only tile showing paid activation readiness.
 * DOES NOT provision Twilio numbers — links to /dashboard/setup for that.
 * ForwardingSheet is opened for forwarding_needed (config-edit only).
 */

import Link from 'next/link'
import { type ActivationState } from '@/lib/derive-activation-state'

interface ActivationTileProps {
  state: ActivationState
  onOpenForwardingSheet: () => void
  onRefreshClick: () => void
}

const STEPS = [
  { key: 'phone', label: 'Phone number' },
  { key: 'forwarding', label: 'Forwarding number' },
  { key: 'live', label: 'Live on calls' },
]

export default function ActivationTile({
  state,
  onOpenForwardingSheet,
  onRefreshClick,
}: ActivationTileProps) {
  const phoneReady = state !== 'awaiting_number'
  const forwardingReady = state === 'ready'
  const allReady = state === 'ready'

  return (
    <div
      className="rounded-2xl p-5 card-surface"
      style={{ border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-warning-tint)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-warning)' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold t1">Activation required</p>
          <p className="text-xs t3">Complete these steps to go live</p>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2.5 mb-4">
        {/* Step 1 — Phone number */}
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${phoneReady ? 'bg-green-500' : 'bg-amber-500'}`}>
            {phoneReady ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span className="text-[9px] font-bold text-white">1</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium t1">Phone number</p>
            {!phoneReady && (
              <p className="text-[11px] t3">Your dedicated number is being assigned</p>
            )}
          </div>
          {!phoneReady && (
            <button
              onClick={onRefreshClick}
              className="text-[11px] font-medium t3 hover:opacity-75 transition-opacity shrink-0"
            >
              Refresh status
            </button>
          )}
        </div>

        {/* Step 2 — Forwarding number */}
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${forwardingReady ? 'bg-green-500' : phoneReady ? 'bg-amber-500' : 'bg-zinc-600'}`}>
            {forwardingReady ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span className="text-[9px] font-bold text-white">2</span>
            )}
          </div>
          <div className="flex-1">
            <p className={`text-xs font-medium ${phoneReady ? 't1' : 't3'}`}>Forwarding number</p>
            {phoneReady && !forwardingReady && (
              <p className="text-[11px] t3">Where to send calls when your agent needs help</p>
            )}
          </div>
          {phoneReady && !forwardingReady && (
            <button
              onClick={onOpenForwardingSheet}
              className="text-[11px] font-semibold shrink-0 transition-opacity hover:opacity-75"
              style={{ color: 'var(--color-primary)' }}
            >
              Set now →
            </button>
          )}
        </div>

        {/* Step 3 — Live */}
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${allReady ? 'bg-green-500' : 'bg-zinc-600'}`}>
            {allReady ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span className="text-[9px] font-bold text-white">3</span>
            )}
          </div>
          <p className={`text-xs font-medium ${allReady ? 't1' : 't3'}`}>Live on calls</p>
        </div>
      </div>

      {/* Primary CTA */}
      {state === 'awaiting_number' && (
        <Link
          href="/dashboard/setup"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Complete setup
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      )}
    </div>
  )
}
