import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Range = '7d' | '30d' | '90d'

function getRangeMs(range: Range): number {
  const DAY = 86400000
  switch (range) {
    case '7d': return 7 * DAY
    case '30d': return 30 * DAY
    case '90d': return 90 * DAY
  }
}

interface RawCall {
  call_status: string | null
  started_at: string
  duration_seconds: number | null
  caller_phone: string | null
  caller_name: string | null
  key_topics: string[] | null
  quality_score: number | null
  sentiment: string | null
  client_id: string | null
}

const STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED', 'UNKNOWN'] as const

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const isAdmin = cu.role === 'admin'
  const { searchParams } = new URL(req.url)
  const range = (searchParams.get('range') || '30d') as Range
  if (!['7d', '30d', '90d'].includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  // Admin can filter by client_id param; clients always see their own
  const filterClientId = isAdmin
    ? searchParams.get('client_id') || null
    : cu.client_id

  const rangeMs = getRangeMs(range)
  const now = Date.now()
  const currentStart = new Date(now - rangeMs).toISOString()
  const prevStart = new Date(now - rangeMs * 2).toISOString()

  // Fetch current period
  let currentQ = supabase
    .from('call_logs')
    .select('call_status, started_at, duration_seconds, caller_phone, caller_name, key_topics, quality_score, sentiment, client_id')
    .gte('started_at', currentStart)
    .order('started_at', { ascending: true })
    .limit(2000)

  if (filterClientId) currentQ = currentQ.eq('client_id', filterClientId)

  // Fetch previous period (for trends)
  let prevQ = supabase
    .from('call_logs')
    .select('call_status, started_at, duration_seconds, quality_score')
    .gte('started_at', prevStart)
    .lt('started_at', currentStart)
    .limit(2000)

  if (filterClientId) prevQ = prevQ.eq('client_id', filterClientId)

  const [{ data: currentCalls }, { data: prevCalls }] = await Promise.all([currentQ, prevQ])

  const calls = (currentCalls ?? []) as RawCall[]
  const prev = (prevCalls ?? []) as Pick<RawCall, 'call_status' | 'started_at' | 'duration_seconds' | 'quality_score'>[]

  // --- Aggregate current period ---

  // Classification counts
  const classification: Record<string, number> = {}
  for (const s of STATUSES) classification[s] = 0
  for (const c of calls) {
    const s = c.call_status ?? 'UNKNOWN'
    classification[s] = (classification[s] ?? 0) + 1
  }

  // Daily volume
  const dailyMap = new Map<string, number>()
  const days = Math.ceil(rangeMs / 86400000)
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * 86400000)
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const c of calls) {
    const day = c.started_at.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
  }
  const dailyVolume = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }))

  // Average duration
  const durations = calls.filter(c => c.duration_seconds && c.duration_seconds > 0).map(c => c.duration_seconds!)
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

  // Average quality
  const qualities = calls.filter(c => c.quality_score && c.quality_score > 0).map(c => c.quality_score!)
  const avgQuality = qualities.length > 0 ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length * 10) / 10 : 0

  // Peak hours
  const hourCounts = new Array(24).fill(0)
  for (const c of calls) {
    const h = new Date(c.started_at).getHours()
    hourCounts[h]++
  }
  const peakHours = hourCounts.map((count, hour) => ({ hour, count }))

  // Top callers
  const callerMap = new Map<string, { phone: string; name: string | null; count: number; lastStatus: string }>()
  for (const c of calls) {
    const phone = c.caller_phone || 'unknown'
    if (phone === 'unknown') continue
    const existing = callerMap.get(phone)
    if (existing) {
      existing.count++
      existing.lastStatus = c.call_status ?? 'UNKNOWN'
      if (c.caller_name) existing.name = c.caller_name
    } else {
      callerMap.set(phone, { phone, name: c.caller_name, count: 1, lastStatus: c.call_status ?? 'UNKNOWN' })
    }
  }
  const topCallers = Array.from(callerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Top topics
  const topicMap = new Map<string, number>()
  for (const c of calls) {
    if (c.key_topics) {
      for (const t of c.key_topics) {
        const normalized = t.toLowerCase().trim()
        if (normalized) topicMap.set(normalized, (topicMap.get(normalized) ?? 0) + 1)
      }
    }
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Sentiment distribution
  const sentimentMap: Record<string, number> = { positive: 0, neutral: 0, negative: 0 }
  for (const c of calls) {
    const s = (c.sentiment ?? 'neutral').toLowerCase()
    if (s in sentimentMap) sentimentMap[s]++
    else sentimentMap.neutral++
  }

  // --- Compute trends (current vs previous) ---
  const prevTotal = prev.length
  const prevHot = prev.filter(c => c.call_status === 'HOT').length
  const prevDurations = prev.filter(c => c.duration_seconds && c.duration_seconds > 0).map(c => c.duration_seconds!)
  const prevAvgDuration = prevDurations.length > 0 ? Math.round(prevDurations.reduce((a, b) => a + b, 0) / prevDurations.length) : 0
  const prevQualities = prev.filter(c => c.quality_score && c.quality_score > 0).map(c => c.quality_score!)
  const prevAvgQuality = prevQualities.length > 0 ? Math.round(prevQualities.reduce((a, b) => a + b, 0) / prevQualities.length * 10) / 10 : 0

  function pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? 100 : null
    return Math.round(((curr - prev) / prev) * 100)
  }

  const hotLeads = classification.HOT ?? 0

  // Quality trend — daily average quality_score
  const qualityByDay = new Map<string, { sum: number; count: number }>()
  for (const c of calls) {
    if (c.quality_score && c.quality_score > 0) {
      const day = c.started_at.slice(0, 10)
      const entry = qualityByDay.get(day) ?? { sum: 0, count: 0 }
      entry.sum += c.quality_score
      entry.count++
      qualityByDay.set(day, entry)
    }
  }
  const qualityTrend = Array.from(qualityByDay.entries())
    .map(([date, { sum, count }]) => ({ date, avg: Math.round((sum / count) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    summary: {
      totalCalls: calls.length,
      hotLeads,
      avgDuration,
      avgQuality,
      trends: {
        callsChange: pctChange(calls.length, prevTotal),
        hotChange: pctChange(hotLeads, prevHot),
        durationChange: pctChange(avgDuration, prevAvgDuration),
        qualityChange: pctChange(avgQuality, prevAvgQuality),
      },
    },
    classification,
    dailyVolume,
    peakHours,
    topCallers,
    topTopics,
    sentiment: sentimentMap,
    qualityTrend,
    range,
    totalDays: days,
  })
}
