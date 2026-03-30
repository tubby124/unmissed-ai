import { createServerClient } from '@/lib/supabase/server'
import OperatorActivity from '@/components/dashboard/OperatorActivity'
import StatsGrid from '@/components/dashboard/StatsGrid'
import OutcomeCharts from '@/components/dashboard/OutcomeCharts'

export const dynamic = 'force-dynamic'

export default async function OtherPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let clientId: string | null = null
  let isAdmin = false

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role')
      .eq('user_id', user.id)
      .order('role')
      .limit(1)
      .maybeSingle()

    isAdmin = cu?.role === 'admin'
    if (!isAdmin) clientId = cu?.client_id ?? null
  }

  // Fetch calls for current month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  let callsQuery = supabase
    .from('call_logs')
    .select('call_status, started_at, duration_seconds')
    .gte('started_at', monthStart)
    .order('started_at', { ascending: false })
    .limit(500)

  if (!isAdmin && clientId) callsQuery = callsQuery.eq('client_id', clientId)

  const { data: callsRaw } = await callsQuery
  const calls = (callsRaw ?? []) as { call_status: string | null; started_at: string; duration_seconds: number | null }[]

  const totalCalls = calls.length
  const hotLeads = calls.filter(c => c.call_status === 'HOT').length
  const missedCalls = calls.filter(c => c.call_status === 'MISSED').length

  return (
    <div className="p-3 sm:p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-base font-semibold t1">Analytics</h1>
        <p className="text-[11px] t3 mt-0.5">Metrics and activity overview</p>
      </div>

      <StatsGrid
        totalCalls={totalCalls}
        hotLeads={hotLeads}
        missedCalls={missedCalls}
        calls={calls}
      />

      <OutcomeCharts calls={calls} />

      <OperatorActivity clientId={clientId} />
    </div>
  )
}
