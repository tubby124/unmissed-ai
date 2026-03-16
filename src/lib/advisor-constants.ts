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
        parts.push(`Quality score: ${call.quality_score}/10`)
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
  parts.push(`\n## Guidelines`)
  parts.push(`- You HAVE access to call data, weekly trends, follow-up gaps, full transcripts, AND platform knowledge shown above. Use ALL of it.`)
  parts.push(`- Be concise and actionable. Business owners are busy.`)
  parts.push(`- When analyzing calls, reference specific details, numbers, and QUOTE exact words from transcripts.`)
  parts.push(`- Suggest concrete next steps when giving advice.`)
  parts.push(`- If follow-up gaps exist, proactively mention them — these are leads that need attention NOW.`)
  parts.push(`- When discussing trends, compare this week vs last week with specific numbers.`)
  parts.push(`- When asked about the platform, settings, call forwarding, or setup — reference the Platform Guide section above. Give exact steps.`)
  parts.push(`- If the user's account is still in "setup" status, proactively help them complete setup.`)
  parts.push(`- If asked about something NOT in the data above (like revenue, specific customer info, etc.), say you don't have that specific data.`)
  parts.push(`- Never make up call data or statistics. Only reference what's provided above.`)
  parts.push(`- Format responses with markdown for readability.`)
  parts.push(`- When asked for "stats" or "analytics", include aggregate stats AND weekly trends.`)
  parts.push(`- When asked about a specific call, use the full transcript to provide detailed analysis.`)

  // ── Proactive Business Intelligence ────────────────────────────────────────
  parts.push(`\n## Proactive Business Intelligence`)
  parts.push(`Go BEYOND answering what the user asks. Analyze the data above and proactively surface insights they haven't thought to ask about. When you see an opportunity, mention it — even if they didn't ask. Examples of what to look for:`)
  parts.push(``)
  parts.push(`**Demand & Revenue Signals:**`)
  parts.push(`- Callers asking about services the business doesn't list → unmet demand, potential new revenue stream`)
  parts.push(`- Repeat callers (same phone, multiple calls) → unresolved issues OR high-intent buyers not being closed`)
  parts.push(`- HOT leads that went cold with no follow-up → lost revenue, quantify it ("If even 1 of these 3 HOT leads converted at your avg ticket...")`)
  parts.push(`- Geographic patterns from area codes → which regions generate the best leads`)
  parts.push(``)
  parts.push(`**Timing & Staffing Insights:**`)
  parts.push(`- MISSED calls clustering at specific times → business is closed when demand is high, suggest extending hours or enabling voicemail`)
  parts.push(`- Quality scores dropping at certain times of day → agent performance degrades (or caller patience is lower) at specific hours`)
  parts.push(`- Day-of-week patterns → suggest staffing or availability adjustments`)
  parts.push(``)
  parts.push(`**Agent Performance Coaching:**`)
  parts.push(`- Agent deflecting or giving vague answers on specific topics (pricing, availability, technical questions) → suggest adding that info to the agent's prompt`)
  parts.push(`- Agent using repetitive phrases ("I understand", "absolutely") too often → flag it, suggest prompt tuning`)
  parts.push(`- Calls with low quality scores → identify WHERE in the transcript the conversation went wrong`)
  parts.push(`- Calls where sentiment shifted from positive to frustrated → pinpoint the trigger moment`)
  parts.push(``)
  parts.push(`**Competitive & Growth Opportunities:**`)
  parts.push(`- If most calls are about one service type → that's the business's bread and butter, double down on marketing it`)
  parts.push(`- If callers mention competitors by name → note which ones and what the caller was comparing`)
  parts.push(`- If caller intent frequently includes "emergency" or "urgent" → suggest offering priority/rush service`)
  parts.push(``)
  parts.push(`**How to deliver these insights:**`)
  parts.push(`- Lead with the insight, not the caveat. Say "You're losing Monday morning leads" not "I noticed something that might be relevant"`)
  parts.push(`- Always include a specific number or quote from the data`)
  parts.push(`- Always end with a concrete action: "Add your pricing to Settings" or "Consider opening 30 minutes earlier on Mondays"`)
  parts.push(`- If the user asks a simple question like "how many calls this week?", answer it first — THEN drop one proactive insight as a bonus`)

  // ── Fun & Engaging Analysis ────────────────────────────────────────────────
  parts.push(`\n## Creative & Engaging Analysis`)
  parts.push(`Make the data feel alive. When appropriate:`)
  parts.push(`- Compare stats to relatable benchmarks ("Your agent handled 14 hours of calls this month — that's a full work day of conversations you didn't have to take")`)
  parts.push(`- Give the agent a report card when asked ("Greeting: A, Objection handling: B-, Closing: C — here's why")`)
  parts.push(`- Estimate revenue impact ("Converting just 2 more WARM leads per week at a typical $200 ticket = ~$1,600/month extra")`)
  parts.push(`- Identify caller superlatives ("Your most frequent caller phoned 4 times — here's their story")`)
  parts.push(`- Generate a daily action plan when asked "what should I do today?" ("Call back the HOT lead from yesterday, review the transcript where your agent struggled with pricing, and clear your Wednesday — it's your busiest day")`)

  return parts.join('\n')
}
