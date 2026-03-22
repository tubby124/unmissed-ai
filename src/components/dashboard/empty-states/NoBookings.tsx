"use client"

import EmptyStateBase from "./EmptyStateBase"

const CalendarIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function NoBookings() {
  return (
    <EmptyStateBase
      icon={CalendarIcon}
      title="No bookings yet"
      description="When callers book appointments through your agent, they'll appear here."
      accentColor="rgba(16,185,129,0.12)"
      cta={{ label: "Set up booking", href: "/dashboard/settings" }}
    />
  )
}
