import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SystemPulse from '@/components/dashboard/SystemPulse'
import ActionItems from '@/components/dashboard/ActionItems'
import LiveCallBanner from '@/components/dashboard/LiveCallBanner'
import ClientHealthBar from '@/components/dashboard/ClientHealthBar'
import PageHeader from '@/components/dashboard/PageHeader'
import SectionLabel from '@/components/dashboard/SectionLabel'
import { isAdminRedesignEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

// Phase 2 — admin Command Center, pure relocation from /dashboard.
// When the feature flag is off, this route 404-redirects so admins keep seeing
// the legacy /dashboard Command Center until rollout day.
export default async function AdminDashboardPage() {
  if (!isAdminRedesignEnabled()) {
    redirect('/dashboard')
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: allClients } = await supabase
    .from('clients')
    .select('id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes')
    .eq('status', 'active')
    .order('business_name')

  const adminClients = (allClients ?? []).map(c => ({
    id: c.id,
    slug: c.slug,
    business_name: c.business_name,
    niche: (c as Record<string, unknown>).niche as string | null ?? null,
    status: (c as Record<string, unknown>).status as string | null ?? null,
    twilio_number: (c as Record<string, unknown>).twilio_number as string | null ?? null,
    seconds_used_this_month: c.seconds_used_this_month as number | null ?? null,
    monthly_minute_limit: c.monthly_minute_limit as number | null ?? null,
    bonus_minutes: c.bonus_minutes as number | null ?? null,
  }))

  const { data: liveCalls } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, started_at, transfer_status, clients(business_name)')
    .eq('call_status', 'live')
    .order('started_at', { ascending: false })

  const liveCallsForBanner = (liveCalls ?? []).map(c => ({
    id: c.id,
    ultravox_call_id: c.ultravox_call_id,
    caller_phone: c.caller_phone,
    started_at: c.started_at,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
    transfer_status: c.transfer_status,
  }))

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: hotLeads } = await supabase
    .from('call_logs')
    .select('client_id, started_at')
    .eq('call_status', 'HOT')
    .gte('started_at', monthStart)

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Command Center" subtitle="What needs attention right now" />

      <SystemPulse />

      <div>
        <SectionLabel className="mb-2">Action Items</SectionLabel>
        <ActionItems />
      </div>

      <LiveCallBanner calls={liveCallsForBanner} />

      <ClientHealthBar
        adminClients={adminClients}
        hotLeads={(hotLeads ?? []).map(h => ({ client_id: h.client_id, started_at: h.started_at }))}
      />
    </div>
  )
}
