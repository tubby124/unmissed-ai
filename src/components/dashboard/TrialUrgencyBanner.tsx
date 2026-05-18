'use client'

/**
 * TrialUrgencyBanner — non-dismissible top-of-dashboard banner for users
 * in the final 3 days of their trial. Always visible across every dashboard
 * page so the upgrade decision stays in the user's face.
 *
 * Renders nothing if:
 *   - subscriptionStatus !== 'trialing'
 *   - trialExpiresAt is null
 *   - daysLeft > 3 (let TrialWelcomeBanner handle the early-trial state)
 *
 * Differs from TrialWelcomeBanner: that one is dismissible and home-page only.
 * This is persistent, layout-level, and only fires when conversion urgency matters.
 */

import Link from 'next/link'

interface Props {
  subscriptionStatus: string | null
  trialExpiresAt: string | null
}

export default function TrialUrgencyBanner({ subscriptionStatus, trialExpiresAt }: Props) {
  if (subscriptionStatus !== 'trialing' || !trialExpiresAt) return null

  const expiresMs = new Date(trialExpiresAt).getTime()
  const nowMs = Date.now()
  const msLeft = expiresMs - nowMs

  if (msLeft <= 0) {
    return (
      <div
        className="px-4 py-2.5 text-center"
        style={{ backgroundColor: 'rgba(239,68,68,0.10)', borderBottom: '1px solid rgba(239,68,68,0.30)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'rgb(239,68,68)' }}>
          Trial expired — your agent is paused.
        </span>
        <Link
          href="/dashboard/billing"
          className="ml-3 text-sm font-semibold underline"
          style={{ color: 'rgb(239,68,68)' }}
        >
          Add a card to reactivate →
        </Link>
      </div>
    )
  }

  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000))
  if (daysLeft > 3) return null

  const isFinalDay = daysLeft <= 1
  const bg = isFinalDay ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)'
  const border = isFinalDay ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'
  const color = isFinalDay ? 'rgb(239,68,68)' : 'rgb(245,158,11)'

  const text = isFinalDay
    ? `Last day of your trial — add a card to keep your agent answering.`
    : `${daysLeft} days left in your trial — add a card to keep your agent.`

  return (
    <div
      className="px-4 py-2.5 text-center"
      style={{ backgroundColor: bg, borderBottom: `1px solid ${border}` }}
    >
      <span className="text-sm font-semibold" style={{ color }}>
        {text}
      </span>
      <Link
        href="/dashboard/billing"
        className="ml-3 text-sm font-semibold underline"
        style={{ color }}
      >
        Choose a plan →
      </Link>
    </div>
  )
}
