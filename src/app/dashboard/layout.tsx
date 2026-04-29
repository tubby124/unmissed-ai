import { Suspense, type ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import ForwardingBanner from '@/components/dashboard/ForwardingBanner'
import AdminCommandStrip from '@/components/dashboard/AdminCommandStrip'
import TabBar from '@/components/dashboard/TabBar'
import BottomTabBar from '@/components/dashboard/BottomTabBar'
import ActivitySubNav from '@/components/dashboard/ActivitySubNav'
import DashboardShellClient from '@/components/dashboard/DashboardShellClient'
import { RouteLoadingBar } from '@/components/dashboard/RouteLoadingBar'
import { PageTransition } from '@/components/dashboard/PageTransition'
import { AdminClientProvider } from '@/contexts/AdminClientContext'
import { CallProvider } from '@/contexts/CallContext'
import { UpgradeModalProvider } from '@/contexts/UpgradeModalContext'
import UpgradeModal from '@/components/dashboard/UpgradeModal'
import { DashboardToaster } from '@/components/dashboard/DashboardToaster'
import RealtimeToasts from '@/components/dashboard/RealtimeToasts'
import FloatingCallOrb from '@/components/dashboard/FloatingCallOrb'
import RecordingConsentGate from '@/components/dashboard/RecordingConsentGate'
import ActingAsBanner from '@/components/admin/ActingAsBanner'
import ClientSwitcher from '@/components/admin/ClientSwitcher'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessName: string | undefined
  let clientId: string | null = null
  let isAdmin = false

  let clientStatus: string | null = null
  let subscriptionStatus: string | null = null
  let trialExpiresAt: string | null = null
  let telegramConnected = false
  let setupComplete = true
  let twilioNumber: string | null = null
  let clientNiche: string | null = null
  let adminClients: { id: string; slug: string; business_name: string; niche: string | null; status: string | null; twilio_number: string | null }[] = []
  let failedNotifCount = 0
  let minutesUsed = 0
  let minuteLimit: number | null = null
  let bonusMinutes = 0
  let needsRecordingConsent = false

  if (user) {
    const { data: cuRows } = await supabase
      .from('client_users')
      .select('client_id, role, clients(business_name, status, subscription_status, trial_expires_at, telegram_bot_token, telegram_chat_id, setup_complete, twilio_number, niche, seconds_used_this_month, monthly_minute_limit, bonus_minutes, recording_consent_acknowledged_at)')
      .eq('user_id', user.id)
      .order('role').limit(1)
    const cu = cuRows?.[0] ?? null

    // S12-V5b: No client_users row = user authenticated but not authorized for any client
    if (!cu) {
      redirect('/onboard')
    }

    isAdmin = cu?.role === 'admin'
    clientId = isAdmin ? null : (cu?.client_id as string | null) ?? null
    const clientData = cu?.clients as { business_name?: string; status?: string; subscription_status?: string | null; trial_expires_at?: string | null; telegram_bot_token?: string | null; telegram_chat_id?: string | null; setup_complete?: boolean; twilio_number?: string | null; niche?: string | null; seconds_used_this_month?: number | null; monthly_minute_limit?: number | null; bonus_minutes?: number | null; recording_consent_acknowledged_at?: string | null } | null
    businessName = isAdmin ? undefined : clientData?.business_name ?? undefined
    clientStatus = isAdmin ? null : clientData?.status ?? null
    subscriptionStatus = isAdmin ? null : clientData?.subscription_status ?? null
    trialExpiresAt = isAdmin ? null : clientData?.trial_expires_at ?? null
    telegramConnected = !!(clientData?.telegram_bot_token && clientData?.telegram_chat_id)
    setupComplete = isAdmin ? true : (clientData?.setup_complete ?? true)
    twilioNumber = isAdmin ? null : (clientData?.twilio_number ?? null)
    clientNiche = isAdmin ? null : (clientData?.niche ?? null)
    if (!isAdmin) {
      minutesUsed = Math.ceil((clientData?.seconds_used_this_month ?? 0) / 60)
      minuteLimit = clientData?.monthly_minute_limit ?? null
      bonusMinutes = clientData?.bonus_minutes ?? 0
    }
    needsRecordingConsent = !isAdmin && !!clientId && !clientData?.recording_consent_acknowledged_at

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

    // Server-side failed notification count for TopBar bell badge
    if (clientId && !isAdmin) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('notification_logs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'failed')
        .gte('created_at', since)
      failedNotifCount = count ?? 0
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

  const isTrialing = subscriptionStatus === 'trialing'

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-page t1">
      {/* Route loading bar — fixed at absolute top edge */}
      <Suspense>
        <RouteLoadingBar />
      </Suspense>

      {/* Universal top bar (all screen sizes) */}
      <DashboardShellClient
        businessName={businessName}
        isAdmin={isAdmin}
        failedNotifCount={failedNotifCount}
        userEmail={user?.email ?? undefined}
        minutesUsed={minutesUsed}
        minuteLimit={minuteLimit}
        bonusMinutes={bonusMinutes}
      />

      <Suspense>
        <UpgradeModalProvider>
        <CallProvider>
          <AdminClientProvider isAdmin={isAdmin} clients={adminClients}>
            {/* Phase 0.5.2 — banner self-gates on feature flag + admin scope */}
            <ActingAsBanner />

            {/* Desktop tab bar — sticky below TopBar */}
            <TabBar isAdmin={isAdmin} clientId={clientId} failedNotifCount={failedNotifCount} />

            {/* Forwarding banner — below TabBar so TabBar y-position stays constant */}
            {!isAdmin && !setupComplete && clientStatus === 'active' && subscriptionStatus !== 'trialing' && (
              <ForwardingBanner twilioNumber={twilioNumber} />
            )}

            <div className="flex flex-1 min-h-0 relative overflow-hidden">
              {/* Sidebar — kept for safety, hidden from view */}
              <div className="hidden" aria-hidden="true">
              <Sidebar
                businessName={businessName}
                isAdmin={isAdmin}
                clientId={clientId}
                setupIncomplete={!isAdmin && clientStatus === 'setup'}
                telegramConnected={telegramConnected}
                niche={clientNiche}
                clientStatus={clientStatus}
                subscriptionStatus={subscriptionStatus}
                trialExpiresAt={trialExpiresAt}
                initialCollapsed={false}
                userEmail={user?.email ?? undefined}
              />
              </div>

              {/* Main content — pb-16 on mobile to clear fixed BottomTabBar */}
              <main className="flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0 dashboard-main">
                {/* Phase 1 — admin client switcher (self-gates on flag + admin role) */}
                <ClientSwitcher />
                <AdminCommandStrip />
                {/* Activity sub-nav — only visible on Activity routes */}
                <ActivitySubNav isTrialing={isTrialing} niche={clientNiche} />
                <PageTransition>{children}</PageTransition>
              </main>

              {/* Activity feed — XL+ right panel — admin only */}
              {isAdmin && <ActivityFeed isAdmin={isAdmin} clientId={clientId} />}
            </div>

            {/* Mobile bottom tab bar */}
            <BottomTabBar />
          </AdminClientProvider>
          <FloatingCallOrb />
          <UpgradeModal />
        </CallProvider>
        </UpgradeModalProvider>
      </Suspense>
      <DashboardToaster />
      <RealtimeToasts clientId={clientId} isAdmin={isAdmin} />
      {needsRecordingConsent && clientId && (
        <RecordingConsentGate clientId={clientId} />
      )}
    </div>
  )
}
