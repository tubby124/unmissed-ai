import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LeadQueue from '@/components/dashboard/LeadQueue'
import LeadsView from '@/components/dashboard/LeadsView'
import OutboundConfigWrapper from '@/components/dashboard/OutboundConfigWrapper'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads' }

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
  follow_up_status: 'contacted' | 'booked' | 'dead' | null
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
    .order('role').limit(1).maybeSingle()

  const isAdmin = cu?.role === 'admin'

  // ── Admin path ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, slug, business_name')
      .order('business_name')

    const { data: leadsRaw } = await supabase
      .from('campaign_leads')
      .select('id, client_id, phone, name, status, notes, added_at, last_called_at, call_count, disposition, last_call_log_id, scheduled_callback_at, clients(business_name)')
      .order('added_at', { ascending: false })

    const leads = (leadsRaw ?? []).map(l => ({
      ...l,
      clients: Array.isArray(l.clients) ? (l.clients[0] ?? null) : (l.clients ?? null),
    })) as Parameters<typeof LeadQueue>[0]['initialLeads']

    return (
      <div className="p-3 sm:p-6">
        <LeadQueue
          initialLeads={leads}
          clients={(clients ?? []) as ClientInfo[]}
        />
      </div>
    )
  }

  // ── Client owner path ────────────────────────────────────────────────────────
  const clientId = cu?.client_id
  if (!clientId) redirect('/dashboard/calls')

  // Fetch client config (outbound_prompt + phone number status)
  const [{ data: clientRow }, { data: leadsRaw }, { data: callsRaw }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, slug, business_name, outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone, twilio_number')
      .eq('id', clientId)
      .single(),

    supabase
      .from('campaign_leads')
      .select('id, client_id, phone, name, status, notes, added_at, last_called_at, call_count, disposition, last_call_log_id, scheduled_callback_at')
      .eq('client_id', clientId)
      .order('added_at', { ascending: false }),

    supabase
      .from('call_logs')
      .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, key_topics, started_at, created_at, next_steps, follow_up_status, client_id')
      .in('call_status', ['HOT', 'WARM'])
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  // Shape leads so clients join matches LeadQueue expectations
  const ownerLeads = (leadsRaw ?? []).map(l => ({
    ...l,
    clients: clientRow ? { business_name: clientRow.business_name as string } : null,
  })) as Parameters<typeof LeadQueue>[0]['initialLeads']

  const clientInfoForQueue: ClientInfo[] = clientRow
    ? [{ id: clientRow.id as string, slug: clientRow.slug as string, business_name: clientRow.business_name as string }]
    : []

  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Outbound agent configuration */}
      <OutboundConfigWrapper
        initialOutboundPrompt={(clientRow?.outbound_prompt as string | null) ?? null}
        initialOutboundGoal={(clientRow?.outbound_goal as string | null) ?? null}
        initialOutboundOpening={(clientRow?.outbound_opening as string | null) ?? null}
        initialOutboundVmScript={(clientRow?.outbound_vm_script as string | null) ?? null}
        initialOutboundTone={((clientRow?.outbound_tone as string | null) ?? 'warm') as 'warm' | 'professional' | 'direct'}
        hasPhoneNumber={!!(clientRow?.twilio_number)}
        clientId={clientRow?.id as string}
      />

      {/* Outbound call queue */}
      <LeadQueue
        initialLeads={ownerLeads}
        clients={clientInfoForQueue}
      />

      {/* Inbound hot/warm leads (call-in contacts worth following up) */}
      {(callsRaw ?? []).length > 0 && (
        <LeadsView
          initialCalls={(callsRaw ?? []) as CallLog[]}
          clientId={clientId}
        />
      )}
    </div>
  )
}
