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
  let clientSlug: string | null = null
  let clientBusinessName: string | null = null
  let clientId: string | null = null
  let isAdmin = false
  let adminClients: ClientInfo[] = []

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(twilio_number, slug, business_name)')
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
      const clientData = cu?.clients as { twilio_number?: string; slug?: string; business_name?: string } | null
      clientPhone = clientData?.twilio_number ?? null
      clientSlug = clientData?.slug ?? null
      clientBusinessName = clientData?.business_name ?? null
      clientId = cu?.client_id ?? null
    }
  }

  let q = supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, client_id, confidence, sentiment, key_topics, next_steps, quality_score, clients(business_name, slug)')
    .order('started_at', { ascending: false })
    .limit(200)

  if (!isAdmin && clientId) q = q.eq('client_id', clientId)

  const { data: calls } = await q

  const allCalls = (calls ?? []).map(c => ({
    ...c,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
  }))

  return (
    <div className="p-3 sm:p-6">
      <CallsList
        initialCalls={allCalls}
        phone={clientPhone}
        isAdmin={isAdmin}
        adminClients={adminClients}
        clientSlug={clientSlug}
        clientBusinessName={clientBusinessName}
        clientId={clientId}
      />
    </div>
  )
}
