'use client'

/**
 * NotificationRow — collapsible row in the admin notifications list.
 *
 * Collapsed: timestamp + client + channel + status badge + recipient + content preview.
 * Expanded: full content + error (if any) + external_id + "View lifecycle" button.
 *
 * Status colors map to delivery state truth:
 *   sent       — neutral (Resend accepted, not yet delivered)
 *   delivered  — green
 *   opened     — green (pixel tracking)
 *   clicked    — green (link tracking)
 *   failed     — red
 *   bounced    — red
 *   complained — red (marked spam)
 *   delayed    — amber (soft bounce, will retry)
 *   other      — neutral
 */

import { useState } from 'react'
import LifecycleDrawer from './LifecycleDrawer'

export interface NotificationRowData {
  id: string
  client_id: string | null
  client_slug: string | null
  business_name: string | null
  channel: string
  recipient: string | null
  content: string | null
  status: string | null
  error: string | null
  external_id: string | null
  created_at: string
}

function statusColor(status: string | null): { bg: string; fg: string } {
  switch (status) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return { bg: 'rgba(34,197,94,0.12)',  fg: 'rgb(34,197,94)'   }
    case 'failed':
    case 'bounced':
    case 'complained':
      return { bg: 'rgba(239,68,68,0.12)',  fg: 'rgb(239,68,68)'   }
    case 'delayed':
      return { bg: 'rgba(245,158,11,0.12)', fg: 'rgb(245,158,11)' }
    default:
      return { bg: 'rgba(148,163,184,0.12)', fg: 'rgb(148,163,184)' }
  }
}

function channelColor(channel: string): { bg: string; fg: string } {
  switch (channel) {
    case 'email':
      return { bg: 'rgba(99,102,241,0.12)', fg: 'rgb(129,140,248)' }
    case 'telegram':
      return { bg: 'rgba(14,165,233,0.12)', fg: 'rgb(56,189,248)'  }
    case 'sms':
      return { bg: 'rgba(34,197,94,0.12)',  fg: 'rgb(74,222,128)'  }
    default:
      return { bg: 'rgba(148,163,184,0.12)', fg: 'rgb(148,163,184)' }
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-CA', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return iso
  }
}

function preview(content: string | null, n = 120): string {
  if (!content) return '—'
  const stripped = content.replace(/\s+/g, ' ').trim()
  return stripped.length > n ? stripped.slice(0, n) + '…' : stripped
}

export default function NotificationRow({ row }: { row: NotificationRowData }) {
  const [expanded, setExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sc = statusColor(row.status)
  const cc = channelColor(row.channel)

  return (
    <>
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Collapsed row */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
        >
          {/* timestamp */}
          <span
            className="text-[11px] font-mono shrink-0 w-[88px]"
            style={{ color: 'var(--color-text-3)' }}
          >
            {formatTimestamp(row.created_at)}
          </span>

          {/* client */}
          <span className="text-[12px] font-medium shrink-0 w-[180px] truncate" style={{ color: 'var(--color-text-1)' }}>
            {row.business_name ?? row.client_slug ?? '—'}
          </span>

          {/* channel badge */}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0"
            style={{ backgroundColor: cc.bg, color: cc.fg }}
          >
            {row.channel}
          </span>

          {/* status badge */}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0"
            style={{ backgroundColor: sc.bg, color: sc.fg }}
          >
            {row.status ?? 'unknown'}
          </span>

          {/* recipient */}
          <span className="text-[11px] shrink-0 w-[160px] truncate" style={{ color: 'var(--color-text-2)' }}>
            {row.recipient ?? '—'}
          </span>

          {/* content preview */}
          <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-2)' }}>
            {preview(row.content)}
          </span>

          {/* chevron */}
          <span className="text-[11px] shrink-0" style={{ color: 'var(--color-text-3)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div
            className="px-3 pb-3 pt-1 space-y-2 text-[12px]"
            style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}
          >
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Recipient</div>
                <div className="font-mono text-[11px] break-all">{row.recipient ?? '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>External ID</div>
                <div className="font-mono text-[11px] break-all">{row.external_id ?? '—'}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Content</div>
              <pre
                className="text-[11px] whitespace-pre-wrap font-mono p-2 rounded max-h-[300px] overflow-auto"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                {row.content ?? '—'}
              </pre>
            </div>

            {row.error && (
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgb(239,68,68)' }}>Error</div>
                <pre
                  className="text-[11px] whitespace-pre-wrap font-mono p-2 rounded"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: 'rgb(248,113,113)',
                  }}
                >
                  {row.error}
                </pre>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {row.client_slug && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="px-3 py-1.5 rounded-md text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                >
                  View {row.business_name ?? row.client_slug} lifecycle →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {row.client_slug && drawerOpen && (
        <LifecycleDrawer slug={row.client_slug} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  )
}
