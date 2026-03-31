/**
 * slot-regenerator.ts — D283c: Section-level prompt regeneration.
 *
 * Instead of individual regex patchers for each variable, this module
 * regenerates an entire slot section from current DB state.
 *
 * Flow:
 *   1. Read client row from DB
 *   2. Convert client row → synthetic intake (what buildSlotContext expects)
 *   3. Build SlotContext
 *   4. Run the target slot function
 *   5. Replace that section in the stored system_prompt (using section markers)
 *   6. Validate, save, and sync to Ultravox
 *
 * This is the "mini-recompose engine" — a narrower version of Phase 6's
 * full recomposePrompt(). It operates on ONE slot at a time.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { type SlotId, replacePromptSection, wrapSection } from './prompt-sections'
import {
  buildSlotContext,
  buildSafetyPreamble,
  buildForbiddenActions,
  buildVoiceNaturalness,
  buildGrammar,
  buildIdentity,
  buildToneAndStyle,
  buildGoal,
  buildConversationFlow,
  buildAfterHoursSlot,
  buildEscalationTransfer,
  buildReturningCaller,
  buildInlineExamples,
  buildCallHandlingMode,
  buildFaqPairsSlot,
  buildObjectionHandling,
  buildKnowledgeBaseSlot,
  buildCalendarBookingSlot,
  buildSmsFollowupSlot,
  buildVipProtocolSlot,
  type SlotContext,
} from './prompt-slots'
import { validatePrompt } from './settings-schema'
import { updateAgent, buildAgentTools } from './ultravox'
import { insertPromptVersion } from './prompt-version-utils'
import { formatServiceCatalog, rowsToCatalogItems } from './service-catalog'

// ── Guard: detect slot-composed vs old-format prompts ───────────────────────────

/**
 * Returns true if the prompt has section markers from slot composition.
 * Old-format prompts (4 live clients) lack these markers.
 * Regeneration only works on marker-based prompts.
 */
function hasSlotMarkers(prompt: string): boolean {
  return prompt.includes('<!-- unmissed:identity -->')
}

// ── Slot function dispatch ──────────────────────────────────────────────────────

type SlotFn = (ctx: SlotContext) => string

const SLOT_FUNCTIONS: Record<SlotId, SlotFn> = {
  safety_preamble:    () => buildSafetyPreamble(),
  forbidden_actions:  (ctx) => buildForbiddenActions(ctx),
  voice_naturalness:  (ctx) => buildVoiceNaturalness(ctx),
  grammar:            () => buildGrammar(),
  identity:           (ctx) => buildIdentity(ctx),
  tone_and_style:     (ctx) => buildToneAndStyle(ctx),
  goal:               (ctx) => buildGoal(ctx),
  conversation_flow:  (ctx) => buildConversationFlow(ctx),
  after_hours:        (ctx) => buildAfterHoursSlot(ctx),
  escalation_transfer:(ctx) => buildEscalationTransfer(ctx),
  returning_caller:   () => buildReturningCaller(),
  inline_examples:    (ctx) => buildInlineExamples(ctx),
  call_handling_mode:  (ctx) => buildCallHandlingMode(ctx),
  faq_pairs:          (ctx) => buildFaqPairsSlot(ctx),
  objection_handling: (ctx) => buildObjectionHandling(ctx),
  knowledge:          (ctx) => buildKnowledgeBaseSlot(ctx),
  calendar_booking:   (ctx) => buildCalendarBookingSlot(ctx),
  sms_followup:       (ctx) => buildSmsFollowupSlot(ctx),
  vip_protocol:       (ctx) => buildVipProtocolSlot(ctx),
}

// ── Client row → synthetic intake conversion ────────────────────────────────────

/**
 * Convert a clients DB row + services into the flat intake dict
 * that buildSlotContext() expects.
 *
 * This bridges the gap between "stored DB state" and "onboarding intake format".
 * Fields that only exist during onboarding (niche_* intake fields) are stored
 * in niche_custom_variables as overrides.
 */
