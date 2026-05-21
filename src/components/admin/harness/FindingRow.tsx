'use client'

/**
 * FindingRow — collapsible row in the findings list.
 *
 * Collapsed: severity badge + harness/check_name + client_slug + last_seen +
 * status badge.
 *
 * Expanded: full details JSON (pretty-printed) + action buttons (Resolve /
 * Suppress until <date> / Reopen / View Details).
 *
 * Mutations hit PATCH /api/admin/harness/findings; on success we router.refresh()
 * so the page re-aggregates the cards.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import StatusBadge from './StatusBadge'
import type { Severity, Status, HarnessName } from '@/lib/harness-writer'

export interface FindingRowData {
  id: string
  harness_name: HarnessName
  run_id: string
  check_name: string
  severity: Severity
  status: Status
  client_slug: string | null
  summary: string
  details: Record<string, unknown>
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  suppressed_until: string | null
}

function formatIso(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + 'Z'
  } catch {
    return iso
  }
}

export default function FindingRow({ finding }: { finding: FindingRowData }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [suppressDate, setSuppressDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function act(action: 'resolve' | 'suppress' | 'reopen') {
    setErrorMsg(null)
    const body: Record<string, unknown> = { id: finding.id, action }
    if (action === 'suppress') body.until = `${suppressDate}T00:00:00Z`
    const res = await fetch('/api/admin/harness/findings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      setErrorMsg(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`)
      return
    }
    startTransition(() => router.refresh())
  }

  const sevVariant: 'P0' | 'P1' | 'P2' | 'PASS' = finding.severity

  return (
    <div
      className="rounded-xl card-surface overflow-hidden"
      style={{ opacity: pending ? 0.65 : 1 }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <StatusBadge variant={sevVariant} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium t1 truncate">{finding.summary}</p>
          <p className="text-[10px] mt-0.5 t3 font-mono truncate">
            {finding.harness_name} · {finding.check_name}
            {finding.client_slug ? ` · ${finding.client_slug}` : ''}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
          <StatusBadge variant={finding.status} />
          <span className="text-[10px] t3 font-mono">{formatIso(finding.last_seen_at)}</span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
          style={{ color: 'var(--color-text-3)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
            <Meta label="First seen" value={formatIso(finding.first_seen_at)} />
            <Meta label="Last seen" value={formatIso(finding.last_seen_at)} />
            <Meta label="Run id" value={finding.run_id} mono />
            {finding.resolved_at && <Meta label="Resolved at" value={formatIso(finding.resolved_at)} />}
            {finding.suppressed_until && <Meta label="Suppressed until" value={formatIso(finding.suppressed_until)} />}
          </div>

          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase t3 mb-1">
              Details
            </p>
            <pre
              className="text-[11px] p-2 rounded-md overflow-x-auto font-mono leading-snug"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
            >
              {JSON.stringify(finding.details ?? {}, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {finding.status !== 'resolved' && (
              <ActionButton onClick={() => act('resolve')} disabled={pending} tone="green">
                Mark Resolved
              </ActionButton>
            )}
            {finding.status === 'resolved' && (
              <ActionButton onClick={() => act('reopen')} disabled={pending} tone="amber">
                Reopen
              </ActionButton>
            )}
            {finding.status !== 'suppressed' && (
              <>
                <input
                  type="date"
                  value={suppressDate}
                  onChange={e => setSuppressDate(e.target.value)}
                  className="text-[11px] px-2 py-1 rounded-md border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
                />
                <ActionButton onClick={() => act('suppress')} disabled={pending} tone="slate">
                  Suppress until →
                </ActionButton>
              </>
            )}
            {errorMsg && (
              <span className="text-[11px]" style={{ color: 'rgb(248,113,113)' }}>
                {errorMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold tracking-[0.14em] uppercase t3">{label}</p>
      <p className={`text-[11px] t2 ${mono ? 'font-mono break-all' : ''}`}>{value}</p>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone: 'green' | 'amber' | 'slate'
}) {
  const palette = {
    green: { bg: 'rgba(34,197,94,0.12)', color: 'rgb(74,222,128)', border: 'rgba(34,197,94,0.3)' },
    amber: { bg: 'rgba(245,158,11,0.12)', color: 'rgb(251,191,36)', border: 'rgba(245,158,11,0.3)' },
    slate: { bg: 'rgba(148,163,184,0.10)', color: 'rgb(148,163,184)', border: 'rgba(148,163,184,0.25)' },
  }[tone]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{
        backgroundColor: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
    >
      {children}
    </button>
  )
}
