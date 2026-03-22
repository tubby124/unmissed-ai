"use client"

import EmptyStateBase from "./EmptyStateBase"

const BellIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
    <path
      d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.73 21a2 2 0 01-3.46 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function NoNotifications() {
  return (
    <EmptyStateBase
      icon={BellIcon}
      title="No notifications yet"
      description="Notifications appear when your agent sends SMS, email, or Telegram alerts during calls."
      accentColor="rgba(245,158,11,0.12)"
    />
  )
}
