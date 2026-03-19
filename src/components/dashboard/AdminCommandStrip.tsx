'use client'

import { useState } from 'react'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { NICHE_CONFIG } from '@/lib/niche-config'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

export default function AdminCommandStrip() {
  const { selectedClient, isAdmin } = useAdminClient()
  const [copied, setCopied] = useState(false)

  if (!isAdmin || !selectedClient) return null

  const nicheConfig = selectedClient.niche ? NICHE_CONFIG[selectedClient.niche] : null
  const statusColor = selectedClient.status === 'active'
    ? 'bg-green-500'
    : selectedClient.status === 'paused'
      ? 'bg-amber-500'
      : 'bg-zinc-400'

  function copyPhone() {
    if (!selectedClient?.twilio_number) return
    navigator.clipboard.writeText(selectedClient.twilio_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const actions = [
    { label: 'Calls', href: `/dashboard/calls?client_id=${selectedClient.id}` },
    { label: 'Live', href: `/dashboard/live?client_id=${selectedClient.id}` },
    { label: 'Lab', href: `/dashboard/lab?client_id=${selectedClient.id}` },
    { label: 'Settings', href: `/dashboard/settings?client_id=${selectedClient.id}` },
  ]

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b text-xs"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Status dot + name */}
      <span className="flex items-center gap-1.5 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
        <span className="font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
          {selectedClient.business_name}
        </span>
      </span>

      {/* Niche badge */}
      {nicheConfig && (
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${nicheConfig.color} ${nicheConfig.border} ${nicheConfig.bg}`}>
          {nicheConfig.label}
        </span>
      )}

      {/* Phone */}
      {selectedClient.twilio_number && (
        <button
          onClick={copyPhone}
          className="shrink-0 font-mono hover:bg-[var(--color-hover)] px-1.5 py-0.5 rounded transition-colors"
          style={{ color: 'var(--color-text-2)' }}
          title="Copy phone number"
        >
          {copied ? 'Copied!' : formatPhone(selectedClient.twilio_number)}
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action links */}
      <div className="flex items-center gap-1">
        {actions.map(a => (
          <a
            key={a.label}
            href={a.href}
            className="px-2 py-1 rounded-md hover:bg-[var(--color-hover)] transition-colors font-medium"
            style={{ color: 'var(--color-text-2)' }}
          >
            {a.label}
          </a>
        ))}
      </div>
    </div>
  )
}
