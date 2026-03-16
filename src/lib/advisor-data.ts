/**
 * Advisor Data Utilities — Phase 2+3
 * Computes trends, follow-up gaps, and insight cards from call_logs data.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CallRow {
  id: string
  call_status: string | null
  duration_seconds: number | null
  created_at: string
  sentiment: string | null
  quality_score: number | null
  key_topics: string[] | null
  next_steps: string | null
  ai_summary: string | null
  caller_phone: string | null
  service_type: string | null
  transcript: TranscriptTurn[] | null
}

export interface TranscriptTurn {
  role: 'agent' | 'user'
  text: string
  startTime?: number
  endTime?: number
}

export interface WeekStats {
  totalCalls: number
  hotLeads: number
  warmLeads: number
  coldCalls: number
  junkCalls: number
  missedCalls: number
  avgQuality: number | null
  avgDuration: number
  totalMinutes: number
}

export interface TrendData {
  thisWeek: WeekStats
  lastWeek: WeekStats
  callsDelta: number       // percentage change
  hotLeadsDelta: number
  qualityDelta: number | null
  peakHour: number | null   // 0-23
  peakDay: string | null     // 'Monday', etc.
  hourDistribution: Record<number, number>
  dayDistribution: Record<string, number>
}

export interface FollowUpGap {
  callId: string
  callerPhone: string | null
  callStatus: string
  summary: string | null
  nextSteps: string | null
  calledAt: string
  hoursSince: number
}

export interface InsightCard {
  id: string
  type: 'hot_leads' | 'quality_trend' | 'busiest_day' | 'sentiment' | 'follow_up' | 'missed_calls' | 'peak_hours' | 'transcript_highlight'
  title: string
  value: string
  prompt: string  // pre-built question to send to advisor
  priority: number // 1=highest
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getWeekBounds(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - dayOfWeek - (weeksAgo * 7))
  startOfThisWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfThisWeek)
  endOfWeek.setDate(startOfThisWeek.getDate() + 7)

  return { start: startOfThisWeek, end: endOfWeek }
}

function computeWeekStats(calls: CallRow[]): WeekStats {
  const total = calls.length
  const hot = calls.filter(c => c.call_status === 'HOT').length
  const warm = calls.filter(c => c.call_status === 'WARM').length
  const cold = calls.filter(c => c.call_status === 'COLD').length
  const junk = calls.filter(c => c.call_status === 'JUNK').length
  const missed = calls.filter(c => c.call_status === 'MISSED').length

  const qualityScores = calls
    .map(c => c.quality_score)
    .filter((q): q is number => q !== null && q !== undefined)
  const avgQuality = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : null

  const totalSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)

  return {
    totalCalls: total,
    hotLeads: hot,
    warmLeads: warm,
    coldCalls: cold,
    junkCalls: junk,
    missedCalls: missed,
    avgQuality,
    avgDuration: total > 0 ? Math.round(totalSeconds / total) : 0,
    totalMinutes: Math.round(totalSeconds / 60),
  }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// ── Trend Computation ─────────────────────────────────────────────────────────

export function computeTrends(allCalls: CallRow[]): TrendData {
  const thisWeekBounds = getWeekBounds(0)
  const lastWeekBounds = getWeekBounds(1)

  const thisWeekCalls = allCalls.filter(c => {
    const d = new Date(c.created_at)
    return d >= thisWeekBounds.start && d < thisWeekBounds.end
  })

  const lastWeekCalls = allCalls.filter(c => {
    const d = new Date(c.created_at)
    return d >= lastWeekBounds.start && d < lastWeekBounds.end
  })

  const thisWeek = computeWeekStats(thisWeekCalls)
  const lastWeek = computeWeekStats(lastWeekCalls)

  // Hour + day distribution (all time, last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentCalls = allCalls.filter(c => new Date(c.created_at) >= thirtyDaysAgo)

  const hourDist: Record<number, number> = {}
  const dayDist: Record<string, number> = {}

  for (const c of recentCalls) {
    const d = new Date(c.created_at)
    const hour = d.getHours()
    const day = DAY_NAMES[d.getDay()]
    hourDist[hour] = (hourDist[hour] || 0) + 1
    dayDist[day] = (dayDist[day] || 0) + 1
  }

  const peakHourEntry = Object.entries(hourDist).sort((a, b) => b[1] - a[1])[0]
  const peakDayEntry = Object.entries(dayDist).sort((a, b) => b[1] - a[1])[0]

  let qualityDelta: number | null = null
  if (thisWeek.avgQuality !== null && lastWeek.avgQuality !== null) {
    qualityDelta = thisWeek.avgQuality - lastWeek.avgQuality
  }

  return {
    thisWeek,
    lastWeek,
    callsDelta: pctChange(thisWeek.totalCalls, lastWeek.totalCalls),
    hotLeadsDelta: pctChange(thisWeek.hotLeads, lastWeek.hotLeads),
    qualityDelta,
    peakHour: peakHourEntry ? parseInt(peakHourEntry[0]) : null,
    peakDay: peakDayEntry ? peakDayEntry[0] : null,
    hourDistribution: hourDist,
    dayDistribution: dayDist,
  }
}

// ── Follow-Up Gap Detection ───────────────────────────────────────────────────

export function findFollowUpGaps(calls: CallRow[]): FollowUpGap[] {
  const now = new Date()
  const gaps: FollowUpGap[] = []

  // Look at HOT and WARM leads from the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const hotWarm = calls.filter(c =>
    (c.call_status === 'HOT' || c.call_status === 'WARM') &&
    new Date(c.created_at) >= sevenDaysAgo &&
    c.next_steps // has follow-up instructions
  )

  // For each HOT/WARM call, check if there's a subsequent call from the same number
  for (const call of hotWarm) {
    const calledAt = new Date(call.created_at)
    const hoursSince = Math.round((now.getTime() - calledAt.getTime()) / (1000 * 60 * 60))

    // Only flag if it's been 24+ hours
    if (hoursSince < 24) continue

    // Check if same caller_phone has a more recent call
    if (call.caller_phone) {
      const hasFollowUp = calls.some(other =>
        other.id !== call.id &&
        other.caller_phone === call.caller_phone &&
        new Date(other.created_at) > calledAt
      )
      if (hasFollowUp) continue
    }

    gaps.push({
      callId: call.id,
      callerPhone: call.caller_phone,
      callStatus: call.call_status!,
      summary: call.ai_summary,
      nextSteps: call.next_steps,
      calledAt: call.created_at,
      hoursSince,
    })
  }

  // Sort by priority: HOT first, then by hours since
  return gaps.sort((a, b) => {
    if (a.callStatus === 'HOT' && b.callStatus !== 'HOT') return -1
    if (a.callStatus !== 'HOT' && b.callStatus === 'HOT') return 1
    return b.hoursSince - a.hoursSince
  })
}

// ── Transcript Formatting ─────────────────────────────────────────────────────

export function formatTranscriptForPrompt(transcript: TranscriptTurn[]): string {
  return transcript
    .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.text.trim()}`)
    .join('\n')
}

// ── Insight Card Generation ───────────────────────────────────────────────────

export function generateInsightCards(
  trends: TrendData,
  gaps: FollowUpGap[],
  allCalls: CallRow[]
): InsightCard[] {
  const cards: InsightCard[] = []

  // 1. HOT leads this week
  if (trends.thisWeek.hotLeads > 0) {
    const delta = trends.hotLeadsDelta
    const deltaText = delta > 0 ? ` (up ${delta}% from last week)` : delta < 0 ? ` (down ${Math.abs(delta)}% from last week)` : ''
    cards.push({
      id: 'hot_leads',
      type: 'hot_leads',
      title: 'HOT Leads This Week',
      value: `${trends.thisWeek.hotLeads} HOT leads${deltaText}`,
      prompt: 'Tell me about my HOT leads this week. Who called, what did they want, and what should I do next?',
      priority: 1,
    })
  }

  // 2. Follow-up gaps
  if (gaps.length > 0) {
    cards.push({
      id: 'follow_up',
      type: 'follow_up',
      title: 'Leads Need Follow-Up',
      value: `${gaps.length} lead${gaps.length > 1 ? 's' : ''} waiting 24+ hours`,
      prompt: 'Which leads haven\'t been followed up on? Show me who needs a callback and what they were calling about.',
      priority: 1,
    })
  }

  // 3. Call volume trend
  if (trends.lastWeek.totalCalls > 0 || trends.thisWeek.totalCalls > 0) {
    const delta = trends.callsDelta
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    cards.push({
      id: 'volume_trend',
      type: 'quality_trend',
      title: 'Call Volume',
      value: `${trends.thisWeek.totalCalls} calls this week (${direction} ${Math.abs(delta)}%)`,
      prompt: 'How is my call volume trending? Compare this week vs last week and tell me what\'s changing.',
      priority: 2,
    })
  }

  // 4. Quality trend
  if (trends.thisWeek.avgQuality !== null) {
    const qualText = trends.qualityDelta !== null
      ? trends.qualityDelta > 0
        ? `up ${trends.qualityDelta} pts`
        : trends.qualityDelta < 0
          ? `down ${Math.abs(trends.qualityDelta)} pts`
          : 'unchanged'
      : ''
    cards.push({
      id: 'quality_trend',
      type: 'quality_trend',
      title: 'Call Quality',
      value: `Avg ${trends.thisWeek.avgQuality}/100${qualText ? ` — ${qualText}` : ''}`,
      prompt: 'How is my call quality trending? What\'s the average quality score and which calls had the lowest scores? What can I improve?',
      priority: 3,
    })
  }

  // 5. Peak hours
  if (trends.peakHour !== null) {
    const h = trends.peakHour
    const formatted = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    cards.push({
      id: 'peak_hours',
      type: 'peak_hours',
      title: 'Busiest Time',
      value: `Peak hour: ${formatted}`,
      prompt: 'When do most of my calls come in? Break it down by hour and day of the week so I can plan my schedule.',
      priority: 4,
    })
  }

  // 6. Busiest day
  if (trends.peakDay !== null) {
    const count = trends.dayDistribution[trends.peakDay] || 0
    cards.push({
      id: 'busiest_day',
      type: 'busiest_day',
      title: 'Busiest Day',
      value: `${trends.peakDay} — ${count} calls (last 30d)`,
      prompt: 'Which day of the week gets the most calls? Should I adjust my availability or staffing?',
      priority: 4,
    })
  }

  // 7. Sentiment
  const recentSentiment = allCalls
    .slice(0, 20)
    .filter(c => c.sentiment)
    .map(c => c.sentiment!)

  if (recentSentiment.length >= 3) {
    const positive = recentSentiment.filter(s => s === 'positive').length
    const frustrated = recentSentiment.filter(s => s === 'frustrated' || s === 'negative').length
    const pct = Math.round((positive / recentSentiment.length) * 100)
    cards.push({
      id: 'sentiment',
      type: 'sentiment',
      title: 'Caller Sentiment',
      value: `${pct}% positive${frustrated > 0 ? `, ${frustrated} frustrated` : ''}`,
      prompt: 'What\'s the overall sentiment from my recent callers? Were any frustrated? What happened in those calls?',
      priority: 5,
    })
  }

  // 8. Missed calls
  if (trends.thisWeek.missedCalls > 0) {
    cards.push({
      id: 'missed_calls',
      type: 'missed_calls',
      title: 'Missed Calls',
      value: `${trends.thisWeek.missedCalls} missed this week`,
      prompt: 'How many calls did I miss this week? When did they happen and is there a pattern I should fix?',
      priority: 2,
    })
  }

  return cards.sort((a, b) => a.priority - b.priority)
}
