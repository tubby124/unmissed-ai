import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import { buildClientAgentConfig } from '@/lib/build-client-agent-config'
import { buildTrialWelcomeViewModel } from '@/lib/build-trial-welcome-view-model'
import { buildCapabilityFlags } from '@/lib/capability-flags'
import { deriveActivationState } from '@/lib/derive-activation-state'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const adminClientId = searchParams.get('client_id')

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  // Admin without specific client → Command Center (no client home)
  if (cu.role === 'admin' && !adminClientId) {
    return NextResponse.json({ admin: true })
  }

  // Admin viewing a specific client → use that client's ID
  const clientId = cu.role === 'admin' ? adminClientId! : cu.client_id

  // Parallel fetch: client info, this month's calls, bookings, last call
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()

  const [clientRes, callsRes, prevCallsRes, bookingsRes, recentRes, knowledgeRes, gapsRes] = await Promise.all([
    // Client config — slug + setup_complete added for buildClientAgentConfig
    supabase
      .from('clients')
      .select('id, slug, business_name, agent_name, status, subscription_status, trial_expires_at, niche, agent_voice_id, voice_style_preset, seconds_used_this_month, monthly_minute_limit, bonus_minutes, booking_enabled, sms_enabled, forwarding_number, transfer_conditions, knowledge_backend, business_facts, extra_qa, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, services_offered, website_url, website_scrape_status, calendar_auth_status, twilio_number, telegram_bot_token, telegram_chat_id, ultravox_agent_id, selected_plan, setup_complete, last_agent_sync_at, last_agent_sync_status')
      .eq('id', clientId)
      .single(),

    // This month's calls
    supabase
      .from('call_logs')
      .select('call_status, duration_seconds, quality_score, sentiment')
      .eq('client_id', clientId)
      .gte('started_at', monthStart)
      .neq('call_status', 'test'),

    // Previous month calls (for trend)
    supabase
      .from('call_logs')
      .select('call_status')
      .eq('client_id', clientId)
      .gte('started_at', prevMonthStart)
      .lt('started_at', monthStart)
      .neq('call_status', 'test'),

    // Bookings this month
    supabase
      .from('bookings')
      .select('id')
      .eq('client_id', clientId)
      .gte('created_at', monthStart),

    // Recent 5 calls — test calls included so trial users see evidence of activity
    supabase
      .from('call_logs')
      .select('id, ultravox_call_id, caller_phone, call_status, duration_seconds, started_at, ai_summary, sentiment')
      .eq('client_id', clientId)
      .order('started_at', { ascending: false })
      .limit(5),

    // Knowledge chunk counts by source + status (for knowledge tile)
    supabase
      .from('knowledge_chunks')
      .select('source, status, updated_at')
      .eq('client_id', clientId),

    // Open gaps count (for insights header)
    supabase
      .from('knowledge_query_log')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('result_count', 0)
      .is('resolved_at', null),
  ])

  const client = clientRes.data
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const calls = callsRes.data ?? []
  const prevCalls = prevCallsRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const recentCalls = recentRes.data ?? []
  const knowledgeChunks = knowledgeRes.data ?? []

  // Knowledge tile data
  const approvedChunks = knowledgeChunks.filter(k => k.status === 'approved')
  const pendingChunks = knowledgeChunks.filter(k => k.status === 'pending')
  const sourceTypes = [...new Set(approvedChunks.map(k => k.source as string))]
  const allUpdatedAts = approvedChunks.map(k => k.updated_at).filter(Boolean) as string[]
  const lastUpdatedAt = allUpdatedAts.length > 0
    ? allUpdatedAts.sort().reverse()[0]
    : null

  // G5/D: Knowledge coverage + open gaps for insights header
  const openGaps = gapsRes.count ?? 0
  const coverageDenominator = approvedChunks.length + pendingChunks.length + openGaps
  const knowledgeCoverage = coverageDenominator > 0
    ? Math.round((approvedChunks.length / coverageDenominator) * 100)
    : null

  // Activation state — truthful readiness, not just setup flags
  const activation = deriveActivationState({
    twilio_number: client.twilio_number,
    setup_complete: client.setup_complete as boolean | null,
  })

  // Aggregate stats
  const totalCalls = calls.length
  const prevTotalCalls = prevCalls.length
  const hotLeads = calls.filter(c => c.call_status === 'HOT').length
  const prevHotLeads = prevCalls.filter(c => c.call_status === 'HOT').length

  const qualities = calls.filter(c => c.quality_score && c.quality_score > 0).map(c => c.quality_score!)
  const avgQuality = qualities.length > 0
    ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length * 10) / 10
    : null

  const minutesUsed = Math.ceil((client.seconds_used_this_month ?? 0) / 60)
  const minuteLimit = client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
  const bonusMinutes = client.bonus_minutes ?? 0

  // Capability flags — truthful runtime readiness, not just DB flag state
  const capabilities = buildCapabilityFlags(client)

  // hasInteracted: true when user has made at least one call (including test calls)
  const hasInteracted = recentCalls.length > 0

  // compiledChunkCount: approved AI Compiler chunks (for view model knowledge badge)
  const compiledChunkCount = knowledgeChunks.filter(k => k.source === 'compiled_import' && k.status === 'approved').length

  // Build normalized config → trial welcome view model
  const c = client as Record<string, unknown>
  const config = buildClientAgentConfig({
    id: client.id,
    slug: c.slug as string ?? client.id,
    business_name: client.business_name,
    niche: client.niche,
    website_url: client.website_url,
    booking_enabled: client.booking_enabled,
    sms_enabled: client.sms_enabled,
    forwarding_number: client.forwarding_number,
    transfer_conditions: c.transfer_conditions as string | null,
    knowledge_backend: client.knowledge_backend,
    business_facts: client.business_facts,
    extra_qa: client.extra_qa as { q: string; a: string }[] | null,
    business_hours_weekday: client.business_hours_weekday,
    business_hours_weekend: c.business_hours_weekend as string | null,
    after_hours_behavior: c.after_hours_behavior as string | null,
    voice_style_preset: c.voice_style_preset as string | null,
    agent_voice_id: client.agent_voice_id,
    agent_name: client.agent_name,
    subscription_status: c.subscription_status as string | null,
    trial_expires_at: c.trial_expires_at as string | null,
    setup_complete: c.setup_complete as boolean | null,
    monthly_minute_limit: client.monthly_minute_limit,
    selected_plan: c.selected_plan as string | null,
  })
  const trialWelcome = buildTrialWelcomeViewModel(config, !!client.ultravox_agent_id, new Date(), compiledChunkCount, hasInteracted)

  return NextResponse.json({
    admin: false,
    clientId,
    agent: {
      name: client.agent_name ?? client.business_name,
      status: client.status,
      niche: client.niche,
      voiceStylePreset: (c.voice_style_preset as string | null) ?? null,
    },
    stats: {
      totalCalls,
      hotLeads,
      bookings: bookings.length,
      avgQuality,
      trends: {
        callsChange: prevTotalCalls > 0 ? Math.round(((totalCalls - prevTotalCalls) / prevTotalCalls) * 100) : totalCalls > 0 ? 100 : null,
        hotChange: prevHotLeads > 0 ? Math.round(((hotLeads - prevHotLeads) / prevHotLeads) * 100) : hotLeads > 0 ? 100 : null,
      },
    },
    usage: {
      minutesUsed,
      minuteLimit,
      bonusMinutes,
      totalAvailable: minuteLimit + bonusMinutes,
    },
    recentCalls: recentCalls.map(call => ({
      id: call.id,
      ultravox_call_id: call.ultravox_call_id,
      caller_phone: call.caller_phone,
      call_status: call.call_status,
      duration_seconds: call.duration_seconds,
      started_at: call.started_at,
      ai_summary: call.ai_summary,
      sentiment: call.sentiment,
    })),
    capabilities,
    onboarding: {
      businessName: client.business_name,
      clientStatus: client.status,
      subscriptionStatus: c.subscription_status as string | null ?? null,
      trialExpiresAt: c.trial_expires_at as string | null ?? null,
      servicesOffered: c.services_offered as string | null ?? null,
      agentVoiceId: c.agent_voice_id as string | null ?? null,
      hasPhoneNumber: !!client.twilio_number,
      hasAgent: !!client.ultravox_agent_id,
      telegramConnected: !!(client.telegram_bot_token && client.telegram_chat_id),
    },
    trialWelcome,
    selectedPlan: (c.selected_plan as string | null) ?? null,
    websiteScrapeStatus: (client.website_scrape_status as string | null) ?? null,
    activation: {
      state: activation,
      twilio_number_present: !!client.twilio_number,
      setup_complete: (c.setup_complete as boolean | null) ?? null,
    },
    agentSync: {
      last_agent_sync_at: (c.last_agent_sync_at as string | null) ?? null,
      last_agent_sync_status: (c.last_agent_sync_status as string | null) ?? null,
    },
    knowledge: {
      approved_chunk_count: approvedChunks.length,
      pending_review_count: pendingChunks.length,
      source_types: sourceTypes,
      last_updated_at: lastUpdatedAt,
    },
    insights: {
      knowledgeCoverage,
      openGaps,
    },
    editableFields: {
      hoursWeekday: (c.business_hours_weekday as string | null) ?? null,
      hoursWeekend: (c.business_hours_weekend as string | null) ?? null,
      afterHoursBehavior: (c.after_hours_behavior as string | null) ?? null,
      afterHoursPhone: (c.after_hours_emergency_phone as string | null) ?? null,
      faqs: Array.isArray(client.extra_qa) ? (client.extra_qa as { q: string; a: string }[]) : [],
      forwardingNumber: (c.forwarding_number as string | null) ?? null,
      websiteUrl: (client.website_url as string | null) ?? null,
      businessFacts: (client.business_facts as string | null) ?? null,
    },
  })
}
