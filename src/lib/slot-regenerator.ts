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
  fetchActivePatternsForNiche,
  injectLearningBankBlock,
  estimateLearningBankBlockChars,
  LEARNING_BANK_PROMPT_BUDGET_CHARS,
} from './learning-bank-inject'
import {
  buildSlotContext,
  buildPromptFromSlots,
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

// ── Guard: refuse to overwrite hand-tuned prompts (D-NEW-recompose-respects-hand-tuned) ──

/**
 * Refuses any automated prompt regeneration when `clients.hand_tuned = true`,
 * unless the caller passes an explicit override. The flag is set during manual
 * concierge provisioning (Steps 9 & 10 of the bypass SOP) and on any client
 * whose prompt is hand-edited and must NOT be touched by the slot pipeline.
 *
 * Returns null when recompose may proceed, or an error string when blocked.
 *
 * Exported for unit testing — callers should instead use the guard helpers
 * applied inside `recomposePrompt`, `regenerateSlot`, and `regenerateSlots`.
 *
 * Surfaced 2026-05-05 by velly-remodeling audit. See
 * `CALLINGAGENTS/Tracker/D-NEW-recompose-respects-hand-tuned.md`.
 */
export function checkHandTunedGuard(
  client: { hand_tuned?: boolean | null; slug?: string | null },
  forceOverride: boolean,
): string | null {
  if (client.hand_tuned === true && !forceOverride) {
    const slug = client.slug ?? '<unknown>'
    return `Refusing to regenerate prompt for hand_tuned=true client "${slug}". ` +
      `Either flip clients.hand_tuned=false (loses hand-edit protection), or pass ` +
      `forceRecompose=true on recomposePrompt() to override (will overwrite hand-edited prompt).`
  }
  return null
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
export function clientRowToIntake(
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
    hours_weekend: client.business_hours_weekend,

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

    // Day-1 editable fields (needed for slot regeneration round-trip)
    today_update: client.today_update,
    business_notes: client.business_notes,
    fields_to_collect: client.fields_to_collect,
    twilio_number: client.twilio_number,
    injected_note: client.injected_note,

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

  // D302: Spread niche intake fields from niche_custom_variables back to top-level keys
  // so buildSlotContext() can read them directly (e.g., intake.niche_emergency, intake.niche_clientType).
  // These were preserved during onboarding by saving all niche_* intakePayload fields.
  const ncv = client.niche_custom_variables as Record<string, unknown> | null
  if (ncv && typeof ncv === 'object') {
    for (const [k, v] of Object.entries(ncv)) {
      if (k.startsWith('niche_') && !(k in intake)) {
        intake[k] = v
      }
    }
  }

  // Service catalog
  if (services.length > 0) {
    const catalog = rowsToCatalogItems(services)
    intake.service_catalog = JSON.stringify(catalog)
  }

  return intake
}

// ── Shared DB reader (used by regenerateSlot, regenerateSlots, recomposePrompt) ─

interface ClientContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services: any[]
  knowledgeChunkCount: number
  ctx: SlotContext
  intake: Record<string, unknown>
}

async function loadClientContext(clientId: string): Promise<
  { ok: true; data: ClientContext } | { ok: false; error: string }
> {
  const svc = createServiceClient()

  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return { ok: false, error: `Client not found: ${clientId}` }
  }

  if (!client.system_prompt) {
    return { ok: false, error: 'No system_prompt on client' }
  }

  const { data: services } = await svc
    .from('client_services')
    .select('name, description, category, duration_mins, price, booking_notes')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  let knowledgeChunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')
    knowledgeChunkCount = count ?? 0
  }

  const intake = clientRowToIntake(client, services ?? [], knowledgeChunkCount)
  const ctx = buildSlotContext(intake)

  return {
    ok: true,
    data: { client, services: services ?? [], knowledgeChunkCount, ctx, intake },
  }
}

