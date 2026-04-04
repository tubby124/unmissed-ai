/**
 * build-client-agent-config.ts — Phase 1: normalized dashboard config builder
 *
 * Converts a raw Supabase clients row into a typed ClientAgentConfig.
 * Pure function — no DB calls, no async, no side effects.
 *
 * RULES (Phase 1):
 * - Does NOT change prompt generation behavior
 * - Does NOT touch provisioning
 * - Does NOT write to DB
 * - All fields read from existing clients columns or derived
 * - No new DB columns required
 */

import type {
  ClientAgentConfig,
  AgentMode,
  VoicePresetId,
  ScheduleMode,
  CallHandlingMode,
  ScrapeStatus,
  SubscriptionStatus,
} from '@/types/client-agent-config'
import {
  DEFAULT_TIMEZONE,
  DEFAULT_VOICE_PRESET,
  DEFAULT_AFTER_HOURS_BEHAVIOR,
  DEFAULT_AGENT_NAME,
  DEFAULT_MONTHLY_MINUTE_LIMIT,
  DEFAULT_SCHEDULE_MODE,
} from '@/lib/client-agent-config-defaults'

// ── Input type ────────────────────────────────────────────────────────────────
// Typed subset of the Supabase clients row. Column names match actual DB schema.
// Only id/slug/business_name are required — all others optional so callers can
// pass a partial SELECT result without type errors.

