/**
 * pm-ops.ts — Phase 7: Property Management Structured Ops
 *
 * Defines the data model and validation boundaries for property management
 * write operations. Separates PM into three concerns:
 *
 *   A. Structured Records (READ) — tenant table via contextData (already exists)
 *   B. Retrieval (SEARCH) — policies/docs via queryCorpus (Phase 4)
 *   C. Write Actions (THIS FILE) — maintenance request intake, bounded by validation
 *
 * RULES:
 * - Write ops require updateTenantRequests=true (only property_management niche)
 * - emergency_911 urgency NEVER creates a request — triggers 911 redirect instead
 * - Voice agent can only CREATE requests and APPEND notes — no status updates, no deletion
 * - All request fields validated before acceptance
 * - This module is pure types + validation — no DB, no HTTP, no side effects
 *
 * Future: when a PM client onboards with write-back needs, an Ultravox HTTP tool
 * endpoint will call these validators before persisting to Supabase.
 */

import type { AgentCapabilities } from '@/lib/niche-capabilities'

// ── Enums ───────────────────────────────────────────────────────────────────────

export const MAINTENANCE_CATEGORIES = [
  'plumbing',
  'hvac',
  'electrical',
  'appliance',
  'structural',
  'pest',
  'lockout',
  'other',
] as const

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]

/** Urgency tiers — aligned with property-mgmt-voice-agent-research.md */
export const URGENCY_TIERS = ['emergency_911', 'urgent', 'routine'] as const
export type UrgencyTier = (typeof URGENCY_TIERS)[number]

