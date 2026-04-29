import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import CallsList from '@/components/dashboard/CallsList'
import ContactsView from '@/components/dashboard/ContactsView'

export const dynamic = 'force-dynamic'

interface ClientInfo {
  id: string
  slug: string
  business_name: string
  niche?: string | null
  status?: string | null
  twilio_number?: string | null
  seconds_used_this_month?: number | null
  monthly_minute_limit?: number | null
  bonus_minutes?: number | null
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const adminSelectedClientId = typeof params.client_id === 'string' ? params.client_id : null

  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  let clientPhone: string | null = null
  let clientSlug: string | null = null
  let clientBusinessName: string | null = null
  let clientId: string | null = null
  let clientStatus: string | null = null
  let isAdmin = false
  let adminClients: ClientInfo[] = []
  let minutesUsed = 0
  let minuteLimit = DEFAULT_MINUTE_LIMIT
  let bonusMinutes = 0

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(twilio_number, slug, business_name, status, seconds_used_this_month, monthly_minute_limit, bonus_minutes)')
      .eq('user_id', user.id)
      .order('role').limit(1).maybeSingle()

    if (cu?.role === 'admin') {
      isAdmin = true
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes')
        .order('business_name')
      adminClients = (allClients ?? []) as ClientInfo[]

      if (adminSelectedClientId) {
        const selected = (allClients ?? []).find(c => c.id === adminSelectedClientId) as Record<string, unknown> | undefined
        if (selected) {
          clientId = adminSelectedClientId
          clientBusinessName = (selected.business_name as string) ?? null
          clientStatus = (selected.status as string) ?? null
          clientPhone = (selected.twilio_number as string) ?? null
        }
      }
    } else {
      const clientData = cu?.clients as { twilio_number?: string; slug?: string; business_name?: string; status?: string; seconds_used_this_month?: number | null; monthly_minute_limit?: number | null; bonus_minutes?: number | null } | null
      clientPhone = clientData?.twilio_number ?? null
      clientSlug = clientData?.slug ?? null
      clientBusinessName = clientData?.business_name ?? null
      clientId = cu?.client_id ?? null
      clientStatus = clientData?.status ?? null
      minutesUsed = Math.ceil((clientData?.seconds_used_this_month ?? 0) / 60)
      minuteLimit = clientData?.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
      bonusMinutes = clientData?.bonus_minutes ?? 0

      if (clientStatus === 'setup') {
        redirect('/dashboard/setup')
      }
    }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  let q = supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, call_direction, ai_summary, service_type, duration_seconds, started_at, client_id, confidence, sentiment, key_topics, next_steps, quality_score, transfer_status, sms_outcome, clients(business_name, slug)')
    .gte('started_at', monthStart)
    .order('started_at', { ascending: false })
    .limit(500)

  // Phase 3 Wave A — admin in scope filters by selected client too. When admin
  // is unscoped clientId stays null so the all-clients view is preserved.
  if (clientId) q = q.eq('client_id', clientId)

  const { data: calls } = await q

  const allCalls = (calls ?? []).map(c => ({
    ...c,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
  }))

  // Resolve calls stuck in 'processing' for >5min (after() callback died on Railway restart)
  const now = Date.now()
  const stuckIds = allCalls
    .filter(c =>
      c.call_status === 'processing' &&
      now - new Date(c.started_at).getTime() > 5 * 60 * 1000
    )
    .map(c => c.ultravox_call_id)

  if (stuckIds.length > 0) {
    const svc = createServiceClient()
    await svc.from('call_logs')
      .update({ call_status: 'UNKNOWN', ai_summary: 'Unclassified \u2014 the AI answered but couldn\'t categorize this call. Listen to the recording to review.' })
      .in('ultravox_call_id', stuckIds)
    for (const c of allCalls) {
      if (stuckIds.includes(c.ultravox_call_id)) {
        c.call_status = 'UNKNOWN'
        c.ai_summary = 'Unclassified \u2014 the AI answered but couldn\'t categorize this call. Listen to the recording to review.'
      }
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold t1">Calls &amp; Leads</h1>
        <p className="text-[11px] t3 mt-0.5">Inbound activity and outbound follow-up</p>
      </div>

      {/* Call log (left, 2/3) + Contacts (right, 1/3). Nothing else. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <CallsList
            initialCalls={allCalls}
            phone={clientPhone}
            isAdmin={isAdmin}
            adminClients={adminClients}
            clientSlug={clientSlug}
            clientBusinessName={clientBusinessName}
            clientId={clientId}
            clientStatus={clientStatus}
            minutesUsed={minutesUsed}
            minuteLimit={minuteLimit}
            bonusMinutes={bonusMinutes}
            hideAnalytics
            hideMinuteUsage
          />
        </div>
        {clientId && (
          <div className="lg:col-span-1 min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Contacts</p>
            <ContactsView clientId={clientId} />
          </div>
        )}
      </div>

    </div>
  )
}