export type ClientsRow = {
  id: string
  slug: string
  business_name: string
  niche?: string | null
  timezone?: string | null
  city?: string | null
  website_url?: string | null
  callback_phone?: string | null
  contact_email?: string | null
  owner_name?: string | null
  agent_voice_id?: string | null
  agent_name?: string | null
  voice_style_preset?: string | null
  business_hours_weekday?: string | null
  business_hours_weekend?: string | null
  after_hours_behavior?: string | null
  after_hours_emergency_phone?: string | null
  forwarding_number?: string | null
  transfer_conditions?: string | null
  booking_enabled?: boolean | null
  sms_enabled?: boolean | null
  ivr_enabled?: boolean | null
  call_handling_mode?: string | null
  agent_mode?: string | null
  knowledge_backend?: string | null
  business_facts?: string | string[] | null
  extra_qa?: { q: string; a: string }[] | null
  services_offered?: string | null
  website_scrape_status?: string | null
  setup_complete?: boolean | null
  subscription_status?: string | null
  selected_plan?: string | null
  trial_expires_at?: string | null
  monthly_minute_limit?: number | null
  gbp_place_id?: string | null
  gbp_rating?: number | null
  gbp_review_count?: number | null
  gbp_photo_url?: string | null
  gbp_summary?: string | null
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function deriveScheduleMode(hoursWeekday: string | null): ScheduleMode {
  if (!hoursWeekday) return DEFAULT_SCHEDULE_MODE
  const lower = hoursWeekday.toLowerCase()
  if (lower.includes('24') || lower.includes('always') || lower.includes('anytime')) return '24_7'
  return 'business_hours'
}

function deriveScrapeStatus(status: string | null | undefined): ScrapeStatus {
  if (!status) return 'none'
  // DB values: 'scraping' | 'extracted' | 'failed' | 'approved'
  // Legacy values: 'complete' | 'pending' | 'in_progress' | 'error'
  if (status === 'approved' || status === 'complete') return 'complete'
  if (status === 'scraping' || status === 'extracted' || status === 'pending' || status === 'in_progress') return 'pending'
  if (status === 'failed' || status === 'error') return 'error'
  return 'none'
}

const VALID_PRESETS: VoicePresetId[] = [
  'casual_friendly',
  'professional_warm',
  'direct_efficient',
  'empathetic_care',
]

function deriveVoicePreset(preset: string | null | undefined): {
  voicePreset: VoicePresetId
  _voicePresetIsDefault: boolean
} {
  if (preset && VALID_PRESETS.includes(preset as VoicePresetId)) {
    return { voicePreset: preset as VoicePresetId, _voicePresetIsDefault: false }
  }
  return { voicePreset: DEFAULT_VOICE_PRESET, _voicePresetIsDefault: true }
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Builds a normalized ClientAgentConfig from a Supabase clients row.
 *
 * @param row - Subset of Supabase clients row (see ClientsRow type)
 * @param now - Current time (default: new Date()) — used only for isTrialActive
 */
export function buildClientAgentConfig(
  row: ClientsRow,
  now: Date = new Date(),
): ClientAgentConfig {
  // Persona
  const { voicePreset, _voicePresetIsDefault } = deriveVoicePreset(row.voice_style_preset)

  // Hours
  const hoursWeekday = row.business_hours_weekday ?? null
  const scheduleMode = deriveScheduleMode(hoursWeekday)

  // Routing
  const forwardingNumber = row.forwarding_number?.trim() || null
  const callForwardingEnabled = !!forwardingNumber
  const bookingEnabled = row.booking_enabled ?? false
  const rawMode = row.call_handling_mode as CallHandlingMode | null
  const callHandlingMode: CallHandlingMode = (rawMode && ['message_only', 'triage', 'full_service'].includes(rawMode))
    ? rawMode
    : 'triage'

  const VALID_AGENT_MODES: AgentMode[] = ['voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking']
  const rawAgentMode = row.agent_mode as AgentMode | null
  const agentMode: AgentMode = (rawAgentMode && VALID_AGENT_MODES.includes(rawAgentMode))
    ? rawAgentMode
    : 'lead_capture'

  // Knowledge — filter empty Q&A pairs (same logic as buildAgentContext)
  const extraQa = (row.extra_qa ?? []).filter(p => p.q?.trim() && p.a?.trim())

  // Trial state
  const subscriptionStatus = (row.subscription_status ?? 'none') as SubscriptionStatus
  const trialConverted = subscriptionStatus === 'active'
  const trialExpiresAt = row.trial_expires_at ?? null
  const isTrialActive =
    !trialConverted && trialExpiresAt != null && new Date(trialExpiresAt) > now

  // Auth
  const setupComplete = row.setup_complete ?? false

  return {
    clientId: row.id,
    slug: row.slug,
    business: {
      businessName: row.business_name,
      niche: row.niche ?? 'other',
      city: row.city ?? null,
      stateCode: null, // Phase 2: add clients.province column
      timezone: row.timezone ?? DEFAULT_TIMEZONE,
      websiteUrl: row.website_url ?? null,
      callbackPhone: row.callback_phone ?? null,
      contactEmail: row.contact_email ?? null,
      ownerName: row.owner_name ?? null,
    },
    persona: {
      agentName: row.agent_name ?? DEFAULT_AGENT_NAME,
      voiceId: row.agent_voice_id ?? null,
      voicePreset,
      _voicePresetIsDefault,
    },
    hours: {
      hoursWeekday,
      hoursWeekend: row.business_hours_weekend ?? null,
      afterHoursBehavior: row.after_hours_behavior ?? DEFAULT_AFTER_HOURS_BEHAVIOR,
      scheduleMode,
    },
    routing: {
      callForwardingEnabled,
      forwardingNumber,
      transferEnabled: !!(row.transfer_conditions?.trim()),
      callHandlingMode,
      agentMode,
    },
    capabilities: {
      smsEnabled: row.sms_enabled ?? false,
      bookingEnabled,
      ivrEnabled: row.ivr_enabled ?? false,
      knowledgeEnabled: row.knowledge_backend === 'pgvector',
    },
    knowledge: {
      businessFacts: Array.isArray(row.business_facts)
        ? row.business_facts
        : (row.business_facts ? row.business_facts.split('\n').filter((l: string) => l.trim().length > 0) : null),
      extraQa,
      servicesOffered: row.services_offered ?? null,
      scrapeStatus: deriveScrapeStatus(row.website_scrape_status),
    },
    trial: {
      subscriptionStatus,
      selectedPlan: row.selected_plan ?? null,
      trialExpiresAt,
      trialConverted,
      monthlyMinuteLimit: row.monthly_minute_limit ?? DEFAULT_MONTHLY_MINUTE_LIMIT,
      isTrialActive,
    },
    gbp: {
      hasGbp: !!row.gbp_place_id,
      placeId: row.gbp_place_id ?? null,
      rating: row.gbp_rating ?? null,
      reviewCount: row.gbp_review_count ?? null,
      photoUrl: row.gbp_photo_url ?? null,
      summary: row.gbp_summary ?? null,
    },
    auth: {
      setupComplete,
      isFirstVisit: !setupComplete,
    },
  }
}
