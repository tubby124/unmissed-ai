/**
 * HarnessCard — per-harness status card for /dashboard/admin/harness.
 *
 * Renders harness name, last-seen-at, and open-finding counts by severity.
 * Reads from a pre-aggregated summary object so the dashboard avoids N+1
 * queries — the page server-aggregates from harness_findings once.
 */

import StatusBadge from './StatusBadge'
import type { HarnessName } from '@/lib/harness-writer'

export interface HarnessSummary {
  harness: HarnessName
  last_seen_at: string | null
  open_counts: { P0: number; P1: number; P2: number }
}

const PRETTY_NAME: Record<HarnessName, string> = {
  'data-hygiene': 'Data hygiene',
  'drift-check': 'Drift check',
  schemathesis: 'Schemathesis',
  promptfoo: 'Promptfoo',
  'stripe-drift': 'Stripe drift',
  'twilio-ownership': 'Twilio ownership',
  'telegram-health': 'Telegram health',
  'calendar-oauth': 'Calendar OAuth',
  'prompt-injection': 'Prompt injection',
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never run'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function HarnessCard({ summary }: { summary: HarnessSummary }) {
  const { harness, last_seen_at, open_counts } = summary
  const totalOpen = open_counts.P0 + open_counts.P1 + open_counts.P2
  const isHealthy = totalOpen === 0
  const isStale = !last_seen_at || (Date.now() - new Date(last_seen_at).getTime()) > 36 * 60 * 60 * 1000

  return (
    <div
      className="rounded-2xl p-4 card-surface flex flex-col gap-2"
      style={{
        borderColor: open_counts.P0 > 0
          ? 'rgba(239,68,68,0.35)'
          : open_counts.P1 > 0
            ? 'rgba(245,158,11,0.30)'
            : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold t1 truncate">{PRETTY_NAME[harness]}</p>
          <p className="text-[10px] mt-0.5 t3 font-mono truncate">{harness}</p>
        </div>
        {isHealthy ? (
          <StatusBadge variant="PASS" label="PASS" />
        ) : (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }}
          >
            {totalOpen} open
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {open_counts.P0 > 0 && <StatusBadge variant="P0" count={open_counts.P0} />}
        {open_counts.P1 > 0 && <StatusBadge variant="P1" count={open_counts.P1} />}
        {open_counts.P2 > 0 && <StatusBadge variant="P2" count={open_counts.P2} />}
        {totalOpen === 0 && (
          <span className="text-[10px] t3">No open findings</span>
        )}
      </div>

      <p
        className="text-[10px] mt-1"
        style={{ color: isStale ? 'rgb(251,191,36)' : 'var(--color-text-3)' }}
        title={last_seen_at ?? undefined}
      >
        {isStale && last_seen_at ? 'Stale: ' : 'Last run: '}
        {formatRelative(last_seen_at)}
      </p>
    </div>
  )
}
