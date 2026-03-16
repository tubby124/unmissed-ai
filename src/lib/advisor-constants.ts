import { type ClientSetup, formatClientSetup, PLATFORM_KNOWLEDGE } from './advisor-platform-knowledge'

export type { ClientSetup }

export const MAX_MESSAGES_PER_CONVERSATION = 50
export const CONVERSATION_SUMMARY_THRESHOLD = 50
export const CREDIT_REFRESH_INTERVAL_MS = 30_000
export const DEFAULT_MODEL_ID = 'meta-llama/llama-3.3-70b-instruct:free'
export const NEW_USER_CREDIT_CENTS = 100 // $1 for new users

export interface BusinessContext {
  businessName: string | null
  niche: string | null
  agentName: string | null
  servicesOffered: string | null
  hours: string | null
  businessFacts: string | null
}

export interface CallStats {
  totalCalls: number
  statusBreakdown: Record<string, number>
  totalMinutes: number
  avgDurationSeconds: number
  dateRange: { first: string; last: string } | null
}

export interface RecentCall {
  caller_intent: string | null
  call_status: string | null
  summary: string | null
  next_steps: string | null
  created_at: string
  duration_seconds: number | null
  sentiment: string | null
  quality_score: number | null
  key_topics: string | null
  caller_phone: string | null
  service_type: string | null
}

export interface TrendSummary {
  thisWeekCalls: number
  lastWeekCalls: number
  callsDelta: number
  thisWeekHot: number
  hotLeadsDelta: number
  avgQuality: number | null
  qualityDelta: number | null
  peakHour: string | null
  peakDay: string | null
}

export interface FollowUpGapSummary {
  callerPhone: string | null
  callStatus: string
  summary: string | null
  nextSteps: string | null
  hoursSince: number
}

export interface TranscriptEntry {
  callDate: string
  callStatus: string
  summary: string | null
  transcript: string // formatted text
}

