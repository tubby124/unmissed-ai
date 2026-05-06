/**
 * niche-registry.ts — Single source of truth for all niche metadata.
 *
 * ADDING A NEW NICHE — two TS-enforced steps:
 *   1. Add the key to the NICHE_REGISTRY object below (TS fails if any required field is missing)
 *   2. Add prompt defaults in src/lib/prompt-config/niche-defaults.ts
 *
 * NOT in this registry (prompt content too large, or React-dependent):
 *   - nicheIcons          — React component refs, stays in AgentBuildCard.tsx
 *   - NICHE_COMPONENTS    — React component refs, stays in step-niche.tsx
 *   - REASON_PLACEHOLDERS — UI copy, stays in step-niche.tsx
 *   - NICHE_CAPABILITIES  — detailed capability flags, stays in niche-capabilities.ts
 *   - NICHE_DELTAS        — prompt override keys, stays in niche-capabilities.ts
 *   - NICHE_WOW_GREETINGS — runtime variable injection, stays inline in prompt-slots.ts
 */

export type WorkflowType = 'booking' | 'intake' | 'triage' | 'support' | 'callback'

export type NicheRegistryEntry = {
  /** Full display label e.g. "Auto Glass Shop" */
  label: string
  /** Short chip label e.g. "Auto Glass" */
  shortLabel: string
  /** Emoji icon */
  emoji: string
  /** Default agent name for new clients */
  defaultAgentName: string
  /** Show streetAddress field in onboarding step 2 */
  hasPhysicalAddress: boolean
  /** Tailwind text color class */
  color: string
  /** Tailwind border color class */
  border: string
  /** Tailwind bg color class */
  bg: string
  /** Hex color for charts/gradients (AgentBuildCard) */
  hexColor: string
  /** Ultravox voice UUID — default fallback when no voice chosen during onboarding */
  voiceId: string
  /** Visible in self-serve onboarding; false = admin-only */
  productionReady: boolean
  /** Appointment type label used in prompt e.g. "service call", "reservation" */
  serviceType: string
  /** Workflow routing in call-state */
  workflowType: WorkflowType
  /** Monthly minute cap — most niches use DEFAULT_MINUTE_LIMIT (100) */
  minuteLimit: number
  /**
   * Niche already has a built-in TRIAGE_DEEP in prompt defaults.
   * prompt-slots should NOT overwrite it with AI-generated TRIAGE_DEEP.
   */
  hasBuiltinTriage: boolean
  /**
   * KB-aware tier-1 stance.
   * - 'strict' (PM/legal/real_estate/dental): KB allowed for general policies; route property/case/patient specifics.
   * - 'permissive' (default): KB-first for most factual questions; route only on KB miss.
   */
  kbStance: 'strict' | 'permissive'
}

// ── Voice IDs ────────────────────────────────────────────────────────────────
const MARK     = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae' // confident, professional
const JACKIE   = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a' // warm, empathic
const MONIKA   = '87edb04c-06d4-47c2-bd94-683bc47e8fbe' // warm, natural (voicemail)

