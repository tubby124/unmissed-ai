import { createServerClient } from '@/lib/supabase/server'
import CallsList from '@/components/dashboard/CallsList'

export const dynamic = 'force-dynamic'

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

export default async function CallsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  let clientPhone: string | null = null
  let isAdmin = false
  let adminClients: ClientInfo[] = []

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(twilio_number)')
      .eq('user_id', user.id)
      .single()

    if (cu?.role === 'admin') {
      isAdmin = true
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name')
        .order('business_name')
      adminClients = (allClients ?? []) as ClientInfo[]
    } else {
      clientPhone = (cu?.clients as { twilio_number?: string } | null)?.twilio_number ?? null
    }
  }

  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, client_id, clients(business_name, slug)')
    .order('started_at', { ascending: false })
    .limit(200)

  const allCalls = (calls ?? []).map(c => ({
    ...c,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
  }))

  return (
    <div className="p-6">
      <CallsList
        initialCalls={allCalls}
        phone={clientPhone}
        isAdmin={isAdmin}
        adminClients={adminClients}
      />
    </div>
  )
}
