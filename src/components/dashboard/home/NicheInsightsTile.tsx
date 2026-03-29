'use client'

import Link from 'next/link'
import type { HomeData } from '../ClientHome'
import type { useHomeSheet } from '@/hooks/useHomeSheet'

interface Props {
  niche: string | null
  capabilities: HomeData['capabilities']
  knowledge: HomeData['knowledge']
  onboarding: HomeData['onboarding']
  sheet: ReturnType<typeof useHomeSheet>
}

interface Nudge {
  id: string
  icon: React.ReactNode
  text: string
  cta: string
  done: boolean
  onAction?: () => void
  href?: string
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(34,197,94)', flexShrink: 0 }}>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SmsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function buildNudges(
  niche: string | null,
  capabilities: HomeData['capabilities'],
  knowledge: HomeData['knowledge'],
  onboarding: HomeData['onboarding'],
  sheet: ReturnType<typeof useHomeSheet>,
): Nudge[] {
  const hasKnowledgeContent = capabilities.hasKnowledge && knowledge.approved_chunk_count > 0
  const hasCalendar = capabilities.hasBooking
  const hasSms = capabilities.hasSms
  const hasTelegram = onboarding.telegramConnected
  const hasHours = capabilities.hasHours
  const hasFacts = capabilities.hasFacts

  const n = (niche ?? 'other').toLowerCase().replace(/-/g, '_')

  if (n === 'real_estate' || n === 'isa' || n === 'outbound_isa_realtor') {
    return [
      {
        id: 'listings',
        icon: <BookIcon />,
        text: 'Add your active listings so your agent can discuss pricing and availability.',
        cta: 'Add knowledge',
        done: hasKnowledgeContent,
        onAction: () => sheet.open('knowledge'),
      },
      {
        id: 'calendar',
        icon: <CalIcon />,
        text: 'Connect your calendar so your agent can book showings directly.',
        cta: 'Connect',
        done: hasCalendar,
        href: '/dashboard/settings?tab=general',
      },
      {
        id: 'sms',
        icon: <SmsIcon />,
        text: 'Enable SMS so your agent can send follow-up texts after calls.',
        cta: 'Enable',
        done: hasSms,
        href: '/dashboard/settings?tab=sms',
      },
    ]
  }

  if (n === 'auto_glass' || n === 'auto') {
    return [
      {
        id: 'insurance',
        icon: <BookIcon />,
        text: 'Add your insurance partners as business facts so your agent can answer coverage questions.',
        cta: 'Add facts',
        done: hasKnowledgeContent || hasFacts,
        onAction: () => sheet.open('knowledge'),
      },
      {
        id: 'sms',
        icon: <SmsIcon />,
        text: 'Enable SMS so your agent can send estimate confirmations after calls.',
        cta: 'Enable',
        done: hasSms,
        href: '/dashboard/settings?tab=sms',
      },
    ]
  }

  if (n === 'restaurant' || n === 'salon') {
    return [
      {
        id: 'menu',
        icon: <BookIcon />,
        text: 'Add your menu or service list so your agent can answer questions about what you offer.',
        cta: 'Add facts',
        done: hasKnowledgeContent || hasFacts,
        onAction: () => sheet.open('knowledge'),
      },
      {
        id: 'hours',
        icon: <ClockIcon />,
        text: 'Set your hours so your agent can tell callers when you\'re open.',
        cta: 'Set hours',
        done: hasHours,
        onAction: () => sheet.open('hours'),
      },
    ]
  }

  if (n === 'hvac' || n === 'plumbing' || n === 'dental' || n === 'legal' || n === 'print_shop') {
    return [
      {
        id: 'facts',
        icon: <BookIcon />,
        text: 'Add your service details so your agent can answer questions callers ask most.',
        cta: 'Add facts',
        done: hasKnowledgeContent || hasFacts,
        onAction: () => sheet.open('knowledge'),
      },
      {
        id: 'sms',
        icon: <SmsIcon />,
        text: 'Enable SMS so your agent can send follow-up texts with your contact info.',
        cta: 'Enable',
        done: hasSms,
        href: '/dashboard/settings?tab=sms',
      },
    ]
  }

  // Generic fallback — 2 most impactful unconfigured items
  const pending: Nudge[] = []
  if (!hasFacts && !hasKnowledgeContent) {
    pending.push({
      id: 'facts',
      icon: <BookIcon />,
      text: 'Add business facts so your agent can answer questions specific to your business.',
      cta: 'Add facts',
      done: false,
      onAction: () => sheet.open('knowledge'),
    })
  }
  if (!hasTelegram) {
    pending.push({
      id: 'telegram',
      icon: <BellIcon />,
      text: 'Connect Telegram to get instant call alerts sent to your phone.',
      cta: 'Connect',
      done: false,
      onAction: () => sheet.open('notifications'),
    })
  }
  if (!hasHours && pending.length < 2) {
    pending.push({
      id: 'hours',
      icon: <ClockIcon />,
      text: 'Set your hours so your agent knows when to suggest calling back.',
      cta: 'Set hours',
      done: false,
      onAction: () => sheet.open('hours'),
    })
  }
  return pending.slice(0, 2)
}

export default function NicheInsightsTile({ niche, capabilities, knowledge, onboarding, sheet }: Props) {
  const nudges = buildNudges(niche, capabilities, knowledge, onboarding, sheet)
  const pendingCount = nudges.filter(n => !n.done).length

  // Don't render if everything is done or no nudges
  if (nudges.length === 0 || pendingCount === 0) return null

  return (
    <div className="rounded-2xl p-4 card-surface flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Setup tips</p>
        </div>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}
        >
          {pendingCount} to go
        </span>
      </div>

      {/* Nudge rows */}
      <div className="space-y-2">
        {nudges.map(nudge => (
          <div
            key={nudge.id}
            className="flex items-start gap-2.5 p-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <div className="mt-0.5">
              {nudge.done ? <Check /> : nudge.icon}
            </div>
            <p className={`flex-1 text-[12px] leading-relaxed ${nudge.done ? 'line-through t3' : 't2'}`}>
              {nudge.text}
            </p>
            {!nudge.done && (
              nudge.href ? (
                <Link
                  href={nudge.href}
                  className="text-[10px] font-semibold shrink-0 hover:opacity-75 transition-opacity whitespace-nowrap"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {nudge.cta} →
                </Link>
              ) : nudge.onAction ? (
                <button
                  onClick={nudge.onAction}
                  className="text-[10px] font-semibold shrink-0 hover:opacity-75 transition-opacity whitespace-nowrap cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {nudge.cta} →
                </button>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
