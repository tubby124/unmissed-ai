import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import CampaignGrid from '@/components/dashboard/CampaignGrid'

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
    .select('id, slug, business_name, niche, status, twilio_number')
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

    return { id: client.id, business_name: client.business_name, slug: client.slug, niche: (client as Record<string, unknown>).niche as string | null ?? null, status: (client as Record<string, unknown>).status as string | null ?? null, twilio_number: (client as Record<string, unknown>).twilio_number as string | null ?? null, total_calls, hot_leads, last_call_at, daily_counts }
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
        <h1 className="text-lg font-semibold t1">Performance</h1>
        <p className="text-xs t3 mt-0.5">
          Per-client call performance — {campaigns.length} agent{campaigns.length !== 1 ? 's' : ''}
        </p>
      </div>

      <CampaignGrid campaigns={campaigns} />
    </div>
  )
}
