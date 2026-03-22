import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import CallsList from '@/components/dashboard/CallsList'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import OperatorActivity from '@/components/dashboard/OperatorActivity'
import AgentTestCard from '@/components/dashboard/AgentTestCard'

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
  agent_name?: string | null
  ultravox_agent_id?: string | null
}

export default async function CallsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  let clientPhone: string | null = null
  let clientSlug: string | null = null
  let clientBusinessName: string | null = null
  let clientId: string | null = null
  let clientStatus: string | null = null
  let clientAgentName: string | null = null
  let clientHasAgent = false
  let isAdmin = false
  let adminClients: ClientInfo[] = []
  let minutesUsed = 0
  let minuteLimit = DEFAULT_MINUTE_LIMIT
  let bonusMinutes = 0
  let telegramConnected = false

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(twilio_number, slug, business_name, status, seconds_used_this_month, monthly_minute_limit, bonus_minutes, telegram_bot_token, telegram_chat_id, agent_name, ultravox_agent_id)')
      .eq('user_id', user.id)
      .single()

    if (cu?.role === 'admin') {
      isAdmin = true
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes')
        .order('business_name')
      adminClients = (allClients ?? []) as ClientInfo[]
    } else {
      const clientData = cu?.clients as { twilio_number?: string; slug?: string; business_name?: string; status?: string; seconds_used_this_month?: number | null; monthly_minute_limit?: number | null; bonus_minutes?: number | null; telegram_bot_token?: string | null; telegram_chat_id?: string | null; agent_name?: string | null; ultravox_agent_id?: string | null } | null
      clientPhone = clientData?.twilio_number ?? null
      clientSlug = clientData?.slug ?? null
      clientBusinessName = clientData?.business_name ?? null
      clientId = cu?.client_id ?? null
      clientStatus = clientData?.status ?? null
      clientAgentName = clientData?.agent_name ?? null
      clientHasAgent = !!clientData?.ultravox_agent_id
      minutesUsed = Math.ceil((clientData?.seconds_used_this_month ?? 0) / 60)
      minuteLimit = clientData?.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
      bonusMinutes = clientData?.bonus_minutes ?? 0
      telegramConnected = !!(clientData?.telegram_bot_token && clientData?.telegram_chat_id)

      // Redirect setup clients to setup page
      if (clientStatus === 'setup') {
        redirect('/dashboard/setup')
      }
    }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  let q = supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, client_id, confidence, sentiment, key_topics, next_steps, quality_score, transfer_status, clients(business_name, slug)')
    .gte('started_at', monthStart)
    .neq('call_status', 'test')
    .order('started_at', { ascending: false })
    .limit(500)

  if (!isAdmin && clientId) q = q.eq('client_id', clientId)

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

  const hasReceivedCall = allCalls.length > 0

  // Check if knowledge base has content for onboarding checklist
  let hasKnowledge = false
  if (!isAdmin && clientId) {
    const { count } = await supabase
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .limit(1)
    hasKnowledge = (count ?? 0) > 0
  }

  const isTrial = clientStatus === 'trial'
  const showChecklist = !isAdmin && (clientStatus === 'trial' || clientStatus === 'active')

  return (
    <div className="p-3 sm:p-6">
      {!isAdmin && clientHasAgent && (
        <AgentTestCard
          agentName={clientAgentName || clientBusinessName || 'Your Agent'}
          businessName={clientBusinessName || ''}
          clientStatus={clientStatus}
        />
      )}
      {showChecklist && (
        <OnboardingChecklist
          hasPhoneNumber={!!clientPhone}
          hasReceivedCall={hasReceivedCall}
          telegramConnected={telegramConnected}
          hasKnowledge={hasKnowledge}
          isTrial={isTrial}
        />
      )}
      <OperatorActivity clientId={clientId} />
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
      />
    </div>
  )
}
