'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

interface ActionItem {
  severity: 'red' | 'amber'
  label: string
  href: string
}

interface ClientRow {
  id: string
  business_name: string
  seconds_used_this_month: number | null
  monthly_minute_limit: number | null
  bonus_minutes: number | null
  booking_enabled?: boolean | null
  forwarding_number?: string | null
  google_calendar_id?: string | null
}

export default function ActionItems() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    let mounted = true

    async function load() {
      const actions: ActionItem[] = []

      // 1. HOT leads unactioned >1h
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count: hotCount } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('call_status', 'HOT')
        .lt('started_at', oneHourAgo)
      if ((hotCount ?? 0) > 0) {
        const count = hotCount ?? 0
        actions.push({
          severity: 'red',
          label: `${count} HOT lead${count > 1 ? 's' : ''} unactioned for >1h`,
          href: '/dashboard/leads',
        })
      }

      // 2. Failed transfers in last 24h
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: failedTransfers } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .in('transfer_status', ['no_answer', 'busy', 'failed', 'canceled'])
        .gte('transfer_updated_at', dayAgo)
      if ((failedTransfers ?? 0) > 0) {
        actions.push({
          severity: 'amber',
          label: `${failedTransfers} failed transfer${failedTransfers! > 1 ? 's' : ''} in last 24h`,
          href: '/dashboard/live',
        })
      }

      // 3. Clients at >90% minute usage
      const { data: clients } = await supabase
        .from('clients')
        .select('id, business_name, seconds_used_this_month, monthly_minute_limit, bonus_minutes, booking_enabled, forwarding_number, google_calendar_id')
        .eq('status', 'active')

      if (clients) {
        for (const c of clients as ClientRow[]) {
          const used = Math.ceil((c.seconds_used_this_month ?? 0) / 60)
          const limit = (c.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT) + (c.bonus_minutes ?? 0)
          if (limit > 0 && used / limit > 0.9) {
            actions.push({
              severity: used >= limit ? 'red' : 'amber',
              label: `${c.business_name}: ${used}/${limit} min used (${Math.round(used / limit * 100)}%)`,
              href: `/dashboard/settings?client_id=${c.id}`,
            })
          }

          // Calendar enabled but no calendar connected
          if (c.booking_enabled && !c.google_calendar_id) {
            actions.push({
              severity: 'amber',
              label: `${c.business_name}: booking enabled but no calendar connected`,
              href: `/dashboard/settings?client_id=${c.id}`,
            })
          }

          // Forwarding number set — check for successful transfers in last 7 days
          if (c.forwarding_number) {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            const { count: successfulTransfers } = await supabase
              .from('call_logs')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', c.id)
              .eq('transfer_status', 'completed')
              .gte('transfer_updated_at', weekAgo)
            if ((successfulTransfers ?? 0) === 0) {
              actions.push({
                severity: 'amber',
                label: `${c.business_name}: transfer configured but no successful transfers in 7 days`,
                href: `/dashboard/settings?client_id=${c.id}`,
              })
            }
          }
        }
      }

      // 4. Live calls right now
      const { count: liveCalls } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('call_status', 'live')
      if ((liveCalls ?? 0) > 0) {
        actions.push({
          severity: 'amber',
          label: `${liveCalls} live call${liveCalls! > 1 ? 's' : ''} in progress`,
          href: '/dashboard/live',
        })
      }

      if (mounted) {
        setItems(actions)
        setLoading(false)
      }
    }

    load()
    const id = setInterval(load, 60_000)
    return () => { mounted = false; clearInterval(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <SkeletonBox key={i} className="h-10 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border b-theme bg-surface">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-500">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>No action items — all clear</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <Link
          key={i}
          href={item.href}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors hover:brightness-110"
          style={{
            borderColor: item.severity === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)',
            backgroundColor: item.severity === 'red' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${item.severity === 'red' ? 'bg-red-500' : 'bg-amber-500'}`}
          />
          <span
            className="text-xs font-medium flex-1"
            style={{ color: item.severity === 'red' ? 'rgb(248,113,113)' : 'rgb(251,191,36)' }}
          >
            {item.label}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      ))}
    </div>
  )
}
