import type { ReactNode } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'
import ActivityFeed from '@/components/dashboard/ActivityFeed'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessName: string | undefined
  let clientId: string | null = null
  let isAdmin = false

  let clientStatus: string | null = null

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(business_name, status)')
      .eq('user_id', user.id)
      .single()
    isAdmin = cu?.role === 'admin'
    clientId = isAdmin ? null : (cu?.client_id as string | null) ?? null
    const clientData = cu?.clients as { business_name?: string; status?: string } | null
    businessName = isAdmin ? undefined : clientData?.business_name ?? undefined
    clientStatus = isAdmin ? null : clientData?.status ?? null
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-1)' }}>
      {/* Ambient glow background — dark mode only */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] rounded-full blur-3xl opacity-0 dark:opacity-100 bg-blue-500/8" />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] rounded-full blur-3xl opacity-0 dark:opacity-100 bg-violet-500/8" />
      </div>

      {/* Mobile top bar */}
      <MobileNav businessName={businessName} isAdmin={isAdmin} />

      <div className="flex flex-1 relative overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar businessName={businessName} isAdmin={isAdmin} clientId={clientId} setupIncomplete={!isAdmin && clientStatus === 'setup'} />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>

        {/* Activity feed — XL+ right panel */}
        <ActivityFeed isAdmin={isAdmin} clientId={clientId} />
      </div>
    </div>
  )
}
