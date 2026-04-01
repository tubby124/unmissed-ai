import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import CallsList from '@/components/dashboard/CallsList'
import LearningLoopCard from '@/components/dashboard/settings/LearningLoopCard'
import ContactsView from '@/components/dashboard/ContactsView'
import AgentConfigCard from '@/components/dashboard/AgentConfigCard'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import LeadQueue from '@/components/dashboard/LeadQueue'

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
  after_hours_behavior?: string | null
  business_hours_weekday?: string | null
  business_hours_weekend?: string | null
  forwarding_number?: string | null
  voicemail_greeting_text?: string | null
  ivr_enabled?: boolean | null
  sms_enabled?: boolean | null
  outbound_vm_script?: string | null
  outbound_tone?: string | null
  outbound_goal?: string | null
  outbound_opening?: string | null
  call_handling_mode?: string | null
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
  let clientAgentName: string | null = null
  let clientHasAgent = false
  let isAdmin = false
  let adminClients: ClientInfo[] = []
  let minutesUsed = 0
  let minuteLimit = DEFAULT_MINUTE_LIMIT
  let bonusMinutes = 0
  // Agent config fields
  let afterHoursBehavior: string | null = null
  let businessHoursWeekday: string | null = null
  let businessHoursWeekend: string | null = null
  let forwardingNumber: string | null = null
  let voicemailGreetingText: string | null = null
  let ivrEnabled: boolean | null = null
  let smsEnabled: boolean | null = null
  let outboundVmScript: string | null = null
  let outboundTone: string | null = null
  let outboundGoal: string | null = null
  let outboundOpening: string | null = null
  let callHandlingMode: string | null = null
  let transferConditions: string | null = null
  let ivrPrompt: string | null = null

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(twilio_number, slug, business_name, status, seconds_used_this_month, monthly_minute_limit, bonus_minutes, telegram_bot_token, telegram_chat_id, agent_name, ultravox_agent_id, after_hours_behavior, business_hours_weekday, business_hours_weekend, forwarding_number, voicemail_greeting_text, ivr_enabled, sms_enabled, outbound_vm_script, outbound_tone, outbound_goal, outbound_opening, call_handling_mode, transfer_conditions, ivr_prompt)')
      .eq('user_id', user.id)
      .order('role').limit(1).maybeSingle()

    if (cu?.role === 'admin') {
      isAdmin = true
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes, agent_name, ultravox_agent_id, after_hours_behavior, business_hours_weekday, business_hours_weekend, forwarding_number, voicemail_greeting_text, ivr_enabled, sms_enabled, outbound_vm_script, outbound_tone, outbound_goal, outbound_opening, call_handling_mode, transfer_conditions, ivr_prompt')
        .order('business_name')
      adminClients = (allClients ?? []) as ClientInfo[]

      // If admin has a client selected, load that client's agent info for test card
      if (adminSelectedClientId) {
        const selected = (allClients ?? []).find(c => c.id === adminSelectedClientId) as Record<string, unknown> | undefined
        if (selected) {
          clientId = adminSelectedClientId
          clientBusinessName = (selected.business_name as string) ?? null
          clientAgentName = (selected.agent_name as string) ?? null
          clientHasAgent = !!(selected.ultravox_agent_id)
          clientStatus = (selected.status as string) ?? null
          clientPhone = (selected.twilio_number as string) ?? null
          afterHoursBehavior = (selected.after_hours_behavior as string) ?? null
          businessHoursWeekday = (selected.business_hours_weekday as string) ?? null
          businessHoursWeekend = (selected.business_hours_weekend as string) ?? null
          forwardingNumber = (selected.forwarding_number as string) ?? null
          voicemailGreetingText = (selected.voicemail_greeting_text as string) ?? null
          ivrEnabled = (selected.ivr_enabled as boolean) ?? null
          smsEnabled = (selected.sms_enabled as boolean) ?? null
          outboundVmScript = (selected.outbound_vm_script as string) ?? null
          outboundTone = (selected.outbound_tone as string) ?? null
          outboundGoal = (selected.outbound_goal as string) ?? null
          outboundOpening = (selected.outbound_opening as string) ?? null
          callHandlingMode = (selected.call_handling_mode as string) ?? null
          transferConditions = (selected.transfer_conditions as string) ?? null
          ivrPrompt = (selected.ivr_prompt as string) ?? null
        }
      }
    } else {
      const clientData = cu?.clients as { twilio_number?: string; slug?: string; business_name?: string; status?: string; seconds_used_this_month?: number | null; monthly_minute_limit?: number | null; bonus_minutes?: number | null; telegram_bot_token?: string | null; telegram_chat_id?: string | null; agent_name?: string | null; ultravox_agent_id?: string | null; after_hours_behavior?: string | null; business_hours_weekday?: string | null; business_hours_weekend?: string | null; forwarding_number?: string | null; voicemail_greeting_text?: string | null; ivr_enabled?: boolean | null; sms_enabled?: boolean | null; outbound_vm_script?: string | null; outbound_tone?: string | null; outbound_goal?: string | null; outbound_opening?: string | null; call_handling_mode?: string | null; transfer_conditions?: string | null; ivr_prompt?: string | null } | null
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
      afterHoursBehavior = clientData?.after_hours_behavior ?? null
      businessHoursWeekday = clientData?.business_hours_weekday ?? null
      businessHoursWeekend = clientData?.business_hours_weekend ?? null
      forwardingNumber = clientData?.forwarding_number ?? null
      voicemailGreetingText = clientData?.voicemail_greeting_text ?? null
      ivrEnabled = clientData?.ivr_enabled ?? null
      smsEnabled = clientData?.sms_enabled ?? null
      outboundVmScript = clientData?.outbound_vm_script ?? null
      outboundTone = clientData?.outbound_tone ?? null
      outboundGoal = clientData?.outbound_goal ?? null
      outboundOpening = clientData?.outbound_opening ?? null
      callHandlingMode = clientData?.call_handling_mode ?? null
      transferConditions = clientData?.transfer_conditions ?? null
      ivrPrompt = clientData?.ivr_prompt ?? null

      // Redirect setup clients to setup page
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

  if (!isAdmin && clientId) q = q.eq('client_id', clientId)

  const { data: calls } = await q

  // Campaign leads (outbound queue)
  let leadsQuery = supabase
    .from('campaign_leads')
    .select('id, client_id, phone, name, status, notes, added_at, last_called_at, call_count, disposition, last_call_log_id, scheduled_callback_at, lead_status, clients(business_name)')
    .order('added_at', { ascending: false })
  if (!isAdmin && clientId) leadsQuery = leadsQuery.eq('client_id', clientId)
  const { data: leadsRaw } = await leadsQuery
  const leads = (leadsRaw ?? []).map(l => ({
    ...l,
    clients: Array.isArray(l.clients) ? (l.clients[0] ?? null) : (l.clients ?? null),
  })) as Parameters<typeof LeadQueue>[0]['initialLeads']

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

      {/* Agent config + Talk to Agent (3-col: config | orb | config right) */}
      {clientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <div className="md:col-span-2">
            <AgentConfigCard
              afterHoursBehavior={afterHoursBehavior}
              businessHoursWeekday={businessHoursWeekday}
              businessHoursWeekend={businessHoursWeekend}
              forwardingNumber={forwardingNumber}
              voicemailGreetingText={voicemailGreetingText}
              ivrEnabled={ivrEnabled}
              smsEnabled={smsEnabled}
              outboundVmScript={outboundVmScript}
              outboundTone={outboundTone}
              outboundGoal={outboundGoal}
              outboundOpening={outboundOpening}
              callHandlingMode={callHandlingMode}
              transferConditions={transferConditions}
              ivrPrompt={ivrPrompt}
              clientId={clientId}
            />
          </div>
          <TestCallCard clientId={clientId} isAdmin={isAdmin} />
        </div>
      )}

      {/* Call log — full width (contains StatsGrid 5-col, OutcomeCharts 3-col, MinuteUsage, call table) */}
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

      {/* Bottom row — 3-col: lead queue | learning loop | contacts */}
      {clientId && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <LeadQueue
            initialLeads={leads}
            clients={isAdmin
              ? adminClients.map(c => ({ id: c.id, slug: c.slug, business_name: c.business_name }))
              : clientId && clientBusinessName
                ? [{ id: clientId, slug: clientSlug ?? '', business_name: clientBusinessName }]
                : []
            }
          />
          <LearningLoopCard clientId={clientId} isAdmin={isAdmin} />
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Contacts</p>
            <ContactsView clientId={clientId} />
          </div>
        </div>
      )}

    </div>
  )
}
