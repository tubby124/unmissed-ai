/**
 * client-to-synthetic-intake.ts
 *
 * Derives a minimal intake_json payload from an existing clients row.
 * Used by the admin synthetic intake creation route for legacy clients
 * that predate the intake_submissions system.
 *
 * Does NOT write anything — returns the payload only.
 * The caller (create-synthetic-intake route) decides what to persist.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SyntheticMeta {
  synthetic: true
  generated_by: 'admin'
  generated_at: string
  source_client_id: string
  source_system_prompt_chars: number
}

export interface SyntheticIntakePayload {
  // Core identity
  business_name: string
  niche: string
  agent_name: string
  // Location / time
  city: string
  timezone: string
  // Hours
  hours_weekday: string
  hours_weekend: string | null
  weekend_policy: string
  // Business info
  services_offered: string
  callback_phone: string
  owner_name: string
  // Mode fields — will be overridden by buildAgentModeRebuildPrompt, but must be present
  call_handling_mode: string
  agent_mode: string
  // Transfer — maps to owner_phone in intake (used for TRANSFER_ENABLED)
  owner_phone: string
  // Provenance marker — ignored by buildPromptFromIntake (unknown key)
  _synthetic_meta: SyntheticMeta
}

/**
 * Derive a simple weekend_policy string from the stored business_hours_weekend text.
 *
 * Rules:
 *   null / empty         → "closed weekends"
 *   contains both days   → "open weekends"
 *   Saturday only        → "open Saturdays only"
 *   Sunday only          → "open Sundays only"
 *   anything else        → "open weekends" (safe default)
 */
export function deriveWeekendPolicy(hoursWeekend: string | null | undefined): string {
  if (!hoursWeekend?.trim()) return 'closed weekends'
  const lower = hoursWeekend.toLowerCase()
  const hasSat = lower.includes('saturday')
  const hasSun = lower.includes('sunday')
  if (hasSat && hasSun) return 'open weekends'
  if (hasSat) return 'open Saturdays only'
  if (hasSun) return 'open Sundays only'
  // Has content but no day name — assume open
  return 'open weekends'
}

/**
 * Build a synthetic intake payload from a clients row.
 *
 * Throws if the client is not found.
 */
export async function clientToSyntheticIntake(
  svc: SupabaseClient,
  clientId: string,
): Promise<{ payload: SyntheticIntakePayload; slug: string }> {
  const { data: rawRow } = await svc
    .from('clients')
    .select(
      'id, slug, business_name, niche, agent_name, system_prompt, timezone, ' +
      'business_hours_weekday, business_hours_weekend, services_offered, ' +
      'forwarding_number, ' +
      // Columns added via migration — not yet in generated database.types.ts
      'city, owner_name, callback_phone, call_handling_mode, agent_mode',
    )
    .eq('id', clientId)
    .single()

  // Cast: migration-added columns aren't in the auto-generated Row type
  const row = rawRow as {
    id: string
    slug: string
    business_name: string
    niche: string | null
    agent_name: string | null
    system_prompt: string | null
    timezone: string | null
    business_hours_weekday: string | null
    business_hours_weekend: string | null
    services_offered: string | null
    forwarding_number: string | null
    city: string | null
    owner_name: string | null
    callback_phone: string | null
    call_handling_mode: string | null
    agent_mode: string | null
  } | null

  if (!row) throw new Error(`Client not found: ${clientId}`)

  const payload: SyntheticIntakePayload = {
    business_name: row.business_name,
    niche: row.niche || 'other',
    agent_name: row.agent_name || '',
    city: row.city || '',
    timezone: row.timezone || 'America/Edmonton',
    hours_weekday: row.business_hours_weekday || 'Monday–Friday 9 AM–5 PM',
    hours_weekend: row.business_hours_weekend || null,
    weekend_policy: deriveWeekendPolicy(row.business_hours_weekend),
    services_offered: row.services_offered || '',
    callback_phone: row.callback_phone || '',
    owner_name: row.owner_name || '',
    call_handling_mode: row.call_handling_mode || 'triage',
    agent_mode: row.agent_mode || 'lead_capture',
    owner_phone: row.forwarding_number || '',
    _synthetic_meta: {
      synthetic: true,
      generated_by: 'admin',
      generated_at: new Date().toISOString(),
      source_client_id: row.id,
      source_system_prompt_chars: (row.system_prompt || '').length,
    },
  }

  return { payload, slug: row.slug }
}
