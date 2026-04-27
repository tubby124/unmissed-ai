'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useAdminClient } from '@/contexts/AdminClientContext'

interface TabBarProps {
  isAdmin?: boolean
  clientId?: string | null
  failedNotifCount?: number
}

const CLIENT_TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/go-live', label: 'Go Live' },
  { href: '/dashboard/knowledge', label: 'Knowledge' },
  { href: '/dashboard/calls', label: 'Calls & Leads' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/other', label: 'Other' },
]

const ACTIVITY_HREFS = ['/dashboard/calls', '/dashboard/leads', '/dashboard/bookings', '/dashboard/live', '/dashboard/maintenance']
const OTHER_HREFS = ['/dashboard/other']

function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === '/dashboard') return pathname === '/dashboard'
  if (tabHref === '/dashboard/calls') return ACTIVITY_HREFS.some(h => pathname.startsWith(h))
  if (tabHref === '/dashboard/other') return OTHER_HREFS.some(h => pathname.startsWith(h))
  return pathname.startsWith(tabHref)
}

export default function TabBar({ isAdmin = false, clientId = null, failedNotifCount = 0 }: TabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()
  const { previewMode, selectedClient } = useAdminClient()
  const cloakSuffix = previewMode && selectedClient ? `?preview=true&client_id=${selectedClient.id}` : ''

  const [liveCount, setLiveCount] = useState(0)
  const [knowledgeGapCount, setKnowledgeGapCount] = useState(0)

  useEffect(() => {
    async function loadBadges() {
      // Live calls badge
      let q = supabase
        .from('call_logs')
        .select('call_status')
        .in('call_status', ['live', 'processing'])
      if (!isAdmin && clientId) q = q.eq('client_id', clientId)
      const { data: callData } = await q
      setLiveCount(callData?.filter(r => r.call_status === 'live').length ?? 0)

      // Knowledge gaps badge
      if (!isAdmin && clientId) {
        try {
          const res = await fetch('/api/dashboard/knowledge/gaps?days=30', {
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const json = await res.json() as { gaps?: unknown[] }
            setKnowledgeGapCount(Array.isArray(json.gaps) ? json.gaps.length : 0)
          }
        } catch {
          // non-critical, badge stays 0
        }
      }
    }

    loadBadges()

    // Realtime: update live count when call_logs change
    const channel = supabase
      .channel('tabbar_live_calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        () => { loadBadges() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clientId, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Number key shortcuts: 1→Overview 2→Activity 3→Knowledge 4→Configure
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map: Record<string, string> = {
        '1': '/dashboard',
        '2': '/dashboard/knowledge',
        '3': '/dashboard/calls',
        '4': '/dashboard/billing',
        '5': '/dashboard/settings',
        '6': '/dashboard/other',
      }
      if (map[e.key]) {
        e.preventDefault()
        router.push(map[e.key] + cloakSuffix)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, cloakSuffix])

  function getBadge(tabHref: string): number {
    if (tabHref === '/dashboard/calls') return liveCount
    if (tabHref === '/dashboard/knowledge') return knowledgeGapCount
    if (tabHref === '/dashboard/settings') return failedNotifCount
    return 0
  }

  function getBadgeColor(tabHref: string): string {
    if (tabHref === '/dashboard/settings') return '#ef4444'
    return 'var(--color-cta)'
  }

  return (
    <nav
      role="tablist"
      className="hidden lg:flex sticky top-14 z-30 h-11 items-center border-b px-2"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {CLIENT_TABS.map((tab, idx) => {
        const active = isTabActive(tab.href, pathname)
        const badge = getBadge(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href + cloakSuffix}
            role="tab"
            aria-selected={active}
            onMouseEnter={() => router.prefetch(tab.href)}
            title={`${tab.label} [${idx + 1}]`}
            className="relative flex items-center gap-1.5 px-4 h-full text-xs font-medium uppercase tracking-widest transition-colors"
            style={{ color: active ? 'var(--color-cta)' : 'var(--color-text-3)' }}
          >
            {tab.label}
            {badge > 0 && (
              <motion.span
                key={badge}
                animate={{ scale: [1.3, 1] }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: getBadgeColor(tab.href) }}
              >
                {badge > 9 ? '9+' : badge}
              </motion.span>
            )}
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] tab-indicator"
                style={{ backgroundColor: 'var(--color-cta)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
