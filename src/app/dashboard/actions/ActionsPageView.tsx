'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import BookingSettingsSection from '@/components/dashboard/actions/BookingSettingsSection'
import TransferSettingsSection from '@/components/dashboard/actions/TransferSettingsSection'
import MessagingSettingsSection from '@/components/dashboard/actions/MessagingSettingsSection'

// ─── Behavior summary ─────────────────────────────────────────────────────────

function buildSummary(client: ClientConfig): string {
  const canBook = !!(client.booking_enabled && client.calendar_auth_status === 'connected')
  const canTransfer = !!client.forwarding_number
  const canSms = !!(client.sms_enabled && client.twilio_number)

  const parts: string[] = []

  if (canBook) {
    parts.push('Can book appointments via Google Calendar.')
  } else if (client.calendar_auth_status === 'connected') {
    parts.push('Calendar connected but booking is disabled.')
  } else {
    parts.push('Cannot book — no calendar connected.')
  }

  if (canTransfer) {
    parts.push('Can transfer calls to a live person.')
  } else {
    parts.push('Cannot transfer calls — no forwarding number set.')
  }

  if (canSms) {
    parts.push('Sends a follow-up SMS after each call.')
  } else {
    parts.push('SMS follow-up is off.')
  }

  return parts.join(' ')
}

// ─── Inner card group — keyed on client.id so hook state resets on switch ────

function ActionCards({
  client,
  isAdmin,
  previewMode,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}) {
  const summary = buildSummary(client)

  return (
    <div className="space-y-4">
      <BookingSettingsSection client={client} isAdmin={isAdmin} previewMode={previewMode} />
      <TransferSettingsSection client={client} isAdmin={isAdmin} previewMode={previewMode} />
      <MessagingSettingsSection client={client} isAdmin={isAdmin} previewMode={previewMode} />

      {/* Behavior summary */}
      <div className="rounded-2xl border b-theme bg-surface px-5 py-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">What happens after calls</p>
        <p className="text-xs t2 leading-relaxed">{summary}</p>
      </div>
    </div>
  )
}

// ─── Admin client dropdown ────────────────────────────────────────────────────

function AdminDropdown({
  clients,
  selectedId,
  onSelect,
}: {
  clients: ClientConfig[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selected = clients.find(c => c.id === selectedId) ?? clients[0]
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border b-theme bg-surface hover:bg-hover transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium t1 truncate">{selected?.business_name}</span>
          {selected?.niche && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-hover t3 shrink-0">{selected.niche}</span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className={`t3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl border b-theme bg-surface shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-hover transition-colors ${c.id === selectedId ? 'bg-hover' : ''}`}
            >
              <span className="text-sm t1 truncate flex-1">{c.business_name}</span>
              {c.niche && <span className="text-[11px] t3 shrink-0">{c.niche}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface ActionsPageViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  previewMode?: boolean
  initialClientId?: string
}

export default function ActionsPageView({ clients, isAdmin, previewMode, initialClientId }: ActionsPageViewProps) {
  const [selectedId, setSelectedId] = useState(
    initialClientId && clients.find(c => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? ''
  )

  useEffect(() => {
    if (initialClientId && clients.find(c => c.id === initialClientId)) {
      setSelectedId(initialClientId)
    }
  }, [initialClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <ActionCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
