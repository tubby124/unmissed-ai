'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { useAdminClient } from '@/contexts/AdminClientContext'

interface BottomTabBarProps {
  liveCount?: number
  knowledgeGapCount?: number
  failedNotifCount?: number
}

const CLIENT_TABS = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/knowledge',
    label: 'Knowledge',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/calls',
    label: 'Calls',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
]

const ACTIVITY_HREFS = ['/dashboard/calls', '/dashboard/leads', '/dashboard/bookings', '/dashboard/live', '/dashboard/maintenance']

function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === '/dashboard') return pathname === '/dashboard'
  if (tabHref === '/dashboard/calls') return ACTIVITY_HREFS.some(h => pathname.startsWith(h))
  return pathname.startsWith(tabHref)
}

export default function BottomTabBar({ liveCount = 0, knowledgeGapCount = 0, failedNotifCount = 0 }: BottomTabBarProps) {
  const pathname = usePathname()
  const { previewMode, selectedClient } = useAdminClient()
  const cloakSuffix = previewMode && selectedClient ? `?preview=true&client_id=${selectedClient.id}` : ''

  function getBadge(tabHref: string): number {
    if (tabHref === '/dashboard/calls') return liveCount
    if (tabHref === '/dashboard/knowledge') return knowledgeGapCount
    if (tabHref === '/dashboard/settings') return failedNotifCount
    return 0
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t pb-safe"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex h-16">
        {CLIENT_TABS.map(tab => {
          const active = isTabActive(tab.href, pathname)
          const badge = getBadge(tab.href)
          return (
            <motion.div key={tab.href} className="flex-1" whileTap={{ scale: 0.85 }}>
              <Link
                href={tab.href + cloakSuffix}
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full transition-colors"
                style={{ color: active ? 'var(--color-cta)' : 'var(--color-text-3)' }}
              >
                <div className="relative">
                  {tab.icon}
                  {badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: tab.href === '/dashboard/settings' ? '#ef4444' : 'var(--color-cta)' }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </nav>
  )
}
