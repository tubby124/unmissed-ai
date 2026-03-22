import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SystemPulse from '@/components/dashboard/SystemPulse'
import ActionItems from '@/components/dashboard/ActionItems'
import LiveCallBanner from '@/components/dashboard/LiveCallBanner'
import ClientHealthBar from '@/components/dashboard/ClientHealthBar'
import ClientHome from '@/components/dashboard/ClientHome'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = cu?.role === 'admin'

  // Non-admin: show client home dashboard
  if (!isAdmin) return <ClientHome />

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
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          Command Center
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
          What needs attention right now
        </p>
      </div>

      {/* System health */}
      <SystemPulse />

      {/* Action items — the core of this page */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--color-text-3)' }}>
          Action Items
        </p>
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
