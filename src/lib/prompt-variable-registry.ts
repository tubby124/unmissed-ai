/**
 * prompt-variable-registry.ts — D283a: Static registry of all prompt template variables.
 *
 * Maps every variable used by buildSlotContext() to its metadata:
 * - Which slot uses it
 * - Which DB field sources it
 * - Whether it's editable via an existing settings card
 * - Which category it belongs to (for dashboard grouping)
 *
 * This is pure data — no UI, no patching, no side effects.
 * Source: derived from buildSlotContext() in prompt-slots.ts
 */

import type { SlotId } from './prompt-sections'

// ── Types ───────────────────────────────────────────────────────────────────────

export type VariableCategory =
  | 'identity'
  | 'voice'
  | 'flow'
  | 'knowledge'
  | 'capability'
  | 'safety'

export interface PromptVariable {
  /** Template variable key, e.g. 'CLOSE_PERSON' */
  key: string
  /** Human-readable label for dashboard display */
  label: string
  /** Which slot function consumes this variable */
  slotId: SlotId
  /**
   * Additional slots whose generated content references this variable and
   * therefore needs regeneration when the variable changes. Names like
   * AGENT_NAME and CLOSE_PERSON are baked into greetings, examples,
   * escalation lines, after-hours blocks, and FAQ answers — far beyond
   * the single owning `slotId`. Without this list, edits leave stale
   * names in unrelated slots (root cause of D371 / Brian "Emon" bug).
   */
  extraAffectedSlots?: SlotId[]
  /** DB column on `clients` table that sources this value (null = derived/computed) */
  dbField: string | null
  /** Intake data key that populates this during onboarding (null = niche default only) */
  intakeField: string | null
  /** Whether this can be edited post-onboarding via a settings card or patcher */
  editable: boolean
  /** Settings card or PATCH field that edits this (null = not editable) */
  editPath: string | null
  /** Dashboard grouping category */
  category: VariableCategory
  /** Which niche defaults provide the base value (null = universal/_common) */
  nicheSourced: boolean
  /** Brief description of what this controls in the prompt */
  description: string
}

// ── Registry ────────────────────────────────────────────────────────────────────

