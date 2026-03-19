'use client'

import { useAdminClient } from '@/contexts/AdminClientContext'

export default function ScopedClientLabel() {
  const { selectedClient, isAdmin } = useAdminClient()

  if (!isAdmin || !selectedClient) return null

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
      style={{ color: 'var(--color-text-2)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
      Scoped to: {selectedClient.business_name}
    </span>
  )
}
