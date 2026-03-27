/**
 * Central capability registry for unmissed.ai.
 *
 * This is the single source of truth for all agent capabilities:
 *   - What modes exist (message_only / triage / full_service)
 *   - What add-on features exist (forwarding, IVR, SMS, knowledge)
 *   - What plan is required for each
 *   - What the onboarding UI should show
 *   - What DB fields are written
 *   - Whether a capability needs agent sync (updateAgent)
 *
 * To add a new capability:
 *   1. Add it here with its metadata
 *   2. Add the tool builder in lib/ultravox.ts → buildAgentTools()
 *   3. Add the badge in lib/capability-flags.ts → buildCapabilityFlags()
 *   4. Add the prompt patcher in lib/prompt-patcher.ts if needed
 *   5. Add to the settings PATCH route and needsAgentSync list
 *
 * Do NOT duplicate this logic in individual components.
 */

// ── Agent modes ─────────────────────────────────────────────────────────────

export type AgentMode = 'message_only' | 'triage' | 'full_service'

export interface AgentModeConfig {
  id: AgentMode
  label: string
  tagline: string
  description: string
  /** What the agent says in this mode (preview quote) */
  quote: string
  /** Emoji icon for the mode card */
  icon: string
  /** What capabilities are always included */
  included: string[]
}

export const AGENT_MODES: AgentModeConfig[] = [
  {
    id: 'message_only',
    label: 'Message Taker',
    tagline: 'Never miss a call',
    description: 'Greets callers, collects their name and reason for calling, and sends you a summary.',
    quote: '"Got it — I\'ll let them know you called. What\'s the best way to reach you?"',
    icon: '📬',
    included: ['Call summaries by email or Telegram', 'Caller name & phone collected', 'After-hours handling'],
  },
  {
    id: 'triage',
    label: 'Receptionist',
    tagline: 'Answer questions + qualify leads',
    description: 'Answers common questions, qualifies callers, and routes or escalates as needed.',
    quote: '"Sure, I can help with that. Are you looking to book a service or do you have a quick question?"',
    icon: '🧑‍💼',
    included: ['Everything in Message Taker', 'FAQ & website knowledge', 'Lead qualification', 'Caller categorization'],
  },
  {
    id: 'full_service',
    label: 'Full Receptionist',
    tagline: 'Book, answer, and handle everything',
    description: 'Acts as a fully capable front desk — books appointments, handles FAQs, and manages callers end-to-end.',
    quote: '"I can book you in for Tuesday at 2pm — does that work for you?"',
    icon: '🏆',
    included: ['Everything in Receptionist', 'Calendar booking', 'Appointment reminders', 'Smart escalation'],
  },
]

// ── Add-on features ──────────────────────────────────────────────────────────

export type CapabilityId =
  | 'forwarding'
  | 'ivr'
  | 'sms'
  | 'knowledge'

export interface CapabilityConfig {
  id: CapabilityId
  label: string
  description: string
  /** Plan required. null = available on all plans */
  requiresPlan: 'pro' | null
  /** Whether enabling this triggers needsAgentSync → updateAgent() */
  needsAgentSync: boolean
  /** DB field on `clients` table (if top-level, not in intake_json) */
  dbField: string | null
  /** Onboarding data field */
  onboardingField: string
  /** Badge text when plan-gated */
  planBadge: string | null
}

export const CAPABILITIES: CapabilityConfig[] = [
  {
    id: 'forwarding',
    label: 'Call Forwarding',
    description: 'Transfer urgent calls to your phone number — available after you get a number.',
    requiresPlan: 'pro',
    needsAgentSync: true,
    dbField: 'forwarding_number',
    onboardingField: 'callForwardingEnabled',
    planBadge: 'Pro plan',
  },
  {
    id: 'ivr',
    label: 'IVR Pre-filter',
    description: 'Play a menu before callers reach your agent (e.g. "Press 1 for service, 2 for billing")',
    requiresPlan: null,
    needsAgentSync: false,
    dbField: 'ivr_enabled',
    onboardingField: 'ivrEnabled',
    planBadge: null,
  },
  {
    id: 'sms',
    label: 'SMS Follow-up',
    description: 'Automatically text callers a summary or confirmation after each call.',
    requiresPlan: null,
    needsAgentSync: true,
    dbField: 'sms_enabled',
    onboardingField: 'callerAutoText',
    planBadge: null,
  },
  {
    id: 'knowledge',
    label: 'Website Knowledge',
    description: 'Your agent learns from your website and answers questions automatically.',
    requiresPlan: null,
    needsAgentSync: true,
    dbField: 'knowledge_backend',
    onboardingField: 'websiteUrl',
    planBadge: null,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAgentMode(mode: AgentMode): AgentModeConfig {
  return AGENT_MODES.find((m) => m.id === mode) ?? AGENT_MODES[1]
}

export function getCapability(id: CapabilityId): CapabilityConfig {
  const cap = CAPABILITIES.find((c) => c.id === id)
  if (!cap) throw new Error(`Unknown capability: ${id}`)
  return cap
}

/** Returns true if the given plan unlocks the given capability */
export function isPlanUnlocked(cap: CapabilityConfig, plan: string | null): boolean {
  if (!cap.requiresPlan) return true
  return plan === cap.requiresPlan
}

/** Returns which modes include calendar booking */
export const BOOKING_MODES: AgentMode[] = ['full_service']

/** Returns true if the selected mode implies booking */
export function modeIncludesBooking(mode: AgentMode): boolean {
  return BOOKING_MODES.includes(mode)
}