export const PROMPT_VARIABLE_REGISTRY: PromptVariable[] = [
  // ── Identity variables ─────────────────────────────────────────────────────
  {
    key: 'AGENT_NAME',
    label: 'Agent name',
    slotId: 'identity',
    extraAffectedSlots: [
      'conversation_flow', 'inline_examples', 'after_hours',
      'returning_caller', 'vip_protocol', 'call_handling_mode',
      'escalation_transfer', 'faq_pairs',
    ],
    dbField: 'agent_name',
    intakeField: 'agent_name',
    editable: true,
    editPath: 'settings.agent_name',
    category: 'identity',
    nicheSourced: false,
    description: 'The AI agent\'s name used in identity and greetings',
  },
  {
    key: 'BUSINESS_NAME',
    label: 'Business name',
    slotId: 'identity',
    extraAffectedSlots: [
      'conversation_flow', 'inline_examples', 'after_hours',
      'returning_caller', 'knowledge', 'faq_pairs',
    ],
    dbField: 'business_name',
    intakeField: 'business_name',
    editable: true,
    editPath: 'settings.business_name',
    category: 'identity',
    nicheSourced: false,
    description: 'Company name used throughout the prompt',
  },
  {
    key: 'INDUSTRY',
    label: 'Industry type',
    slotId: 'identity',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'identity',
    nicheSourced: true,
    description: 'Business type description (e.g. "auto glass shop", "residential plumbing company")',
  },
  {
    key: 'CITY',
    label: 'City / service area',
    slotId: 'identity',
    dbField: null,
    intakeField: 'city',
    editable: false,
    editPath: null,
    category: 'identity',
    nicheSourced: false,
    description: 'Location used in identity line ("in Calgary")',
  },
  {
    key: 'LOCATION_STRING',
    label: 'Location string',
    slotId: 'identity',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'identity',
    nicheSourced: false,
    description: 'Derived from CITY — " in Calgary" or empty string',
  },
  {
    key: 'PERSONALITY_LINE',
    label: 'Personality descriptor',
    slotId: 'identity',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'identity',
    nicheSourced: false,
    description: 'One-line personality from voice preset (e.g. "friendly, casual, approachable")',
  },
  {
    key: 'CLOSE_PERSON',
    label: 'Callback contact name',
    slotId: 'goal',
    extraAffectedSlots: [
      'conversation_flow', 'inline_examples', 'escalation_transfer',
      'after_hours', 'faq_pairs', 'call_handling_mode',
    ],
    dbField: 'owner_name',
    intakeField: 'owner_name',
    editable: true,
    editPath: 'settings.owner_name',
    category: 'identity',
    nicheSourced: true,
    description: 'Person who will call back (first name derived from owner_name)',
  },

  // ── Voice variables ────────────────────────────────────────────────────────
  {
    key: 'TONE_STYLE_BLOCK',
    label: 'Tone & style instructions',
    slotId: 'tone_and_style',
    dbField: null,
    intakeField: 'voice_style_preset',
    editable: true,
    editPath: 'settings.voice_style_preset',
    category: 'voice',
    nicheSourced: false,
    description: 'Full tone/style block from voice preset',
  },
  {
    key: 'FILLER_STYLE',
    label: 'Filler words style',
    slotId: 'voice_naturalness',
    dbField: null,
    intakeField: 'voice_style_preset',
    editable: true,
    editPath: 'settings.voice_style_preset',
    category: 'voice',
    nicheSourced: false,
    description: 'Natural filler words (e.g. "like, uh, y\'know" for casual)',
  },
  {
    key: 'GREETING_LINE',
    label: 'Opening greeting',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'voice',
    nicheSourced: true,
    description: 'First thing the agent says when answering (niche wow-first greeting)',
  },
  {
    key: 'CLOSING_LINE',
    label: 'Closing line',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'voice',
    nicheSourced: false,
    description: 'Final goodbye before hangUp (from voice preset)',
  },

  // ── Flow variables ─────────────────────────────────────────────────────────
  {
    key: 'PRIMARY_GOAL',
    label: 'Primary goal',
    slotId: 'goal',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: false,
    description: 'Derived from agent_mode — what the agent is trying to accomplish',
  },
  {
    key: 'COMPLETION_FIELDS',
    label: 'Required info fields',
    slotId: 'goal',
    dbField: null,
    intakeField: 'completion_fields',
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Fields that must be collected before closing (e.g. "name, phone, vehicle info")',
  },
  {
    key: 'CLOSE_ACTION',
    label: 'Callback action',
    slotId: 'goal',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'What CLOSE_PERSON will do (e.g. "call ya back with a quote")',
  },
  {
    key: 'PRIMARY_CALL_REASON',
    label: 'Primary call reason',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Main reason callers call (routes to triage step)',
  },
  {
    key: 'FIRST_INFO_QUESTION',
    label: 'First info question',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'First question asked to collect caller info',
  },
  {
    key: 'INFO_TO_COLLECT',
    label: 'Info to collect',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'List of fields to collect during the call',
  },
  {
    key: 'INFO_LABEL',
    label: 'Info label',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Short label for what info is being collected (e.g. "vehicle info")',
  },
  {
    key: 'SERVICE_TIMING_PHRASE',
    label: 'Service timing phrase',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Timing question verb (e.g. "bring it in", "book an appointment")',
  },
  {
    key: 'MOBILE_POLICY',
    label: 'Mobile service policy',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: 'niche_mobileService',
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Whether business comes to customer or vice versa',
  },
  {
    key: 'WEEKEND_POLICY',
    label: 'Weekend availability',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'What agent says about weekend scheduling',
  },
  {
    key: 'TRIAGE_DEEP',
    label: 'Triage script',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Deep triage instructions — niche-specific diagnostic questions',
  },
  {
    key: 'FILTER_EXTRA',
    label: 'Extra filter rules',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Niche-specific call routing rules in the filter step',
  },
  {
    key: 'NICHE_EXAMPLES',
    label: 'Niche call examples',
    slotId: 'inline_examples',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Custom example conversations for this niche (replaces generic examples)',
  },
  {
    key: 'INFO_FLOW_OVERRIDE',
    label: 'Info collection override',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Completely replaces the default info collection flow',
  },
  {
    key: 'CLOSING_OVERRIDE',
    label: 'Closing override',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'flow',
    nicheSourced: true,
    description: 'Completely replaces the default closing flow',
  },
  {
    key: 'HOURS_WEEKDAY',
    label: 'Weekday hours',
    slotId: 'conversation_flow',
    dbField: 'business_hours_weekday',
    intakeField: 'hours_weekday',
    editable: true,
    editPath: 'settings.business_hours_weekday',
    category: 'flow',
    nicheSourced: false,
    description: 'Weekday business hours (also baked into filter response)',
  },

  // ── Knowledge variables ────────────────────────────────────────────────────
  {
    key: 'SERVICES_OFFERED',
    label: 'Services offered',
    slotId: 'conversation_flow',
    dbField: 'services_offered',
    intakeField: 'services_offered',
    editable: true,
    editPath: 'settings.services_offered',
    category: 'knowledge',
    nicheSourced: true,
    description: 'List of services the business offers',
  },
  {
    key: 'SERVICES_NOT_OFFERED',
    label: 'Services not offered',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: 'services_not_offered',
    editable: false,
    editPath: null,
    category: 'knowledge',
    nicheSourced: false,
    description: 'Services to explicitly decline',
  },
  {
    key: 'INSURANCE_STATUS',
    label: 'Insurance/payment status',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: 'insurance_preset',
    editable: false,
    editPath: null,
    category: 'knowledge',
    nicheSourced: true,
    description: 'How the business handles insurance (e.g. "private pay right now")',
  },
  {
    key: 'INSURANCE_DETAIL',
    label: 'Insurance/payment detail',
    slotId: 'conversation_flow',
    dbField: null,
    intakeField: 'insurance_preset',
    editable: false,
    editPath: null,
    category: 'knowledge',
    nicheSourced: true,
    description: 'Detail about insurance/payment handling',
  },
  {
    key: 'FAQ_PAIRS',
    label: 'FAQ Q&A pairs',
    slotId: 'faq_pairs',
    dbField: null,
    intakeField: 'niche_faq_pairs',
    editable: true,
    editPath: 'settings.extra_qa',
    category: 'knowledge',
    nicheSourced: false,
    description: 'Frequently asked question/answer pairs',
  },
  {
    key: 'URGENCY_KEYWORDS',
    label: 'Urgency keywords',
    slotId: 'escalation_transfer',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'knowledge',
    nicheSourced: true,
    description: 'Words that trigger escalation (e.g. "emergency", "flooding")',
  },

  // ── Capability variables ───────────────────────────────────────────────────
  {
    key: 'TRANSFER_ENABLED',
    label: 'Transfer enabled',
    slotId: 'escalation_transfer',
    dbField: 'forwarding_number',
    intakeField: 'owner_phone',
    editable: true,
    editPath: 'settings.forwarding_number',
    category: 'capability',
    nicheSourced: false,
    description: 'Whether call transfer is available (derived from forwarding_number)',
  },
  {
    key: 'AFTER_HOURS_BLOCK',
    label: 'After-hours instructions',
    slotId: 'after_hours',
    dbField: 'after_hours_behavior',
    intakeField: 'after_hours_behavior',
    editable: true,
    editPath: 'settings.after_hours_behavior',
    category: 'capability',
    nicheSourced: false,
    description: 'What the agent does outside business hours',
  },
  {
    key: 'FORBIDDEN_EXTRA',
    label: 'Extra forbidden rules',
    slotId: 'forbidden_actions',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'safety',
    nicheSourced: true,
    description: 'Niche/mode-specific extra forbidden action rules (numbered 10+)',
  },
  {
    key: 'SERVICE_APPOINTMENT_TYPE',
    label: 'Appointment type label',
    slotId: 'calendar_booking',
    dbField: null,
    intakeField: null,
    editable: false,
    editPath: null,
    category: 'capability',
    nicheSourced: true,
    description: 'Type of appointment for booking (e.g. "service appointment")',
  },

  // ── Safety variables (mostly static or niche-derived) ──────────────────────
  {
    key: 'PRICING_POLICY',
    label: 'Pricing policy',
    slotId: 'forbidden_actions',
    dbField: null,
    intakeField: 'pricing_policy',
    editable: false,
    editPath: null,
    category: 'safety',
    nicheSourced: false,
    description: 'Controls rule 3: never_quote, quote_from_kb, or quote_ranges',
  },
  {
    key: 'UNKNOWN_ANSWER_BEHAVIOR',
    label: 'Unknown answer behavior',
    slotId: 'knowledge',
    dbField: null,
    intakeField: 'unknown_answer_behavior',
    editable: false,
    editPath: null,
    category: 'safety',
    nicheSourced: false,
    description: 'What the agent does when it doesn\'t know the answer',
  },
]

