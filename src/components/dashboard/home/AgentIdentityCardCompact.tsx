'use client'

/**
 * AgentIdentityCardCompact — v2 modal-based parity (2026-04-27).
 *
 * Mirrors `~/Downloads/CALLING AGENTs/dashboard-mockup.html` view-opt1 identity
 * block: avatar circle + name + "Voice · phone change" subtitle + 10-chip 4×3
 * grid. Each chip opens an InlineEditModal via the `openModal` callback.
 *
 * v1 (`/dashboard`) does NOT use this component — it remains drawer-based via
 * AgentIdentityCard. This Compact variant is v2-only and the modal pattern is
 * the canonical edit chrome for that surface.
 */

import { useEffect, useState } from 'react'
import type { ModalId } from '@/hooks/useInlineEdit'

interface Props {
  agentName: string
  businessName: string | null
  /** Optional preset label fallback when voice name lookup is pending. */
  voiceFallback?: string | null
  /** Ultravox voice UUID — used to look up the friendly name from /api/dashboard/voices. */
  voiceId: string | null
  twilioNumber: string | null
  capabilities: {
    hasGreeting: boolean
    hasSms: boolean
    hasTelegram: boolean
    hasIvr: boolean
    hasVoicemail: boolean
    hasBooking: boolean
    hasTransfer: boolean
    hasWebsite: boolean
    hasGoogleProfile: boolean
  }
  injectedNote: string | null
  /** Optional "Synced X ago" trust string sourced from agentSync.last_agent_sync_at. */
  syncedLabel?: string | null
  /** True when subscription_status === 'trialing'. Shows trial-clarity caption above chips. */
  isTrial?: boolean
  /** True when client has an active forwarding_number wired (paid + verified). */
  hasForwarding?: boolean
  openModal: (id: Exclude<ModalId, null>) => void
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

interface ChipDef {
  key: string
  label: string
  on: boolean
  modal: Exclude<ModalId, null>
}

export default function AgentIdentityCardCompact({
  agentName,
  businessName,
  voiceFallback,
  voiceId,
  twilioNumber,
  capabilities,
  injectedNote,
  syncedLabel,
  isTrial = false,
  hasForwarding = false,
  openModal,
}: Props) {
  const [voiceName, setVoiceName] = useState<string | null>(null)

  useEffect(() => {
    if (!voiceId) return
    let cancelled = false
    fetch('/api/dashboard/voices', { signal: AbortSignal.timeout(8000) })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled || !json?.voices) return
        const match = (json.voices as { voiceId: string; name: string }[]).find(v => v.voiceId === voiceId)
        if (match?.name) setVoiceName(match.name)
      })
      .catch(() => { /* swallow — fallback label shows */ })
    return () => { cancelled = true }
  }, [voiceId])

  const voiceLabel = voiceName ? `${voiceName} voice` : voiceFallback || 'Voice'

  const initial = (agentName || 'A').trim().charAt(0).toUpperCase()
  const titleLine = businessName
    ? `${agentName} \u00b7 ${businessName}`
    : agentName

  const phoneDisplay = formatPhone(twilioNumber)

  const chips: ChipDef[] = [
    { key: 'greeting',  label: 'Greeting',       on: capabilities.hasGreeting,      modal: 'greeting' },
    { key: 'sms',       label: 'SMS',            on: capabilities.hasSms,           modal: 'aftercall' },
    { key: 'telegram',  label: 'Telegram',       on: capabilities.hasTelegram,      modal: 'telegram' },
    { key: 'ivr',       label: 'IVR',            on: capabilities.hasIvr,           modal: 'ivr' },
    { key: 'voicemail', label: 'Voicemail',      on: capabilities.hasVoicemail,     modal: 'voicemail' },
    { key: 'booking',   label: 'Booking',        on: capabilities.hasBooking,       modal: 'calendar' },
    { key: 'transfer',  label: 'Transfer',       on: capabilities.hasTransfer,      modal: 'transfer' },
    { key: 'website',   label: 'Website',        on: capabilities.hasWebsite,       modal: 'knowledge' },
    { key: 'gbp',       label: 'Google profile', on: capabilities.hasGoogleProfile, modal: 'gbp' },
    {
      key: 'today',
      label: injectedNote ? `Today: ${injectedNote.slice(0, 22)}${injectedNote.length > 22 ? '\u2026' : ''}` : 'Today: empty',
      on: !!injectedNote,
      modal: 'today',
    },
  ]

  return (
    <div
      className="rounded-2xl"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {syncedLabel && (
        <div
          className="px-4 pt-3 -mb-1 flex items-center gap-1.5 text-[10px] font-medium"
          style={{ color: 'rgb(52,211,153)' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" fill="currentColor" />
          </svg>
          {syncedLabel}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_1fr] gap-4 p-4 md:p-5 items-center">
        {/* LEFT — avatar + name + voice·phone subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => openModal('callback')}
            className="shrink-0"
            aria-label="Edit callback contact"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-[18px]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {initial}
            </div>
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => openModal('callback')}
              className="block text-left max-w-full"
              aria-label="Edit agent + business name"
            >
              <div className="text-[14px] font-bold t1 truncate">{titleLine}</div>
            </button>
            <button
              type="button"
              onClick={() => openModal('voice')}
              className="block text-left max-w-full mt-0.5"
              aria-label="Change voice"
            >
              <div className="text-[11px] t3 truncate flex items-center gap-1.5">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                  style={{
                    backgroundColor: 'rgba(99,102,241,0.12)',
                    color: 'var(--color-primary)',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}
                >
                  {voiceLabel}
                </span>
                {phoneDisplay && (
                  <>
                    <span className="t3">·</span>
                    <span className="t3 font-mono">{phoneDisplay}</span>
                  </>
                )}
                <span className="font-semibold ml-1" style={{ color: 'var(--color-primary)' }}>
                  change
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* RIGHT — 10 chips, 4-col grid (4×3 on desktop, 2×5 on mobile) */}
        <div className="space-y-2 min-w-0">
          {(isTrial || !hasForwarding) && twilioNumber && (
            <p className="text-[10px] t3 leading-snug px-0.5">
              {isTrial
                ? 'Trial — your agent is live. Forward your business line to the number above to start receiving real calls. SMS / Voicemail / Telegram activate when you upgrade.'
                : 'Calls to the number above reach your agent. Forwarding from your business line activates after upgrade.'}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => openModal(chip.modal)}
              className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer min-w-0"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: chip.on ? 'var(--color-text-1)' : 'var(--color-text-3)',
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: chip.on ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.18)',
                  }}
                />
                <span className="truncate">{chip.label}</span>
              </span>
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  )
}
