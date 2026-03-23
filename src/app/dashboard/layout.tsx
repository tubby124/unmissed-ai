import { Suspense, type ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import ForwardingBanner from '@/components/dashboard/ForwardingBanner'
import FloatingAdvisorBubble from '@/components/advisor/FloatingAdvisorBubble'
import AdminCommandStrip from '@/components/dashboard/AdminCommandStrip'
import { AdminClientProvider } from '@/contexts/AdminClientContext'
import { DashboardToaster } from '@/components/dashboard/DashboardToaster'
import GuidedTour from '@/components/dashboard/GuidedTour'

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
  let clientNiche: string | null = null
  let adminClients: { id: string; slug: string; business_name: string; niche: string | null; status: string | null; twilio_number: string | null }[] = []

  if (user) {
    const { data: cuRows } = await supabase
      .from('client_users')
      .select('client_id, role, clients(business_name, status, telegram_bot_token, telegram_chat_id, setup_complete, twilio_number, niche)')
      .eq('user_id', user.id)
      .order('role').limit(1)
    const cu = cuRows?.[0] ?? null

    // S12-V5b: No client_users row = user authenticated but not authorized for any client
    if (!cu) {
      redirect('/onboard')
    }

    isAdmin = cu?.role === 'admin'
    clientId = isAdmin ? null : (cu?.client_id as string | null) ?? null
    const clientData = cu?.clients as { business_name?: string; status?: string; telegram_bot_token?: string | null; telegram_chat_id?: string | null; setup_complete?: boolean; twilio_number?: string | null; niche?: string | null } | null
    businessName = isAdmin ? undefined : clientData?.business_name ?? undefined
    clientStatus = isAdmin ? null : clientData?.status ?? null
    telegramConnected = !!(clientData?.telegram_bot_token && clientData?.telegram_chat_id)
    setupComplete = isAdmin ? true : (clientData?.setup_complete ?? true)
    twilioNumber = isAdmin ? null : (clientData?.twilio_number ?? null)
    clientNiche = isAdmin ? null : (clientData?.niche ?? null)

    if (isAdmin) {
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name, niche, status, twilio_number')
        .order('business_name')
      adminClients = (allClients ?? []).map(c => ({
        id: c.id,
        slug: c.slug,
        business_name: c.business_name,
        niche: (c as Record<string, unknown>).niche as string | null ?? null,
        status: (c as Record<string, unknown>).status as string | null ?? null,
        twilio_number: (c as Record<string, unknown>).twilio_number as string | null ?? null,
      }))
    }
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
    <div className="min-h-screen flex flex-col bg-page t1">
      {/* Mobile top bar */}
      <MobileNav businessName={businessName} isAdmin={isAdmin} clientStatus={clientStatus} />

      {!isAdmin && !setupComplete && clientStatus === 'active' && (
        <ForwardingBanner twilioNumber={twilioNumber} />
      )}

      <Suspense>
        <AdminClientProvider isAdmin={isAdmin} clients={adminClients}>
          <div className="flex flex-1 relative overflow-hidden">
            {/* Desktop sidebar */}
            <Sidebar businessName={businessName} isAdmin={isAdmin} clientId={clientId} setupIncomplete={!isAdmin && clientStatus === 'setup'} telegramConnected={telegramConnected} niche={clientNiche} clientStatus={clientStatus} />

            {/* Main content */}
            <main className="flex-1 min-w-0 overflow-y-auto">
              <AdminCommandStrip />
              {children}
              <FloatingAdvisorBubble isAdmin={isAdmin} />
            </main>

            {/* Activity feed — XL+ right panel */}
            <ActivityFeed isAdmin={isAdmin} clientId={clientId} />
          </div>
        </AdminClientProvider>
      </Suspense>
      <DashboardToaster />
      {!isAdmin && <GuidedTour />}
    </div>
  )
}
