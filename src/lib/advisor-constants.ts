export const MAX_MESSAGES_PER_CONVERSATION = 50
export const CONVERSATION_SUMMARY_THRESHOLD = 50
export const CREDIT_REFRESH_INTERVAL_MS = 30_000
export const DEFAULT_MODEL_ID = 'meta-llama/llama-3.3-70b-instruct:free'

export interface BusinessContext {
  businessName: string | null
  niche: string | null
  agentName: string | null
  servicesOffered: string | null
  hours: string | null
  businessFacts: string | null
}

export interface RecentCall {
  caller_intent: string | null
  call_status: string | null
  summary: string | null
  next_steps: string | null
  created_at: string
}

export function buildAdvisorSystemPrompt(
  business: BusinessContext | null,
  recentCalls: RecentCall[] = []
): string {
  const parts: string[] = []

  parts.push(`You are a helpful AI business advisor for the unmissed.ai platform. You help business owners understand their calls, leads, and agent performance.`)

  if (business) {
    parts.push(`\n## Business Context`)
    if (business.businessName) parts.push(`Business: ${business.businessName}`)
    if (business.niche) parts.push(`Industry: ${business.niche}`)
    if (business.agentName) parts.push(`AI Agent Name: ${business.agentName}`)
    if (business.servicesOffered) parts.push(`Services: ${business.servicesOffered}`)
    if (business.hours) parts.push(`Hours: ${business.hours}`)
    if (business.businessFacts) parts.push(`Key Facts: ${business.businessFacts}`)
  }

  if (recentCalls.length > 0) {
    parts.push(`\n## Recent Calls (last ${recentCalls.length})`)
    for (const call of recentCalls) {
      const line = [
        call.created_at ? `[${new Date(call.created_at).toLocaleDateString()}]` : '',
        call.call_status ? `Status: ${call.call_status}` : '',
        call.summary || '',
        call.next_steps ? `Next: ${call.next_steps}` : '',
      ].filter(Boolean).join(' | ')
      parts.push(`- ${line}`)
    }
  }

  parts.push(`\n## Guidelines`)
  parts.push(`- Be concise and actionable. Business owners are busy.`)
  parts.push(`- When analyzing calls, reference specific details from the call data above.`)
  parts.push(`- Suggest concrete next steps when giving advice.`)
  parts.push(`- If asked about something outside your data, say so clearly.`)
  parts.push(`- Never make up call data or statistics. Only reference what's provided.`)
  parts.push(`- Format responses with markdown for readability.`)

  return parts.join('\n')
}
