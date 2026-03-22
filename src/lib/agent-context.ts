/**
 * agent-context.ts — Phase 1B: AgentContext type + buildAgentContext()
 *
 * Provides a single normalized view of everything an agent needs for one call:
 *   - stable business config (from Supabase clients row)
 *   - per-call caller context (phone, date/time, prior calls, after-hours)
 *   - capability flags (from Phase 1A niche-capabilities.ts)
 *   - pre-assembled prompt injection blocks (same strings the inbound webhook currently builds)
 *
 * RULES:
 * - Does NOT change prompt generation behavior — assembles the same strings inbound/route.ts does
 * - Does NOT touch provisioning
 * - Does NOT rewrite bespoke niche builders
 * - Capability flags from Phase 1A are included here so Phase 2 can gate prompt assembly on them
 *
 * Phase 2 will wire the prompt builder to consume AgentContext instead of scattered raw inputs.
 */

import { buildContextBlock } from '@/lib/context-data'
import { getCapabilities, type AgentCapabilities } from '@/lib/niche-capabilities'
import { buildKnowledgeSummary, type KnowledgeSummary } from '@/lib/knowledge-summary'
import { buildRetrievalConfig, type RetrievalConfig, type RetrievalBackend } from '@/lib/knowledge-retrieval'

// ── Input type: subset of Supabase clients row ────────────────────────────────
// All fields except id/slug are optional — avoids breaking callers that SELECT fewer columns.
export type ClientRow = {
  id: string
  slug: string
  niche?: string | null
  business_name?: string | null
  timezone?: string | null
  business_hours_weekday?: string | null
  business_hours_weekend?: string | null
  after_hours_behavior?: string | null
  after_hours_emergency_phone?: string | null
  business_facts?: string | null
  extra_qa?: { q: string; a: string }[] | null
  context_data?: string | null
  context_data_label?: string | null
  knowledge_backend?: string | null
  injected_note?: string | null
}

// ── Input type: one prior call row from call_logs ─────────────────────────────
export type PriorCall = {
  started_at: string
  call_status: string
  ai_summary?: string | null
  caller_name?: string | null
  ultravox_call_id?: string | null
}

// ── Business Config — stable facts about the business ────────────────────────
export type BusinessConfig = {
  /** Supabase clients.id */
  clientId: string
  /** URL-safe slug */
  slug: string
  /** Niche key (e.g. 'auto_glass', 'real_estate') — defaults to 'other' */
  niche: string
  /** Display name from clients.business_name */
  businessName: string
  /** IANA timezone string — defaults to 'America/Regina' */
  timezone: string
  /** e.g. "9am to 5pm" or "closed" */
  hoursWeekday: string | null
  hoursWeekend: string | null
  /** 'take_message' | 'route_emergency' | custom string */
  afterHoursBehavior: string
  /** Phone number to transfer to on after-hours emergencies */
  afterHoursEmergencyPhone: string | null
  /** Free-text business facts block */
  businessFacts: string | null
  /** Filtered (non-empty) Q&A pairs */
  extraQa: { q: string; a: string }[]
  /** Arbitrary reference data (e.g. tenant table) */
  contextData: string | null
  /** Label for contextData block — defaults to 'Reference Data' */
  contextDataLabel: string
}

// ── CallerContext — per-call dynamic facts ────────────────────────────────────
export type CallerContext = {
  /** E.164 phone number, or null if unknown/blocked */
  callerPhone: string | null
  /** YYYY-MM-DD in client timezone */
  todayIso: string
  /** "Monday", "Tuesday", … */
  dayOfWeek: string
  /** "10:00 AM" in client timezone */
  timeNow: string
  /** True if this call lands outside configured business hours */
  isAfterHours: boolean
  /**
   * Pre-assembled after-hours instruction string for prompt injection.
   * Non-null only when isAfterHours=true.
   */
  afterHoursBehaviorNote: string | null
  /** True if this phone number has prior calls in call_logs */
  isReturningCaller: boolean
  /** Number of prior calls found */
  priorCallCount: number
  /** Caller name from any prior call_logs row with caller_name set */
  returningCallerName: string | null
  /** "Mar 5" style date of most recent prior call */
  lastCallDate: string | null
  /** First 120 chars of ai_summary from most recent prior call */
  lastCallSummary: string | null
}

// ── AssembledContextBlocks — ready-to-inject strings ─────────────────────────
// These match exactly what inbound/route.ts currently builds at runtime.
export type AssembledContextBlocks = {
  /** "[TODAY: ... CURRENT TIME: ... CALLER PHONE: ... RETURNING CALLER: ...]" */
  callerContextBlock: string
  /** "## Business Facts\n..." or '' */
  businessFactsBlock: string
  /** "## Q&A\n..." or '' */
  extraQaBlock: string
  /** "## [Label]\n..." or '' */
  contextDataBlock: string
}

