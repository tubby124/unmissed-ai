'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'
import { hasCapability } from '@/lib/niche-capabilities'

interface CapabilitiesCardProps {
  client: ClientConfig
}

type CapabilityItem = {
  label: string
  available: boolean
  active: boolean
  actionHint?: string
}

export default function CapabilitiesCard({ client }: CapabilitiesCardProps) {
  const niche = client.niche ?? ''

  const capabilities: CapabilityItem[] = [
    {
      label: 'Take messages',
      available: hasCapability(niche, 'takeMessages'),
      active: hasCapability(niche, 'takeMessages'),
    },
    {
      label: 'Answer business questions',
      available: hasCapability(niche, 'useKnowledgeLookup'),
      active: !!(client.business_facts || (client.extra_qa && client.extra_qa.length > 0) || client.knowledge_backend === 'pgvector'),
      actionHint: 'Add business facts or Q&A above to enable',
    },
    {
      label: 'Book appointments',
      available: hasCapability(niche, 'bookAppointments'),
      active: !!(client.booking_enabled && client.calendar_auth_status === 'connected'),
      actionHint: 'Connect Google Calendar to enable',
    },
    {
      label: 'Transfer calls',
      available: hasCapability(niche, 'transferCalls'),
      active: !!client.forwarding_number,
      actionHint: 'Set a forwarding number to enable',
    },
    {
      label: 'SMS follow-up',
      available: true,
      active: !!client.sms_enabled,
      actionHint: 'Enable in SMS tab',
    },
    {
      label: 'Look up reference data',
      available: hasCapability(niche, 'useTenantLookup') || hasCapability(niche, 'usePropertyLookup'),
      active: !!client.context_data,
      actionHint: 'Upload reference data above to enable',
    },
    {
      label: 'Search knowledge base',
      available: true,
      active: client.knowledge_backend === 'pgvector',
      actionHint: 'Enable Knowledge Base to use',
    },
  ]

  // Only show capabilities that are available for this niche
  const visible = capabilities.filter(c => c.available)

  if (visible.length === 0) return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">What your agent can do</p>
      <p className="text-[11px] t3 mb-4">Capabilities available for your business and their current status.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map(cap => (
          <div
            key={cap.label}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
              cap.active
                ? 'border-green-500/20 bg-green-500/[0.04]'
                : 'border-amber-500/15 bg-amber-500/[0.03]'
            }`}
          >
            {cap.active ? (
              <span className="text-green-400 mt-0.5 shrink-0 text-xs">&#10003;</span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-medium ${cap.active ? 't1' : 't2'}`}>{cap.label}</p>
              {cap.active ? (
                <p className="text-[10px] text-green-400/70">Enabled</p>
              ) : (
                <p className="text-[10px] text-amber-400/70">{cap.actionHint || 'Available'}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
