/**
 * client-agent-config.ts — Dashboard/config-time business config types
 *
 * DISTINCT from the call-time AgentContext in lib/agent-context.ts.
 * ClientAgentConfig = what the dashboard/settings layer sees (normalized, stable).
 * AgentContext       = what the inbound webhook sees at call time (per-call, dynamic).
 *
 * Built by: lib/build-client-agent-config.ts
 */

export type VoicePresetId =
  | 'casual_friendly'
  | 'professional_warm'
  | 'direct_efficient'
  | 'empathetic_care'

export type ScheduleMode = '24_7' | 'business_hours'

export type CallHandlingMode = 'message_only' | 'triage' | 'full_service'

/** Internal conversational behavior profile — distinct from CallHandlingMode (customer-facing product mode). */
export type AgentMode = 'voicemail_replacement' | 'lead_capture' | 'info_hub' | 'appointment_booking'

export type ScrapeStatus = 'none' | 'pending' | 'complete' | 'error'

export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'canceled' | 'past_due'

// ── Sub-types ─────────────────────────────────────────────────────────────────

export type AgentBusiness = {
  businessName: string
  niche: string
  city: string | null
  /** Two-letter state/province code — null until Phase 2 adds clients.province */
  stateCode: string | null
  timezone: string
  websiteUrl: string | null
  callbackPhone: string | null
  contactEmail: string | null
  ownerName: string | null
}

export type AgentPersona = {
  agentName: string
  /** Ultravox voice ID — clients.agent_voice_id */
  voiceId: string | null
  voicePreset: VoicePresetId
  /** True when voicePreset is the column default, not a user-chosen value */
  _voicePresetIsDefault: boolean
}

export type AgentHours = {
  hoursWeekday: string | null
  hoursWeekend: string | null
  afterHoursBehavior: string
  scheduleMode: ScheduleMode
}

export type AgentRouting = {
  callForwardingEnabled: boolean
  forwardingNumber: string | null
  transferEnabled: boolean
  /** Top-level DB column: 'message_only' | 'triage' | 'full_service' */
  callHandlingMode: CallHandlingMode
  /** Internal behavior profile. Default: 'lead_capture'. No prompt wiring in Phase 1. */
  agentMode: AgentMode
}

export type AgentCapabilities = {
  smsEnabled: boolean
  bookingEnabled: boolean
  ivrEnabled: boolean
  knowledgeEnabled: boolean
}

export type AgentKnowledge = {
  businessFacts: string[] | null
  extraQa: { q: string; a: string }[]
  servicesOffered: string | null
  scrapeStatus: ScrapeStatus
}

export type AgentGbp = {
  hasGbp: boolean
  placeId: string | null
  rating: number | null
  reviewCount: number | null
  photoUrl: string | null
  summary: string | null
}

export type AgentTrial = {
  subscriptionStatus: SubscriptionStatus
  selectedPlan: string | null
  trialExpiresAt: string | null
  trialConverted: boolean
  monthlyMinuteLimit: number
  isTrialActive: boolean
}

export type AgentAuth = {
  setupComplete: boolean
  /** Phase 1 proxy: !setup_complete. Phase 2: use first_login_at column. */
  isFirstVisit: boolean
}

// ── Root type ─────────────────────────────────────────────────────────────────

export type ClientAgentConfig = {
  clientId: string
  slug: string
  business: AgentBusiness
  persona: AgentPersona
  hours: AgentHours
  routing: AgentRouting
  capabilities: AgentCapabilities
  knowledge: AgentKnowledge
  gbp: AgentGbp
  trial: AgentTrial
  auth: AgentAuth
}