/** Request statuses — voice agent can only create 'new' requests */
export const REQUEST_STATUSES = [
  'new',
  'acknowledged',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Who created the request */
export const CREATED_BY_SOURCES = ['voice_agent', 'dashboard', 'api'] as const
export type CreatedBySource = (typeof CREATED_BY_SOURCES)[number]

// ── Types ───────────────────────────────────────────────────────────────────────

export type MaintenanceRequest = {
  id: string
  clientId: string
  unitNumber: string
  tenantName: string
  callerPhone: string | null
  category: MaintenanceCategory
  description: string
  urgencyTier: Exclude<UrgencyTier, 'emergency_911'>
  preferredAccessWindow: string | null
  entryPermission: boolean | null
  status: RequestStatus
  createdAt: string
  createdBy: CreatedBySource
  callLogId: string | null
  notes: string[]
}

/** Input shape for creating a new request (before validation) */
export type MaintenanceRequestInput = {
  clientId: string
  unitNumber?: string
  tenantName?: string
  callerPhone?: string | null
  category?: string
  description?: string
  urgencyTier?: string
  preferredAccessWindow?: string | null
  entryPermission?: boolean | null
  callLogId?: string | null
}

/** Result of validation */
export type ValidationResult = {
  valid: boolean
  errors: string[]
}

/** Describes an allowed PM operation */
export type PmOperation = {
  name: string
  description: string
  requiredFields: string[]
}

// ── Allowed Operations ──────────────────────────────────────────────────────────

/**
 * Canonical list of PM write operations the voice agent may perform.
 * Used for documentation, capability gating, and future tool registration.
 */
export const PM_WRITE_OPS: PmOperation[] = [
  {
    name: 'createMaintenanceRequest',
    description: 'Create a new maintenance request from caller-provided details',
    requiredFields: ['unitNumber', 'tenantName', 'category', 'description', 'urgencyTier'],
  },
  {
    name: 'appendRequestNote',
    description: 'Add a follow-up note to an existing maintenance request',
    requiredFields: ['requestId', 'note'],
  },
]

/** Read-only PM operations (always allowed when useTenantLookup=true) */
export const PM_READ_OPS: PmOperation[] = [
  {
    name: 'lookupTenant',
    description: 'Look up tenant record by unit number, address, or name (via contextData)',
    requiredFields: ['query'],
  },
  {
    name: 'lookupExistingRequests',
    description: 'List open maintenance requests for a unit',
    requiredFields: ['unitNumber'],
  },
]

// ── Validation ──────────────────────────────────────────────────────────────────

export function isValidCategory(cat: string): cat is MaintenanceCategory {
  return (MAINTENANCE_CATEGORIES as readonly string[]).includes(cat)
}

export function isValidUrgencyTier(tier: string): tier is UrgencyTier {
  return (URGENCY_TIERS as readonly string[]).includes(tier)
}

/**
 * Validates a maintenance request input.
 * Returns all errors at once (not fail-fast) so the caller can fix everything.
 */
export function validateMaintenanceRequest(input: MaintenanceRequestInput): ValidationResult {
  const errors: string[] = []

  if (!input.unitNumber?.trim()) {
    errors.push('unitNumber is required')
  }

  if (!input.tenantName?.trim()) {
    errors.push('tenantName is required')
  }

  if (!input.category?.trim()) {
    errors.push('category is required')
  } else if (!isValidCategory(input.category)) {
    errors.push(`invalid category: "${input.category}" — must be one of: ${MAINTENANCE_CATEGORIES.join(', ')}`)
  }

  if (!input.description?.trim()) {
    errors.push('description is required')
  } else if (input.description.trim().length < 10) {
    errors.push('description must be at least 10 characters')
  }

  if (!input.urgencyTier?.trim()) {
    errors.push('urgencyTier is required')
  } else if (!isValidUrgencyTier(input.urgencyTier)) {
    errors.push(`invalid urgencyTier: "${input.urgencyTier}" — must be one of: ${URGENCY_TIERS.join(', ')}`)
  } else if (input.urgencyTier === 'emergency_911') {
    errors.push('emergency_911 requests must NOT be created — trigger 911 redirect + hangUp instead')
  }

  return { valid: errors.length === 0, errors }
}

// ── Capability Gating ───────────────────────────────────────────────────────────

/**
 * Returns true if the given capabilities allow PM write actions.
 * Requires updateTenantRequests=true (only property_management niche).
 */
export function isWriteActionAllowed(capabilities: AgentCapabilities): boolean {
  return capabilities.updateTenantRequests
}

/**
 * Returns the list of allowed PM operations based on capabilities.
 * - useTenantLookup=true → read ops
 * - updateTenantRequests=true → read ops + write ops
 * - Neither → empty
 */
export function getAllowedPmOps(capabilities: AgentCapabilities): PmOperation[] {
  const ops: PmOperation[] = []

  if (capabilities.useTenantLookup) {
    ops.push(...PM_READ_OPS)
  }

  if (capabilities.updateTenantRequests) {
    ops.push(...PM_WRITE_OPS)
  }

  return ops
}

/**
 * Returns true if the niche is property_management.
 */
export function isPmNiche(niche: string): boolean {
  return niche === 'property_management'
}

// ── Urgency Classification (heuristic) ──────────────────────────────────────────

const EMERGENCY_911_KEYWORDS = [
  'gas smell', 'gas leak', 'smell gas', 'smells like gas',
  'fire', 'flames', 'smoke', 'burning',
  'carbon monoxide', 'co detector', 'co alarm',
  'flooding through ceiling', 'flooding through floor',
  'break-in', 'breaking in', 'intruder', 'someone broke in',
]

const URGENT_KEYWORDS = [
  'no heat', 'no heating', 'furnace broken', 'furnace stopped', 'furnace not working',
  'burst pipe', 'pipe burst', 'pipe broke',
  'sewage', 'sewer backup', 'sewage backup',
  'water heater', 'hot water tank', 'no hot water',
  'no electricity', 'power out', 'no power',
  'flooding', 'water leak', 'major leak', 'pipe leaking',
  'frozen pipe', 'pipes frozen',
]

/**
 * Heuristic urgency classification from issue description.
 * Used to SUGGEST a tier — the prompt's TRIAGE_DEEP section handles the actual routing.
 * This is for validation/logging, not for overriding the voice agent's triage decision.
 */
export function classifyUrgency(description: string): UrgencyTier {
  const lower = description.toLowerCase()

  for (const keyword of EMERGENCY_911_KEYWORDS) {
    if (lower.includes(keyword)) return 'emergency_911'
  }

  for (const keyword of URGENT_KEYWORDS) {
    if (lower.includes(keyword)) return 'urgent'
  }

  return 'routine'
}

// ── Payload Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a validated MaintenanceRequest payload from input.
 * Throws if validation fails — caller should catch and return errors.
 *
 * @param input - Partial request fields from voice agent tool call
 * @returns Complete MaintenanceRequest ready for persistence
 * @throws Error with validation messages if input is invalid
 */
export function buildMaintenanceRequestPayload(
  input: MaintenanceRequestInput,
): MaintenanceRequest {
  const validation = validateMaintenanceRequest(input)
  if (!validation.valid) {
    throw new Error(`Invalid maintenance request: ${validation.errors.join('; ')}`)
  }

  // Validation passed — all required fields are present and valid
  return {
    id: crypto.randomUUID(),
    clientId: input.clientId,
    unitNumber: input.unitNumber!.trim(),
    tenantName: input.tenantName!.trim(),
    callerPhone: input.callerPhone ?? null,
    category: input.category as MaintenanceCategory,
    description: input.description!.trim(),
    urgencyTier: input.urgencyTier as Exclude<UrgencyTier, 'emergency_911'>,
    preferredAccessWindow: input.preferredAccessWindow ?? null,
    entryPermission: input.entryPermission ?? null,
    status: 'new',
    createdAt: new Date().toISOString(),
    createdBy: 'voice_agent',
    callLogId: input.callLogId ?? null,
    notes: [],
  }
}
