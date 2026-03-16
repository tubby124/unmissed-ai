import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import CampaignCard from '@/components/dashboard/CampaignCard'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  // Fetch all clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, business_name')
    .order('business_name')

  // Fetch all non-live call_logs for aggregation
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('client_id, call_status, started_at')
    .in('call_status', ['HOT', 'WARM', 'COLD', 'JUNK'])
    .order('started_at', { ascending: false })

  const logs = callLogs ?? []
  const now = Date.now()
  const DAY = 86400000

  const campaigns = (clients ?? []).map(client => {
    const clientLogs = logs.filter(l => l.client_id === client.id)
    const total_calls = clientLogs.length
    const hot_leads = clientLogs.filter(l => l.call_status === 'HOT').length
    const sorted = clientLogs.slice().sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )
    const last_call_at = sorted[0]?.started_at ?? null

    // Last 7 days daily counts
    const daily_counts = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(now - (6 - i) * DAY).setHours(0, 0, 0, 0)
      const end = start + DAY
      return clientLogs.filter(l => {
        const t = new Date(l.started_at).getTime()
        return t >= start && t < end
      }).length
    })

    return { id: client.id, business_name: client.business_name, slug: client.slug, total_calls, hot_leads, last_call_at, daily_counts }
  }).sort((a, b) => {
    if (!a.last_call_at && !b.last_call_at) return 0
    if (!a.last_call_at) return 1
    if (!b.last_call_at) return -1
    return new Date(b.last_call_at).getTime() - new Date(a.last_call_at).getTime()
  })

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold t1">Campaigns</h1>
        <p className="text-xs t3 mt-0.5">
          Per-client call performance — {campaigns.length} active agent{campaigns.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Campaign grid */}
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 t3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-25">
            <rect x="18" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="8" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="13" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <p className="text-sm">No clients provisioned yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  )
}
