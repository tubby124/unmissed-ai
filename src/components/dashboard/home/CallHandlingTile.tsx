'use client'

/**
 * CallHandlingTile — 4-row capability status card.
 * SMS | Booking | Transfer | Knowledge base
 * Each row has 4 possible states: not-on-plan | not-configured | partial | active
 */

import { getPlanEntitlements } from '@/lib/plan-entitlements'

interface Capabilities {
  hasKnowledge: boolean
  hasBooking: boolean
  hasSms: boolean
  hasTransfer: boolean
}

interface Props {
  selectedPlan: string | null
  subscriptionStatus: string | null
  capabilities: Capabilities
  knowledge: { approved_chunk_count: number }
  callHandlingMode?: string | null
  onOpenSheet?: (sheet: 'forwarding' | 'notifications') => void
}

const MODE_MAP: Record<string, { label: string; desc: string }> = {
  voicemail_replacement: {
    label: 'Smart Voicemail',
    desc: 'Takes messages and handles calls when you\'re busy.',
  },
  receptionist: {
    label: 'Receptionist',
    desc: 'Answers calls, qualifies leads, and connects them to you.',
  },
  full_service: {
    label: 'Receptionist + Booking',
    desc: 'Books appointments and manages inquiries end to end.',
  },
}

type RowState = 'not-on-plan' | 'not-configured' | 'partial' | 'active'

interface Row {
  label: string
  state: RowState
  detail: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

function StateIndicator({ state }: { state: RowState }) {
  if (state === 'active') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Active
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Partial
      </span>
    )
  }
  if (state === 'not-configured') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold t3 px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--color-hover)' }}>
        Setup needed
      </span>
    )
  }
  // not-on-plan
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold t3 px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--color-hover)' }}>
      Not on plan
    </span>
  )
}

export default function CallHandlingTile({
  selectedPlan,
  subscriptionStatus,
  capabilities,
  knowledge,
  callHandlingMode,
  onOpenSheet,
}: Props) {
  const modeInfo = callHandlingMode ? (MODE_MAP[callHandlingMode] ?? null) : null
  const modeLabel = modeInfo?.label ?? 'Basic Answering'
  const modeDesc = modeInfo?.desc ?? 'Answers calls and provides information about your business.'
  const planId: Parameters<typeof getPlanEntitlements>[0] = subscriptionStatus === 'trialing' ? 'trial'
    : subscriptionStatus ? (selectedPlan ?? null)
    : null
  const plan = getPlanEntitlements(planId)

  const rows: Row[] = [
    // SMS
    {
      label: 'SMS follow-up',
      state: !plan.smsEnabled ? 'not-on-plan' : capabilities.hasSms ? 'active' : 'not-configured',
      detail: !plan.smsEnabled
        ? 'Core / Pro plans'
        : capabilities.hasSms
        ? 'Sends texts after calls'
        : 'Requires phone number',
    },
    // Booking
    {
      label: 'Calendar booking',
      state: !plan.bookingEnabled ? 'not-on-plan' : capabilities.hasBooking ? 'active' : 'not-configured',
      detail: !plan.bookingEnabled
        ? 'Pro plan only'
        : capabilities.hasBooking
        ? 'Calendar connected'
        : 'Connect your calendar',
      actionLabel: !plan.bookingEnabled ? undefined : capabilities.hasBooking ? undefined : 'Connect',
      actionHref: capabilities.hasBooking ? undefined : '/dashboard/settings?tab=general',
    },
    // Transfer
    {
      label: 'Live transfer',
      state: !plan.transferEnabled ? 'not-on-plan' : capabilities.hasTransfer ? 'active' : 'not-configured',
      detail: !plan.transferEnabled
        ? 'Pro plan only'
        : capabilities.hasTransfer
        ? 'Forwarding configured'
        : 'No forwarding number',
      actionLabel: !plan.transferEnabled ? undefined : capabilities.hasTransfer ? undefined : 'Set up',
      onAction: (!plan.transferEnabled || capabilities.hasTransfer) ? undefined : () => onOpenSheet?.('forwarding'),
    },
    // Knowledge base
    {
      label: 'Knowledge base',
      state: !plan.knowledgeEnabled
        ? 'not-on-plan'
        : capabilities.hasKnowledge && knowledge.approved_chunk_count > 0
        ? 'active'
        : capabilities.hasKnowledge
        ? 'partial'
        : 'not-configured',
      detail: !plan.knowledgeEnabled
        ? 'Core / Pro plans'
        : knowledge.approved_chunk_count > 0
        ? `${knowledge.approved_chunk_count} chunks indexed`
        : 'No content approved yet',
    },
  ]

  return (
    <div className="rounded-2xl p-4 card-surface flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Call Handling</p>
      </div>

      {/* Mode pill */}
      <div className="pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}
          >
            {modeLabel}
          </span>
          <a
            href="/dashboard/settings?tab=general"
            className="flex items-center gap-0.5 text-[10px] font-medium hover:opacity-75 transition-opacity shrink-0"
            style={{ color: 'var(--color-text-3)' }}
          >
            Change
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <p className="text-[11px] t3 mt-1 leading-relaxed">{modeDesc}</p>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium t2 truncate">{row.label}</p>
              <p className="text-[11px] t3 truncate">{row.detail}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StateIndicator state={row.state} />
              {row.actionLabel && (
                row.actionHref ? (
                  <a
                    href={row.actionHref}
                    className="text-[10px] font-semibold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {row.actionLabel}
                  </a>
                ) : row.onAction ? (
                  <button
                    onClick={row.onAction}
                    className="text-[10px] font-semibold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {row.actionLabel}
                  </button>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade nudge for not-on-plan items */}
      {rows.some(r => r.state === 'not-on-plan') && (
        <a
          href="/dashboard/billing"
          className="text-[11px] font-semibold self-start"
          style={{ color: 'var(--color-primary)' }}
        >
          Upgrade to unlock more →
        </a>
      )}
    </div>
  )
}