export function buildAdvisorSystemPrompt(
  business: BusinessContext | null,
  recentCalls: RecentCall[] = [],
  callStats: CallStats | null = null,
  trends: TrendSummary | null = null,
  gaps: FollowUpGapSummary[] = [],
  transcripts: TranscriptEntry[] = [],
  clientSetup?: ClientSetup | null,
): string {
  const parts: string[] = []

  parts.push(`You are a helpful AI business advisor for the unmissed.ai platform. You help business owners understand their calls, leads, agent performance, AND how to use the platform itself. You have FULL ACCESS to their call data, transcripts, trends, follow-up status, account status, and platform knowledge — use ALL of it to answer questions.`)

  if (business) {
    parts.push(`\n## Business Context`)
    if (business.businessName) parts.push(`- Business: ${business.businessName}`)
    if (business.niche) parts.push(`- Industry: ${business.niche}`)
    if (business.agentName) parts.push(`- AI Agent Name: ${business.agentName}`)
    if (business.servicesOffered) parts.push(`- Services: ${business.servicesOffered}`)
    if (business.hours) parts.push(`- Hours: ${business.hours}`)
    if (business.businessFacts) parts.push(`- Key Facts: ${business.businessFacts}`)
  }

  if (callStats && callStats.totalCalls > 0) {
    parts.push(`\n## Call Statistics (All Time)`)
    parts.push(`- **Total calls received:** ${callStats.totalCalls}`)
    parts.push(`- **Total call minutes:** ${callStats.totalMinutes} min`)
    parts.push(`- **Average call duration:** ${callStats.avgDurationSeconds > 0 ? (callStats.avgDurationSeconds / 60).toFixed(1) : '0'} min`)

    if (callStats.dateRange) {
      parts.push(`- **Date range:** ${new Date(callStats.dateRange.first).toLocaleDateString()} – ${new Date(callStats.dateRange.last).toLocaleDateString()}`)
    }

    const statusEntries = Object.entries(callStats.statusBreakdown)
    if (statusEntries.length > 0) {
      parts.push(`\n### Lead Breakdown`)
      for (const [status, count] of statusEntries.sort((a, b) => b[1] - a[1])) {
        const pct = callStats.totalCalls > 0 ? ((count / callStats.totalCalls) * 100).toFixed(0) : '0'
        parts.push(`- **${status}:** ${count} calls (${pct}%)`)
      }

      const hot = callStats.statusBreakdown['HOT'] || 0
      const warm = callStats.statusBreakdown['WARM'] || 0
      if (hot + warm > 0) {
        parts.push(`- **Hot + Warm leads total:** ${hot + warm}`)
      }
    }
  } else if (callStats && callStats.totalCalls === 0) {
    parts.push(`\n## Call Statistics`)
    parts.push(`No calls received yet. The AI voice agent has not handled any calls.`)
  }

  if (recentCalls.length > 0) {
    parts.push(`\n## Recent Calls (last ${recentCalls.length})`)
    for (const call of recentCalls) {
      const lineParts = [
        call.created_at ? `[${new Date(call.created_at).toLocaleDateString()}]` : '',
        call.call_status ? `**${call.call_status}**` : '',
        call.duration_seconds ? `${Math.round(call.duration_seconds / 60 * 10) / 10}min` : '',
        call.sentiment ? `Sentiment: ${call.sentiment}` : '',
        call.service_type ? `Service: ${call.service_type}` : '',
      ].filter(Boolean).join(' | ')

      parts.push(`\n### ${lineParts}`)
      if (call.summary) parts.push(`Summary: ${call.summary}`)
      if (call.key_topics) parts.push(`Topics: ${call.key_topics}`)
      if (call.caller_intent) parts.push(`Intent: ${call.caller_intent}`)
      if (call.next_steps) parts.push(`Next steps: ${call.next_steps}`)
      if (call.quality_score !== null && call.quality_score !== undefined) {
        parts.push(`Quality score: ${call.quality_score}/100`)
      }
    }
  }

  // ── Trends (Phase 2) ──────────────────────────────────────────────────────
  if (trends) {
    parts.push(`\n## Weekly Trends`)
    parts.push(`- **This week:** ${trends.thisWeekCalls} calls, ${trends.thisWeekHot} HOT leads`)
    parts.push(`- **Last week:** ${trends.lastWeekCalls} calls`)
    parts.push(`- **Call volume change:** ${trends.callsDelta > 0 ? '+' : ''}${trends.callsDelta}%`)
    if (trends.hotLeadsDelta !== 0) {
      parts.push(`- **HOT leads change:** ${trends.hotLeadsDelta > 0 ? '+' : ''}${trends.hotLeadsDelta}%`)
    }
    if (trends.avgQuality !== null) {
      const qd = trends.qualityDelta !== null
        ? ` (${trends.qualityDelta > 0 ? '+' : ''}${trends.qualityDelta} pts vs last week)`
        : ''
      parts.push(`- **Avg quality:** ${trends.avgQuality}/100${qd}`)
    }
    if (trends.peakHour) parts.push(`- **Peak hour:** ${trends.peakHour}`)
    if (trends.peakDay) parts.push(`- **Busiest day:** ${trends.peakDay}`)
  }

  // ── Follow-Up Gaps (Phase 2) ─────────────────────────────────────────────
  if (gaps.length > 0) {
    parts.push(`\n## Follow-Up Gaps (leads waiting 24+ hours)`)
    for (const gap of gaps.slice(0, 5)) {
      const phone = gap.callerPhone ? gap.callerPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : 'unknown'
      parts.push(`\n### **${gap.callStatus}** — ${phone} — ${gap.hoursSince}h ago`)
      if (gap.summary) parts.push(`Summary: ${gap.summary}`)
      if (gap.nextSteps) parts.push(`Needed: ${gap.nextSteps}`)
    }
  }

  // ── Full Transcripts (Phase 2) ───────────────────────────────────────────
  if (transcripts.length > 0) {
    parts.push(`\n## Full Call Transcripts (last ${transcripts.length})`)
    parts.push(`Use these to quote exact words, spot patterns, and identify where the agent excelled or struggled.`)
    for (const t of transcripts) {
      parts.push(`\n### [${t.callDate}] ${t.callStatus}`)
      if (t.summary) parts.push(`Summary: ${t.summary}`)
      parts.push(`\n\`\`\`\n${t.transcript}\n\`\`\``)
    }
  }

  // ── Client Setup + Platform Knowledge ───────────────────────────────────────
  if (clientSetup) {
    parts.push(formatClientSetup(clientSetup))
  }

  parts.push(PLATFORM_KNOWLEDGE)

  // ── Guidelines ─────────────────────────────────────────────────────────────
  parts.push(`\n## Response Style — IMPORTANT`)
  parts.push(`- **DEFAULT: Keep responses SHORT.** 2-4 sentences max for simple questions. No walls of text.`)
  parts.push(`- Only give long, detailed breakdowns when the user explicitly asks for depth ("give me a full analysis", "break it down", "tell me everything", "go deep").`)
  parts.push(`- Lead with the answer, not the preamble. No "Great question!" or "Let me look into that."`)
  parts.push(`- One insight per response is enough. Don't dump every trend, gap, and stat at once.`)
  parts.push(`- End with ONE concrete action — not a bullet list of 5 things.`)
  parts.push(`- Use bold for key numbers. Skip markdown headers unless the response is 5+ lines.`)

  parts.push(`\n## Guidelines`)
  parts.push(`- You HAVE access to call data, trends, transcripts, platform knowledge, and agent instructions above. Use what's relevant — not everything at once.`)
  parts.push(`- Never make up call data or statistics. Only reference what's provided above.`)
  parts.push(`- If asked about something NOT in the data (like revenue, specific customer info), say you don't have it.`)
  parts.push(`- When asked about the platform, settings, or call forwarding — give exact steps from the Platform Guide.`)
  parts.push(`- If the user's account is in "setup" status, proactively help them finish.`)

  // ── Proactive Insights (kept brief) ─────────────────────────────────────────
  parts.push(`\n## Proactive Insights`)
  parts.push(`After answering the user's question, you MAY add ONE short bonus insight (1-2 sentences) if you spot something important in the data. Examples:`)
  parts.push(`- Unmet demand: callers asking about services not listed`)
  parts.push(`- Missed revenue: HOT leads with no follow-up`)
  parts.push(`- Timing gaps: MISSED calls clustering at a specific time`)
  parts.push(`- Agent gaps: prompt doesn't cover something callers keep asking about`)
  parts.push(`- Repeat callers: same number calling multiple times (unresolved issue?)`)
  parts.push(`Keep it to ONE per response. Don't pile on. The user can always ask "tell me more."`)

  // ── Creative Analysis (only when asked) ────────────────────────────────────
  parts.push(`\n## Creative Analysis (only when asked)`)
  parts.push(`When the user asks for fun stats, a report card, revenue estimates, or "what should I do today" — go for it. Otherwise keep it straight.`)

  return parts.join('\n')
}
