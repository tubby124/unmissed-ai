import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LeadQueue from '@/components/dashboard/LeadQueue'
import LeadsView from '@/components/dashboard/LeadsView'

export const dynamic = 'force-dynamic'

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  key_topics: string[] | null
  started_at: string | null
  created_at: string
  next_steps: string | null
  client_id?: string | null
}

export default async function LeadsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  const isAdmin = cu?.role === 'admin'

  // ── Admin path ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, slug, business_name')
      .order('business_name')

    const { data: leadsRaw } = await supabase
      .from('campaign_leads')
      .select('id, client_id, phone, name, status, notes, added_at, last_called_at, clients(business_name)')
      .order('added_at', { ascending: false })

    const leads = (leadsRaw ?? []).map(l => ({
      ...l,
      clients: Array.isArray(l.clients) ? (l.clients[0] ?? null) : (l.clients ?? null),
    })) as Parameters<typeof LeadQueue>[0]['initialLeads']

    return (
      <div className="p-6">
        <LeadQueue
          initialLeads={leads}
          clients={(clients ?? []) as ClientInfo[]}
        />
      </div>
    )
  }

  // ── Client path ─────────────────────────────────────────────────────────────
  const clientId = cu?.client_id
  if (!clientId) redirect('/dashboard/calls')

  const { data: callsRaw } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, key_topics, started_at, created_at, next_steps, client_id')
    .in('call_status', ['HOT', 'WARM'])
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="p-3 sm:p-6">
      <LeadsView
        initialCalls={(callsRaw ?? []) as CallLog[]}
        clientId={clientId}
      />
    </div>
  )
}