/** Build the agentFlags object needed for updateAgent() and buildAgentTools(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAgentFlagsFromClient(client: Record<string, any>, prompt: string, knowledgeChunkCount: number): Parameters<typeof updateAgent>[1] {
  return {
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
}

/** Save prompt to DB, insert version, sync to Ultravox. */
async function savePromptAndSync(
  clientId: string,
  newPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Record<string, any>,
  knowledgeChunkCount: number,
  changeDescription: string,
  triggeredByUserId: string | null,
): Promise<{ error?: string }> {
  const svc = createServiceClient()

  const { error: updateErr } = await svc
    .from('clients')
    .update({
      system_prompt: newPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (updateErr) {
    return { error: `DB update failed: ${updateErr.message}` }
  }

  // Version tracking
  try {
    await insertPromptVersion(svc, {
      clientId,
      content: newPrompt,
      changeDescription,
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
      const agentFlags = buildAgentFlagsFromClient(client, newPrompt, knowledgeChunkCount)
      await updateAgent(client.ultravox_agent_id, agentFlags)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)
      console.log(`[slot-regen] ${changeDescription} for client=${clientId}, synced to Ultravox`)
    } catch (err) {
      console.error(`[slot-regen] Ultravox sync failed for client=${clientId}: ${err}`)
    }
  }

  return {}
}

// ── Main regeneration function ──────────────────────────────────────────────────

export interface RegenerateSlotResult {
  success: boolean
  promptChanged: boolean
  error?: string
  /** New prompt char count */
  charCount?: number
  /** When dryRun=true, the preview prompt text */
  preview?: string
  /** When dryRun=true, the current prompt text (for diffing) */
  currentPrompt?: string
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
 * @param dryRun - If true, return preview without saving to DB or syncing to Ultravox
 */
export async function regenerateSlot(
  clientId: string,
  slotId: SlotId,
  triggeredByUserId: string | null = null,
  dryRun = false,
): Promise<RegenerateSlotResult> {
  const loaded = await loadClientContext(clientId)
  if (!loaded.ok) {
    return { success: false, promptChanged: false, error: loaded.error }
  }
  const { client, knowledgeChunkCount, ctx } = loaded.data

  // Guard: hand-tuned clients are never touched by automated regeneration.
  // No escape hatch on single-slot regen — flip clients.hand_tuned=false manually
  // if intentional, then regenerate, then flip it back. Force flag lives only on
  // recomposePrompt() because the snowflake-migration use case needs it there.
  const handTunedError = checkHandTunedGuard(client, false)
  if (handTunedError) {
    return { success: false, promptChanged: false, error: handTunedError }
  }

  // Guard: only works on slot-composed prompts (have section markers).
  if (!hasSlotMarkers(client.system_prompt as string)) {
    return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — use patchers instead of regeneration' }
  }

  // Run the target slot function
  const slotFn = SLOT_FUNCTIONS[slotId]
  if (!slotFn) {
    return { success: false, promptChanged: false, error: `Unknown slot: ${slotId}` }
  }
  const newContent = slotFn(ctx)

  // Replace that section in the stored prompt
  const updatedPrompt = replacePromptSection(client.system_prompt, slotId, newContent)

  if (updatedPrompt === client.system_prompt) {
    return { success: true, promptChanged: false, charCount: updatedPrompt.length }
  }

  // Validate
  const validation = validatePrompt(updatedPrompt)
  if (!validation.valid) {
    return { success: false, promptChanged: false, error: `Validation failed: ${validation.error}` }
  }

  // Dry-run: return preview without saving
  if (dryRun) {
    return {
      success: true,
      promptChanged: true,
      charCount: updatedPrompt.length,
      preview: updatedPrompt,
      currentPrompt: client.system_prompt as string,
    }
  }

  // Save + sync
  const saveResult = await savePromptAndSync(
    clientId, updatedPrompt, client, knowledgeChunkCount,
    `Slot regeneration: ${slotId}`, triggeredByUserId,
  )
  if (saveResult.error) {
    return { success: false, promptChanged: false, error: saveResult.error }
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
 *
 * @param dryRun - If true, return preview without saving to DB or syncing to Ultravox
 */
export async function regenerateSlots(
  clientId: string,
  slotIds: SlotId[],
  triggeredByUserId: string | null = null,
  dryRun = false,
): Promise<RegenerateSlotResult> {
  const loaded = await loadClientContext(clientId)
  if (!loaded.ok) {
    return { success: false, promptChanged: false, error: loaded.error }
  }
  const { client, knowledgeChunkCount, ctx } = loaded.data

  // Guard: hand-tuned clients are never touched by automated regeneration.
  const handTunedError = checkHandTunedGuard(client, false)
  if (handTunedError) {
    return { success: false, promptChanged: false, error: handTunedError }
  }

  // Guard: slot-composed prompts only
  if (!hasSlotMarkers(client.system_prompt as string)) {
    return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — use patchers instead of regeneration' }
  }

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

  // Dry-run: return preview without saving
  if (dryRun) {
    return {
      success: true,
      promptChanged: true,
      charCount: prompt.length,
      preview: prompt,
      currentPrompt: client.system_prompt as string,
    }
  }

  // Save + sync
  const saveResult = await savePromptAndSync(
    clientId, prompt, client, knowledgeChunkCount,
    `Slot regeneration: ${slotIds.join(', ')}`, triggeredByUserId,
  )
  if (saveResult.error) {
    return { success: false, promptChanged: false, error: saveResult.error }
  }

  return {
    success: true,
    promptChanged: true,
    charCount: prompt.length,
  }
}

// ── Full prompt recomposition (D280) ────────────────────────────────────────────

export interface RecomposeResult {
  success: boolean
  promptChanged: boolean
  error?: string
  charCount?: number
  /** When dryRun=true, the fully recomposed prompt text */
  preview?: string
  /** When dryRun=true, the current stored prompt text (for diffing) */
  currentPrompt?: string
}

/**
 * Recompose the entire prompt from scratch using current DB state.
 *
 * Unlike regenerateSlots (which patches individual sections in the existing prompt),
 * this rebuilds the full prompt via buildPromptFromSlots(). This is the "nuclear"
 * option — it guarantees the prompt matches what a fresh onboarding would produce
 * from the current DB fields.
 *
 * WARNING: This overwrites ALL sections, including any manual edits made via the
 * D251 section editor (triage, etc.) that live only in prompt text. Manual edits
 * survive only if their content was saved to a DB field or niche_custom_variables
 * (e.g., TRIAGE_DEEP override). Always use dryRun=true first to show a diff preview.
 * For targeted updates, prefer regenerateSlots() which only touches affected sections.
 *
 * Use cases:
 * - "Recompose" button in Agent Brain dashboard (always show diff preview first)
 * - After bulk variable edits
 * - Prompt drift repair
 *
 * @param clientId - The client UUID
 * @param triggeredByUserId - Who triggered this (null for system)
 * @param dryRun - If true, return the recomposed prompt without saving or syncing
 * @param forceRecompose - If true, skip the slot-marker guard and recompose
 *   even on legacy-monolithic prompts. **Migration-only.** This intentionally
 *   discards any hand-edits that live ONLY in `clients.system_prompt` text and
 *   not in DB columns / `niche_custom_variables`. Default false. (D445)
 */
export async function recomposePrompt(
  clientId: string,
  triggeredByUserId: string | null = null,
  dryRun = false,
  forceRecompose = false,
): Promise<RecomposeResult> {
  const loaded = await loadClientContext(clientId)
  if (!loaded.ok) {
    return { success: false, promptChanged: false, error: loaded.error }
  }
  const { client, knowledgeChunkCount, ctx } = loaded.data

  // Guard: hand-tuned clients require explicit forceRecompose to overwrite.
  // The flag is set during manual concierge provisioning (Steps 9 & 10 of the
  // bypass SOP) on any client whose prompt was hand-edited and must NOT be
  // wiped by a stray "Recompose" click. forceRecompose bypasses for migrations
  // (e.g. snowflake D445) where overwriting hand-edits is the explicit intent.
  const handTunedError = checkHandTunedGuard(client, forceRecompose)
  if (handTunedError) {
    return { success: false, promptChanged: false, error: handTunedError }
  }

  // Guard: only recompose slot-composed prompts.
  // Old-format prompts (4 live clients) must be migrated first (D304/D445).
  // forceRecompose bypasses this for one-time migration runs only.
  const isLegacyMonolithic = !hasSlotMarkers(client.system_prompt as string)
  if (isLegacyMonolithic && !forceRecompose) {
    return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — migrate to slot format first (D304)' }
  }

  // Build the entire prompt from scratch
  let newPrompt = buildPromptFromSlots(ctx)

  // ── Learning Bank injection (gated, default OFF) ────────────────────────────
  // W3 self-improvement loop. Only injects when the env flag is explicitly
  // 'true' so we can validate per-niche before flipping it on. The block is
  // small and budget-checked; if injecting would push the prompt over the
  // soft budget the entire injection is skipped.
  if (process.env.LEARNING_BANK_INJECT === 'true') {
    try {
      const svc = createServiceClient()
      const niche = (client.niche as string | null) ?? null
      const patterns = await fetchActivePatternsForNiche(svc, niche)
      if (patterns.length > 0) {
        const injectionChars = estimateLearningBankBlockChars(patterns)
        if (newPrompt.length + injectionChars < LEARNING_BANK_PROMPT_BUDGET_CHARS) {
          newPrompt = injectLearningBankBlock(newPrompt, patterns)
        } else {
          console.warn(
            `[learning-bank] Skipping injection for client=${clientId} niche=${niche ?? 'null'}: ` +
            `would exceed budget (${newPrompt.length} + ${injectionChars} >= ${LEARNING_BANK_PROMPT_BUDGET_CHARS})`,
          )
        }
      }
    } catch (err) {
      console.warn(`[learning-bank] Injection failed (continuing without): ${err}`)
    }
  }

  if (newPrompt === client.system_prompt) {
    return { success: true, promptChanged: false, charCount: newPrompt.length }
  }

  // Validate
  const validation = validatePrompt(newPrompt)
  if (!validation.valid) {
    return { success: false, promptChanged: false, error: `Validation failed: ${validation.error}` }
  }

  // Dry-run: return preview without saving
  if (dryRun) {
    return {
      success: true,
      promptChanged: true,
      charCount: newPrompt.length,
      preview: newPrompt,
      currentPrompt: client.system_prompt as string,
    }
  }

  // Save + sync
  const changeDescription = isLegacyMonolithic
    ? 'Snowflake migration to slot format (D445 forceRecompose)'
    : 'Full prompt recomposition'
  const saveResult = await savePromptAndSync(
    clientId, newPrompt, client, knowledgeChunkCount,
    changeDescription, triggeredByUserId,
  )
  if (saveResult.error) {
    return { success: false, promptChanged: false, error: saveResult.error }
  }

  return {
    success: true,
    promptChanged: true,
    charCount: newPrompt.length,
  }
}
