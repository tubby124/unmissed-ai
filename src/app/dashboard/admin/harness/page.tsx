/**
 * /dashboard/admin/harness — operator-facing dashboard for nightly harness
 * findings.
 *
 * Reads:
 *   - harness_findings (filtered by URL search params; status defaults to 'open')
 *   - aggregated max(last_seen_at) + open-count-by-severity for the 7 status cards
 *
 * Admin-only. Server component does the auth + initial fetch; the filter strip
 * and finding rows are client components.
 *
 * Why aggregate cards server-side: 7 harnesses × 3 severities = up to 21
 * client-side aggregations otherwise; cleaner to compute once on the server
 * from the already-fetched row set.
 */

import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import SectionLabel from '@/components/dashboard/SectionLabel'
import HarnessCard, { type HarnessSummary } from '@/components/admin/harness/HarnessCard'
import FilterStrip from '@/components/admin/harness/FilterStrip'
import FindingRow, { type FindingRowData } from '@/components/admin/harness/FindingRow'
import type { HarnessName, Severity, Status } from '@/lib/harness-writer'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Harness Findings' }

const ALL_HARNESSES: ReadonlyArray<HarnessName> = [
  'data-hygiene',
  'drift-check',
  'schemathesis',
  'promptfoo',
  'stripe-drift',
  'twilio-ownership',
  'prompt-injection',
]

interface HarnessFindingsRow {
  id: string
  harness_name: HarnessName
  run_id: string
  check_name: string
  severity: Severity
  status: Status
  client_slug: string | null
  summary: string
  details: Record<string, unknown> | null
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  suppressed_until: string | null
}

function aggregateCards(allRows: HarnessFindingsRow[]): HarnessSummary[] {
  const map = new Map<HarnessName, HarnessSummary>()
  for (const h of ALL_HARNESSES) {
    map.set(h, {
      harness: h,
      last_seen_at: null,
      open_counts: { P0: 0, P1: 0, P2: 0 },
    })
  }
  for (const r of allRows) {
    const s = map.get(r.harness_name)
    if (!s) continue
    if (!s.last_seen_at || new Date(r.last_seen_at) > new Date(s.last_seen_at)) {
      s.last_seen_at = r.last_seen_at
    }
    if (r.status === 'open' && (r.severity === 'P0' || r.severity === 'P1' || r.severity === 'P2')) {
      s.open_counts[r.severity] += 1
    }
  }
  return Array.from(map.values())
}

function applyFilters(
  rows: HarnessFindingsRow[],
  harness: string,
  severity: string,
  status: string,
): HarnessFindingsRow[] {
  const filtered = rows.filter(r => {
    if (harness !== 'all' && r.harness_name !== harness) return false
    if (severity !== 'all' && r.severity !== severity) return false
    if (status === 'all') return true
    return r.status === status
  })
  // Sort: severity DESC (P0 first), then last_seen_at DESC.
  const SEV_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, PASS: 3 }
  return filtered.sort((a, b) => {
    const s = (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99)
    if (s !== 0) return s
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
  })
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HarnessPage({ searchParams }: PageProps) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    redirect('/dashboard')
  }

  const sp = await searchParams
  const harness = typeof sp.harness === 'string' ? sp.harness : 'all'
  const severity = typeof sp.severity === 'string' ? sp.severity : 'all'
  const status = typeof sp.status === 'string' ? sp.status : 'open'

  // Pull every row once and aggregate in-memory. Table is small (one row per
  // active finding; resolved rows trickle in over time but cap is hundreds,
  // not millions) — one fetch beats two round-trips.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('harness_findings')
    .select(
      'id, harness_name, run_id, check_name, severity, status, client_slug, summary, details, first_seen_at, last_seen_at, resolved_at, suppressed_until',
    )
    .order('last_seen_at', { ascending: false })
    .limit(2000)

  const allRows = (data ?? []) as HarnessFindingsRow[]
  const cards = aggregateCards(allRows)
  const filtered = applyFilters(allRows, harness, severity, status)

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Harness Findings" subtitle="Nightly check output across all 7 harnesses" />

      {error && (
        <div
          className="rounded-xl p-3 text-[12px]"
          style={{
            backgroundColor: 'rgba(239,68,68,0.08)',
            color: 'rgb(248,113,113)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          Failed to load findings: {error.message}
        </div>
      )}

      <div>
        <SectionLabel className="mb-2">Status</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(c => (
            <HarnessCard key={c.harness} summary={c} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel className="mb-2">Filters</SectionLabel>
        <FilterStrip
          harness={harness as HarnessName | 'all'}
          severity={severity as Severity | 'all'}
          status={status as 'open' | 'resolved' | 'suppressed' | 'all'}
        />
      </div>

      <div>
        <SectionLabel className="mb-2">
          Findings ({filtered.length}{filtered.length !== allRows.length ? ` of ${allRows.length}` : ''})
        </SectionLabel>
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center card-surface"
            style={{ color: 'var(--color-text-3)' }}
          >
            <p className="text-[13px]">No findings match the current filters.</p>
            <p className="text-[11px] mt-1">
              {status === 'open' ? 'All caught up — no open findings right now.' : 'Try widening the filters above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => (
              <FindingRow
                key={f.id}
                finding={{
                  ...f,
                  details: (f.details ?? {}) as Record<string, unknown>,
                } as FindingRowData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
