/**
 * agent-mode-rebuild.ts
 *
 * Shared helper for admin deep-mode activation (Phase 4).
 * Used by both the confirm route (/api/dashboard/regenerate-prompt) and the
 * preview route (/api/dashboard/regenerate-prompt/preview) to guarantee that
 * both paths produce exactly the same prompt — no drift.
 *
 * Does NOT write to DB or Ultravox. Callers decide what to persist.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPromptFromIntake, VOICE_PRESETS } from '@/lib/prompt-builder'
import {
  patchCalendarBlock,
  patchSmsBlock,
  patchVoiceStyleSection,
  patchAgentName,
  getServiceType,
  getClosePerson,
} from '@/lib/prompt-patcher'

export type AgentMode =
  | 'voicemail_replacement'
  | 'lead_capture'
  | 'info_hub'
  | 'appointment_booking'

export const AGENT_MODE_VALUES: AgentMode[] = [
  'voicemail_replacement',
  'lead_capture',
  'info_hub',
  'appointment_booking',
]

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  voicemail_replacement: 'Voicemail Replacement — take a message',
  lead_capture: 'Lead Capture — collect and route (default)',
  info_hub: 'Info Hub — answer questions first',
  appointment_booking: 'Appointment Booking — drive scheduling',
}

/**
 * Derives the effective call_handling_mode when applying an agent_mode override.
 *
 * Rules (in priority order):
 *   1. voicemail_replacement always → message_only (mode requires minimal collection)
 *   2. full_service clients keep full_service (never silently downgrade booking clients)
 *   3. everything else → triage
 *
 * Source of currentCallHandlingMode: clients.call_handling_mode DB column.
 */
export function deriveCallHandlingMode(
  agentModeOverride: AgentMode,
  currentCallHandlingMode: string | null,
): string {
  if (agentModeOverride === 'voicemail_replacement') return 'message_only'
  if (currentCallHandlingMode === 'full_service') return 'full_service'
  return 'triage'
}

export interface AgentModeRebuildResult {
  newPrompt: string
  currentPrompt: string | null
  regenSource: 'intake'
  effectiveCallHandlingMode: string
  clientSlug: string
  intakeAgentName: string | undefined
  prevCharCount: number
  /** Resolved client fields needed by the confirm route for Ultravox sync */
  clientRow: {
    ultravox_agent_id: string | null
    agent_voice_id: string | null
    agent_name: string | null
    forwarding_number: string | null
    booking_enabled: boolean
    sms_enabled: boolean
    twilio_number: string | null
    knowledge_backend: string | null
    transfer_conditions: string | null
    niche: string | null
    status: string | null
    slug: string
  }
}

/**
 * Rebuilds a client's system prompt with an explicit agent_mode override applied.
 *
 * Throws (does not return null) when no intake submission exists — the caller
 * must surface this as an error rather than silently falling back to S6f
 * behavior, which would ignore the agent_mode override entirely.
 */
export async function buildAgentModeRebuildPrompt(
  svc: SupabaseClient,
  clientId: string,
  agentModeOverride: AgentMode,
): Promise<AgentModeRebuildResult> {
  const { data: clientRaw } = await svc
    .from('clients')
    .select(
      'id, slug, agent_name, status, ultravox_agent_id, agent_voice_id, ' +
      'forwarding_number, booking_enabled, sms_enabled, twilio_number, ' +
      'knowledge_backend, transfer_conditions, system_prompt, voice_style_preset, ' +
      'niche, call_handling_mode',
    )
    .eq('id', clientId)
    .single()

  // Cast required: svc is generic SupabaseClient without DB schema types
  const client = clientRaw as {
    id: string; slug: string; agent_name: string | null; status: string | null
    ultravox_agent_id: string | null; agent_voice_id: string | null
    forwarding_number: string | null; booking_enabled: boolean | null
    sms_enabled: boolean | null; twilio_number: string | null
    knowledge_backend: string | null; transfer_conditions: string | null
    system_prompt: string | null; voice_style_preset: string | null
    niche: string | null; call_handling_mode: string | null
  } | null

  if (!client) throw new Error('Client not found')

  const currentPrompt = (client.system_prompt as string | null) ?? null
  const prevCharCount = currentPrompt?.length ?? 0
  const currentCallHandlingMode = (client.call_handling_mode as string | null) ?? null
  const effectiveCallHandlingMode = deriveCallHandlingMode(agentModeOverride, currentCallHandlingMode)

  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', client.slug)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (!intake?.intake_json) {
    throw new Error(
      'No intake submission found for this client. ' +
      'Complete the intake form before activating deep mode.',
    )
  }

  const intakeData = { ...(intake.intake_json as Record<string, unknown>) }
  const intakeAgentName = intakeData.agent_name as string | undefined

  // Overlay the mode override onto the intake data before rebuild
  intakeData.agent_mode = agentModeOverride
  intakeData.call_handling_mode = effectiveCallHandlingMode

  // Preserve the current DB agent name for active clients (same as regen route)
  if (client.agent_name && client.status === 'active') {
    intakeData.db_agent_name = client.agent_name
  }

  // Fetch knowledge docs (same as regen route)
  let knowledgeDocs = ''
  const { data: kDocs } = await svc
    .from('client_knowledge_docs')
    .select('content_text')
    .eq('client_id', clientId)
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
  }

  let newPrompt = buildPromptFromIntake(intakeData, undefined, knowledgeDocs)

  // Re-apply manual patches in the same order as /regenerate-prompt/route.ts
  // so admin-applied customizations survive the deep-mode rebuild.

  // 1. Agent name — patch if DB name differs from intake name
  if (client.agent_name && intakeAgentName && intakeAgentName !== client.agent_name) {
    newPrompt = patchAgentName(newPrompt, intakeAgentName, client.agent_name as string)
  }

  // 2. Calendar booking block
  if (client.booking_enabled) {
    const niche = (client.niche as string | null) || 'other'
    newPrompt = patchCalendarBlock(
      newPrompt,
      true,
      getServiceType(niche),
      getClosePerson(newPrompt, client.agent_name as string | null),
    )
  }

  // 3. SMS follow-up block
  if (client.sms_enabled) {
    newPrompt = patchSmsBlock(newPrompt, true)
  }

  // 4. Voice style preset
  const voicePreset = client.voice_style_preset as string | null
  if (voicePreset) {
    const preset = VOICE_PRESETS[voicePreset]
    if (preset) {
      newPrompt = patchVoiceStyleSection(newPrompt, preset.toneStyleBlock, preset.fillerStyle)
    }
  }

  return {
    newPrompt,
    currentPrompt,
    regenSource: 'intake',
    effectiveCallHandlingMode,
    clientSlug: client.slug,
    intakeAgentName,
    prevCharCount,
    clientRow: {
      ultravox_agent_id: (client.ultravox_agent_id as string | null) ?? null,
      agent_voice_id: (client.agent_voice_id as string | null) ?? null,
      agent_name: (client.agent_name as string | null) ?? null,
      forwarding_number: (client.forwarding_number as string | null) ?? null,
      booking_enabled: (client.booking_enabled as boolean) ?? false,
      sms_enabled: (client.sms_enabled as boolean) ?? false,
      twilio_number: (client.twilio_number as string | null) ?? null,
      knowledge_backend: (client.knowledge_backend as string | null) ?? null,
      transfer_conditions: (client.transfer_conditions as string | null) ?? null,
      niche: (client.niche as string | null) ?? null,
      status: (client.status as string | null) ?? null,
      slug: client.slug,
    },
  }
}
