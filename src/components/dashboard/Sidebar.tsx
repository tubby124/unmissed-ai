'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'

const NAV = [
  {
    href: '/dashboard/calls',
    label: 'Calls',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/campaigns',
    label: 'Campaigns',
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
    label: 'Lead Queue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/voices',
    label: 'Voices',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
]

interface SidebarProps {
  businessName?: string
}

export default function Sidebar({ businessName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase
        .from('call_logs')
        .select('call_status')
        .in('call_status', ['live', 'processing'])
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
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] bg-black/40 backdrop-blur-xl h-screen sticky top-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/[0.06] min-h-[64px]">
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
                <span className="text-white font-semibold text-sm tracking-tight block whitespace-nowrap">unmissed.ai</span>
                {businessName && (
                  <span className="text-zinc-500 text-xs block truncate">{businessName}</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          const isCalls = item.href === '/dashboard/calls'
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-w-0 ${
                active
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
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
          )
        })}

        <hr className="border-white/[0.06] my-2" />

        <Link
          href="/"
          title={collapsed ? 'Back to Site' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
        >
          <span className="shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="whitespace-nowrap">
                Back to Site
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </nav>

      {/* Sign out + collapse */}
      <div className="px-2 py-4 border-t border-white/[0.06] space-y-1">
        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors w-full"
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors w-full"
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
