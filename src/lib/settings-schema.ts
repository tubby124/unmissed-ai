/**
 * settings-schema.ts — Zod schemas + field registry for the settings PATCH route.
 *
 * Replaces 40+ manual typeof checks with a single validated parse.
 * Field registry classifies each field by mutation class (from control-plane-mutation-contract.md)
 * and derives needsAgentSync from the registry instead of a manual boolean.
 *
 * @see docs/architecture/control-plane-mutation-contract.md — authoritative field classification
 */

import { z } from 'zod'

// ── Mutation classes ────────────────────────────────────────────────────────────
// From control-plane-mutation-contract.md Section 1.

export type MutationClass =
  | 'DB_ONLY'
  | 'DB_PLUS_PROMPT'
  | 'DB_PLUS_TOOLS'
  | 'DB_PLUS_PROMPT_PLUS_TOOLS'
  | 'DB_PLUS_KNOWLEDGE_PIPELINE'
  | 'PER_CALL_CONTEXT_ONLY'

// ── Field registry ──────────────────────────────────────────────────────────────

export interface FieldDef {
  /** Which mutation class governs this field's side effects. */
  mutationClass: MutationClass
  /** If true, changing this field requires an updateAgent() call to Ultravox. */
  triggersSync: boolean
  /** If true, only users with role='admin' can write this field. */
  adminOnly?: boolean
  /**
   * If set, changing this field triggers an auto-patch on system_prompt.
   * The patcher name maps to an orchestrator step in settings-patchers.ts.
   */
  triggersPatch?: 'calendar' | 'sms' | 'voice_style' | 'agent_name' | 'business_name' | 'services' | 'call_handling_mode' | 'agent_mode' | 'section_edit'
}

/**
 * Authoritative registry of every field accepted by the settings PATCH route.
 *
 * triggersSync MUST match the manual needsAgentSync boolean in the pre-refactor route.
 * The snapshot test verifies this — if you add a field here, add it to the snapshot.
 */
