"use client"

import EmptyStateBase from "./EmptyStateBase"

const PhoneIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
    <path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 016.18 12.8a19.79 19.79 0 01-3.07-8.63A2 2 0 015.09 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function NoCalls() {
  return (
    <EmptyStateBase
      icon={PhoneIcon}
      title="No calls yet"
      description="Your agent is ready. Forward your calls to your unmissed number and your first call will show here."
      accentColor="rgba(59,130,246,0.12)"
      cta={{ label: "Set up call forwarding →", href: "/dashboard" }}
    />
  )
}
