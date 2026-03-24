'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicemailGreetingCard from '@/components/dashboard/settings/VoicemailGreetingCard'
import CapabilitiesCard from '@/components/dashboard/settings/CapabilitiesCard'
import HoursCard from '@/components/dashboard/settings/HoursCard'
import IvrMenuCard from '@/components/dashboard/settings/IvrMenuCard'
import BookingCard from '@/components/dashboard/settings/BookingCard'
import ActivityLog from '@/components/dashboard/settings/ActivityLog'
import AgentCurrentVoiceCard from '@/components/dashboard/settings/AgentCurrentVoiceCard'
import SettingsPanel from '@/components/dashboard/settings/SettingsPanel'
import TransferSettingsSection from '@/components/dashboard/actions/TransferSettingsSection'
import MessagingSettingsSection from '@/components/dashboard/actions/MessagingSettingsSection'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import AgentTestCard from '@/components/dashboard/AgentTestCard'

// ─── Voice style label map ────────────────────────────────────────────────────

const VOICE_STYLE_LABELS: Record<string, string> = {
  casual_friendly: 'casual, friendly',
  professional_warm: 'professional, warm',
  direct_efficient: 'direct, efficient',
}

// ─── Panel title map ──────────────────────────────────────────────────────────

const PANEL_TITLES: Record<string, string> = {
  hours: 'Answering Schedule',
  ivr: 'Voicemail Menu (IVR)',
  booking: 'Appointment Booking',
  'agent-config': 'Live Transfer',
  sms: 'SMS Follow-up',
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
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const { patch } = usePatchSettings(client.id, isAdmin)
  const router = useRouter()

  const isActive = statusLocal === 'active'

  function toggleStatus() {
    const newStatus = isActive ? 'paused' : 'active'
    setStatusLocal(newStatus)
    patch({ status: newStatus })
  }

  const handleConfigure = useCallback((section: string) => {
    // Navigate to dedicated pages for knowledge-related sections
    if (section === 'knowledge' || section === 'advanced-context') {
      router.push('/dashboard/knowledge')
      return
    }
    // Voicemail: scroll to it on this page
    if (section === 'voicemail') {
      document.getElementById('voicemail-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // Everything else opens in the panel
    setActivePanel(section)
  }, [router])

  const voiceStyleLabel = VOICE_STYLE_LABELS[client.voice_style_preset ?? 'casual_friendly'] ?? 'casual, friendly'

  return (
    <div className="space-y-6">
      {/* ── Test Your Agent (orb) ─────────────────────────── */}
      <AgentTestCard
        agentName={client.agent_name ?? client.business_name ?? 'your agent'}
        businessName={client.business_name}
        clientStatus={client.status ?? null}
        isTrial={!isAdmin && client.subscription_status === 'trialing'}
      />

      {/* ── Identity & Status ─────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>Identity &amp; Status</p>
        <AgentOverviewCard
          client={client}
          isAdmin={isAdmin}
          isActive={isActive}
          onToggleStatus={toggleStatus}
          previewMode={previewMode}
        />
      </div>

      {/* ── Voice & Style ─────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>Voice &amp; Style</p>
        <div className="space-y-4">
          <VoiceStyleCard
            clientId={client.id}
            isAdmin={isAdmin}
            initialPreset={client.voice_style_preset ?? 'casual_friendly'}
            previewMode={previewMode}
          />
          <div id="voicemail-section">
            <VoicemailGreetingCard
              clientId={client.id}
              isAdmin={isAdmin}
              initialText={client.voicemail_greeting_text ?? ''}
              businessName={client.business_name}
              hasAudioGreeting={!!client.voicemail_greeting_audio_url}
              previewMode={previewMode}
            />
          </div>
          <AgentCurrentVoiceCard
            agentVoiceId={client.agent_voice_id ?? ''}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* ── Capabilities (clickable → opens panel) ──────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>Capabilities</p>
        <CapabilitiesCard
          client={client}
          isAdmin={isAdmin}
          onConfigure={handleConfigure}
        />
      </div>

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

      {/* ── Activity ──────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>Activity</p>
        <ActivityLog clientId={client.id} isAdmin={isAdmin} />
      </div>

      {/* ── Settings Panel (right-side drawer) ────────────── */}
      <SettingsPanel
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        title={activePanel ? (PANEL_TITLES[activePanel] ?? '') : ''}
      >
        {activePanel === 'hours' && (
          <HoursCard
            clientId={client.id}
            isAdmin={isAdmin}
            initialWeekday={client.business_hours_weekday ?? ''}
            initialWeekend={client.business_hours_weekend ?? ''}
            initialBehavior={client.after_hours_behavior ?? 'take_message'}
            initialPhone={client.after_hours_emergency_phone ?? ''}
            previewMode={previewMode}
          />
        )}
        {activePanel === 'ivr' && (
          <IvrMenuCard
            clientId={client.id}
            isAdmin={isAdmin}
            initialEnabled={client.ivr_enabled ?? false}
            initialPrompt={client.ivr_prompt ?? ''}
            businessName={client.business_name}
            agentName={client.agent_name}
            previewMode={previewMode}
          />
        )}
        {activePanel === 'booking' && (
          <BookingCard
            clientId={client.id}
            isAdmin={isAdmin}
            calendarAuthStatus={client.calendar_auth_status}
            googleCalendarId={client.google_calendar_id}
            initialDuration={client.booking_service_duration_minutes ?? 30}
            initialBuffer={client.booking_buffer_minutes ?? 0}
            initialBookingEnabled={client.booking_enabled ?? false}
            previewMode={previewMode}
          />
        )}
        {activePanel === 'agent-config' && (
          <TransferSettingsSection
            client={client}
            isAdmin={isAdmin}
            previewMode={previewMode}
          />
        )}
        {activePanel === 'sms' && (
          <MessagingSettingsSection
            client={client}
            isAdmin={isAdmin}
            previewMode={previewMode}
          />
        )}
      </SettingsPanel>
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
    <div className="p-3 sm:p-6 space-y-6 max-w-3xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <AgentCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
