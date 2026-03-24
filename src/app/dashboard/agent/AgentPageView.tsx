'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicemailGreetingCard from '@/components/dashboard/settings/VoicemailGreetingCard'
import CapabilitiesCard from '@/components/dashboard/settings/CapabilitiesCard'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

// ─── Voice style label map ────────────────────────────────────────────────────

const VOICE_STYLE_LABELS: Record<string, string> = {
  casual_friendly: 'casual, friendly',
  professional_warm: 'professional, warm',
  direct_efficient: 'direct, efficient',
}

// ─── Inner card group — keyed on client.id so state resets on client switch ──

function AgentCards({
  client,
  isAdmin,
  previewMode,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}) {
  const [statusLocal, setStatusLocal] = useState(client.status ?? 'active')
  const { patch } = usePatchSettings(client.id, isAdmin)

  const isActive = statusLocal === 'active'

  function toggleStatus() {
    const newStatus = isActive ? 'paused' : 'active'
    setStatusLocal(newStatus)
    patch({ status: newStatus })
  }

  const voiceStyleLabel = VOICE_STYLE_LABELS[client.voice_style_preset ?? 'casual_friendly'] ?? 'casual, friendly'

  return (
    <div className="space-y-4">
      <AgentOverviewCard
        client={client}
        isAdmin={isAdmin}
        isActive={isActive}
        onToggleStatus={toggleStatus}
        previewMode={previewMode}
      />
      <VoiceStyleCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialPreset={client.voice_style_preset ?? 'casual_friendly'}
        previewMode={previewMode}
      />
      <VoicemailGreetingCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialText={client.voicemail_greeting_text ?? ''}
        businessName={client.business_name}
        hasAudioGreeting={!!client.voicemail_greeting_audio_url}
        previewMode={previewMode}
      />
      <CapabilitiesCard
        client={client}
        isAdmin={isAdmin}
      />

      {/* Behavior summary */}
      <div className="rounded-2xl border b-theme bg-surface px-5 py-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">How your agent sounds</p>
        <p className="text-xs t2 leading-relaxed">
          Speaks in a{' '}
          <span className="font-medium t1">{voiceStyleLabel}</span> tone.
          {client.agent_name ? (
            <> Acts as <span className="font-medium t1">{client.agent_name}</span>.</>
          ) : null}
          {!client.agent_name && client.business_name ? (
            <> Represents <span className="font-medium t1">{client.business_name}</span>.</>
          ) : null}
        </p>
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

interface AgentPageViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  previewMode?: boolean
  initialClientId?: string
}

export default function AgentPageView({ clients, isAdmin, previewMode, initialClientId }: AgentPageViewProps) {
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

      <AgentCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
