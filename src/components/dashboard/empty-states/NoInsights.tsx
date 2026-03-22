"use client"

import EmptyStateBase from "./EmptyStateBase"

const ChartIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
    <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function NoInsights() {
  return (
    <EmptyStateBase
      icon={ChartIcon}
      title="Not enough data yet"
      description="After your agent handles a few calls, insights and trends will appear here."
      accentColor="rgba(99,102,241,0.12)"
    />
  )
}
