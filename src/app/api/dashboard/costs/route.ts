import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ─── Pricing constants — update when rates change ────────────────────────────
const PRICING = {
  twilio_inbound_per_min: 0.0085,    // Twilio Canada local inbound voice
  twilio_outbound_per_min: 0.0140,   // Twilio Canada local outbound voice
  twilio_number_per_month: 1.15,     // Twilio local CA phone number rental/month
  ultravox_per_min: 0.05,            // Ultravox AI voice (billing rounds up to 60s min)
}

// Clients that make OUTBOUND calls (Twilio charges outbound rate)
const OUTBOUND_CLIENT_SLUGS = new Set<string>([]) // future: add outbound clients here

const ULTRAVOX_API = 'https://api.ultravox.ai/api'
const ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY

function getDateRange(range: string): { from: Date; to: Date; label: string } {
  const to = new Date()
  const from = new Date()
  switch (range) {
    case 'today':
      from.setHours(0, 0, 0, 0)
      return { from, to, label: 'Today' }
    case 'week':
      from.setDate(from.getDate() - 7)
      return { from, to, label: 'Last 7 Days' }
    case 'all':
      from.setFullYear(2024, 0, 1)
      return { from, to, label: 'All Time' }
    case 'month':
    default:
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      return { from, to, label: 'This Month' }
  }
}

function prorateNumberCost(range: string, clientCount: number, monthsMultiplier = 1): number {
  const monthly = PRICING.twilio_number_per_month * clientCount
  switch (range) {
    case 'today':  return monthly / 30
    case 'week':   return monthly / 4
    case 'all':    return monthly * monthsMultiplier
    case 'month':
    default:       return monthly
  }
}

function parseDuration(d: string | null | undefined): number {
  // Ultravox billedDuration format: "60s", "120s", "300s"
  if (!d) return 0
  const match = d.match(/^(\d+(?:\.\d+)?)s$/)
  return match ? parseFloat(match[1]) : 0
}

// ─── Pull Ultravox live billed minutes (paginated) ────────────────────────────
interface UltravoxCallResult {
  callId: string
  created: string
  billedDuration: string | null
  billingStatus: string
  metadata?: Record<string, string>
}

