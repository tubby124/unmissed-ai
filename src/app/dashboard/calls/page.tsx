import { createServerClient } from '@/lib/supabase/server'
import StatsGrid from '@/components/dashboard/StatsGrid'
import CallsList from '@/components/dashboard/CallsList'

export const dynamic = 'force-dynamic'

export default async function CallsPage() {
  const supabase = await createServerClient()

  // Get authenticated user's client
  const { data: { user } } = await supabase.auth.getUser()
  let clientPhone: string | null = null

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, clients(twilio_number)')
      .eq('user_id', user.id)
      .single()
    clientPhone = (cu?.clients as { twilio_number?: string } | null)?.twilio_number ?? null
  }

  // Fetch calls (RLS filters to this user's client automatically)
  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at')
    .order('started_at', { ascending: false })
    .limit(100)

  const allCalls = calls ?? []

  // Compute stats
  const completed = allCalls.filter(c => ['HOT','WARM','COLD','JUNK'].includes(c.call_status ?? ''))
  const hotLeads = completed.filter(c => c.call_status === 'HOT').length
  const avgDuration = completed.length
    ? Math.round(completed.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / completed.length)
    : 0
  const activeNow = allCalls.filter(c => c.call_status === 'live').length

  return (
    <div className="p-6 space-y-6">
      <StatsGrid
        totalCalls={completed.length}
        hotLeads={hotLeads}
        avgDurationSecs={avgDuration}
        activeNow={activeNow}
      />
      <CallsList initialCalls={allCalls} phone={clientPhone} />
    </div>
  )
}
