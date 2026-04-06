'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'

interface ActivitySubNavProps {
  isTrialing?: boolean
  niche?: string | null
}

const BASE_SEGMENTS = [
  { href: '/dashboard/calls', label: 'Calls', trialLocked: false },
  { href: '/dashboard/leads', label: 'Leads', trialLocked: false },
  { href: '/dashboard/bookings', label: 'Bookings', trialLocked: true },
  { href: '/dashboard/live', label: 'Live ⚡', trialLocked: true },
]

const PM_SEGMENTS = [
  { href: '/dashboard/maintenance', label: 'Maintenance', trialLocked: false },
]

const ACTIVITY_ROUTES = ['/dashboard/calls', '/dashboard/leads', '/dashboard/bookings', '/dashboard/live', '/dashboard/maintenance']

export default function ActivitySubNav({ isTrialing = false, niche = null }: ActivitySubNavProps) {
  const SEGMENTS = [
    ...BASE_SEGMENTS,
    ...(niche === 'property_management' ? PM_SEGMENTS : []),
  ]
  const pathname = usePathname()
  const { openUpgradeModal } = useUpgradeModal()

  const showSubNav = ACTIVITY_ROUTES.some(r => pathname.startsWith(r))
  if (!showSubNav) return null

  return (
    <div
      className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {SEGMENTS.map(seg => {
        const isLocked = isTrialing && seg.trialLocked
        const active = seg.href === '/dashboard/calls'
          ? pathname === '/dashboard/calls' || (pathname.startsWith('/dashboard/calls/'))
          : pathname.startsWith(seg.href)

        if (isLocked) {
          return (
            <button
              key={seg.href}
              onClick={() => openUpgradeModal('activity_subnav')}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors opacity-50"
              style={{ color: 'var(--color-text-3)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {seg.label}
            </button>
          )
        }

        return (
          <Link
            key={seg.href}
            href={seg.href}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={
              active
                ? { backgroundColor: 'var(--color-cta)', color: 'black' }
                : { color: 'var(--color-text-2)' }
            }
          >
            {seg.label}
          </Link>
        )
      })}
    </div>
  )
}