async function fetchUltravoxLive(from: Date, to: Date): Promise<{
  bySlug: Map<string, { calls: number; billedSeconds: number }>
  totalCalls: number
  totalBilledSeconds: number
}> {
  const bySlug = new Map<string, { calls: number; billedSeconds: number }>()
  let totalCalls = 0
  let totalBilledSeconds = 0
  let cursor: string | null = null
  const maxPages = 15 // cap at 1500 calls to stay fast

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${ULTRAVOX_API}/calls`)
    url.searchParams.set('pageSize', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': ULTRAVOX_KEY! },
    })

    if (!res.ok) break

    const data = await res.json() as {
      results: UltravoxCallResult[]
      next: string | null
    }

    let hitBoundary = false
    for (const call of data.results) {
      const created = new Date(call.created)
      // Stop early if we've gone past the start of our range
      if (created < from) { hitBoundary = true; break }
      if (created > to) continue

      // Only count billed calls
      if (call.billingStatus !== 'BILLING_STATUS_BILLED') continue

      const billedSecs = parseDuration(call.billedDuration)
      const slug = call.metadata?.client_slug ?? 'unknown'

      if (!bySlug.has(slug)) bySlug.set(slug, { calls: 0, billedSeconds: 0 })
      const entry = bySlug.get(slug)!
      entry.calls++
      entry.billedSeconds += billedSecs
      totalCalls++
      totalBilledSeconds += billedSecs
    }

    if (hitBoundary || !data.next) break
    // Extract cursor from next URL
    const nextUrl = new URL(data.next)
    cursor = nextUrl.searchParams.get('cursor')
    if (!cursor) break
  }

  return { bySlug, totalCalls, totalBilledSeconds }
}

// ─── Pull Twilio actual billed amount from Usage Records API ──────────────────
async function fetchTwilioLive(from: Date, to: Date): Promise<{
  callsPrice: number
  callsMinutes: number
  numberPrice: number
} | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null

  try {
    const startDate = from.toISOString().slice(0, 10)
    const endDate = to.toISOString().slice(0, 10)
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    // Fetch voice call usage
    const callsRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json?Category=calls&StartDate=${startDate}&EndDate=${endDate}`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (!callsRes.ok) return null
    const callsData = await callsRes.json() as {
      usage_records: Array<{ price: string; usage: string; usage_unit: string }>
    }
    const callRecord = callsData.usage_records?.[0]

    // Fetch phone number usage
    const numbersRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json?Category=phonenumbers-local&StartDate=${startDate}&EndDate=${endDate}`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    const numbersData = numbersRes.ok
      ? await numbersRes.json() as { usage_records: Array<{ price: string }> }
      : null
    const numberRecord = numbersData?.usage_records?.[0]

    return {
      callsPrice: parseFloat(callRecord?.price ?? '0'),
      callsMinutes: parseFloat(callRecord?.usage ?? '0'),
      numberPrice: parseFloat(numberRecord?.price ?? '0'),
    }
  } catch {
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ULTRAVOX_KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  const { from, to, label } = getDateRange(range)

  // ── Run DB + Ultravox + Twilio fetches in parallel ──────────────────────────
  const [logsResult, allClientsResult, ultravoxLive, twilioLive] = await Promise.all([
    supabase
      .from('call_logs')
      .select('id, duration_seconds, started_at, client_id, call_status, clients(business_name, slug)')
      .gte('started_at', from.toISOString())
      .lte('started_at', to.toISOString())
      .not('call_status', 'eq', 'MISSED')
      .not('duration_seconds', 'is', null)
      .order('started_at', { ascending: true }),

    supabase
      .from('clients')
      .select('id, business_name, slug')
      .order('business_name'),

    fetchUltravoxLive(from, to),
    fetchTwilioLive(from, to),
  ])

  const logs = logsResult.data ?? []
  const allClients = allClientsResult.data ?? []
  const activeClientCount = allClients.length

  // Months multiplier for "all time" number cost
  let monthsMultiplier = 1
  if (range === 'all' && logs.length > 0) {
    const earliest = new Date(logs[0].started_at as string)
    monthsMultiplier = Math.max(
      1,
      (to.getFullYear() - earliest.getFullYear()) * 12 +
      (to.getMonth() - earliest.getMonth()) + 1
    )
  }

  // ── Compute costs from call_logs (DB-derived) ───────────────────────────────
  type ClientCost = {
    client_id: string
    business_name: string
    slug: string
    calls: number
    duration_seconds: number
    twilio_cost: number
    ultravox_cost: number
  }
  const byClientMap = new Map<string, ClientCost>()

  for (const log of logs) {
    const dur = (log.duration_seconds as number) ?? 0
    if (dur <= 0) continue
    const clientData = log.clients as { business_name?: string; slug?: string } | null
    const clientId = log.client_id as string
    const slug = clientData?.slug ?? ''
    const mins = dur / 60
    const twilioRate = OUTBOUND_CLIENT_SLUGS.has(slug)
      ? PRICING.twilio_outbound_per_min
      : PRICING.twilio_inbound_per_min

    if (!byClientMap.has(clientId)) {
      byClientMap.set(clientId, {
        client_id: clientId,
        business_name: clientData?.business_name ?? 'Unknown',
        slug,
        calls: 0,
        duration_seconds: 0,
        twilio_cost: 0,
        ultravox_cost: 0,
      })
    }
    const e = byClientMap.get(clientId)!
    e.calls++
    e.duration_seconds += dur
    e.twilio_cost += mins * twilioRate
    e.ultravox_cost += mins * PRICING.ultravox_per_min
  }

  const numberCostPerClient = prorateNumberCost(range, 1, monthsMultiplier)

  // ── Build per-client output (include all clients, even those with 0 calls) ──
  const byClient = allClients.map(client => {
    const computed = byClientMap.get(client.id)
    const isOutbound = OUTBOUND_CLIENT_SLUGS.has(client.slug)
    const twilioRate = isOutbound ? PRICING.twilio_outbound_per_min : PRICING.twilio_inbound_per_min

    // Ultravox live billed minutes for this client
    const uvLive = ultravoxLive.bySlug.get(client.slug)
    const uvLiveMins = uvLive ? uvLive.billedSeconds / 60 : null

    const computedTwilio = computed?.twilio_cost ?? 0
    const computedUltravox = computed?.ultravox_cost ?? 0
    const computedMinutes = (computed?.duration_seconds ?? 0) / 60
    const calls = computed?.calls ?? 0

    // Live Ultravox cost (uses actual billed duration from Ultravox API)
    const liveUltravoxCost = uvLiveMins !== null ? uvLiveMins * PRICING.ultravox_per_min : null

    const totalComputed = computedTwilio + computedUltravox + numberCostPerClient
    const totalLive = computedTwilio + (liveUltravoxCost ?? computedUltravox) + numberCostPerClient

    return {
      client_id: client.id,
      business_name: client.business_name,
      slug: client.slug,
      call_direction: isOutbound ? 'outbound' : 'inbound',
      twilio_rate: twilioRate,
      calls,
      minutes_computed: parseFloat(computedMinutes.toFixed(2)),
      minutes_billed_ultravox: uvLiveMins !== null ? parseFloat(uvLiveMins.toFixed(2)) : null,
      twilio_cost: parseFloat(computedTwilio.toFixed(4)),
      ultravox_cost_computed: parseFloat(computedUltravox.toFixed(4)),
      ultravox_cost_live: liveUltravoxCost !== null ? parseFloat(liveUltravoxCost.toFixed(4)) : null,
      number_cost: parseFloat(numberCostPerClient.toFixed(4)),
      total_cost_computed: parseFloat(totalComputed.toFixed(4)),
      total_cost_live: parseFloat(totalLive.toFixed(4)),
      cost_per_call: calls > 0 ? parseFloat((totalLive / calls).toFixed(4)) : 0,
    }
  })

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalTwilioComputed = byClient.reduce((s, c) => s + c.twilio_cost, 0)
  const totalUltravoxLive = byClient.reduce((s, c) => s + (c.ultravox_cost_live ?? c.ultravox_cost_computed), 0)
  const totalNumberCost = prorateNumberCost(range, activeClientCount, monthsMultiplier)
  const totalMinutes = byClient.reduce((s, c) => s + c.minutes_computed, 0)
  const totalCalls = byClient.reduce((s, c) => s + c.calls, 0)

  // ── Daily spend (fixed 30-day window for chart) ──────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { data: dailyLogs } = await supabase
    .from('call_logs')
    .select('duration_seconds, started_at, client_id, clients(slug)')
    .gte('started_at', thirtyDaysAgo.toISOString())
    .not('call_status', 'eq', 'MISSED')
    .not('duration_seconds', 'is', null)

  const dailyMap = new Map<string, { twilio: number; ultravox: number }>()
  for (const log of dailyLogs ?? []) {
    const dur = (log.duration_seconds as number) ?? 0
    if (dur <= 0) continue
    const date = (log.started_at as string).slice(0, 10)
    const slug = (log.clients as { slug?: string } | null)?.slug ?? ''
    const mins = dur / 60
    const twilioRate = OUTBOUND_CLIENT_SLUGS.has(slug)
      ? PRICING.twilio_outbound_per_min
      : PRICING.twilio_inbound_per_min
    if (!dailyMap.has(date)) dailyMap.set(date, { twilio: 0, ultravox: 0 })
    const d = dailyMap.get(date)!
    d.twilio += mins * twilioRate
    d.ultravox += mins * PRICING.ultravox_per_min
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      twilio: parseFloat(v.twilio.toFixed(4)),
      ultravox: parseFloat(v.ultravox.toFixed(4)),
      total: parseFloat((v.twilio + v.ultravox).toFixed(4)),
    }))

  return NextResponse.json({
    summary: {
      total_cost_live: parseFloat((totalTwilioComputed + totalUltravoxLive + totalNumberCost).toFixed(4)),
      twilio_cost_computed: parseFloat((totalTwilioComputed + totalNumberCost).toFixed(4)),
      twilio_cost_actual: twilioLive
        ? parseFloat((twilioLive.callsPrice + twilioLive.numberPrice).toFixed(4))
        : null,
      twilio_minutes_actual: twilioLive?.callsMinutes ?? null,
      ultravox_cost_live: parseFloat(totalUltravoxLive.toFixed(4)),
      number_cost: parseFloat(totalNumberCost.toFixed(4)),
      total_minutes_computed: parseFloat(totalMinutes.toFixed(2)),
      total_calls: totalCalls,
      range_label: label,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    by_client: byClient,
    daily,
    pricing: PRICING,
    ultravox_live_total_calls: ultravoxLive.totalCalls,
    ultravox_live_total_billed_seconds: ultravoxLive.totalBilledSeconds,
  })
}
