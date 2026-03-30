'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'
import { BRAND_NAME } from '@/lib/brand'

interface TopBarProps {
  businessName?: string
  isAdmin?: boolean
  failedNotifCount?: number
  userEmail?: string
  onOpenPalette?: () => void
}

export default function TopBar({
  businessName,
  isAdmin = false,
  failedNotifCount = 0,
  userEmail,
  onOpenPalette,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-sm"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Left: Logo + business name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: 'var(--color-text-1)' }}
          >
            {BRAND_NAME}
          </span>
        </Link>
        {businessName && (
          <>
            <span className="text-sm hidden sm:inline" style={{ color: 'var(--color-text-3)' }}>
              /
            </span>
            <span
              className="text-sm truncate max-w-[140px] hidden sm:inline"
              style={{ color: 'var(--color-text-2)' }}
            >
              {businessName}
            </span>
          </>
        )}
        {isAdmin && (
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded hidden sm:inline"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: 0.8 }}
          >
            Admin
          </span>
        )}
      </div>

      {/* Right: ⌘K + bell + theme + avatar */}
      <div className="flex items-center gap-1">
        {/* Cmd+K trigger pill — desktop only */}
        {onOpenPalette && (
          <button
            onClick={onOpenPalette}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors hover:bg-hover mr-1"
            style={{
              color: 'var(--color-text-3)',
              border: '1px solid var(--color-border)',
            }}
            title="Open command palette (⌘K)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            <span>K</span>
          </button>
        )}

        {/* Notification bell */}
        <Link
          href="/dashboard/notifications"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-hover"
          style={{ color: 'var(--color-text-2)' }}
          aria-label="Notifications"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {failedNotifCount > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: '#ef4444' }}
              aria-live="polite"
              aria-label={`${failedNotifCount} failed notifications`}
            />
          )}
        </Link>

        <ThemeToggle />

        {/* Avatar + sign-out dropdown */}
        <div className="relative ml-0.5">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-75"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            title={userEmail}
          >
            {userEmail?.[0]?.toUpperCase() ?? 'U'}
          </button>

          {menuOpen && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-10 z-50 w-52 rounded-xl border shadow-lg py-1.5"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {userEmail && (
                  <div
                    className="px-3 py-2 text-[11px] truncate"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    {userEmail}
                  </div>
                )}
                <div
                  className="h-px mx-2 mb-1"
                  style={{ backgroundColor: 'var(--color-border)' }}
                />
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover transition-colors text-left"
                  style={{ color: 'var(--color-text-2)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
