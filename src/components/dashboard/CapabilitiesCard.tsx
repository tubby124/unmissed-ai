'use client'

import Link from 'next/link'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'

interface Capabilities {
  hasKnowledge: boolean
  hasFacts: boolean
  hasFaqs: boolean
  hasHours: boolean
  hasBooking: boolean
  hasSms: boolean
  hasTransfer: boolean
  hasWebsite: boolean
}

interface CapabilitiesCardProps {
  capabilities: Capabilities
  agentName: string
  voiceStylePreset: string | null
  isTrial: boolean
  clientId: string | null
  hasPhoneNumber: boolean
  hasIvr: boolean
  hasContextData: boolean
}

type DotType = 'always' | 'search'

interface CapabilityItem {
  id: string
  label: string
  enabledDesc: string
  disabledDesc: string
  enabled: boolean
  dotType: DotType
  link: string | null
  upgradeRequired?: boolean
  goliveLocked?: boolean
  lockReason?: string
  tooltip?: string
}

const VOICE_LABELS: Record<string, string> = {
  casual_friendly: 'casual, friendly',
  professional_warm: 'professional, warm',
  formal: 'formal',
  energetic: 'energetic',
  empathetic: 'empathetic',
}

function getVoiceLabel(preset: string | null): string {
  if (!preset) return 'professional, warm'
  return VOICE_LABELS[preset] ?? preset.replace(/_/g, ' ')
}

