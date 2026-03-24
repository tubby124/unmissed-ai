'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import BookingSettingsSection from '@/components/dashboard/actions/BookingSettingsSection'
import TransferSettingsSection from '@/components/dashboard/actions/TransferSettingsSection'
import MessagingSettingsSection from '@/components/dashboard/actions/MessagingSettingsSection'
import AdminDropdown from '@/components/dashboard/AdminDropdown'

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
