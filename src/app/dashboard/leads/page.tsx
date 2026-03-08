import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LeadQueue from '@/components/dashboard/LeadQueue'

export const dynamic = 'force-dynamic'

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

export default async function LeadsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, business_name')
    .order('business_name')

  const { data: leadsRaw } = await supabase
    .from('campaign_leads')
    .select('id, client_id, phone, name, status, notes, added_at, last_called_at, clients(business_name)')
    .order('added_at', { ascending: false })

  // Normalize clients join: Supabase returns array for foreign key, pick first or null
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