function clientRowToIntake(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services: any[],
  knowledgeChunkCount: number,
): Record<string, unknown> {
  const intake: Record<string, unknown> = {
    // Core identity
    niche: client.niche,
    business_name: client.business_name,
    agent_name: client.agent_name,
    db_agent_name: client.agent_name,
    city: client.city,
    owner_name: client.owner_name,

    // Hours
    hours_weekday: client.business_hours_weekday,

    // Services
    services_offered: client.services_offered,
    services_not_offered: client.services_not_offered,

    // Contact
    callback_phone: client.callback_phone,
    owner_phone: client.forwarding_number,
    emergency_phone: client.after_hours_emergency_phone,

    // Mode
    call_handling_mode: client.call_handling_mode ?? 'triage',
    agent_mode: client.agent_mode,

    // Voice
    voice_style_preset: client.voice_style_preset,
    agent_tone: client.agent_tone,

    // Features
    booking_enabled: client.booking_enabled,
    sms_enabled: client.sms_enabled,
    forwarding_number: client.forwarding_number,
    after_hours_behavior: client.after_hours_behavior ?? 'standard',

    // Knowledge
    knowledge_backend: client.knowledge_backend,
    knowledge_chunk_count: knowledgeChunkCount,
    pricing_policy: client.pricing_policy,
    unknown_answer_behavior: client.unknown_answer_behavior,
    caller_faq: client.caller_faq,
    common_objections: client.common_objections,

    // FAQ pairs (extra_qa → niche_faq_pairs format)
    niche_faq_pairs: client.extra_qa ? JSON.stringify(client.extra_qa) : undefined,

    // Completion fields
    completion_fields: client.completion_fields,

    // Agent restrictions
    agent_restrictions: client.agent_restrictions,

    // Insurance
    insurance_preset: client.insurance_preset,
    insurance_status: client.insurance_status,
    insurance_detail: client.insurance_detail,

    // Niche custom variables (all niche_* overrides from intake review)
    niche_custom_variables: client.niche_custom_variables,
  }

  // Service catalog
  if (services.length > 0) {
    const catalog = rowsToCatalogItems(services)
    intake.service_catalog = JSON.stringify(catalog)
  }

  return intake
}

// ── Main regeneration function ──────────────────────────────────────────────────

export interface RegenerateSlotResult {
  success: boolean
  promptChanged: boolean
  error?: string
  /** New prompt char count */
  charCount?: number
}

/**
 * Regenerate a single slot section in a client's stored system_prompt.
 *
 * This replaces the need for individual regex patchers for most variables.
 * The slot function produces fresh output from current DB state, and the
 * section marker system replaces just that section in the stored prompt.
 *
 * @param clientId - The client UUID
 * @param slotId - Which slot to regenerate (e.g. 'identity', 'goal', 'conversation_flow')
 * @param triggeredByUserId - Who triggered this (null for system)
 */
export async function regenerateSlot(
  clientId: string,
  slotId: SlotId,
  triggeredByUserId: string | null = null,
): Promise<RegenerateSlotResult> {
  const svc = createServiceClient()

  // 1. Read client row (all fields needed by buildSlotContext)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return { success: false, promptChanged: false, error: `Client not found: ${clientId}` }
  }

  if (!client.system_prompt) {
    return { success: false, promptChanged: false, error: 'No system_prompt on client' }
  }

  // Guard: only works on slot-composed prompts (have section markers).
  // Old-format prompts (4 live clients) have no markers — regeneration would
  // append duplicate sections instead of replacing. Use patchers for those.
  if (!hasSlotMarkers(client.system_prompt as string)) {
    return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — use patchers instead of regeneration' }
  }

  // 2. Read services catalog
  const { data: services } = await svc
    .from('client_services')
    .select('name, description, category, duration_mins, price, booking_notes')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  // 3. Count knowledge chunks (for pgvector-aware slot output)
  let knowledgeChunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')
    knowledgeChunkCount = count ?? 0
  }

  // 4. Convert client row → synthetic intake
  const intake = clientRowToIntake(client, services ?? [], knowledgeChunkCount)

  // 5. Build full SlotContext (needed because slots cross-reference each other)
  const ctx = buildSlotContext(intake)

  // 6. Run the target slot function
  const slotFn = SLOT_FUNCTIONS[slotId]
  if (!slotFn) {
    return { success: false, promptChanged: false, error: `Unknown slot: ${slotId}` }
  }
  const newContent = slotFn(ctx)

  // 7. Replace that section in the stored prompt
  const updatedPrompt = replacePromptSection(client.system_prompt, slotId, newContent)

  if (updatedPrompt === client.system_prompt) {
    return { success: true, promptChanged: false, charCount: updatedPrompt.length }
  }

  // 8. Validate
  const validation = validatePrompt(updatedPrompt)
  if (!validation.valid) {
    return { success: false, promptChanged: false, error: `Validation failed: ${validation.error}` }
  }

  // 9. Save to DB
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      system_prompt: updatedPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (updateErr) {
    return { success: false, promptChanged: false, error: `DB update failed: ${updateErr.message}` }
  }

  // 10. Prompt version tracking
  try {
    await insertPromptVersion(svc, {
      clientId,
      content: updatedPrompt,
      changeDescription: `Slot regeneration: ${slotId}`,
      triggeredByUserId,
      triggeredByRole: triggeredByUserId ? 'owner' : 'system',
      prevCharCount: client.system_prompt.length,
    })
  } catch (err) {
    console.warn(`[slot-regen] Prompt version insert failed: ${err}`)
  }

  // 11. Sync to Ultravox if agent exists
  if (client.ultravox_agent_id) {
    try {
      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: updatedPrompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: client.knowledge_backend,
        knowledge_chunk_count: knowledgeChunkCount,
        transfer_conditions: client.transfer_conditions,
        selectedPlan: (client.selected_plan as string | null) || undefined,
        subscriptionStatus: (client.subscription_status as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)

      console.log(`[slot-regen] Regenerated ${slotId} for client=${clientId}, synced to Ultravox`)
    } catch (err) {
      console.error(`[slot-regen] Ultravox sync failed for client=${clientId}: ${err}`)
      // Prompt is saved to DB even if Ultravox sync fails
    }
  }

  return {
    success: true,
    promptChanged: true,
    charCount: updatedPrompt.length,
  }
}

