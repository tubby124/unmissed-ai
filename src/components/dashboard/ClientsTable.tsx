'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNicheConfig } from '@/lib/niche-config'
import { hasCapability } from '@/lib/niche-capabilities'

interface DriftSnapshot {
  chars_dropped: number | null
  status: string
  biggest_drop_section: string | null
  checked_at: string
}

interface Client {
  id: string
  slug: string
  business_name: string
  twilio_number: string | null
  niche?: string | null
  status?: string | null
  last_sign_in_at?: string | null
  drift?: DriftSnapshot | null
}

const PROTECTED_SLUGS = ['hasan-sharif', 'windshield-hub', 'urban-vibe', 'manzil-isa']

function isTestClient(client: Client): boolean {
  if (PROTECTED_SLUGS.includes(client.slug)) return false
  if (client.slug.startsWith('e2e-test-')) return true
  if (client.slug.startsWith('test-')) return true
  if (client.status === 'setup') return true
  return false
}

type FilterTab = 'all' | 'real' | 'test'

function StatusDot({ status }: { status: string | null | undefined }) {
  const s = status ?? 'setup'
  const color =
    s === 'active' ? 'bg-green-500' :
    s === 'setup' ? 'bg-amber-500' :
    s === 'paused' ? 'bg-red-500' :
    s === 'churned' ? 'bg-red-500' :
    'bg-zinc-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={s} />
}

function DriftChip({ drift }: { drift: DriftSnapshot | null | undefined }) {
  if (!drift) return null

  const checkedAt = new Date(drift.checked_at)
  const daysAgo = Math.floor((Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24))
  const stale = daysAgo > 14

  if (drift.status === 'legacy_monolithic') {
    return (
      <span
        title={`Snowflake — recompose blocked (D445 migration). Checked ${daysAgo}d ago.`}
        className="text-[10px] font-medium border rounded-full px-2 py-0.5"
        style={{ color: "var(--color-text-3)", borderColor: "var(--color-border)" }}
      >
        Snowflake
      </span>
    )
  }

  if (drift.status === 'error') {
    return (
      <span
        title={`Drift check errored. Checked ${daysAgo}d ago.`}
        className="text-[10px] font-medium border rounded-full px-2 py-0.5 border-red-500/20 bg-red-500/10 text-red-400"
      >
        Drift: error
      </span>
    )
  }

  const dropped = drift.chars_dropped ?? 0
  const formatted = dropped >= 1000 ? `${(dropped / 1000).toFixed(1)}K` : String(dropped)
  const titleSuffix = drift.biggest_drop_section ? ` — biggest drop: ${drift.biggest_drop_section}` : ''
  const baseTitle = `${dropped.toLocaleString()} chars would be dropped on recompose${titleSuffix}. Checked ${daysAgo}d ago.`

  if (dropped > 500) {
    return (
      <span
        title={baseTitle}
        className="text-[10px] font-medium border rounded-full px-2 py-0.5 border-red-500/20 bg-red-500/10 text-red-400"
      >
        Drift: {formatted}
      </span>
    )
  }
  if (dropped > 100) {
    return (
      <span
        title={baseTitle}
        className="text-[10px] font-medium border rounded-full px-2 py-0.5 border-amber-500/20 bg-amber-500/10 text-amber-400"
      >
        Drift: {formatted}
      </span>
    )
  }
  if (stale) {
    return (
      <span
        title={`No recent drift check (${daysAgo}d ago).`}
        className="text-[10px] font-medium border rounded-full px-2 py-0.5"
        style={{ color: "var(--color-text-3)", borderColor: "var(--color-border)" }}
      >
        Drift: stale
      </span>
    )
  }
  // Clean (≤100 chars dropped, recent) — no chip needed.
  return null
}

function DriftWatchSummary({ clients }: { clients: Client[] }) {
  const withDrift = clients.filter(c => c.drift && c.drift.status === 'ok' && (c.drift.chars_dropped ?? 0) > 100)
  const high = withDrift.filter(c => (c.drift!.chars_dropped ?? 0) > 500)
  const med = withDrift.filter(c => (c.drift!.chars_dropped ?? 0) > 100 && (c.drift!.chars_dropped ?? 0) <= 500)
  const snowflakes = clients.filter(c => c.drift?.status === 'legacy_monolithic')
  const checked = clients.filter(c => c.drift !== null && c.drift !== undefined)

  if (checked.length === 0) {
    return (
      <div
        className="rounded-xl border b-theme bg-surface px-4 py-3 mb-4 text-xs"
        style={{ color: "var(--color-text-3)" }}
      >
        <span className="font-medium" style={{ color: "var(--color-text-2)" }}>Drift watch:</span>
        {' '}no checks yet — run <code className="font-mono">npx tsx scripts/drift-check-all.ts</code> to populate.
      </div>
    )
  }

  if (high.length === 0 && med.length === 0) {
    return (
      <div
        className="rounded-xl border b-theme bg-surface px-4 py-3 mb-4 text-xs"
        style={{ color: "var(--color-text-3)" }}
      >
        <span className="font-medium" style={{ color: "var(--color-text-2)" }}>Drift watch:</span>
        {' '}all slot-pipeline clients clean ({checked.length} checked, {snowflakes.length} snowflake{snowflakes.length === 1 ? '' : 's'} excluded).
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 mb-4 text-xs">
      <div className="font-medium text-red-400 mb-1">
        Drift watch: {high.length} high · {med.length} medium · {snowflakes.length} snowflake
      </div>
      {high.length > 0 && (
        <div style={{ color: "var(--color-text-2)" }}>
          High-risk (chars dropped on recompose):{' '}
          {high.slice(0, 5).map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <span className="font-medium">{c.business_name}</span>
              {' '}
              <span className="text-red-400">({(c.drift!.chars_dropped ?? 0).toLocaleString()})</span>
            </span>
          ))}
          {high.length > 5 && <span style={{ color: "var(--color-text-3)" }}> + {high.length - 5} more</span>}
        </div>
      )}
    </div>
  )
}

