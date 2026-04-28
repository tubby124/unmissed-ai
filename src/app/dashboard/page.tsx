import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SystemPulse from '@/components/dashboard/SystemPulse'
import ActionItems from '@/components/dashboard/ActionItems'
import LiveCallBanner from '@/components/dashboard/LiveCallBanner'
import ClientHealthBar from '@/components/dashboard/ClientHealthBar'
import ClientHomeV2 from '@/components/dashboard/ClientHomeV2'
import PageHeader from '@/components/dashboard/PageHeader'
import SectionLabel from '@/components/dashboard/SectionLabel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  const isAdmin = cu?.role === 'admin'

  if (!isAdmin) {
    return <ClientHomeV2 />
  }

  // Admin in preview mode: show client's dashboard
  const isPreview = params.preview === 'true' && typeof params.client_id === 'string'
  if (isPreview) return <ClientHomeV2 />

  // Fetch admin data for Command Center
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

  // Fetch live calls for banner
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

  // Fetch HOT leads for ClientHealthBar
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: hotLeads } = await supabase
    .from('call_logs')
    .select('client_id, started_at')
    .eq('call_status', 'HOT')
    .gte('started_at', monthStart)

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Command Center" subtitle="What needs attention right now" />

      {/* System health */}
      <SystemPulse />

      {/* Action items — the core of this page */}
      <div>
        <SectionLabel className="mb-2">Action Items</SectionLabel>
        <ActionItems />
      </div>

      {/* Live calls */}
      <LiveCallBanner calls={liveCallsForBanner} />

      {/* Client health */}
      <ClientHealthBar
        adminClients={adminClients}
        hotLeads={(hotLeads ?? []).map(h => ({ client_id: h.client_id, started_at: h.started_at }))}
      />
    </div>
  )
}
