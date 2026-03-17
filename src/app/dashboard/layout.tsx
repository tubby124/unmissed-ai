import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import ForwardingBanner from '@/components/dashboard/ForwardingBanner'
import FloatingAdvisorBubble from '@/components/advisor/FloatingAdvisorBubble'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessName: string | undefined
  let clientId: string | null = null
  let isAdmin = false

  let clientStatus: string | null = null
  let telegramConnected = false
  let setupComplete = true
  let twilioNumber: string | null = null

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(business_name, status, telegram_bot_token, telegram_chat_id, setup_complete, twilio_number)')
      .eq('user_id', user.id)
      .single()
    isAdmin = cu?.role === 'admin'
    clientId = isAdmin ? null : (cu?.client_id as string | null) ?? null
    const clientData = cu?.clients as { business_name?: string; status?: string; telegram_bot_token?: string | null; telegram_chat_id?: string | null; setup_complete?: boolean; twilio_number?: string | null } | null
    businessName = isAdmin ? undefined : clientData?.business_name ?? undefined
    clientStatus = isAdmin ? null : clientData?.status ?? null
    telegramConnected = !!(clientData?.telegram_bot_token && clientData?.telegram_chat_id)
    setupComplete = isAdmin ? true : (clientData?.setup_complete ?? true)
    twilioNumber = isAdmin ? null : (clientData?.twilio_number ?? null)
  }

  // Auto-redirect setup-status clients to /dashboard/setup unless they're already there
  if (!isAdmin && clientStatus === 'setup') {
    const headersList = await headers()
    const currentPath = headersList.get('x-pathname')
    if (currentPath && !currentPath.startsWith('/dashboard/setup')) {
      redirect('/dashboard/setup')
    }
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

      {!isAdmin && !setupComplete && clientStatus === 'active' && (
        <ForwardingBanner twilioNumber={twilioNumber} />
      )}

      <div className="flex flex-1 relative overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar businessName={businessName} isAdmin={isAdmin} clientId={clientId} setupIncomplete={!isAdmin && clientStatus === 'setup'} telegramConnected={telegramConnected} />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
          <FloatingAdvisorBubble isAdmin={isAdmin} />
        </main>

        {/* Activity feed — XL+ right panel */}
        <ActivityFeed isAdmin={isAdmin} clientId={clientId} />
      </div>
    </div>
  )
}
