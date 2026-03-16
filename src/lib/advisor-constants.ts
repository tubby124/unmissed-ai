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

export function buildAdvisorSystemPrompt(
  business: BusinessContext | null,
  recentCalls: RecentCall[] = [],
  callStats: CallStats | null = null
): string {
  const parts: string[] = []

  parts.push(`You are a helpful AI business advisor for the unmissed.ai platform. You help business owners understand their calls, leads, and agent performance. You have FULL ACCESS to their call data — use it to answer questions.`)

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

  parts.push(`\n## Guidelines`)
  parts.push(`- You HAVE access to the call data shown above. Use it to answer questions about total calls, lead quality, performance, patterns, etc.`)
  parts.push(`- Be concise and actionable. Business owners are busy.`)
  parts.push(`- When analyzing calls, reference specific details and numbers from the data above.`)
  parts.push(`- Suggest concrete next steps when giving advice.`)
  parts.push(`- If asked about something NOT in the data above (like revenue, specific customer info, etc.), say you don't have that specific data.`)
  parts.push(`- Never make up call data or statistics. Only reference what's provided above.`)
  parts.push(`- Format responses with markdown for readability.`)
  parts.push(`- When asked for "stats" or "analytics", provide the aggregate numbers from Call Statistics section.`)

  return parts.join('\n')
}
