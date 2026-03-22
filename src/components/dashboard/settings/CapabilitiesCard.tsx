'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'
import { hasCapability } from '@/lib/niche-capabilities'

interface CapabilitiesCardProps {
  client: ClientConfig
  isAdmin?: boolean
  onScrollTo?: (section: string) => void
}

type CapabilityItem = {
  label: string
  available: boolean
  active: boolean
  detail?: string
  actionHint?: string
  section?: string
  layer?: 'always' | 'lookup'
}

export default function CapabilitiesCard({ client, isAdmin, onScrollTo }: CapabilitiesCardProps) {
  const niche = client.niche ?? ''

  const factLines = client.business_facts?.split('\n').filter(l => l.trim()).length ?? 0
  const faqCount = client.extra_qa?.filter(p => p.q?.trim() && p.a?.trim()).length ?? 0

  const capabilities: CapabilityItem[] = [
    {
      label: 'Take messages',
      available: hasCapability(niche, 'takeMessages'),
      active: hasCapability(niche, 'takeMessages'),
      detail: 'Collects name, number, and reason for calling',
      layer: 'always',
    },
    {
      label: 'Answer business questions',
      available: hasCapability(niche, 'useKnowledgeLookup'),
      active: !!(client.business_facts || (client.extra_qa && client.extra_qa.length > 0)),
      detail: factLines > 0 || faqCount > 0
        ? `${factLines > 0 ? `${factLines} fact${factLines !== 1 ? 's' : ''}` : ''}${factLines > 0 && faqCount > 0 ? ' + ' : ''}${faqCount > 0 ? `${faqCount} Q&A` : ''}`
        : undefined,
      actionHint: 'Add business facts or Q&A to enable',
      section: 'advanced-context',
      layer: 'always',
    },
    {
      label: 'Search knowledge base',
      available: true,
      active: client.knowledge_backend === 'pgvector',
      detail: client.knowledge_backend === 'pgvector' ? 'Searches uploaded docs during calls' : undefined,
      actionHint: 'Enable to let your agent search documents',
      section: 'knowledge',
      layer: 'lookup',
    },
    {
      label: 'Book appointments',
      available: hasCapability(niche, 'bookAppointments'),
      active: !!(client.booking_enabled && client.calendar_auth_status === 'connected'),
      detail: client.booking_enabled && client.calendar_auth_status === 'connected' ? 'Google Calendar connected' : undefined,
      actionHint: 'Connect Google Calendar to enable',
      section: 'booking',
    },
    {
      label: 'Transfer calls',
      available: hasCapability(niche, 'transferCalls'),
      active: !!client.forwarding_number,
      detail: client.forwarding_number ? `Transfers to ${formatPhone(client.forwarding_number)}` : undefined,
      actionHint: 'Set a forwarding number to enable',
      section: 'agent-config',
    },
    {
      label: 'Business hours',
      available: true,
      active: !!client.business_hours_weekday,
      detail: client.business_hours_weekday || undefined,
      actionHint: 'Set your hours so callers know when you\'re open',
      section: 'hours',
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
      detail: client.context_data ? `Using ${client.context_data_label || 'reference data'}` : undefined,
      actionHint: 'Upload reference data to enable',
      section: 'advanced-context',
      layer: 'lookup',
    },
    {
      label: 'Voicemail fallback',
      available: true,
      active: true,
      detail: client.voicemail_greeting_text ? 'Custom greeting set' : 'Default greeting',
    },
  ]

  const visible = capabilities.filter(c => c.available)
  const activeCount = visible.filter(c => c.active).length

  if (visible.length === 0) return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">What Your Agent Can Do</p>
        </div>
        <div className="flex items-center gap-2">
          <ReadinessBadge ratio={activeCount / visible.length} />
          <span className="text-[10px] font-mono t3">
            {activeCount}/{visible.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden mb-4 mt-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            activeCount / visible.length >= 0.8 ? 'bg-green-500/60'
              : activeCount / visible.length >= 0.5 ? 'bg-blue-500/60'
              : 'bg-amber-500/60'
          }`}
          style={{ width: `${(activeCount / visible.length) * 100}%` }}
        />
      </div>

      {/* Knowledge layer legend */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
          <span className="text-[9px] t3">Always knows</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/80" />
          <span className="text-[9px] t3">Searches when needed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map(cap => {
          const isClickable = !!cap.section && !!onScrollTo
          const Wrapper = isClickable ? 'button' : 'div'

          return (
            <Wrapper
              key={cap.label}
              {...(isClickable ? {
                onClick: () => onScrollTo!(cap.section!),
                type: 'button' as const,
              } : {})}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                cap.active
                  ? 'border-green-500/20 bg-green-500/[0.04]'
                  : 'border-zinc-500/15 bg-zinc-500/[0.02]'
              } ${isClickable ? 'hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer' : ''}`}
            >
              {cap.active ? (
                <span className="text-green-400 mt-0.5 shrink-0 text-xs">&#10003;</span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-zinc-500/40 mt-1.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-medium ${cap.active ? 't1' : 't3'}`}>{cap.label}</p>
                  {cap.layer === 'always' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 shrink-0" title="Always available on every call" />
                  )}
                  {cap.layer === 'lookup' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400/80 shrink-0" title="Searched when relevant" />
                  )}
                </div>
                {cap.active ? (
                  <p className="text-[10px] text-green-400/70 truncate">{cap.detail || 'Enabled'}</p>
                ) : (
                  <p className="text-[10px] t3 truncate">{cap.actionHint || 'Available'}</p>
                )}
              </div>
              {isClickable && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-zinc-500 mt-1 shrink-0">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Wrapper>
          )
        })}
      </div>
    </div>
  )
}

function ReadinessBadge({ ratio }: { ratio: number }) {
  if (ratio >= 0.8) return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Ready</span>
  )
  if (ratio >= 0.5) return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Getting there</span>
  )
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Needs setup</span>
  )
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}
