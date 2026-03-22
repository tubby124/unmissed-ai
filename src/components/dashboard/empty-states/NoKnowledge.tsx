"use client"

import EmptyStateBase from "./EmptyStateBase"

const BookIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
    <path
      d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function NoKnowledge() {
  return (
    <EmptyStateBase
      icon={BookIcon}
      title="Your agent starts smart"
      description="Add FAQs, service details, or upload docs to make your agent an expert on your business."
      accentColor="rgba(167,139,250,0.12)"
      cta={{ label: "Add Knowledge", href: "/dashboard/settings" }}
    />
  )
}
