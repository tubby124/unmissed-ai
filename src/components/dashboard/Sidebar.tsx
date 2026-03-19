'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import ThemeToggle from '../ThemeToggle'

const GROUP_LABELS: Record<number, string | null> = { 1: null, 2: 'MANAGE', 3: 'TOOLS', 4: null }

const NAV = [
  // ── Group 1 ──────────────────────────────────────────────────────────────
  {
    href: '/dashboard/calls',
    label: 'Overview',
    adminOnly: false,
    group: 1,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/insights',
    label: 'Insights',
    adminOnly: false,
    group: 1,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/live',
    label: 'Live',
    adminOnly: false,
    group: 1,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.3 6.3a8 8 0 1011.4 11.4M6.3 6.3A8 8 0 0117.7 17.7M6.3 6.3L5 5M17.7 17.7l1.3 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/setup',
    label: 'Agent',
    adminOnly: false,
    group: 1,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/advisor',
    label: 'Advisor',
    adminOnly: false,
    group: 1,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 10h.01M12 10h.01M16 10h.01"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  // ── Group 2 — MANAGE (admin) ──────────────────────────────────────────────
  {
    href: '/dashboard/clients',
    label: 'Clients',
    adminOnly: true,
    group: 2,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/campaigns',
    label: 'Performance',
    adminOnly: true,
    group: 2,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="18" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="10" y="8" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="2" y="13" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/leads',
    label: 'Leads',
    adminOnly: false,
    group: 2,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/calendar',
    label: 'Calendar',
    adminOnly: false,
    group: 2,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  // ── Group 3 — TOOLS (admin) ───────────────────────────────────────────────
  {
    href: '/dashboard/lab',
    label: 'Lab',
    adminOnly: true,
    group: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/admin/costs',
    label: 'Cost Intel',
    adminOnly: true,
    group: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/admin/numbers',
    label: 'Numbers',
    adminOnly: true,
    group: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/voices',
    label: 'Voices',
    adminOnly: true,
    group: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  // ── Group 4 — bottom ──────────────────────────────────────────────────────
  {
    href: '/dashboard/settings',
    label: 'Settings',
    adminOnly: false,
    group: 4,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/',
    label: 'Back to Site',
    adminOnly: false,
    group: 4,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

interface SidebarProps {
  businessName?: string
  isAdmin?: boolean
  clientId?: string | null
  setupIncomplete?: boolean
  telegramConnected?: boolean
}

export default function Sidebar({ businessName, isAdmin = false, clientId = null, setupIncomplete = false, telegramConnected = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    async function loadCounts() {
      let q = supabase
        .from('call_logs')
        .select('call_status')
        .in('call_status', ['live', 'processing'])
      if (!isAdmin && clientId) q = q.eq('client_id', clientId)
      const { data } = await q
      if (!data) return
      setLiveCount(data.filter(r => r.call_status === 'live').length)
      setProcessingCount(data.filter(r => r.call_status === 'processing').length)
    }

    loadCounts()

    const channel = supabase
      .channel('sidebar_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
        loadCounts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="hidden lg:flex flex-col shrink-0 border-r backdrop-blur-xl h-screen sticky top-0 overflow-hidden"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {/* Logo + identity */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b min-h-[64px]" style={{ borderColor: "var(--color-border)" }}>
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0 overflow-hidden"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight whitespace-nowrap" style={{ color: "var(--color-text-1)" }}>unmissed.ai</span>
                  {isAdmin && (
                    <span className="text-[9px] font-bold tracking-wide text-indigo-500 bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-500/30 dark:text-indigo-400 rounded-full px-1.5 py-0.5 leading-none">
                      Admin
                    </span>
                  )}
                </div>
                {businessName && (
                  <span className="text-xs flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-2)" }}>
                    {businessName}
                    {!isAdmin && (
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${telegramConnected ? 'bg-green-500' : 'bg-amber-500'}`}
                        title={telegramConnected ? 'Telegram connected' : 'Telegram not connected'}
                      />
                    )}
                  </span>
                )}
                {isAdmin && (
                  <span className="text-xs block" style={{ color: "var(--color-text-3)" }}>All clients</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {(() => {
          const filteredNav = NAV.filter(item => !item.adminOnly || isAdmin)
          return filteredNav.map((item, idx) => {
          const prevGroup = idx > 0 ? filteredNav[idx - 1].group : null
          const groupChanged = prevGroup !== null && item.group !== prevGroup
          const active = item.href !== '/' && pathname.startsWith(item.href)
          const isCalls = item.href === '/dashboard/calls'
          const isLive = item.href === '/dashboard/live'
          const isSetup = item.href === '/dashboard/setup'
          return (
            <Fragment key={item.href}>
              {groupChanged && isAdmin && !collapsed && (
                <>
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '8px 12px' }} />
                  {GROUP_LABELS[item.group] && (
                    <p className="px-3 mt-4 mb-1 text-[10px] font-medium tracking-widest" style={{ color: 'var(--color-text-3)' }}>
                      {GROUP_LABELS[item.group]}
                    </p>
                  )}
                </>
              )}
            <Link
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-w-0 ${
                active
                  ? 'bg-indigo-50 border-l-[3px] border-indigo-500 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-400 dark:text-indigo-400'
                  : isSetup && setupIncomplete && !active
                  ? 'hover:bg-gray-50 dark:hover:bg-white/5 ring-1 ring-amber-500/30'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
              style={active ? {} : { color: "var(--color-text-2)" }}
            >
              <span className="shrink-0 relative">
                {item.icon}
                {/* Pulsing green dot when a call is live */}
                {isCalls && liveCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {isLive && liveCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {/* Pulsing amber dot when setup is incomplete */}
                {isSetup && setupIncomplete && !active && (
                  <span className="absolute -top-1 -right-1 flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                )}
              </span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="whitespace-nowrap overflow-hidden flex-1 flex items-center gap-2"
                  >
                    {item.label}
                    {/* Amber processing count pill */}
                    {isCalls && processingCount > 0 && (
                      <span className="ml-auto text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                        {processingCount}
                      </span>
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            </Fragment>
          )
        })
        })()}
      </nav>

      {/* Theme toggle + Sign out + collapse */}
      <div className="px-2 py-4 border-t space-y-1" style={{ borderColor: "var(--color-border)" }}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3'} py-1`}>
          <ThemeToggle />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="text-sm whitespace-nowrap" style={{ color: "var(--color-text-3)" }}>
                Theme
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          aria-label="Sign out"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors w-full"
          style={{ color: "var(--color-text-2)" }}
        >
          <span className="shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="whitespace-nowrap">
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors w-full"
          style={{ color: "var(--color-text-3)" }}
        >
          <span className="shrink-0">
            <motion.svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </motion.svg>
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="whitespace-nowrap">
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