/**
 * Regenerate multiple slots at once.
 * Useful when a single field change affects multiple slots.
 */
export async function regenerateSlots(
  clientId: string,
  slotIds: SlotId[],
  triggeredByUserId: string | null = null,
): Promise<RegenerateSlotResult> {
  const svc = createServiceClient()

  // Read client once
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientErr || !client || !client.system_prompt) {
    return { success: false, promptChanged: false, error: `Client not found or no prompt: ${clientId}` }
  }

  // Guard: slot-composed prompts only (same as regenerateSlot)
  if (!hasSlotMarkers(client.system_prompt as string)) {
    return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — use patchers instead of regeneration' }
  }

  // Read services once
  const { data: services } = await svc
    .from('client_services')
    .select('name, description, category, duration_mins, price, booking_notes')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  // Count chunks once
  let knowledgeChunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')
    knowledgeChunkCount = count ?? 0
  }

  // Build context once
  const intake = clientRowToIntake(client, services ?? [], knowledgeChunkCount)
  const ctx = buildSlotContext(intake)

  // Regenerate each slot in the stored prompt
  let prompt = client.system_prompt as string
  for (const slotId of slotIds) {
    const slotFn = SLOT_FUNCTIONS[slotId]
    if (!slotFn) continue
    const newContent = slotFn(ctx)
    prompt = replacePromptSection(prompt, slotId, newContent)
  }

  if (prompt === client.system_prompt) {
    return { success: true, promptChanged: false, charCount: prompt.length }
  }

  // Validate
  const validation = validatePrompt(prompt)
  if (!validation.valid) {
    return { success: false, promptChanged: false, error: `Validation failed: ${validation.error}` }
  }

  // Save
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      system_prompt: prompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (updateErr) {
    return { success: false, promptChanged: false, error: `DB update failed: ${updateErr.message}` }
  }

  // Version tracking
  try {
    await insertPromptVersion(svc, {
      clientId,
      content: prompt,
      changeDescription: `Slot regeneration: ${slotIds.join(', ')}`,
      triggeredByUserId,
      triggeredByRole: triggeredByUserId ? 'owner' : 'system',
      prevCharCount: (client.system_prompt as string).length,
    })
  } catch (err) {
    console.warn(`[slot-regen] Prompt version insert failed: ${err}`)
  }

  // Ultravox sync
  if (client.ultravox_agent_id) {
    try {
      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: prompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: client.knowledge_backend,
        knowledge_chunk_count: knowledgeChunkCount,
        transfer_conditions: client.transfer_conditions,
        selectedPlan: (client.selected_plan as string | null) || undefined,
        subscriptionStatus: (client.subscription_status as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)

      console.log(`[slot-regen] Regenerated [${slotIds.join(', ')}] for client=${clientId}, synced to Ultravox`)
    } catch (err) {
      console.error(`[slot-regen] Ultravox sync failed for client=${clientId}: ${err}`)
    }
  }

  return {
    success: true,
    promptChanged: true,
    charCount: prompt.length,
  }
}
