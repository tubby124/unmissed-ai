'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AGENT_MODES, type AgentMode } from '@/lib/capabilities'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  subscriptionStatus: string | null
  selectedPlan: string | null
  currentMode: string | null
  hasBooking: boolean
  onRetest?: () => void
}

function ModeIcon({ mode }: { mode: AgentMode }) {
  if (mode === 'message_only') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.72a19.79 19.79 0 01-3.07-8.67A2 2 0 012.42 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.73 6.73l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
    )
  }
  if (mode === 'triage') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6"/>
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M9 16l2 2 4-4"/>
    </svg>
  )
}

export default function TrialModeSwitcher({
  clientId,
  subscriptionStatus,
  selectedPlan,
  currentMode,
  hasBooking,
  onRetest,
}: Props) {
  const [localMode, setLocalMode] = useState<AgentMode>(
    (currentMode as AgentMode | null) ?? 'triage',
  )
  const { saving, saved, error, syncStatus, patch } = usePatchSettings(clientId, false)

  // Trial and null plans get full access — same gate as CallHandlingModeCard
  const isTrial = subscriptionStatus === 'trialing' || !subscriptionStatus
  const canSelectFullService = selectedPlan === 'pro' || isTrial

  async function selectMode(newMode: AgentMode) {
    if (newMode === localMode || saving) return
    if (newMode === 'full_service' && !canSelectFullService) return

    const prev = localMode
    setLocalMode(newMode)
    const res = await patch({ call_handling_mode: newMode })
    if (!res?.ok) setLocalMode(prev)
  }

  const activeMode = AGENT_MODES.find(m => m.id === localMode)
  const showBookingNote = localMode === 'full_service' && !hasBooking

  return (
    <div className="rounded-2xl p-4 card-surface space-y-3">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-0.5">
          How should your agent handle calls?
        </p>
        <p className="text-[11px] t3 leading-relaxed">
          Pick a mode — your agent updates immediately. You can change this any time.
        </p>
      </div>

      {/* Mode cards */}
      <div className="space-y-2">
        {AGENT_MODES.map(m => {
          const isSelected = localMode === m.id
          const isLocked = m.id === 'full_service' && !canSelectFullService

          return (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              disabled={saving || isLocked}
              className={[
                'w-full text-left rounded-xl px-3.5 py-3 transition-all border',
                isSelected
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.07]'
                  : isLocked
                  ? 'border-zinc-700/30 bg-zinc-800/20 opacity-50 cursor-not-allowed'
                  : 'border-[var(--color-border)] hover:border-zinc-500/40 hover:bg-[var(--color-hover)] cursor-pointer',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0"
                  style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-3)' }}
                >
                  <ModeIcon mode={m.id} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold t1">{m.label}</span>
                    {isSelected && !saving && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: 0.9 }}
                      >
                        Active
                      </span>
                    )}
                    {isLocked && (
                      <span className="ml-auto text-[10px] font-medium text-amber-400 shrink-0">
                        Pro plan
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] t3 mt-0.5 leading-snug">{m.tagline}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Save / sync status */}
      {saving && (
        <p className="text-[11px] t3">Applying mode...</p>
      )}
      {!saving && saved && syncStatus === 'synced' && (
        <p className="text-[11px] text-emerald-400">Mode saved — agent updated live</p>
      )}
      {!saving && saved && syncStatus === 'failed' && (
        <p className="text-[11px] text-amber-400">
          Mode saved — agent sync delayed (will apply on next call)
        </p>
      )}
      {!saving && saved && (syncStatus === null || syncStatus === 'not-needed') && (
        <p className="text-[11px] text-emerald-400">Mode saved</p>
      )}
      {!saving && error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}

      {/* Booking not-connected disclaimer */}
      {showBookingNote && (
        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{
            backgroundColor: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            className="text-amber-400 shrink-0 mt-0.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            Calendar not connected — your agent runs as AI Receptionist until you{' '}
            <Link
              href="/dashboard/actions"
              className="underline underline-offset-2 hover:opacity-75 transition-opacity"
            >
              connect Google Calendar
            </Link>
            .
          </p>
        </div>
      )}

      {/* Post-save test CTA */}
      {saved && !saving && onRetest && (
        <button
          onClick={onRetest}
          className="w-full py-2 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80 cursor-pointer flex items-center justify-center gap-1.5"
          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
        >
          Test this mode now
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}

      {/* Active mode quote (shown when idle, no pending save) */}
      {!saving && !saved && !error && activeMode && (
        <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)', opacity: 0.6 }}>
          <p className="text-[11px] t3 leading-relaxed">
            <em>&ldquo;{activeMode.quote}&rdquo;</em>
          </p>
        </div>
      )}
    </div>
  )
}
