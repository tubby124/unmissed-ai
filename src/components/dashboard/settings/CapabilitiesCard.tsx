'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'
import { hasCapability } from '@/lib/niche-capabilities'
import { getPlanEntitlements, resolveEffectivePlanId } from '@/lib/plan-entitlements'

interface CapabilitiesCardProps {
  client: ClientConfig
  isAdmin?: boolean
  onConfigure?: (section: string) => void
}

type CapabilityStatus = 'active' | 'needs_setup' | 'upgrade_required'

type CapabilityItem = {
  id: string
  label: string
  status: CapabilityStatus
  available: boolean
  detail?: string
  actionHint?: string
  upgradeLabel?: string
  pathNote?: string
  section?: string
}

export default function CapabilitiesCard({ client, isAdmin, onConfigure }: CapabilitiesCardProps) {
  const niche = client.niche ?? ''
  const entitlements = getPlanEntitlements(resolveEffectivePlanId(client.selected_plan, client.subscription_status))

  const factLines = client.business_facts?.split('\n').filter(l => l.trim()).length ?? 0
  const faqCount = client.extra_qa?.filter(p => p.q?.trim() && p.a?.trim()).length ?? 0

  const capabilities: CapabilityItem[] = [
    {
      id: 'messages',
      label: 'Take messages',
      available: hasCapability(niche, 'takeMessages'),
      status: 'active',
      detail: 'Collects name, number, and reason for calling',
    },
    {
      id: 'answer-questions',
      label: 'Answer business questions',
      available: hasCapability(niche, 'useKnowledgeLookup'),
      status: (factLines > 0 || faqCount > 0) ? 'active' : 'needs_setup',
      detail: factLines > 0 || faqCount > 0
        ? `${factLines > 0 ? `${factLines} fact${factLines !== 1 ? 's' : ''}` : ''}${factLines > 0 && faqCount > 0 ? ' + ' : ''}${faqCount > 0 ? `${faqCount} Q&A` : ''}`
        : undefined,
      actionHint: 'Add business facts or Q&A',
      section: 'advanced-context',
    },
    {
      id: 'knowledge',
      label: 'Search knowledge base',
      available: true,
      status: !entitlements.knowledgeEnabled
        ? 'upgrade_required'
        : client.knowledge_backend === 'pgvector' ? 'active' : 'needs_setup',
      detail: client.knowledge_backend === 'pgvector' ? 'Searches uploaded docs during calls' : undefined,
      actionHint: 'Enable document search',
      upgradeLabel: 'Core',
      section: 'knowledge',
    },
    {
      id: 'booking',
      label: 'Book appointments',
      available: hasCapability(niche, 'bookAppointments'),
      status: !entitlements.bookingEnabled
        ? 'upgrade_required'
        : (client.booking_enabled && client.calendar_auth_status === 'connected') ? 'active' : 'needs_setup',
      detail: (entitlements.bookingEnabled && client.booking_enabled && client.calendar_auth_status === 'connected')
        ? 'Google Calendar connected' : undefined,
      actionHint: !client.booking_enabled
        ? 'Enable booking in settings'
        : 'Connect Google Calendar',
      upgradeLabel: 'Pro',
      pathNote: (entitlements.bookingEnabled && client.booking_enabled && client.calendar_auth_status === 'connected')
        ? 'Works on live phone calls and dashboard test calls' : undefined,
      section: 'booking',
    },
    {
      id: 'transfer',
      label: 'Transfer calls',
      available: hasCapability(niche, 'transferCalls'),
      status: !entitlements.transferEnabled
        ? 'upgrade_required'
        : client.forwarding_number ? 'active' : 'needs_setup',
      detail: (entitlements.transferEnabled && client.forwarding_number)
        ? `Transfers to ${formatPhone(client.forwarding_number)}` : undefined,
      actionHint: 'Set a forwarding number',
      upgradeLabel: 'Pro',
      pathNote: (entitlements.transferEnabled && client.forwarding_number)
        ? 'Phone calls only' : undefined,
      section: 'agent-config',
    },
    {
      id: 'hours',
      label: 'Business hours',
      available: true,
      status: client.business_hours_weekday ? 'active' : 'needs_setup',
      detail: client.business_hours_weekday || undefined,
      actionHint: "Set your hours",
      section: 'hours',
    },
    {
      id: 'sms',
      label: 'SMS follow-up',
      available: true,
      status: (client.sms_enabled && client.twilio_number) ? 'active' : 'needs_setup',
      actionHint: client.sms_enabled && !client.twilio_number
        ? 'Available after go-live'
        : 'Enable SMS templates',
      pathNote: (client.sms_enabled && !client.twilio_number)
        ? 'Needs a Twilio number — available after go-live' : undefined,
      section: 'sms',
    },
    {
      id: 'reference-data',
      label: 'Look up reference data',
      available: hasCapability(niche, 'useTenantLookup') || hasCapability(niche, 'usePropertyLookup'),
      status: client.context_data ? 'active' : 'needs_setup',
      detail: client.context_data ? `Using ${client.context_data_label || 'reference data'}` : undefined,
      actionHint: 'Upload reference data',
      section: 'advanced-context',
    },
    {
      id: 'voicemail',
      label: 'Voicemail fallback',
      available: true,
      status: 'active',
      detail: client.voicemail_greeting_text ? 'Custom greeting set' : 'Default greeting',
      section: 'voicemail',
    },
    {
      id: 'ivr',
      label: 'Voicemail menu (IVR)',
      available: true,
      status: client.ivr_enabled ? 'active' : 'needs_setup',
      detail: client.ivr_enabled
        ? (client.ivr_prompt ? 'Custom menu set' : 'Press 1 for voicemail')
        : undefined,
      actionHint: 'Add a voicemail menu option',
      pathNote: client.ivr_enabled ? 'Phone calls only' : undefined,
      section: 'ivr',
    },
  ]

  const visible = capabilities.filter(c => c.available)
  const activeCount = visible.filter(c => c.status === 'active').length

  if (visible.length === 0) return null

  const ratio = activeCount / visible.length

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Your Agent Can Do</p>
        </div>
        <div className="flex items-center gap-2">
          <ReadinessBadge ratio={ratio} />
          <span className="text-[10px] font-mono t3">
            {activeCount}/{visible.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden mb-4 mt-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            ratio >= 0.8 ? 'bg-green-500/60'
              : ratio >= 0.5 ? 'bg-blue-500/60'
              : 'bg-amber-500/60'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map(cap => {
          const isClickable = !!cap.section && !!onConfigure && cap.status !== 'upgrade_required'
          const Wrapper = isClickable ? 'button' : 'div'

          return (
            <Wrapper
              key={cap.id}
              {...(isClickable ? {
                onClick: () => onConfigure!(cap.section!),
                type: 'button' as const,
              } : {})}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                cap.status === 'active'
                  ? 'border-green-500/20 bg-green-500/[0.04]'
                  : cap.status === 'upgrade_required'
                  ? 'border-zinc-700/20 bg-zinc-800/[0.03] opacity-60'
                  : 'b-theme bg-surface'
              } ${isClickable ? 'hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer' : ''}`}
            >
              {/* Status icon */}
              {cap.status === 'active' ? (
                <span className="text-green-400 mt-0.5 shrink-0 text-xs">&#10003;</span>
              ) : cap.status === 'upgrade_required' ? (
                <LockIcon />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium ${
                  cap.status === 'active' ? 't1'
                  : cap.status === 'upgrade_required' ? 'text-zinc-500'
                  : 't2'
                }`}>{cap.label}</p>
                {cap.status === 'active' ? (
                  <>
                    <p className="text-[10px] text-green-400/70 truncate">{cap.detail || 'Enabled'}</p>
                    {cap.pathNote && (
                      <p className="text-[9px] t3 mt-0.5">{cap.pathNote}</p>
                    )}
                  </>
                ) : cap.status === 'upgrade_required' ? (
                  <p className="text-[10px] text-zinc-500 truncate">
                    Requires {cap.upgradeLabel} plan
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-amber-400/70 truncate">{cap.actionHint || 'Not configured'}</p>
                    {cap.pathNote && (
                      <p className="text-[9px] t3 mt-0.5">{cap.pathNote}</p>
                    )}
                  </>
                )}
              </div>
              {isClickable && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="t3 mt-1 shrink-0">
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

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-zinc-500 mt-0.5 shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
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
