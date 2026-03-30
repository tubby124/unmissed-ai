'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/dashboard/TopBar'
import CommandPalette from '@/components/dashboard/CommandPalette'

interface DashboardShellClientProps {
  businessName?: string
  isAdmin?: boolean
  failedNotifCount?: number
  userEmail?: string
}

export default function DashboardShellClient({
  businessName,
  isAdmin = false,
  failedNotifCount = 0,
  userEmail,
}: DashboardShellClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <TopBar
        businessName={businessName}
        isAdmin={isAdmin}
        failedNotifCount={failedNotifCount}
        userEmail={userEmail}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
