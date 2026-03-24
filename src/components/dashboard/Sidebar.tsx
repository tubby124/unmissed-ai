'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import ThemeToggle from '../ThemeToggle'
import UpgradeCTA from './UpgradeCTA'
import { hasCapability } from '@/lib/niche-capabilities'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { BRAND_NAME } from '@/lib/brand'
import { NAV_ITEMS, GROUP_LABELS } from './dashboardNav'
import { NavIcon } from './navIcons'

interface SidebarProps {
  businessName?: string
  isAdmin?: boolean
  clientId?: string | null
  setupIncomplete?: boolean
  telegramConnected?: boolean
  niche?: string | null
  clientStatus?: string | null
  subscriptionStatus?: string | null
  trialExpiresAt?: string | null
}

export default function Sidebar({ businessName, isAdmin = false, clientId = null, setupIncomplete = false, telegramConnected = false, niche = null, clientStatus = null, subscriptionStatus = null, trialExpiresAt = null }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const [failedNotifCount, setFailedNotifCount] = useState(0)
  const [knowledgeGapCount, setKnowledgeGapCount] = useState(0)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()
  const { previewMode, selectedClient: previewClient } = useAdminClient()

  const isTrialing = !isAdmin && subscriptionStatus === 'trialing'
  const daysRemaining = isTrialing && trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / 86400000))
    : undefined

  // In Cloak mode, preserve ?preview=true&client_id=X on all nav links
  const cloakSuffix = previewMode && previewClient ? `?preview=true&client_id=${previewClient.id}` : ''

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

    async function loadFailedNotifs() {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      let q = supabase
        .from('notification_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since)
      if (!isAdmin && clientId) q = q.eq('client_id', clientId)
      const { count } = await q
      setFailedNotifCount(count ?? 0)
    }
    loadFailedNotifs()

    async function loadKnowledgeGaps() {
      try {
        const params = new URLSearchParams({ days: '30' })
        if (clientId) params.set('client_id', clientId)
        const res = await fetch(`/api/dashboard/knowledge/gaps?${params}`)
        if (res.ok) {
          const data = await res.json()
          setKnowledgeGapCount(data.total ?? 0)
        }
      } catch {
        // silent
      }
    }
    loadKnowledgeGaps()

    const channel = supabase
      .channel('sidebar_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
        loadCounts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_logs' }, () => {
        loadFailedNotifs()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_query_log' }, () => {
        loadKnowledgeGaps()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (
      pathname.startsWith('/dashboard/agent') ||
      pathname.startsWith('/dashboard/knowledge') ||
      pathname.startsWith('/dashboard/actions') ||
      pathname.startsWith('/dashboard/voices')
    ) setAgentOpen(true)
  }, [pathname])

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
          <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-primary)" }}>
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
                  <span className="font-semibold text-sm tracking-tight whitespace-nowrap" style={{ color: "var(--color-text-1)" }}>{BRAND_NAME}</span>
                  {isAdmin && (
                    <span
                      className="text-[9px] font-bold tracking-wide rounded-full px-1.5 py-0.5 leading-none border"
                      style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-accent-tint)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                    >
                      Admin
                    </span>
                  )}
                </div>
                {businessName && (
                  <span className="text-xs flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-2)" }}>
                    {businessName}
                    {!isAdmin && isTrialing && (
                      <span
                        className="text-[9px] font-bold tracking-wide rounded-full px-1.5 py-0.5 leading-none shrink-0"
                        style={{ backgroundColor: 'rgb(245 158 11 / 0.15)', color: 'rgb(251 191 36)', border: '1px solid rgb(245 158 11 / 0.3)' }}
                      >
                        Trial
                      </span>
                    )}
                    {!isAdmin && !isTrialing && (
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${telegramConnected ? 'bg-green-500' : 'bg-amber-500'}`}
                        title={telegramConnected ? 'Telegram connected' : 'Telegram not connected'}
                      />
                    )}
                  </span>
                )}
                {isAdmin && !previewMode && (
                  <span className="text-xs block" style={{ color: "var(--color-text-3)" }}>All clients</span>
                )}
                {isAdmin && previewMode && previewClient && (
                  <span className="text-xs block text-amber-400 truncate">{previewClient.business_name}</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {(() => {
          const filteredNav = NAV_ITEMS.filter(item => {
            // In preview mode, hide admin-only items (show what client sees)
            if (item.adminOnly && (!isAdmin || previewMode)) return false
            // Hide Calendar nav for niches that don't support booking
            if (item.href === '/dashboard/calendar' && !isAdmin && niche && !hasCapability(niche, 'bookAppointments')) return false
            return true
          })
          return filteredNav.map((item, idx) => {
          const prevGroup = idx > 0 ? filteredNav[idx - 1].group : null
          const groupChanged = prevGroup !== null && item.group !== prevGroup
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
          const isCalls = item.href === '/dashboard/calls'
          const isLive = item.href === '/dashboard/live'
          const isSetup = item.href === '/dashboard/setup'
          const isLocked = isTrialing && !!item.trialLocked

          // ── Agent accordion ───────────────────────────────────────────────
          if (item.href === '/dashboard/agent') {
            const agentSection =
              pathname.startsWith('/dashboard/agent') ||
              pathname.startsWith('/dashboard/knowledge') ||
              pathname.startsWith('/dashboard/actions') ||
              pathname.startsWith('/dashboard/voices')
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
                {collapsed ? (
                  <Link
                    href={`/dashboard/agent${cloakSuffix}`}
                    title="Agent"
                    className={`flex items-center justify-center px-3 py-2.5 rounded-xl text-sm transition-colors ${agentSection ? 'border-l-[3px]' : 'hover:bg-hover'}`}
                    style={agentSection
                      ? { backgroundColor: 'var(--color-accent-tint)', borderLeftColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-2)' }}
                  >
                    <NavIcon name="agent" />
                  </Link>
                ) : (
                  <div>
                    <button
                      onClick={() => setAgentOpen(v => !v)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full"
                      style={{ color: agentSection ? 'var(--color-primary)' : 'var(--color-text-2)' }}
                    >
                      <span className="shrink-0"><NavIcon name="agent" /></span>
                      <span className="flex-1 whitespace-nowrap text-left">Agent</span>
                      <motion.svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        animate={{ rotate: agentOpen ? 180 : 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ color: agentSection ? 'var(--color-primary)' : 'var(--color-text-3)', opacity: 0.7 }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </motion.svg>
                    </button>
                    <AnimatePresence>
                      {agentOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 pl-3 border-l pb-1" style={{ borderColor: 'var(--color-border)' }}>
                            <Link
                              href={`/dashboard/agent${cloakSuffix}`}
                              className="flex items-center px-3 py-2 rounded-lg text-sm hover:bg-hover transition-colors"
                              style={{ color: pathname === '/dashboard/agent' ? 'var(--color-primary)' : 'var(--color-text-2)', fontWeight: pathname === '/dashboard/agent' ? 600 : undefined }}
                            >
                              Overview
                            </Link>
                            <Link
                              href={`/dashboard/knowledge${cloakSuffix}`}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-hover transition-colors"
                              style={{ color: pathname.startsWith('/dashboard/knowledge') ? 'var(--color-primary)' : 'var(--color-text-2)', fontWeight: pathname.startsWith('/dashboard/knowledge') ? 600 : undefined }}
                            >
                              <span className="flex-1">Knowledge</span>
                              {knowledgeGapCount > 0 && (
                                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                                  {knowledgeGapCount}
                                </span>
                              )}
                            </Link>
                            <Link
                              href={`/dashboard/actions${cloakSuffix}`}
                              className="flex items-center px-3 py-2 rounded-lg text-sm hover:bg-hover transition-colors"
                              style={{ color: pathname.startsWith('/dashboard/actions') ? 'var(--color-primary)' : 'var(--color-text-2)', fontWeight: pathname.startsWith('/dashboard/actions') ? 600 : undefined }}
                            >
                              Actions
                            </Link>
                            <Link
                              href={`/dashboard/voices${cloakSuffix}`}
                              className="flex items-center px-3 py-2 rounded-lg text-sm hover:bg-hover transition-colors"
                              style={{ color: pathname.startsWith('/dashboard/voices') ? 'var(--color-primary)' : 'var(--color-text-2)', fontWeight: pathname.startsWith('/dashboard/voices') ? 600 : undefined }}
                            >
                              Voice Library
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </Fragment>
            )
          }

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
              href={isLocked ? '/dashboard/settings?tab=billing' : `${item.href}${cloakSuffix}`}
              title={isLocked ? 'Available when you go live' : (collapsed ? item.label : undefined)}
              {...(item.href === '/dashboard/calls' ? { 'data-tour': 'nav-calls' } : {})}
              {...(item.href === '/dashboard/setup' ? { 'data-tour': 'nav-agent' } : {})}
              {...(item.href === '/dashboard/settings' ? { 'data-tour': 'nav-settings' } : {})}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-w-0 ${
                isLocked
                  ? 'opacity-40'
                  : active
                  ? 'border-l-[3px]'
                  : 'hover:bg-hover'
              }`}
              style={active && !isLocked
                ? { backgroundColor: 'var(--color-accent-tint)', borderLeftColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                : isSetup && setupIncomplete && !active && !isTrialing
                ? { color: 'var(--color-text-2)', boxShadow: 'inset 0 0 0 1px var(--color-warning)' }
                : { color: "var(--color-text-2)" }}
            >
              <span className="shrink-0 relative">
                {isLocked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <NavIcon name={item.iconName} />
                )}
                {/* Pulsing green dot when a call is live */}
                {isCalls && liveCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {isLive && liveCount > 0 && !isLocked && (
                  <span className="absolute -top-1 -right-1 flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {/* Pulsing amber dot when setup is incomplete — suppressed for trial users */}
                {isSetup && setupIncomplete && !active && !isTrialing && (
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
                    {item.adminLabel && isAdmin ? item.adminLabel : item.label}
                    {/* Amber processing count pill */}
                    {isCalls && processingCount > 0 && (
                      <span className="ml-auto text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                        {processingCount}
                      </span>
                    )}
                    {/* Red failed notification count pill */}
                    {item.href === '/dashboard/notifications' && failedNotifCount > 0 && (
                      <span className="ml-auto text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                        {failedNotifCount}
                      </span>
                    )}
                    {/* Amber knowledge gap count pill */}
                    {item.href === '/dashboard/knowledge' && knowledgeGapCount > 0 && (
                      <span className="ml-auto text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                        {knowledgeGapCount}
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
        {/* Settings submenu — Billing + Voices */}
        {!collapsed ? (
          <div>
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full"
              style={{ color: "var(--color-text-2)" }}
            >
              <span className="shrink-0"><NavIcon name="settings" /></span>
              <span className="flex-1 whitespace-nowrap text-left">Settings</span>
              <motion.svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                animate={{ rotate: advancedOpen ? 180 : 0 }}
                transition={{ duration: 0.15 }}
                style={{ color: "var(--color-text-3)" }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.svg>
            </button>
            <AnimatePresence>
              {advancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 pl-3 border-l pb-1" style={{ borderColor: "var(--color-border)" }}>
                    <Link
                      href={`/dashboard/settings?tab=billing${previewMode && previewClient ? `&preview=true&client_id=${previewClient.id}` : ''}`}
                      className="flex items-center px-3 py-2 rounded-lg text-sm hover:bg-hover transition-colors"
                      style={{ color: "var(--color-text-2)" }}
                    >
                      Billing
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            href={`/dashboard/settings${cloakSuffix}`}
            title="Settings"
            className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors"
            style={{ color: "var(--color-text-2)" }}
          >
            <NavIcon name="settings" />
          </Link>
        )}

        {/* Back to Site — inline, not part of shared NAV_ITEMS */}
        <Link
          href={`/${cloakSuffix ? cloakSuffix : ''}`}
          title={collapsed ? 'Back to Site' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors min-w-0"
          style={{ color: "var(--color-text-2)" }}
        >
          <span className="shrink-0">
            <NavIcon name="home" />
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Back to Site
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </nav>

      {/* Upgrade CTA for trial users */}
      {!isAdmin && isTrialing && (
        <div className="px-2 pb-2">
          <UpgradeCTA collapsed={collapsed} daysRemaining={daysRemaining} />
        </div>
      )}

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

        {!isAdmin && !collapsed && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('retake-tour'))}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full cursor-pointer"
            style={{ color: "var(--color-text-3)" }}
          >
            <span className="shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="whitespace-nowrap">Take tour</span>
          </button>
        )}

        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          aria-label="Sign out"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full"
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full"
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
