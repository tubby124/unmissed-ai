/**
 * niche-capabilities.ts — Phase 1A: Capability Flags by Niche
 *
 * Defines what each niche is capable of doing. This is the source of truth
 * for whether a given niche supports booking, transfer, knowledge lookup, etc.
 *
 * RULES:
 * - No niche assumes booking capability unless explicitly declared here
 * - No niche assumes transfer capability unless explicitly declared here
 * - Disabled capabilities must NOT appear in assembled prompt/context (enforced in Phase 2)
 * - Phase 7: updateTenantRequests=true for property_management (pm-ops.ts validates writes)
 *
 * Do NOT modify this file to change prompt behavior directly —
 * capabilities are consumed by AgentContext (Phase 1B) and prompt builder (Phase 2).
 */

export type AgentCapabilities = {
  /** Agent can collect a caller message for callback */
  takeMessages: boolean
  /** Agent can take appointment booking requests (may use calendar tools) */
  bookAppointments: boolean
  /** Agent can perform a live call transfer (TRANSFER_ENABLED) */
  transferCalls: boolean
  /** Agent can answer questions from injected business knowledge / FAQ */
  useKnowledgeLookup: boolean
  /** Agent can look up property info (address, listing, showing details) */
  usePropertyLookup: boolean
  /** Agent can look up tenant records (unit, lease, contact info) */
  useTenantLookup: boolean
  /** Agent can write/update structured tenant requests (maintenance ops) */
  updateTenantRequests: boolean
  /** Agent has niche-specific emergency routing beyond the global 911 rule */
  emergencyRouting: boolean
}

// Default used when niche is unknown — most conservative posture
const DEFAULT_CAPABILITIES: AgentCapabilities = {
  takeMessages: true,
  bookAppointments: false,
  transferCalls: false,
  useKnowledgeLookup: false,
  usePropertyLookup: false,
  useTenantLookup: false,
  updateTenantRequests: false,
  emergencyRouting: false,
}

