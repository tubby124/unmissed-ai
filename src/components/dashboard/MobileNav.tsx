'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'
import UpgradeCTA from './UpgradeCTA'
import { hasCapability } from '@/lib/niche-capabilities'
import { BRAND_NAME } from '@/lib/brand'
import { NAV_ITEMS } from './dashboardNav'
import { NavIcon } from './navIcons'

interface MobileNavProps {
  businessName?: string
  isAdmin?: boolean
  clientStatus?: string | null
  subscriptionStatus?: string | null
  trialExpiresAt?: string | null
  niche?: string | null
}

export default function MobileNav({ businessName, isAdmin = false, clientStatus, subscriptionStatus, trialExpiresAt, niche = null }: MobileNavProps) {
  const isTrialing = !isAdmin && subscriptionStatus === 'trialing'
  const daysRemaining = trialExpiresAt ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / 86400000)) : undefined
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filteredNav = NAV_ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.href === '/dashboard/calendar' && !isAdmin && niche && !hasCapability(niche, 'bookAppointments')) return false
    return true
  })

  return (
    <>
      {/* Top bar */}
      <div className="lg:hidden sticky top-0 z-40 backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-primary)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--color-text-1)" }}>{BRAND_NAME}</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-8 h-8 flex items-center justify-center transition-colors"
          style={{ color: "var(--color-text-2)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Overlay menu */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 backdrop-blur-xl border-r flex flex-col"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-primary)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <span className="font-semibold text-sm tracking-tight block" style={{ color: "var(--color-text-1)" }}>{BRAND_NAME}</span>
                    {businessName && <span className="text-xs" style={{ color: "var(--color-text-2)" }}>{businessName}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center transition-colors"
                  style={{ color: "var(--color-text-2)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {filteredNav.map((item, idx) => {
                  const prevGroup = idx > 0 ? filteredNav[idx - 1].group : null
                  const groupChanged = prevGroup !== null && item.group !== prevGroup
                  const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
                  return (
                    <div key={item.href}>
                      {groupChanged && (
                        <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
                      )}
                      {(() => {
                          const isLocked = isTrialing && item.trialLocked
                          return (
                            <Link
                              href={isLocked ? '/dashboard/settings?tab=billing' : item.href}
                              onClick={() => setOpen(false)}
                              title={isLocked ? 'Available when you go live' : undefined}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                                active
                                  ? 'border-l-[3px]'
                                  : 'hover:bg-hover'
                              } ${isLocked ? 'opacity-40' : ''}`}
                              style={
                                active
                                  ? { backgroundColor: 'var(--color-accent-tint)', borderLeftColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                                  : { color: "var(--color-text-2)" }
                              }
                            >
                              <NavIcon name={item.iconName} />
                              {item.adminLabel && isAdmin ? item.adminLabel : item.label}
                              {isLocked && (
                                <svg className="ml-auto w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
                                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                            </Link>
                          )
                        })()}
                    </div>
                  )
                })}
                <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
                {/* Back to Site — inline, not part of shared NAV_ITEMS */}
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors"
                  style={{ color: "var(--color-text-2)" }}
                >
                  <NavIcon name="home" />
                  Back to Site
                </Link>
              </nav>

              {isTrialing && (
                <div className="px-3 py-2">
                  <UpgradeCTA daysRemaining={daysRemaining} />
                </div>
              )}

              <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-hover transition-colors w-full"
                  style={{ color: "var(--color-text-2)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