// ── AgentContext — complete normalized context for one call ───────────────────
export type AgentContext = {
  /** Stable business configuration */
  business: BusinessConfig
  /** Per-call runtime state */
  caller: CallerContext
  /** Capability flags from Phase 1A — niche-capabilities.ts */
  capabilities: AgentCapabilities
  /** Pre-assembled prompt injection blocks */
  assembled: AssembledContextBlocks
  /** Phase 3: condensed knowledge summary — inject this, not raw businessFacts/extraQa */
  knowledge: KnowledgeSummary
  /** Phase 4: retrieval config — determines if queryCorpus is available + prompt instruction */
  retrieval: RetrievalConfig
}

// ── detectAfterHours() ────────────────────────────────────────────────────────
// Extracted faithfully from api/webhook/[slug]/inbound/route.ts (no behavior change).
// Parses "9am to 5pm" / "9:00 to 17:00" / "closed" style strings.
export function detectAfterHours(
  now: Date,
  timezone: string,
  hoursWeekday: string | null,
  hoursWeekend: string | null,
): boolean {
  try {
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const dow = localNow.getDay() // 0=Sun, 1=Mon, …, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    const hoursStr = isWeekend ? hoursWeekend : hoursWeekday
    if (!hoursStr) return false
    const lower = hoursStr.toLowerCase().trim()
    if (lower === 'closed' || lower === 'n/a' || lower === '') return true
    const hourMatch = lower.match(
      /(\d{1,2})(?::(\d{2}))?(?:\s*)(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?(?:\s*)(am|pm)?/,
    )
    if (!hourMatch) return false
    const toMin = (h: number, min: number, meridian?: string): number => {
      if (meridian === 'pm' && h < 12) return (h + 12) * 60 + min
      if (meridian === 'am' && h === 12) return min
      return h * 60 + min
    }
    const openMin = toMin(
      parseInt(hourMatch[1]),
      parseInt(hourMatch[2] || '0'),
      hourMatch[3],
    )
    const closeMin = toMin(
      parseInt(hourMatch[4]),
      parseInt(hourMatch[5] || '0'),
      hourMatch[6],
    )
    const nowMin = localNow.getHours() * 60 + localNow.getMinutes()
    return nowMin < openMin || nowMin >= closeMin
  } catch {
    return false
  }
}

// ── buildAfterHoursBehaviorNote() ─────────────────────────────────────────────
// Provides soft contextual awareness that the office is closed for visits.
// The agent ALWAYS takes calls 24/7 — this note never implies the call shouldn't happen.
export function buildAfterHoursBehaviorNote(
  afterHoursBehavior: string,
  afterHoursPhone: string | null,
): string {
  if (afterHoursBehavior === 'route_emergency' && afterHoursPhone) {
    return (
      `OFFICE STATUS: The office is currently closed for in-person visits. ` +
      `If this is an emergency, transfer to ${afterHoursPhone}. ` +
      `Otherwise continue helping the caller normally — collect their info and let them know someone will follow up.`
    )
  }
  if (afterHoursBehavior === 'take_message') {
    return (
      `OFFICE STATUS: The office is currently closed for in-person visits. ` +
      `Continue helping the caller normally — collect their info and let them know someone will follow up.`
    )
  }
  return `OFFICE STATUS: The office is currently closed for in-person visits. ${afterHoursBehavior}`
}

// ── buildAgentContext() ───────────────────────────────────────────────────────
/**
 * Builds a complete, normalized AgentContext from a Supabase clients row,
 * the caller's phone number, optional prior call history, and the current time.
 *
 * This is a pure function — no database calls, no side effects.
 * Database lookups (prior calls, client row) happen in the caller (inbound webhook).
 *
 * @param client    - Subset of Supabase clients row (see ClientRow type)
 * @param callerPhone - E.164 phone or 'unknown' (from Twilio body.From)
 * @param priorCalls  - Prior call_logs rows for this caller+client (default [])
 * @param now         - Current time (default: new Date())
 */
export function buildAgentContext(
  client: ClientRow,
  callerPhone: string,
  priorCalls: PriorCall[] = [],
  now: Date = new Date(),
  corpusAvailable: boolean = false,
): AgentContext {
  // ── Business config ──────────────────────────────────────────────────────
  const niche = (client.niche as string | null) || 'other'
  const clientTz = (client.timezone as string | null) || 'America/Regina'

  const business: BusinessConfig = {
    clientId: client.id,
    slug: client.slug,
    niche,
    businessName: (client.business_name as string | null) || client.slug,
    timezone: clientTz,
    hoursWeekday: (client.business_hours_weekday as string | null) ?? null,
    hoursWeekend: (client.business_hours_weekend as string | null) ?? null,
    afterHoursBehavior: (client.after_hours_behavior as string | null) || 'take_message',
    afterHoursEmergencyPhone: (client.after_hours_emergency_phone as string | null) ?? null,
    businessFacts: (client.business_facts as string | null) ?? null,
    extraQa: ((client.extra_qa as { q: string; a: string }[] | null) ?? []).filter(
      (p) => p.q?.trim() && p.a?.trim(),
    ),
    contextData: (client.context_data as string | null) ?? null,
    contextDataLabel: (client.context_data_label as string | null) || 'Reference Data',
  }

  // ── Capability flags (Phase 1A) ──────────────────────────────────────────
  const capabilities = getCapabilities(niche)

  // ── Date/time in client timezone ─────────────────────────────────────────
  const todayIso = now.toLocaleDateString('en-CA', { timeZone: clientTz })
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: clientTz, weekday: 'long' })
  const timeNow = now.toLocaleTimeString('en-US', {
    timeZone: clientTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  // ── After-hours detection ────────────────────────────────────────────────
  const isAfterHours = detectAfterHours(
    now,
    clientTz,
    business.hoursWeekday,
    business.hoursWeekend,
  )
  const afterHoursBehaviorNote = isAfterHours
    ? buildAfterHoursBehaviorNote(business.afterHoursBehavior, business.afterHoursEmergencyPhone)
    : null

  // ── Returning caller ─────────────────────────────────────────────────────
  const callerPhoneNormalized = callerPhone !== 'unknown' ? callerPhone : null
  let isReturningCaller = false
  let priorCallCount = 0
  let returningCallerName: string | null = null
  let lastCallDate: string | null = null
  let lastCallSummary: string | null = null
  if (callerPhoneNormalized && priorCalls.length > 0) {
    isReturningCaller = true
    priorCallCount = priorCalls.length
    const lastCall = priorCalls[0]
    lastCallDate = new Date(lastCall.started_at).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
    })
    lastCallSummary = lastCall.ai_summary
      ? (lastCall.ai_summary as string).slice(0, 120)
      : null
    returningCallerName =
      (priorCalls.find((c) => c.caller_name)?.caller_name as string | null) ?? null
  }

  const caller: CallerContext = {
    callerPhone: callerPhoneNormalized,
    todayIso,
    dayOfWeek,
    timeNow,
    isAfterHours,
    afterHoursBehaviorNote,
    isReturningCaller,
    priorCallCount,
    returningCallerName,
    lastCallDate,
    lastCallSummary,
  }

  // ── Assemble context blocks (same strings as inbound/route.ts) ────────────
  let callerContextStr = `TODAY: ${todayIso} (${dayOfWeek})\nCURRENT TIME: ${timeNow} (${clientTz})`
  if (callerPhoneNormalized) callerContextStr += `\nCALLER PHONE: ${callerPhoneNormalized}`
  if (returningCallerName) callerContextStr += `\nCALLER NAME: ${returningCallerName}`
  if (isReturningCaller) {
    const summaryStr = lastCallSummary ? ` Last call: ${lastCallSummary}` : ''
    callerContextStr +=
      `\nRETURNING CALLER — ${priorCallCount} prior call${priorCallCount > 1 ? 's' : ''}. ` +
      `Most recent: ${lastCallDate}.${summaryStr}`
  }
  // Office/visit hours — informational only. Agent always answers calls 24/7.
  const hoursLines: string[] = []
  if (business.hoursWeekday) hoursLines.push(`- Weekdays: ${business.hoursWeekday}`)
  if (business.hoursWeekend) hoursLines.push(`- Weekends: ${business.hoursWeekend}`)
  if (hoursLines.length > 0) {
    callerContextStr += `\nOFFICE HOURS (for caller inquiries):\n${hoursLines.join('\n')}`
  }
  if (afterHoursBehaviorNote) callerContextStr += `\n${afterHoursBehaviorNote}`

  // Today's Update — time-sensitive temporary override from dashboard
  const injectedNote = (client.injected_note as string | null)?.trim()
  if (injectedNote) {
    callerContextStr += `\nRIGHT NOW: ${injectedNote}`
  }

  const extraQaFormatted = business.extraQa.map((p) => `"${p.q}" → "${p.a}"`).join('\n')

  const assembled: AssembledContextBlocks = {
    callerContextBlock: `[${callerContextStr}]`,
    businessFactsBlock: business.businessFacts
      ? buildContextBlock('Business Facts', business.businessFacts)
      : '',
    extraQaBlock: extraQaFormatted ? buildContextBlock('Q&A', extraQaFormatted) : '',
    contextDataBlock: business.contextData
      ? buildContextBlock(business.contextDataLabel, business.contextData)
      : '',
  }

  // ── Knowledge summary (Phase 3) ─────────────────────────────────────────────
  const knowledge = buildKnowledgeSummary(business)

  // ── Retrieval config (Phase 4) ────────────────────────────────────────────
  const knowledgeBackend = (client.knowledge_backend as RetrievalBackend) ?? null
  const retrieval = buildRetrievalConfig(capabilities, knowledge, corpusAvailable, knowledgeBackend)

  return { business, caller, capabilities, assembled, knowledge, retrieval }
}