// Amber padlock for go-live locked items
function GoliveLockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 ml-auto" stroke="rgb(251,191,36)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// Check icon (green) for enabled items
function CheckIcon() {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="rgb(34,197,94)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// Gray dot for disabled items
function EmptyDot() {
  return (
    <div
      className="w-5 h-5 rounded-full border-2 shrink-0"
      style={{ borderColor: 'var(--color-border)' }}
    />
  )
}

// Chevron right icon
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 ml-auto" style={{ color: 'var(--color-text-3)' }}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CapabilityRow({
  item,
  isTrial,
  onUpgradeClick,
  onGoliveLockClick,
}: {
  item: CapabilityItem
  isTrial: boolean
  onUpgradeClick: () => void
  onGoliveLockClick: () => void
}) {
  const isGoliveLocked = !item.enabled && item.goliveLocked
  const tooltipText = isGoliveLocked && item.lockReason
    ? item.lockReason
    : item.tooltip

  const inner = (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-3 min-h-[52px] transition-colors duration-200 hover:bg-hover cursor-pointer ${isGoliveLocked ? 'opacity-50' : ''}`}
      title={tooltipText}
    >
      {item.enabled ? <CheckIcon /> : <EmptyDot />}

      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium leading-tight"
          style={{ color: item.enabled ? 'var(--color-text-1)' : 'var(--color-text-2)' }}
        >
          {item.label}
          {item.dotType === 'search' && (
            <span
              className="ml-1.5 inline-block w-2 h-2 rounded-full border border-current align-middle"
              style={{ color: item.enabled ? 'var(--color-primary)' : 'var(--color-text-3)' }}
            />
          )}
          {item.dotType === 'always' && item.enabled && (
            <span
              className="ml-1.5 inline-block w-2 h-2 rounded-full align-middle"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
        </p>
        <p className="text-[11px] mt-0.5 leading-tight" style={{
          color: item.enabled ? 'rgb(34,197,94)' : isGoliveLocked ? 'rgb(251,191,36)' : 'var(--color-text-3)',
        }}>
          {item.enabled ? item.enabledDesc : isGoliveLocked && item.lockReason ? item.lockReason : item.disabledDesc}
        </p>
      </div>

      {isGoliveLocked ? <GoliveLockIcon /> : item.link ? <ChevronRight /> : null}
      {!item.enabled && !isGoliveLocked && item.upgradeRequired && isTrial && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 ml-auto" style={{ color: 'var(--color-text-3)' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )

  // Go-live locked (amber padlock) — takes visual precedence over upgradeRequired
  if (isGoliveLocked) {
    return (
      <button
        onClick={onGoliveLockClick}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded-xl"
      >
        {inner}
      </button>
    )
  }

  // Upgrade-gated items for trial users
  if (!item.enabled && item.upgradeRequired && isTrial) {
    return (
      <button
        onClick={onUpgradeClick}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
      >
        {inner}
      </button>
    )
  }

  // Disabled with a settings link
  if (!item.enabled && item.link) {
    return (
      <Link
        href={item.link}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
      >
        {inner}
      </Link>
    )
  }

  // Enabled with a settings link
  if (item.enabled && item.link) {
    return (
      <Link
        href={item.link}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
      >
        {inner}
      </Link>
    )
  }

  // No link (always-enabled items like "take messages" / "voicemail")
  return <div>{inner}</div>
}

export default function CapabilitiesCard({
  capabilities,
  agentName,
  voiceStylePreset,
  isTrial,
  clientId,
  hasPhoneNumber,
  hasIvr,
  hasContextData,
}: CapabilitiesCardProps) {
  const { openUpgradeModal } = useUpgradeModal()

  const hasQA = capabilities.hasFacts || capabilities.hasFaqs

  const items: CapabilityItem[] = [
    {
      id: 'messages',
      label: 'Take messages',
      enabledDesc: 'Collects name, number, and reason for calling',
      disabledDesc: 'Always active',
      enabled: true,
      dotType: 'always',
      link: null,
    },
    {
      id: 'qa',
      label: 'Answer business questions',
      enabledDesc: 'Trained on your business facts & FAQs',
      disabledDesc: 'Add business facts or Q&A to enable',
      enabled: hasQA,
      dotType: 'always',
      link: '/dashboard/knowledge?tab=add&source=manual',
    },
    {
      id: 'knowledge',
      label: 'Search knowledge base',
      enabledDesc: 'Searches uploaded docs during calls',
      disabledDesc: 'Upload documents to enable',
      enabled: capabilities.hasKnowledge,
      dotType: 'search',
      link: '/dashboard/knowledge',
    },
    {
      id: 'transfer',
      label: 'Transfer calls',
      enabledDesc: 'Configured — phone calls only',
      disabledDesc: 'Set a forwarding number to enable',
      enabled: capabilities.hasTransfer,
      dotType: 'always',
      link: '/dashboard/settings?tab=general',
      tooltip: 'Transfer works on live phone calls only. Browser test calls cannot transfer.',
    },
    {
      id: 'hours',
      label: 'Business hours',
      enabledDesc: 'Knows your open/closed schedule',
      disabledDesc: 'Set your hours to enable',
      enabled: capabilities.hasHours,
      dotType: 'always',
      link: '/dashboard/settings?tab=general',
    },
    {
      id: 'sms',
      label: 'SMS follow-up',
      enabledDesc: 'Sends follow-up texts — phone calls only',
      disabledDesc: 'Requires a phone number on your plan',
      enabled: capabilities.hasSms,
      dotType: 'always',
      link: '/dashboard/settings?tab=sms',
      upgradeRequired: true,
      tooltip: 'SMS requires a Twilio phone number. Available on paid plans.',
    },
    {
      id: 'voicemail',
      label: 'Voicemail fallback',
      enabledDesc: 'Takes a message when unavailable',
      disabledDesc: 'Needs a live phone number',
      enabled: hasPhoneNumber,
      dotType: 'always',
      link: null,
      goliveLocked: !hasPhoneNumber,
      lockReason: 'Needs a live phone number — available after go-live',
    },
    {
      id: 'booking',
      label: 'Book appointments',
      enabledDesc: 'Books directly into your calendar',
      disabledDesc: 'Connect your calendar to enable',
      enabled: capabilities.hasBooking,
      dotType: 'always',
      link: '/dashboard/settings?tab=general',
      upgradeRequired: true,
    },
    {
      id: 'context_data',
      label: 'Look up reference data',
      enabledDesc: 'Searches reference tables during calls',
      disabledDesc: 'Add reference data to enable',
      enabled: hasContextData,
      dotType: 'search',
      link: '/dashboard/knowledge?tab=add&source=text',
    },
    {
      id: 'ivr',
      label: 'Voicemail menu / IVR',
      enabledDesc: 'Greets callers with a key-press menu',
      disabledDesc: 'Requires a live phone number',
      enabled: hasIvr && hasPhoneNumber,
      dotType: 'always',
      link: '/dashboard/settings?tab=general',
      goliveLocked: !hasPhoneNumber,
      lockReason: 'Needs a live phone number — upgrade to go live',
    },
  ]

  const enabledCount = items.filter(i => i.enabled).length
  const total = items.length
  const pct = Math.round((enabledCount / total) * 100)

  let statusLabel: string
  let statusColor: string
  if (pct === 100) {
    statusLabel = 'Fully configured'
    statusColor = 'bg-green-500/10 text-green-400'
  } else if (pct >= 50) {
    statusLabel = 'Getting there'
    statusColor = 'bg-blue-500/10 text-blue-400'
  } else {
    statusLabel = 'Just starting'
    statusColor = 'bg-amber-500/10 text-amber-400'
  }

  const voiceLabel = getVoiceLabel(voiceStylePreset)

  return (
    <div className="space-y-3">
      {/* Section label */}
      <p
        className="text-[11px] font-semibold tracking-[0.15em] uppercase px-1"
        style={{ color: 'var(--color-text-3)' }}
      >
        Capabilities
      </p>

      {/* Main capability grid card */}
      <div className="rounded-2xl overflow-hidden card-surface">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p
              className="text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: 'var(--color-text-2)' }}
            >
              What your agent can do
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>
              {enabledCount}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? 'rgb(34,197,94)' : 'var(--color-primary)',
              }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 pb-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
            <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>Always knows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border shrink-0" style={{ borderColor: 'var(--color-primary)' }} />
            <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>Searches when needed</span>
          </div>
        </div>

        {/* 2-column grid */}
        <div className="px-2 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          {items.map(item => (
            <CapabilityRow
              key={item.id}
              item={item}
              isTrial={isTrial}
              onUpgradeClick={() => openUpgradeModal('capability_upgrade', clientId, undefined)}
              onGoliveLockClick={() => openUpgradeModal('golive_lock', clientId)}
            />
          ))}
        </div>
      </div>

      {/* How your agent sounds */}
      <div
        className="rounded-2xl px-4 py-3.5 flex items-center gap-3 card-surface"
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--color-accent-tint, rgba(37,99,235,0.1))' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-0.5"
            style={{ color: 'var(--color-text-3)' }}
          >
            How your agent sounds
          </p>
          <p className="text-[13px] leading-snug" style={{ color: 'var(--color-text-2)' }}>
            Speaks in a{' '}
            <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>
              {voiceLabel}
            </span>{' '}
            tone. Acts as{' '}
            <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>
              {agentName}
            </span>
            .
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=voice"
          className="text-[12px] font-medium shrink-0 hover:opacity-75 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          style={{ color: 'var(--color-primary)' }}
        >
          Edit
        </Link>
      </div>
    </div>
  )
}
