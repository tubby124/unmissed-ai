import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  // Admin uses Command Center — this endpoint is for non-admin clients
  if (cu.role === 'admin') {
    return NextResponse.json({ admin: true })
  }

  const clientId = cu.client_id

  // Parallel fetch: client info, this month's calls, bookings, last call
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()

  const [clientRes, callsRes, prevCallsRes, bookingsRes, recentRes] = await Promise.all([
    // Client config
    supabase
      .from('clients')
      .select('id, business_name, agent_name, status, niche, seconds_used_this_month, monthly_minute_limit, bonus_minutes, booking_enabled, sms_enabled, forwarding_number, knowledge_backend, business_facts, extra_qa, business_hours_weekday, website_url, calendar_auth_status, twilio_number, telegram_bot_token, telegram_chat_id, ultravox_agent_id')
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

    // Recent 5 calls
    supabase
      .from('call_logs')
      .select('id, ultravox_call_id, caller_phone, call_status, duration_seconds, started_at, ai_summary, sentiment')
      .eq('client_id', clientId)
      .neq('call_status', 'test')
      .order('started_at', { ascending: false })
      .limit(5),
  ])

  const client = clientRes.data
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const calls = callsRes.data ?? []
  const prevCalls = prevCallsRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const recentCalls = recentRes.data ?? []

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

  // Capability flags for action items
  const capabilities = {
    hasKnowledge: client.knowledge_backend === 'pgvector',
    hasFacts: !!client.business_facts,
    hasFaqs: Array.isArray(client.extra_qa) && client.extra_qa.length > 0,
    hasHours: !!client.business_hours_weekday,
    hasBooking: !!(client.booking_enabled && client.calendar_auth_status === 'connected'),
    hasSms: !!client.sms_enabled,
    hasTransfer: !!client.forwarding_number,
    hasWebsite: !!client.website_url,
  }

  return NextResponse.json({
    admin: false,
    agent: {
      name: client.agent_name ?? client.business_name,
      status: client.status,
      niche: client.niche,
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
    recentCalls: recentCalls.map(c => ({
      id: c.id,
      ultravox_call_id: c.ultravox_call_id,
      caller_phone: c.caller_phone,
      call_status: c.call_status,
      duration_seconds: c.duration_seconds,
      started_at: c.started_at,
      ai_summary: c.ai_summary,
      sentiment: c.sentiment,
    })),
    capabilities,
    onboarding: {
      businessName: client.business_name,
      clientStatus: client.status,
      hasPhoneNumber: !!client.twilio_number,
      hasAgent: !!client.ultravox_agent_id,
      telegramConnected: !!(client.telegram_bot_token && client.telegram_chat_id),
    },
  })
}