export const FIELD_REGISTRY: Record<string, FieldDef> = {
  // ── Fields that trigger Ultravox agent sync ───────────────────────────────
  system_prompt:        { mutationClass: 'DB_PLUS_PROMPT', triggersSync: true },
  forwarding_number:    { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true },
  transfer_conditions:  { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true },
  booking_enabled:      { mutationClass: 'DB_PLUS_PROMPT_PLUS_TOOLS', triggersSync: true, triggersPatch: 'calendar' },
  call_handling_mode:   { mutationClass: 'DB_PLUS_PROMPT', triggersSync: true, triggersPatch: 'call_handling_mode' },
  agent_mode:           { mutationClass: 'DB_PLUS_PROMPT', triggersSync: true, triggersPatch: 'agent_mode' },
  agent_voice_id:       { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true },
  knowledge_backend:    { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true, adminOnly: true },
  sms_enabled:          { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true, triggersPatch: 'sms' },
  twilio_number:        { mutationClass: 'DB_PLUS_TOOLS', triggersSync: true, adminOnly: true },

  // ── Fields that auto-patch the prompt (sync is triggered indirectly via system_prompt change) ──
  voice_style_preset:   { mutationClass: 'DB_PLUS_PROMPT', triggersSync: false, triggersPatch: 'voice_style' },
  agent_name:           { mutationClass: 'DB_PLUS_PROMPT', triggersSync: false, triggersPatch: 'agent_name' },
  business_name:        { mutationClass: 'DB_PLUS_PROMPT', triggersSync: false, triggersPatch: 'business_name' },
  services_offered:     { mutationClass: 'DB_PLUS_PROMPT', triggersSync: false, triggersPatch: 'services' },

  // ── Knowledge pipeline fields (may trigger reseed → sync) ─────────────────
  business_facts:       { mutationClass: 'DB_PLUS_KNOWLEDGE_PIPELINE', triggersSync: false },
  extra_qa:             { mutationClass: 'DB_PLUS_KNOWLEDGE_PIPELINE', triggersSync: false },

  // ── Staff roster (PER_CALL_CONTEXT_ONLY — injected at call time, no agent sync) ──
  staff_roster:               { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },

  // ── Per-call context (injected fresh each call via callerContextBlock) ───
  // business_hours_weekday is ALSO baked into the static system_prompt at provision time
  // via {{HOURS_WEEKDAY}} substitution. Changing it triggers a prompt patch (literal replace)
  // so the scripted HOURS/LOCATION responses stay in sync. Prompt patch → system_prompt changes
  // → computeNeedsSync returns true → Ultravox agent resynced automatically.
  business_hours_weekday:     { mutationClass: 'DB_PLUS_PROMPT', triggersSync: false },
  business_hours_weekend:     { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  after_hours_behavior:       { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  after_hours_emergency_phone:{ mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  injected_note:              { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  context_data:               { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  context_data_label:         { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },
  timezone:                   { mutationClass: 'PER_CALL_CONTEXT_ONLY', triggersSync: false },

  // ── DB-only fields (no agent sync, no prompt patch, no per-call injection) ─
  status:                        { mutationClass: 'DB_ONLY', triggersSync: false },
  sms_template:                  { mutationClass: 'DB_ONLY', triggersSync: false },
  booking_service_duration_minutes: { mutationClass: 'DB_ONLY', triggersSync: false },
  booking_buffer_minutes:        { mutationClass: 'DB_ONLY', triggersSync: false },
  setup_complete:                { mutationClass: 'DB_ONLY', triggersSync: false },
  telegram_style:                { mutationClass: 'DB_ONLY', triggersSync: false },
  weekly_digest_enabled:         { mutationClass: 'DB_ONLY', triggersSync: false },
  telegram_notifications_enabled:{ mutationClass: 'DB_ONLY', triggersSync: false },
  email_notifications_enabled:   { mutationClass: 'DB_ONLY', triggersSync: false },
  pending_loop_suggestion:       { mutationClass: 'DB_ONLY', triggersSync: false },
  voicemail_greeting_text:       { mutationClass: 'DB_ONLY', triggersSync: false },
  voicemail_greeting_audio_url:  { mutationClass: 'DB_ONLY', triggersSync: false },
  ivr_enabled:                   { mutationClass: 'DB_ONLY', triggersSync: false },
  ivr_prompt:                    { mutationClass: 'DB_ONLY', triggersSync: false },
  service_catalog:               { mutationClass: 'DB_ONLY', triggersSync: false },
  owner_name:                    { mutationClass: 'DB_ONLY', triggersSync: false },
  callback_phone:                { mutationClass: 'DB_ONLY', triggersSync: false },
  website_url:                   { mutationClass: 'DB_ONLY', triggersSync: false },

  // ── Outbound calling structured fields ───────────────────────────────────
  outbound_goal:       { mutationClass: 'DB_ONLY', triggersSync: false },
  outbound_opening:    { mutationClass: 'DB_ONLY', triggersSync: false },
  outbound_vm_script:  { mutationClass: 'DB_ONLY', triggersSync: false },
  outbound_tone:       { mutationClass: 'DB_ONLY', triggersSync: false },
  outbound_notes:      { mutationClass: 'DB_ONLY', triggersSync: false },

  // D247/D254 — Owner intent → custom TRIAGE_DEEP (any niche) ───────────────
  niche_custom_variables:  { mutationClass: 'DB_ONLY', triggersSync: false },

  // ── Admin-only DB fields ──────────────────────────────────────────────────
  calendar_beta_enabled:   { mutationClass: 'DB_ONLY', triggersSync: false, adminOnly: true },
  telegram_bot_token:      { mutationClass: 'DB_ONLY', triggersSync: false, adminOnly: true },
  telegram_chat_id:        { mutationClass: 'DB_ONLY', triggersSync: false, adminOnly: true },
  monthly_minute_limit:    { mutationClass: 'DB_ONLY', triggersSync: false, adminOnly: true },
} as const

// ── Zod schema ──────────────────────────────────────────────────────────────────

const VALID_MODES = ['message_only', 'triage', 'full_service'] as const
const VALID_AGENT_MODES = ['voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking'] as const
const VALID_AFTER_HOURS = ['take_message', 'route_emergency', 'custom_message'] as const
const VALID_TELEGRAM_STYLES = ['compact', 'standard', 'action_card'] as const

/**
 * Schema for the settings PATCH request body.
 *
 * Every field is optional — the route applies only present fields.
 * Validation replaces 40+ manual typeof checks.
 */
export const settingsBodySchema = z.object({
  // Admin client targeting
  client_id: z.string().optional(),

  // Direct prompt (DB_PLUS_PROMPT)
  system_prompt: z.string().optional(),

  // Status
  status: z.enum(['active', 'paused']).optional(),

  // SMS
  sms_enabled: z.boolean().optional(),
  sms_template: z.string().optional(),

  // Knowledge pipeline
  business_facts: z.array(z.string()).optional(),
  extra_qa: z.array(z.object({ q: z.string(), a: z.string() })).optional(),

  // Per-call context
  context_data: z.string().optional(),
  context_data_label: z.string().optional(),

  // Booking
  booking_service_duration_minutes: z.number().positive().optional(),
  booking_buffer_minutes: z.number().nonnegative().optional(),
  booking_enabled: z.boolean().optional(),
  calendar_beta_enabled: z.boolean().optional(),

  // Voice / identity
  voice_style_preset: z.string().min(1).optional(),
  agent_voice_id: z.string().min(1).optional(),
  agent_name: z.string().min(1).optional(),
  business_name: z.string().min(1).optional(),
  services_offered: z.string().optional(),

  // Misc settings
  forwarding_number: z.string().optional(),
  setup_complete: z.boolean().optional(),
  injected_note: z.union([z.string(), z.null()]).optional(),
  telegram_style: z.enum(VALID_TELEGRAM_STYLES).optional(),
  weekly_digest_enabled: z.boolean().optional(),
  telegram_notifications_enabled: z.boolean().optional(),
  email_notifications_enabled: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  pending_loop_suggestion: z.any().optional(),

  // Hours
  business_hours_weekday: z.string().optional(),
  business_hours_weekend: z.string().optional(),
  after_hours_behavior: z.enum(VALID_AFTER_HOURS).optional(),
  after_hours_emergency_phone: z.string().optional(),

  // Transfer
  transfer_conditions: z.string().optional(),

  // Voicemail
  voicemail_greeting_text: z.string().optional(),
  voicemail_greeting_audio_url: z.string().optional(),

  // IVR
  ivr_enabled: z.boolean().optional(),
  ivr_prompt: z.string().optional(),

  // Call handling mode
  call_handling_mode: z.enum(VALID_MODES).optional(),

  // Agent mode (internal conversational behavior profile)
  agent_mode: z.enum(VALID_AGENT_MODES).optional(),

  // Service catalog — structured list for appointment_booking mode
  service_catalog: z.array(z.object({
    name: z.string().min(1),
    duration_mins: z.number().positive().optional(),
    price: z.string().optional(),
  })).optional(),

  // Post-provision editable
  owner_name: z.string().optional(),
  callback_phone: z.string().optional(),
  website_url: z.string().optional(),

  // Section editor (B1)
  section_id: z.string().optional(),
  section_content: z.string().optional(),

  // Outbound calling
  outbound_prompt: z.union([z.string(), z.null()]).optional(),
  outbound_goal: z.union([z.string(), z.null()]).optional(),
  outbound_opening: z.union([z.string(), z.null()]).optional(),
  outbound_vm_script: z.union([z.string().max(500), z.null()]).optional(),
  outbound_tone: z.enum(['warm', 'professional', 'direct']).optional(),
  outbound_notes: z.union([z.string(), z.null()]).optional(),

  // Admin-only: God Mode
  telegram_bot_token: z.string().min(1).optional(),
  telegram_chat_id: z.string().min(1).optional(),
  twilio_number: z.string().min(1).optional(),
  monthly_minute_limit: z.number().positive().optional(),

  // Knowledge backend (admin-only)
  knowledge_backend: z.union([z.literal('pgvector'), z.null()]).optional(),

  // D247/D254 — Owner intent → custom TRIAGE_DEEP (any niche)
  niche_custom_variables: z.record(z.string()).optional(),

  // Staff roster (PER_CALL_CONTEXT_ONLY — booking-mode clients only)
  staff_roster: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    availability_note: z.string().optional(),
  })).optional(),

  // Audit trail (not a DB field, passed for prompt versioning)
  change_description: z.string().optional(),
}).passthrough() // Allow unknown fields without failing — they'll be ignored by buildUpdates

export type SettingsBody = z.infer<typeof settingsBodySchema>

// ── Prompt validation ───────────────────────────────────────────────────────────

export interface PromptWarning { field: string; message: string }
export interface PromptValidation { valid: boolean; error?: string; warnings: PromptWarning[] }

const PROMPT_WARN_CHARS = 15000
const PROMPT_MAX_CHARS = 25000

export function validatePrompt(prompt: string): PromptValidation {
  const warnings: PromptWarning[] = []

  if (prompt.length > PROMPT_MAX_CHARS) {
    return {
      valid: false,
      error: `Prompt is ${prompt.length.toLocaleString()} characters — maximum is ${PROMPT_MAX_CHARS.toLocaleString()}. Remove content before saving.`,
      warnings,
    }
  }

  if (prompt.length > PROMPT_WARN_CHARS) {
    warnings.push({ field: 'length', message: `Prompt is ${prompt.length.toLocaleString()} characters. GLM-4.6 works best under ${PROMPT_WARN_CHARS.toLocaleString()} — consider trimming for optimal voice quality.` })
  }

  if (/(?<!\d)\d{10,}(?!\d)/g.test(prompt)) {
    warnings.push({ field: 'phone_number', message: 'Phone numbers in prompts cause hallucination. Use the forwarding number field instead.' })
  }
  if (/https?:\/\/[^\s)]+/gi.test(prompt)) {
    warnings.push({ field: 'url', message: "URLs aren't spoken correctly by voice agents. Use the knowledge base to store web content." })
  }
  if (/(?:we charge|our price is|costs? )\$[\d,.]+/gi.test(prompt)) {
    warnings.push({ field: 'price', message: 'Hardcoded prices can bind your business. Consider using the knowledge base for pricing info.' })
  }

  return { valid: true, warnings }
}

// ── Update builder ──────────────────────────────────────────────────────────────

/**
 * Build the DB `updates` dictionary from a validated settings body.
 *
 * Applies trimming, nullable string coercion, and admin-only field filtering.
 * Replaces 40+ manual typeof checks in the original route.
 */
export function buildUpdates(body: SettingsBody, role: string): Record<string, unknown> {
  const updates: Record<string, unknown> = {}

  // String fields that get trimmed + nullable (empty string → null)
  const trimNullable: (keyof SettingsBody)[] = [
    'forwarding_number', 'business_hours_weekday', 'business_hours_weekend',
    'after_hours_emergency_phone', 'transfer_conditions', 'voicemail_greeting_text',
    'voicemail_greeting_audio_url', 'ivr_prompt', 'owner_name', 'callback_phone',
    'website_url', 'context_data', 'context_data_label',
  ]

  // String fields that get trimmed + nullable, but require non-empty
  const trimRequired: (keyof SettingsBody)[] = [
    'agent_name', 'business_name',
  ]

  // String fields that get trimmed, nullable when empty
  const trimOptional: (keyof SettingsBody)[] = [
    'services_offered',
  ]

  // Boolean fields — direct copy
  const boolFields: (keyof SettingsBody)[] = [
    'sms_enabled', 'booking_enabled', 'setup_complete', 'weekly_digest_enabled',
    'telegram_notifications_enabled', 'email_notifications_enabled', 'ivr_enabled',
  ]

  // Enum/string fields — direct copy
  const directFields: (keyof SettingsBody)[] = [
    'status', 'sms_template', 'voice_style_preset', 'agent_voice_id',
    'telegram_style', 'timezone', 'after_hours_behavior', 'call_handling_mode', 'agent_mode',
    'business_facts',
  ]

  // Process trim + nullable strings
  for (const key of trimNullable) {
    if (body[key] !== undefined) {
      const val = typeof body[key] === 'string' ? (body[key] as string).trim() : null
      updates[key] = val || null
    }
  }

  // Process trim + required strings
  for (const key of trimRequired) {
    const val = body[key]
    if (typeof val === 'string' && val.trim()) {
      updates[key] = val.trim()
    }
  }

  // Process trim + optional strings (nullable when empty)
  for (const key of trimOptional) {
    if (body[key] !== undefined) {
      const val = typeof body[key] === 'string' ? (body[key] as string).trim() : null
      updates[key] = val || null
    }
  }

  // Process booleans
  for (const key of boolFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key]
    }
  }

  // Process direct copy fields
  for (const key of directFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key]
    }
  }

  // outbound_prompt — separate from inbound; nullable to clear
  if (body.outbound_prompt !== undefined) {
    const val = typeof body.outbound_prompt === 'string' ? body.outbound_prompt.trim() : null
    updates.outbound_prompt = val || null
  }

  // Outbound structured fields — assembled into outbound_prompt by OutboundAgentConfigCard
  if (body.outbound_goal !== undefined) {
    const val = typeof body.outbound_goal === 'string' ? body.outbound_goal.trim() : null
    updates.outbound_goal = val || null
  }
  if (body.outbound_opening !== undefined) {
    const val = typeof body.outbound_opening === 'string' ? body.outbound_opening.trim() : null
    updates.outbound_opening = val || null
  }
  if (body.outbound_vm_script !== undefined) {
    const val = typeof body.outbound_vm_script === 'string' ? body.outbound_vm_script.trim() : null
    updates.outbound_vm_script = val || null
  }
  if (body.outbound_tone !== undefined) {
    updates.outbound_tone = body.outbound_tone
  }
  if (body.outbound_notes !== undefined) {
    const val = typeof body.outbound_notes === 'string' ? body.outbound_notes.trim() : null
    updates.outbound_notes = val || null
  }

  // system_prompt — validated separately (may be overwritten by prompt patchers)
  if (typeof body.system_prompt === 'string') {
    updates.system_prompt = body.system_prompt
    updates.updated_at = new Date().toISOString()
  }

  // extra_qa — array (deduplicate by question, last-write-wins, strip empty pairs)
  if (body.extra_qa !== undefined) {
    const seen = new Map<string, { q: string; a: string }>()
    for (const pair of body.extra_qa) {
      if (pair.q?.trim() && pair.a?.trim()) {
        seen.set(pair.q.trim().toLowerCase(), { q: pair.q.trim(), a: pair.a.trim() })
      }
    }
    updates.extra_qa = Array.from(seen.values())
  }

  // Number fields with custom constraints
  if (body.booking_service_duration_minutes !== undefined) {
    updates.booking_service_duration_minutes = body.booking_service_duration_minutes
  }
  if (body.booking_buffer_minutes !== undefined) {
    updates.booking_buffer_minutes = body.booking_buffer_minutes
  }

  // injected_note — union(string, null)
  if (body.injected_note !== undefined) {
    const noteText = typeof body.injected_note === 'string' ? body.injected_note.trim() : null
    updates.injected_note = noteText || null
  }

  // service_catalog — array of service items (filter out empty names)
  if (body.service_catalog !== undefined) {
    updates.service_catalog = body.service_catalog.filter(s => s.name.trim())
  }

  // pending_loop_suggestion — any (nullable)
  if ('pending_loop_suggestion' in body) {
    updates.pending_loop_suggestion = body.pending_loop_suggestion ?? null
  }

  // staff_roster — filter out entries with empty names (parseStaffRoster validation)
  if (body.staff_roster !== undefined) {
    updates.staff_roster = body.staff_roster.filter(
      s => typeof s.name === 'string' && s.name.trim() !== '' &&
           typeof s.role === 'string'
    ).map(s => ({
      name: s.name.trim(),
      role: s.role.trim(),
      ...(s.availability_note?.trim() ? { availability_note: s.availability_note.trim() } : {}),
    }))
  }

  // Admin-only fields — filtered by role
  if (role === 'admin') {
    if (body.calendar_beta_enabled !== undefined) updates.calendar_beta_enabled = body.calendar_beta_enabled
    if (body.telegram_bot_token !== undefined) updates.telegram_bot_token = body.telegram_bot_token
    if (body.telegram_chat_id !== undefined) updates.telegram_chat_id = body.telegram_chat_id
    if (body.twilio_number !== undefined) updates.twilio_number = body.twilio_number
    if (body.monthly_minute_limit !== undefined) updates.monthly_minute_limit = body.monthly_minute_limit
    if (body.knowledge_backend !== undefined) updates.knowledge_backend = body.knowledge_backend
  }

  return updates
}

