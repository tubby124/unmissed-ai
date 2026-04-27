'use client'

/**
 * NotificationsBlock — Go Live "How you'll be notified" section.
 *
 * Three read-only summary rows + deep-links into Settings:
 *   1. Telegram alerts          → /dashboard/settings?tab=notifications
 *   2. SMS auto-text reply      → /dashboard/settings?tab=sms
 *   3. Voicemail greeting       → /dashboard/settings?tab=general
 *
 * Editing happens on Settings — this block exists so the Go Live operator
 * can confirm at a glance that the caller-facing follow-up + their own
 * alert path are both wired before they tell anyone the number.
 */

import Link from 'next/link'

interface Props {
  telegramConnected: boolean
  smsEnabled: boolean
  smsTemplate: string | null
  voicemailGreetingText: string | null
}

export default function NotificationsBlock({
  telegramConnected,
  smsEnabled,
  smsTemplate,
  voicemailGreetingText,
}: Props) {
  return (
    <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">How you&apos;ll be notified</h3>
        <p className="text-sm text-zinc-600 mt-0.5">
          What the caller hears back, and how you find out.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        <Row
          icon={<TelegramIcon />}
          title="Telegram alerts"
          subtitle={
            telegramConnected
              ? "We'll ping you the moment a call comes in."
              : 'Connect Telegram to get instant call alerts.'
          }
          status={telegramConnected ? { tone: 'green', label: 'Connected' } : { tone: 'gray', label: 'Not set up' }}
          href="/dashboard/settings?tab=notifications"
          linkLabel={telegramConnected ? 'Manage' : 'Connect'}
        />

        <Row
          icon={<SmsIcon />}
          title="Auto-text reply"
          subtitle={
            smsEnabled && smsTemplate
              ? truncate(smsTemplate, 90)
              : smsEnabled
                ? 'Default confirmation will be sent after each call.'
                : 'Send the caller a confirmation text after every call.'
          }
          status={smsEnabled ? { tone: 'green', label: 'On' } : { tone: 'gray', label: 'Off' }}
          href="/dashboard/settings?tab=sms"
          linkLabel="Edit"
        />

        <Row
          icon={<VoicemailIcon />}
          title="Voicemail greeting"
          subtitle={
            voicemailGreetingText
              ? truncate(voicemailGreetingText, 90)
              : 'Plays only if the agent is unreachable.'
          }
          status={voicemailGreetingText ? { tone: 'green', label: 'Set' } : { tone: 'gray', label: 'Default' }}
          href="/dashboard/settings?tab=general"
          linkLabel="Edit"
        />
      </ul>
    </div>
  )
}

function Row({
  icon,
  title,
  subtitle,
  status,
  href,
  linkLabel,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  status: { tone: 'green' | 'gray'; label: string }
  href: string
  linkLabel: string
}) {
  const pillCls =
    status.tone === 'green'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-zinc-50 text-zinc-600 border-zinc-200'

  return (
    <li className="py-3 flex items-start gap-3">
      <span className="shrink-0 mt-0.5 text-zinc-500" aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900">{title}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${pillCls}`}
          >
            {status.label}
          </span>
        </div>
        <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-xs font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
      >
        {linkLabel}
      </Link>
    </li>
  )
}

function truncate(s: string, n: number): string {
  const t = s.trim()
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3L3 10.5l7 1.5 2 5 3-3 5 3L21 3z" />
    </svg>
  )
}

function SmsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function VoicemailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="14" r="4" />
      <circle cx="18" cy="14" r="4" />
      <line x1="6" y1="18" x2="18" y2="18" />
    </svg>
  )
}
