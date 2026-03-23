'use client'

import { useState } from 'react'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
  const { selectedClient, isAdmin, previewMode, exitPreview } = useAdminClient()
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!isAdmin || !selectedClient) return null

  function enterPreview() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('preview', 'true')
    params.set('client_id', selectedClient!.id)
    router.push(`/dashboard?${params.toString()}`)
  }

  // Preview mode: full-width amber banner replaces normal strip
  if (previewMode) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-amber-500/10 border-amber-500/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span className="text-xs font-semibold text-amber-400">
          Viewing as {selectedClient.business_name} — Read Only
        </span>
        <div className="flex-1" />
        <button
          onClick={exitPreview}
          className="text-[11px] font-semibold px-3 py-1 rounded-md border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          Exit Preview
        </button>
      </div>
    )
  }

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
        <button
          onClick={enterPreview}
          className="px-2 py-1 rounded-md transition-colors font-medium flex items-center gap-1"
          style={{ color: 'var(--color-primary)' }}
          title="View dashboard as this client sees it"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Cloak
        </button>
      </div>
    </div>
  )
}