// ── Sync derivation ─────────────────────────────────────────────────────────────

/**
 * Fields whose presence in the updates dict triggers updateAgent().
 * Derived from FIELD_REGISTRY — must match the manual needsAgentSync boolean.
 */
export const SYNC_TRIGGER_FIELDS: string[] = Object.entries(FIELD_REGISTRY)
  .filter(([, def]) => def.triggersSync)
  .map(([key]) => key)

/**
 * Determine whether updateAgent() must be called for the given set of updates.
 *
 * Equivalent to the original manual boolean:
 *   typeof updates.system_prompt === 'string' ||
 *   'forwarding_number' in updates || ... || knowledgeReseeded
 *
 * @param updates — The DB updates dict after prompt patching
 * @param knowledgeReseeded — Whether knowledge chunks were reseeded this request
 */
export function computeNeedsSync(updates: Record<string, unknown>, knowledgeReseeded: boolean): boolean {
  // system_prompt is special: check it's a string (not just present) to match original behavior
  if (typeof updates.system_prompt === 'string') return true

  // Check all other sync-triggering fields (excluding system_prompt, already checked)
  for (const field of SYNC_TRIGGER_FIELDS) {
    if (field === 'system_prompt') continue
    if (field in updates) return true
  }

  // Knowledge reseed triggers sync to re-register queryKnowledge tool
  return knowledgeReseeded
}

// ── Admin section gating ────────────────────────────────────────────────────────

const ADMIN_ONLY_SECTION_IDS = ['tone', 'flow', 'technical']

/**
 * Check if a section_id edit is allowed for the given role.
 */
export function isSectionEditAllowed(sectionId: string, role: string): boolean {
  if (ADMIN_ONLY_SECTION_IDS.includes(sectionId)) {
    return role === 'admin'
  }
  return true
}