export const NICHE_CAPABILITIES: Record<string, AgentCapabilities> = {
  auto_glass: {
    takeMessages: true,
    bookAppointments: false, // Timing preference collected but confirmed via callback
    transferCalls: true,     // Can be enabled via owner_phone in intake
    useKnowledgeLookup: true, // SGI, ADAS, chip vs crack triage questions
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  hvac: {
    takeMessages: true,
    bookAppointments: false, // Service scheduling via callback only
    transferCalls: true,
    useKnowledgeLookup: true,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: true,  // No heat in winter → [URGENT]; gas smell → gas company redirect
  },
  plumbing: {
    takeMessages: true,
    bookAppointments: false,
    transferCalls: true,
    useKnowledgeLookup: true,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: true,  // Flooding / burst pipe → [URGENT] flag + shut-off instructions
  },
  dental: {
    takeMessages: true,
    bookAppointments: true,  // Primary purpose — new patient booking, cleaning requests
    transferCalls: true,
    useKnowledgeLookup: true,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false, // Dental pain → [URGENT] but no transfer to external emergency line
  },
  legal: {
    takeMessages: true,
    bookAppointments: false, // Consultation inquiry routes to callback, not calendar booking
    transferCalls: true,
    useKnowledgeLookup: true, // Practice areas, free consultation, existing client routing
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  salon: {
    takeMessages: true,
    bookAppointments: true,  // checkCalendarAvailability + bookAppointment tools active
    transferCalls: true,
    useKnowledgeLookup: true,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  real_estate: {
    takeMessages: true,
    bookAppointments: true,  // Property showings + agent callbacks
    transferCalls: true,
    useKnowledgeLookup: true, // Listing details, area knowledge, agent info
    usePropertyLookup: true,  // Look up specific properties, addresses, listings
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  property_management: {
    takeMessages: true,
    bookAppointments: false, // Maintenance visits routed to callback; NOT calendar-booked
    transferCalls: false,    // EXPLICIT: "NEVER pretend to transfer or put someone on hold. This is a callback-only service."
    useKnowledgeLookup: true, // Building policies, PM procedures, tenant FAQs
    usePropertyLookup: false,
    useTenantLookup: true,   // Tenant unit lookup, existing maintenance request lookup
    updateTenantRequests: true, // Phase 7: PM can create maintenance requests + append notes
    emergencyRouting: true,  // Flooding, no heat, gas leak → [URGENT] + 911 routing
  },
  outbound_isa_realtor: {
    takeMessages: true,
    bookAppointments: true,  // Setting up agent callback call IS the booking action
    transferCalls: false,    // Outbound ISA — no live transfer back to inbound
    useKnowledgeLookup: false,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  voicemail: {
    takeMessages: true,
    bookAppointments: false, // Voicemail only — no booking capability
    transferCalls: false,    // No transfer for voicemail-only service
    useKnowledgeLookup: false, // No business knowledge injection needed
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  print_shop: {
    takeMessages: true,
    bookAppointments: false, // Order intake via callback only
    transferCalls: true,
    useKnowledgeLookup: true, // Products, pricing, file requirements, rush policy
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  barbershop: {
    takeMessages: true,
    bookAppointments: true,  // checkCalendarAvailability + bookAppointment tools active
    transferCalls: true,
    useKnowledgeLookup: false, // Simple service menu; no complex knowledge needed
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  restaurant: {
    takeMessages: true,
    bookAppointments: false, // Reservations confirmed via callback, not calendar booking
    transferCalls: false,    // No live transfer flow in restaurant niche
    useKnowledgeLookup: true, // Menu questions, hours, specials
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  mechanic_shop: {
    takeMessages: true,
    bookAppointments: false, // Service appointments via callback
    transferCalls: true,
    useKnowledgeLookup: true, // Services, pricing, vehicle makes
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
  pest_control: {
    takeMessages: true,
    bookAppointments: false, // Inspection/treatment via callback
    transferCalls: true,
    useKnowledgeLookup: true, // Pests, treatment methods, pricing
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: true,  // Active infestation / health hazard → [URGENT]
  },
  electrician: {
    takeMessages: true,
    bookAppointments: false, // Service calls via callback
    transferCalls: true,
    useKnowledgeLookup: true, // Services, pricing, certifications
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: true,  // Sparks, burning smell, power out → [URGENT]
  },
  locksmith: {
    takeMessages: true,
    bookAppointments: false, // Emergency dispatch via callback
    transferCalls: true,
    useKnowledgeLookup: true, // Lock types, pricing, service area
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: true,  // Locked out → [URGENT] same-day dispatch
  },
  other: {
    takeMessages: true,
    bookAppointments: false, // Generic niche — no booking assumed
    transferCalls: true,     // Generic — can be enabled
    useKnowledgeLookup: false,
    usePropertyLookup: false,
    useTenantLookup: false,
    updateTenantRequests: false,
    emergencyRouting: false,
  },
}

/**
 * Normalizes niche slugs so DB values with hyphens (e.g. "auto-glass")
 * resolve to the canonical underscore keys in NICHE_CAPABILITIES (e.g. "auto_glass").
 */
function normalizeNiche(niche: string): string {
  return niche.replace(/-/g, '_')
}

/**
 * Returns the capability flags for a given niche.
 * Falls back to the most conservative default for unknown niches.
 * Normalizes hyphens → underscores so DB slugs match registry keys.
 */
export function getCapabilities(niche: string): AgentCapabilities {
  return NICHE_CAPABILITIES[normalizeNiche(niche)] ?? DEFAULT_CAPABILITIES
}

/**
 * Returns true if the given niche supports the specified capability.
 * Safe to call with unknown niches — returns false (conservative default).
 */
export function hasCapability(niche: string, capability: keyof AgentCapabilities): boolean {
  return getCapabilities(niche)[capability]
}

// ── Phase 5: Niche Family Classification ──────────────────────────────────────

/**
 * Builder path classification for each niche.
 *
 * - bespoke: Entirely separate prompt function (does NOT use the shared inbound template)
 * - shared_heavy: Uses shared template but has 3+ niche-specific override blocks
 * - shared_standard: Uses shared template with standard overrides only
 */
export type NicheFamily = 'bespoke' | 'shared_heavy' | 'shared_standard'

/**
 * Describes what makes a niche different from the shared baseline.
 */
export type NicheDelta = {
  family: NicheFamily
  /** Which NICHE_DEFAULTS override keys this niche uses */
  overrideKeys: string[]
  /** Hard-coded niche branches in buildPromptFromIntake (e.g. early return, special field handling) */
  buildtimeSpecialCases: string[]
  /** Hard-coded niche branches in webhook runtime (completed/inbound routes) */
  runtimeSpecialCases: string[]
}

export const NICHE_DELTAS: Record<string, NicheDelta> = {
  voicemail: {
    family: 'bespoke',
    overrideKeys: [],
    buildtimeSpecialCases: ['buildVoicemailPrompt (early return)'],
    runtimeSpecialCases: ['completed: custom SMS body', 'completed: email transcription'],
  },
  real_estate: {
    family: 'shared_heavy',
    overrideKeys: ['TRIAGE_DEEP', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  auto_glass: {
    family: 'shared_heavy',
    overrideKeys: ['TRIAGE_DEEP', 'FILTER_EXTRA', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: ['completed: rich Telegram format with vehicle/ADAS/VIN'],
  },
  property_management: {
    family: 'shared_heavy',
    overrideKeys: ['TRIAGE_DEEP', 'INFO_FLOW_OVERRIDE', 'CLOSING_OVERRIDE', 'FILTER_EXTRA', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  barbershop: {
    family: 'shared_heavy',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: ['niche_priceRange mapping', 'niche_walkInPolicy mapping', 'owner_name → CLOSE_PERSON'],
    runtimeSpecialCases: [],
  },
  print_shop: {
    family: 'shared_heavy',
    overrideKeys: ['URGENCY_KEYWORDS'],
    buildtimeSpecialCases: ['PRICE QUOTING EXCEPTION injection', 'buildPrintShopFaq (custom FAQ)', 'niche_pickupOnly → MOBILE_POLICY'],
    runtimeSpecialCases: [],
  },
  hvac: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  plumbing: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  dental: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  legal: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  salon: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  restaurant: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  outbound_isa_realtor: {
    family: 'shared_standard',
    overrideKeys: [],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  mechanic_shop: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  pest_control: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  electrician: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  locksmith: {
    family: 'shared_standard',
    overrideKeys: ['TRIAGE_DEEP', 'NICHE_EXAMPLES', 'FORBIDDEN_EXTRA'],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
  other: {
    family: 'shared_standard',
    overrideKeys: [],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  },
}

/**
 * Returns the niche family (builder path) for a given niche.
 * Unknown niches return 'shared_standard' (safest default — uses shared template with no overrides).
 */
export function getNicheFamily(niche: string): NicheFamily {
  return NICHE_DELTAS[normalizeNiche(niche)]?.family ?? 'shared_standard'
}

/**
 * Returns the full delta descriptor for a niche.
 * Unknown niches return a minimal shared_standard descriptor.
 */
export function getNicheDelta(niche: string): NicheDelta {
  return NICHE_DELTAS[normalizeNiche(niche)] ?? {
    family: 'shared_standard' as NicheFamily,
    overrideKeys: [],
    buildtimeSpecialCases: [],
    runtimeSpecialCases: [],
  }
}

/**
 * Returns all niches in a given family.
 */
export function getNichesByFamily(family: NicheFamily): string[] {
  return Object.entries(NICHE_DELTAS)
    .filter(([, delta]) => delta.family === family)
    .map(([niche]) => niche)
}