// ── Registry ─────────────────────────────────────────────────────────────────
export const NICHE_REGISTRY = {
  auto_glass: {
    label:              'Auto Glass Shop',
    shortLabel:         'Auto Glass',
    emoji:              '🚗',
    defaultAgentName:   'Mark',
    hasPhysicalAddress: true,
    color:              'text-blue-400',
    border:             'border-blue-500/30',
    bg:                 'bg-blue-500/10',
    hexColor:           '#3B82F6',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'service appointment',
    workflowType:       'intake',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'permissive',
  },
  hvac: {
    label:              'HVAC / Heating & Cooling',
    shortLabel:         'HVAC',
    emoji:              '❄️',
    defaultAgentName:   'Mike',
    hasPhysicalAddress: false,
    color:              'text-orange-400',
    border:             'border-orange-500/30',
    bg:                 'bg-orange-500/10',
    hexColor:           '#F59E0B',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'service call',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'permissive',
  },
  plumbing: {
    label:              'Plumbing',
    shortLabel:         'Plumbing',
    emoji:              '🔧',
    defaultAgentName:   'Dave',
    hasPhysicalAddress: false,
    color:              'text-cyan-400',
    border:             'border-cyan-500/30',
    bg:                 'bg-cyan-500/10',
    hexColor:           '#06B6D4',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'service call',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'permissive',
  },
  dental: {
    label:              'Dental Office',
    shortLabel:         'Dental',
    emoji:              '🦷',
    defaultAgentName:   'Ashley',
    hasPhysicalAddress: true,
    color:              'text-teal-400',
    border:             'border-teal-500/30',
    bg:                 'bg-teal-500/10',
    hexColor:           '#8B5CF6',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'strict',
  },
  legal: {
    label:              'Law Firm',
    shortLabel:         'Legal',
    emoji:              '⚖️',
    defaultAgentName:   'Jordan',
    hasPhysicalAddress: true,
    color:              'text-rose-400',
    border:             'border-rose-500/30',
    bg:                 'bg-rose-500/10',
    hexColor:           '#6B7280',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'strict',
  },
  salon: {
    label:              'Salon / Barbershop',
    shortLabel:         'Salon',
    emoji:              '✂️',
    defaultAgentName:   'Jamie',
    hasPhysicalAddress: true,
    color:              'text-pink-400',
    border:             'border-pink-500/30',
    bg:                 'bg-pink-500/10',
    hexColor:           '#EC4899',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  real_estate: {
    label:              'Real Estate Agent',
    shortLabel:         'Real Estate',
    emoji:              '🏠',
    defaultAgentName:   'Alex',
    hasPhysicalAddress: false,
    color:              'text-amber-400',
    border:             'border-amber-500/30',
    bg:                 'bg-amber-500/10',
    hexColor:           '#10B981',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'consultation',
    workflowType:       'triage',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'strict',
  },
  property_management: {
    label:              'Property Management',
    shortLabel:         'Property Mgmt',
    emoji:              '🏘️',
    defaultAgentName:   'Jade',
    hasPhysicalAddress: true,
    color:              'text-purple-400',
    border:             'border-purple-500/30',
    bg:                 'bg-purple-500/10',
    hexColor:           '#8B5CF6',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'strict',
  },
  outbound_isa_realtor: {
    label:              'Realtor ISA (Outbound)',
    shortLabel:         'ISA Realtor',
    emoji:              '📞',
    defaultAgentName:   'Fatima',
    hasPhysicalAddress: false,
    color:              'text-amber-400',
    border:             'border-amber-500/30',
    bg:                 'bg-amber-500/10',
    hexColor:           '#10B981',
    voiceId:            JACKIE,
    productionReady:    false, // admin-only — hidden from self-serve
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   true,
    kbStance:           'permissive',
  },
  restaurant: {
    label:              'Restaurant / Food Service',
    shortLabel:         'Restaurant',
    emoji:              '🍕',
    defaultAgentName:   'Sofia',
    hasPhysicalAddress: true,
    color:              'text-red-400',
    border:             'border-red-500/30',
    bg:                 'bg-red-500/10',
    hexColor:           '#EF4444',
    voiceId:            JACKIE,
    productionReady:    true,
    serviceType:        'reservation',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  voicemail: {
    label:              'Voicemail / Message Taking',
    shortLabel:         'Voicemail',
    emoji:              '📬',
    defaultAgentName:   'Sam',
    hasPhysicalAddress: false,
    color:              'text-zinc-400',
    border:             'border-zinc-500/30',
    bg:                 'bg-zinc-500/10',
    hexColor:           '#6366F1',
    voiceId:            MONIKA,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        50, // lower tier
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  print_shop: {
    label:              'Print Shop',
    shortLabel:         'Print Shop',
    emoji:              '🖨️',
    defaultAgentName:   'Alex',
    hasPhysicalAddress: true,
    color:              'text-indigo-400',
    border:             'border-indigo-500/30',
    bg:                 'bg-indigo-500/10',
    hexColor:           '#14B8A6',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  mechanic_shop: {
    label:              'Auto Mechanic Shop',
    shortLabel:         'Auto Repair',
    emoji:              '🔩',
    defaultAgentName:   'Jake',
    hasPhysicalAddress: true,
    color:              'text-red-400',
    border:             'border-red-500/30',
    bg:                 'bg-red-500/10',
    hexColor:           '#EF4444',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  pest_control: {
    label:              'Pest Control',
    shortLabel:         'Pest Control',
    emoji:              '🐛',
    defaultAgentName:   'Tyler',
    hasPhysicalAddress: false,
    color:              'text-lime-400',
    border:             'border-lime-500/30',
    bg:                 'bg-lime-500/10',
    hexColor:           '#84CC16',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  electrician: {
    label:              'Electrician',
    shortLabel:         'Electrician',
    emoji:              '⚡',
    defaultAgentName:   'Ryan',
    hasPhysicalAddress: false,
    color:              'text-yellow-400',
    border:             'border-yellow-500/30',
    bg:                 'bg-yellow-500/10',
    hexColor:           '#EAB308',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'service call',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  locksmith: {
    label:              'Locksmith',
    shortLabel:         'Locksmith',
    emoji:              '🔑',
    defaultAgentName:   'Chris',
    hasPhysicalAddress: false,
    color:              'text-slate-400',
    border:             'border-slate-500/30',
    bg:                 'bg-slate-500/10',
    hexColor:           '#94A3B8',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  barbershop: {
    label:              'Barbershop',
    shortLabel:         'Barbershop',
    emoji:              '💈',
    defaultAgentName:   'Jake',
    hasPhysicalAddress: true,
    color:              'text-green-400',
    border:             'border-green-500/30',
    bg:                 'bg-green-500/10',
    hexColor:           '#22C55E',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
  other: {
    label:              'Other Business',
    shortLabel:         'General',
    emoji:              '🏢',
    defaultAgentName:   'Sam',
    hasPhysicalAddress: false,
    color:              'text-zinc-400',
    border:             'border-zinc-500/30',
    bg:                 'bg-zinc-500/10',
    hexColor:           '#6366F1',
    voiceId:            MARK,
    productionReady:    true,
    serviceType:        'appointment',
    workflowType:       'support',
    minuteLimit:        100,
    hasBuiltinTriage:   false,
    kbStance:           'permissive',
  },
} as const satisfies Record<string, NicheRegistryEntry>

// ── Derived types ─────────────────────────────────────────────────────────────

/** Union of all valid niche keys — TS-enforced via NICHE_REGISTRY. */
export type Niche = keyof typeof NICHE_REGISTRY

// ── Derived lookup maps (backward-compat re-exports) ──────────────────────────

/** Full display labels e.g. "Auto Glass Shop" */
export const nicheLabels = Object.fromEntries(
  Object.entries(NICHE_REGISTRY).map(([k, v]) => [k, v.label])
) as Record<Niche, string>

/** Short chip labels e.g. "Auto Glass" */
export const nicheShortLabels = Object.fromEntries(
  Object.entries(NICHE_REGISTRY).map(([k, v]) => [k, v.shortLabel])
) as Record<Niche, string>

/** Emoji icons */
export const nicheEmojis = Object.fromEntries(
  Object.entries(NICHE_REGISTRY).map(([k, v]) => [k, v.emoji])
) as Record<Niche, string>

/** Default agent names */
export const defaultAgentNames = Object.fromEntries(
  Object.entries(NICHE_REGISTRY).map(([k, v]) => [k, v.defaultAgentName])
) as Record<Niche, string>

/** Production-ready flag — used by step1-gbp.tsx and API routes */
export const NICHE_PRODUCTION_READY = Object.fromEntries(
  Object.entries(NICHE_REGISTRY).map(([k, v]) => [k, v.productionReady])
) as Record<Niche, boolean>

// ── Getter functions ──────────────────────────────────────────────────────────

/** Normalises hyphenated DB slugs to canonical underscore keys. */
function norm(niche: string): string {
  return niche.replace(/-/g, '_')
}

function entry(niche: string | null | undefined): NicheRegistryEntry {
  const key = norm(niche ?? 'other')
  return (NICHE_REGISTRY as Record<string, NicheRegistryEntry>)[key] ?? NICHE_REGISTRY.other
}

/** Returns `{ label, shortLabel, color, border, bg }` for dashboard chips. */
export function getNicheConfig(niche: string | null | undefined) {
  const e = entry(niche)
  return { label: e.label, shortLabel: e.shortLabel, color: e.color, border: e.border, bg: e.bg }
}

/** Returns the Ultravox voice UUID for a niche. */
export function getNicheVoice(niche: string | null | undefined): string {
  return entry(niche).voiceId
}

/** Returns the hex colour string for a niche (charts / gradients). */
export function getNicheHexColor(niche: string | null | undefined): string {
  return entry(niche).hexColor
}

/** Returns the workflow type for a niche. */
export function getNicheWorkflowType(niche: string | null | undefined): WorkflowType {
  return entry(niche).workflowType
}

/** Returns the service type label for a niche. */
export function getNicheServiceType(niche: string | null | undefined): string {
  return entry(niche).serviceType
}

/** Returns the monthly minute cap for a niche. */
export function getNicheMinuteLimit(niche: string | null | undefined): number {
  return entry(niche).minuteLimit
}

export function getKbStance(niche: string): 'strict' | 'permissive' {
  const e = (NICHE_REGISTRY as Record<string, NicheRegistryEntry>)[niche]
  return e?.kbStance ?? 'permissive'
}
