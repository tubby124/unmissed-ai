/**
 * /dashboard/admin/notifications — admin operator dashboard for outbound alerts.
 *
 * Filterable table of every email/Telegram/SMS that went out, with delivery
 * state badges, full content on row expand, and a client lifecycle drawer.
 *
 * Reads:
 *   - notification_logs (with client_users join for business_name)
 *
 * Admin-only. Server component does the auth + initial fetch; the filter
 * strip, row expand, and lifecycle drawer are client components.
 *
 * Mirrors the pattern of /dashboard/admin/harness — URL-driven filters,
 * single fetch up front, aggregations server-side.
 */

import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import SectionLabel from '@/components/dashboard/SectionLabel'
import FilterStrip from '@/components/admin/notifications/FilterStrip'
import NotificationRow, { type NotificationRowData } from '@/components/admin/notifications/NotificationRow'
import StatsRibbon, { type StatsByChannel } from '@/components/admin/notifications/StatsRibbon'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

const CHANNELS = ['email', 'telegram', 'sms', 'system'] as const
const WINDOWS = ['1h', '24h', '7d', '30d', 'all'] as const

function computeWindow(window: string): Date | null {
  const now = Date.now()
  const map: Record<string, number> = {
    '1h':  1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7  * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  if (window === 'all' || !map[window]) return null
  return new Date(now - map[window])
}

function aggregateStats(rows: NotificationRowData[]): StatsByChannel {
  const stats: StatsByChannel = {
    email:    { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, complained: 0, other: 0 },
    telegram: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, complained: 0, other: 0 },
    sms:      { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, complained: 0, other: 0 },
    system:   { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, complained: 0, other: 0 },
  }
  for (const r of rows) {
    const channel = (CHANNELS as readonly string[]).includes(r.channel) ? (r.channel as keyof StatsByChannel) : 'system'
    stats[channel].total += 1
    const status = r.status ?? 'other'
    if (status in stats[channel]) {
      // @ts-expect-error string indexing of known status keys
      stats[channel][status] += 1
    } else {
      stats[channel].other += 1
    }
  }
  return stats
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NotificationsAdminPage({ searchParams }: PageProps) {
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
  const channel  = typeof sp.channel  === 'string' ? sp.channel  : 'all'
  const status   = typeof sp.status   === 'string' ? sp.status   : 'all'
  const window   = typeof sp.window   === 'string' && (WINDOWS as readonly string[]).includes(sp.window) ? sp.window : '24h'
  const search   = typeof sp.q        === 'string' ? sp.q.trim() : ''

  const since = computeWindow(window)

  // Fetch rows + join client business_name in one query
  let query = svc
    .from('notification_logs')
    .select('id, client_id, channel, recipient, content, status, error, external_id, created_at, clients(slug,business_name)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (since) query = query.gte('created_at', since.toISOString())
  if (channel !== 'all') query = query.eq('channel', channel)
  if (status !== 'all')  query = query.eq('status', status)

  const { data, error } = await query

  type RawRow = {
    id: string
    client_id: string | null
    channel: string
    recipient: string | null
    content: string | null
    status: string | null
    error: string | null
    external_id: string | null
    created_at: string
    clients: { slug?: string | null; business_name?: string | null } | { slug?: string | null; business_name?: string | null }[] | null
  }

  const rawRows = (data ?? []) as unknown as RawRow[]
  const allRows: NotificationRowData[] = rawRows.map((r) => {
    const cl = Array.isArray(r.clients) ? r.clients[0] : r.clients
    return {
      id: r.id,
      client_id: r.client_id,
      client_slug: cl?.slug ?? null,
      business_name: cl?.business_name ?? null,
      channel: r.channel,
      recipient: r.recipient,
      content: r.content,
      status: r.status,
      error: r.error,
      external_id: r.external_id,
      created_at: r.created_at,
    }
  })

  // Client-side text search (small dataset after window filter — fine)
  const filtered = search
    ? allRows.filter(r => {
        const haystack = `${r.business_name ?? ''} ${r.client_slug ?? ''} ${r.recipient ?? ''} ${r.content ?? ''}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
    : allRows

  const stats = aggregateStats(filtered)

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Notifications" subtitle="Every email, Telegram, and SMS your platform sent out — and whether it landed" />

      {error && (
        <div
          className="rounded-xl p-3 text-[12px]"
          style={{
            backgroundColor: 'rgba(239,68,68,0.08)',
            color: 'rgb(248,113,113)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          Error loading notifications: {error.message}
        </div>
      )}

      <StatsRibbon stats={stats} window={window} />

      <div className="space-y-3">
        <SectionLabel>Filter</SectionLabel>
        <FilterStrip channel={channel} status={status} window={window} q={search} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>{filtered.length} of {allRows.length} notifications</SectionLabel>
          {filtered.length === 500 && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
              showing first 500 — narrow the window for older rows
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-[13px]"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-3)',
              border: '1px solid var(--color-border)',
            }}
          >
            No notifications match the current filters.
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((row) => (
              <NotificationRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