function CapabilityIcons({ niche }: { niche: string | null | undefined }) {
  if (!niche) return null
  const icons: React.ReactElement[] = []

  if (hasCapability(niche, 'bookAppointments')) {
    icons.push(
      <span key="cal" title="Booking enabled" className="text-[10px]" style={{ color: "var(--color-text-3)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </span>
    )
  }

  if (hasCapability(niche, 'transferCalls')) {
    icons.push(
      <span key="xfer" title="Transfer enabled" className="text-[10px]" style={{ color: "var(--color-text-3)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 14 20 9 15 4"/>
          <path d="M4 20v-7a4 4 0 014-4h12"/>
        </svg>
      </span>
    )
  }

  if (hasCapability(niche, 'useKnowledgeLookup')) {
    icons.push(
      <span key="kb" title="Knowledge base" className="text-[10px]" style={{ color: "var(--color-text-3)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
      </span>
    )
  }

  if (icons.length === 0) return null
  return <div className="flex items-center gap-1.5">{icons}</div>
}

function ActiveClientCard({ client, onDeleted }: { client: Client; onDeleted: () => void }) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isProtected = PROTECTED_SLUGS.includes(client.slug)
  const isTest = isTestClient(client)
  const nicheConfig = getNicheConfig(client.niche)

  function copyPhone() {
    if (!client.twilio_number) return
    navigator.clipboard.writeText(client.twilio_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/cleanup-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSlug: client.slug, deleteUltravox: true }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error || 'Cleanup failed')
        return
      }
      onDeleted()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className={`rounded-xl border b-theme bg-surface overflow-hidden transition-opacity ${isTest ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
          <span className="text-green-400 text-xs font-bold">{client.business_name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-1)" }}>{client.business_name}</p>
            <StatusDot status={client.status} />
          </div>
          {client.last_sign_in_at && (
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-3)" }}>
              Last login {new Date(client.last_sign_in_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            {client.twilio_number ? (
              <button
                onClick={copyPhone}
                className="text-xs font-mono hover:underline transition-colors"
                style={{ color: "var(--color-text-3)" }}
                title="Click to copy"
              >
                {copied ? 'Copied!' : client.twilio_number}
              </button>
            ) : (
              <span className="text-xs" style={{ color: "var(--color-text-3)" }}>No number</span>
            )}
            {nicheConfig && (
              <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${nicheConfig.color} ${nicheConfig.bg} ${nicheConfig.border}`}>
                {nicheConfig.label}
              </span>
            )}
            <DriftChip drift={client.drift} />
            <CapabilityIcons niche={client.niche} />
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <a
          href={`/dashboard/settings?client_id=${client.id}`}
          className="text-[10px] font-medium border rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: "var(--color-text-2)", borderColor: "var(--color-border)" }}
        >
          Settings
        </a>
        <a
          href={`/dashboard/lab?client_id=${client.id}`}
          className="text-[10px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          Lab
        </a>
        <a
          href={`/dashboard/live?client_id=${client.id}`}
          className="text-[10px] font-medium border rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: "var(--color-text-2)", borderColor: "var(--color-border)" }}
        >
          Live
        </a>
        <a
          href={`/dashboard/calls?client_id=${client.id}`}
          className="text-[10px] font-medium border rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: "var(--color-text-2)", borderColor: "var(--color-border)" }}
        >
          Calls
        </a>

        {!isProtected && !client.twilio_number && (
          <div className="ml-auto">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-3 py-1.5 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400">Delete {client.slug}?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[10px] font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] rounded-lg px-2 py-1.5 hover:bg-[var(--color-hover)] transition-colors"
                  style={{ color: "var(--color-text-3)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientsTable({ clients }: {
  clients: Client[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterTab>('all')

  const realClients = clients.filter(c => !isTestClient(c))
  const testClients = clients.filter(c => isTestClient(c))
  const filtered =
    filter === 'real' ? realClients :
    filter === 'test' ? testClients :
    clients

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: clients.length },
    { key: 'real', label: 'Real', count: realClients.length },
    { key: 'test', label: 'Test', count: testClients.length },
  ]

  return (
    <>
      <DriftWatchSummary clients={clients} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filter === tab.key
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'hover:bg-[var(--color-hover)]'
            }`}
            style={filter !== tab.key ? { color: "var(--color-text-3)", borderColor: "var(--color-border)" } : undefined}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Client cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--color-text-3)" }}>
            No clients match this filter
          </div>
        ) : (
          filtered.map(c => (
            <ActiveClientCard key={c.id} client={c} onDeleted={() => router.refresh()} />
          ))
        )}
      </div>
    </>
  )
}