// ── Lookup helpers ──────────────────────────────────────────────────────────────

/** Get a variable definition by key. */
export function getVariable(key: string): PromptVariable | undefined {
  return PROMPT_VARIABLE_REGISTRY.find(v => v.key === key)
}

/** Get all variables for a given slot. */
export function getVariablesForSlot(slotId: SlotId): PromptVariable[] {
  return PROMPT_VARIABLE_REGISTRY.filter(v => v.slotId === slotId)
}

/** Get all variables in a category. */
export function getVariablesByCategory(category: VariableCategory): PromptVariable[] {
  return PROMPT_VARIABLE_REGISTRY.filter(v => v.category === category)
}

/** Get all editable variables (ones with a settings edit path). */
export function getEditableVariables(): PromptVariable[] {
  return PROMPT_VARIABLE_REGISTRY.filter(v => v.editable)
}

/** Get all variables that are sourced from niche defaults. */
export function getNicheSourcedVariables(): PromptVariable[] {
  return PROMPT_VARIABLE_REGISTRY.filter(v => v.nicheSourced)
}

/**
 * Map from variable key to the slot that would need regeneration
 * when that variable changes. Used by the slot regenerator (D283c).
 */
export function getSlotForVariable(key: string): SlotId | null {
  const v = getVariable(key)
  return v?.slotId ?? null
}

/**
 * Map from DB field name to all variables it affects.
 * Used to determine which slots need regeneration when a DB field changes.
 */
export function getVariablesForDbField(dbField: string): PromptVariable[] {
  return PROMPT_VARIABLE_REGISTRY.filter(v => v.dbField === dbField)
}

/**
 * Get all slots that would need regeneration when a given DB field changes.
 * Returns unique slot IDs.
 *
 * Merges each variable's primary `slotId` with its `extraAffectedSlots` list —
 * required because identity-class variables (AGENT_NAME, BUSINESS_NAME,
 * CLOSE_PERSON) are baked into many slots beyond their owning slot
 * (greetings, examples, escalation, after-hours, FAQ). Without merging,
 * regen leaves the old name across most of the prompt.
 */
export function getSlotsAffectedByDbField(dbField: string): SlotId[] {
  const vars = getVariablesForDbField(dbField)
  const slots = new Set<SlotId>()
  for (const v of vars) {
    slots.add(v.slotId)
    for (const extra of v.extraAffectedSlots ?? []) slots.add(extra)
  }
  return Array.from(slots)
}
