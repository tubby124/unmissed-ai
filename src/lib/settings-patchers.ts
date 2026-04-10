/**
 * settings-patchers.ts — Prompt auto-patch orchestrator for the settings PATCH route.
 *
 * When a user changes a field that affects the system_prompt (agent_name, booking_enabled,
 * voice_style_preset, etc.), this module orchestrates fetching the current prompt,
 * applying the relevant patcher, validating the result, and updating the updates dict.
 *
 * Consolidates 6 scattered "fetch prompt if needed" patterns into a single DB fetch.
 *
 * Patch order follows the mutation contract: identity → sensory → operational.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  patchCalendarBlock,
  patchSmsBlock,
  patchVoiceStyleSection,
  patchAgentName,
  patchBusinessName,
  patchServicesOffered,
  patchCallHandlingMode,
  patchVipSection,
  patchHoursWeekday,
  patchIdentityPersonality,
  getServiceType,
  getClosePerson,
} from './prompt-patcher'
import { replacePromptSection } from './prompt-sections'
import { VOICE_PRESETS } from './voice-presets'
import { VOICE_TONE_PRESETS } from './prompt-config/voice-tone-presets'
import { validatePrompt, type PromptWarning, type SettingsBody } from './settings-schema'
import { buildPromptFromIntake } from './prompt-builder'

// ── Types ───────────────────────────────────────────────────────────────────────

interface PatchOrchestratorInput {
  supabase: SupabaseClient
  clientId: string
  body: SettingsBody
  updates: Record<string, unknown>
}

interface PatchOrchestratorResult {
  warnings: PromptWarning[]
  /** True when voicemail full rebuild was applied — caller can skip separate regen */
  promptRebuilt?: boolean
}

// ── Patcher context (fetched once) ──────────────────────────────────────────────

interface PatcherContext {
  currentPrompt: string | null
  currentNiche: string | null
  currentSlug: string | null
  currentAgentName: string | null
  currentBusinessName: string | null
  currentOwnerName: string | null
  currentCallHandlingMode: string | null
  currentAgentMode: string | null
  currentSmsEnabled: boolean
  currentForwardingNumber: string | null
  currentBusinessHoursWeekday: string | null
}

/**
 * Fields that trigger prompt auto-patching.
 * If any of these are present in the body, we need to fetch the current prompt.
 */
const PATCH_TRIGGER_FIELDS = [
  'section_id', 'booking_enabled', 'sms_enabled', 'voice_style_preset',
  'agent_name', 'business_name', 'owner_name', 'services_offered', 'call_handling_mode', 'agent_mode',
  'forwarding_number', 'business_hours_weekday',
  // D283c: triggers slot regeneration instead of individual patcher
  'niche_custom_variables',
] as const

function needsPromptPatching(body: SettingsBody): boolean {
  return PATCH_TRIGGER_FIELDS.some(f => body[f] !== undefined)
}

/**
 * Fetch the patcher context from the DB once.
 * All patchers share this context — no repeated DB queries.
 *
 * Uses the current (pre-update) DB values so name patchers can find old names.
 */
async function fetchPatcherContext(
  supabase: SupabaseClient,
  clientId: string,
  updates: Record<string, unknown>,
): Promise<PatcherContext> {
  const { data } = await supabase
    .from('clients')
    .select('system_prompt, niche, slug, agent_name, business_name, owner_name, call_handling_mode, agent_mode, sms_enabled, forwarding_number, business_hours_weekday')
    .eq('id', clientId)
    .single()

  return {
    // Use prompt from updates (if system_prompt was directly set in body) or from DB
    currentPrompt: typeof updates.system_prompt === 'string'
      ? updates.system_prompt as string
      : (data?.system_prompt as string) ?? null,
    currentNiche: (data?.niche as string) ?? null,
    currentSlug: (data?.slug as string) ?? null,
    // Use OLD names from DB — needed for replacement patching
    currentAgentName: (data?.agent_name as string) ?? null,
    currentBusinessName: (data?.business_name as string) ?? null,
    currentOwnerName: (data?.owner_name as string) ?? null,
    currentCallHandlingMode: (data?.call_handling_mode as string) ?? null,
    currentAgentMode: (data?.agent_mode as string) ?? null,
    currentSmsEnabled: (data?.sms_enabled as boolean) ?? false,
    currentForwardingNumber: (data?.forwarding_number as string | null) ?? null,
    currentBusinessHoursWeekday: (data?.business_hours_weekday as string | null) ?? null,
  }
}

// ── Patch step helpers ──────────────────────────────────────────────────────────

/**
 * Apply a prompt patch, validate the result, and update the updates dict.
 * Returns warnings. If validation fails, returns an error string.
 */
function applyPatch(
  patched: string,
  currentPrompt: string,
  updates: Record<string, unknown>,
  warnings: PromptWarning[],
): string | null {
  if (patched === currentPrompt) return null // no change

  const v = validatePrompt(patched)
  if (!v.valid) return v.error ?? 'Prompt too long after patching'
  if (v.warnings.length) warnings.push(...v.warnings)

  updates.system_prompt = patched
  updates.updated_at = new Date().toISOString()
  return null
}

// ── Voicemail full rebuild ───────────────────────────────────────────────────────

/**
 * Day1EditPanel fields that the voicemail builder reads.
 * When any of these are in the PATCH body for a voicemail/message_only client,
 * we do a full rebuild instead of surgical section patching (which silently
 * fails because voicemail prompts have different section headers).
 */
const VOICEMAIL_REBUILD_FIELDS = [
  'today_update', 'business_notes', 'fields_to_collect',
  'pricing_policy', 'unknown_answer_behavior', 'calendar_mode',
] as const

/**
 * Full rebuild for voicemail/message_only clients.
 *
 * The voicemail prompt is built by buildVoicemailPrompt() — a standalone
 * template with section headers (# VOICE NATURALNESS, # CONVERSATION STYLE)
 * that don't match the slot-pipeline headers the surgical patchers target.
 * Instead of patching, we rebuild the entire prompt from intake + client state.
 */
async function voicemailFullRebuild(
  supabase: SupabaseClient,
  clientId: string,
  slug: string,
  body: SettingsBody,
  updates: Record<string, unknown>,
): Promise<PatchOrchestratorResult & { error?: string }> {
  const warnings: PromptWarning[] = []

  // Fetch intake + current client state in parallel
  const [{ data: intake }, { data: clientRow }] = await Promise.all([
    supabase
      .from('intake_submissions')
      .select('intake_json')
      .eq('client_slug', slug)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('clients')
      .select('agent_name, business_name, owner_name, niche, twilio_number, callback_phone, today_update, business_notes, fields_to_collect, pricing_policy, unknown_answer_behavior, calendar_mode, status')
      .eq('id', clientId)
      .single(),
  ])

  if (!intake?.intake_json) {
    // No intake — can't rebuild. Leave prompt as-is.
    return { warnings }
  }

  // Build merged intake dict: intake_json ← clients row ← this PATCH's updates
  const intakeData = { ...(intake.intake_json as Record<string, unknown>) }

  // Layer 1: clients row values override intake_json (prior dashboard edits)
  if (clientRow) {
    const cr = clientRow as Record<string, unknown>
    for (const f of ['agent_name', 'business_name', 'owner_name', 'twilio_number', 'callback_phone',
                      'today_update', 'business_notes', 'fields_to_collect', 'pricing_policy',
                      'unknown_answer_behavior', 'calendar_mode']) {
      if (cr[f] !== null && cr[f] !== undefined) intakeData[f] = cr[f]
    }
    if (cr.agent_name && cr.status === 'active') intakeData.db_agent_name = cr.agent_name
  }

  // Layer 2: this PATCH's updates (most recent, not yet saved to DB)
  for (const f of ['agent_name', 'business_name', 'owner_name',
                    'today_update', 'business_notes', 'fields_to_collect', 'pricing_policy',
                    'unknown_answer_behavior', 'calendar_mode']) {
    if (updates[f] !== undefined) {
      intakeData[f] = updates[f]
      if (f === 'agent_name') intakeData.db_agent_name = updates[f]
    }
  }

  const newPrompt = buildPromptFromIntake(intakeData)

  const v = validatePrompt(newPrompt)
  if (!v.valid) return { warnings, error: v.error ?? 'Prompt too long after voicemail rebuild' }
  if (v.warnings.length) warnings.push(...v.warnings)

  updates.system_prompt = newPrompt
  updates.updated_at = new Date().toISOString()

  console.log(`[settings] Voicemail full rebuild: client=${clientId} chars=${newPrompt.length}`)

  return { warnings, promptRebuilt: true }
}

// ── Main orchestrator ───────────────────────────────────────────────────────────

/**
 * Apply all prompt auto-patches based on fields present in the body.
 *
 * Patch order: section edit → identity (agent_name, business_name) →
 *   sensory (voice_style) → operational (services, sms, calendar, call_handling_mode)
 *
 * Mutates `updates.system_prompt` in place when patches are applied.
 * Returns validation warnings and an optional error (abort string).
 */
export async function applyPromptPatches(
  input: PatchOrchestratorInput,
): Promise<PatchOrchestratorResult & { error?: string }> {
  const { supabase, clientId, body, updates } = input
  const warnings: PromptWarning[] = []

  const hasPatchTrigger = needsPromptPatching(body)
  const hasVoicemailField = VOICEMAIL_REBUILD_FIELDS.some(f => body[f] !== undefined)

  if (!hasPatchTrigger && !hasVoicemailField) {
    return { warnings }
  }

  // Single DB fetch for all patcher context
  const ctx = await fetchPatcherContext(supabase, clientId, updates)

  // Voicemail/message_only clients: full rebuild instead of surgical patching.
  // The voicemail template has different section headers than the slot pipeline,
  // so patchVoiceStyleSection, patchCalendarBlock, etc. are silent no-ops.
  const isVoicemail = ctx.currentNiche === 'voicemail' || ctx.currentCallHandlingMode === 'message_only'
  if (isVoicemail && ctx.currentSlug) {
    return voicemailFullRebuild(supabase, clientId, ctx.currentSlug, body, updates)
  }

  // Slot-pipeline path: surgical patching only when patcher trigger fields are present
  if (!hasPatchTrigger) {
    return { warnings }
  }

  if (!ctx.currentPrompt) {
    return { warnings }
  }

  // We'll track the evolving prompt through the patch chain
  let prompt = ctx.currentPrompt

  // ── 1. Section edit (B1) ────────────────────────────────────────────────
  if (typeof body.section_id === 'string' && typeof body.section_content === 'string') {
    const merged = replacePromptSection(prompt, body.section_id, body.section_content)
    const err = applyPatch(merged, prompt, updates, warnings)
    if (err) return { warnings, error: err }
    prompt = typeof updates.system_prompt === 'string' ? updates.system_prompt as string : prompt
  }

  // ── 2. Identity patches (agent_name, business_name) ─────────────────────
  if (typeof body.agent_name === 'string' && body.agent_name.trim()) {
    const oldName = ctx.currentAgentName
    const newName = body.agent_name.trim()

    if (oldName && oldName !== newName) {
      const patched = patchAgentName(prompt, oldName, newName)
      if (patched !== prompt) {
        const err = applyPatch(patched, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = patched
        console.log(`[settings] Agent name patched '${oldName}' → '${newName}' in prompt for client=${clientId}`)
      } else {
        warnings.push({ field: 'agent_name_not_patched', message: `Name saved — but "${oldName}" wasn't found in your agent's prompt. Run /prompt-deploy to update the prompt.` })
      }
    }
  }

  if (typeof body.business_name === 'string' && body.business_name.trim()) {
    const oldName = ctx.currentBusinessName
    const newName = body.business_name.trim()

    if (oldName && oldName !== newName) {
      const patched = patchBusinessName(prompt, oldName, newName)
      if (patched !== prompt) {
        const err = applyPatch(patched, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = patched
        console.log(`[settings] Business name patched '${oldName}' → '${newName}' in prompt for client=${clientId}`)
      } else {
        warnings.push({ field: 'business_name_not_patched', message: `Business name saved — but "${oldName}" wasn't found in your agent's prompt. Run /prompt-deploy to update the prompt.` })
      }
    }
  }

  // ── 2b. Owner name (CLOSE_PERSON) patch ─────────────────────────────────
  // D281: owner_name → CLOSE_PERSON (first name). Word-boundary replace throughout prompt.
  if (typeof body.owner_name === 'string' && body.owner_name.trim()) {
    const oldOwnerName = ctx.currentOwnerName
    const newOwnerName = body.owner_name.trim()

    if (oldOwnerName && oldOwnerName !== newOwnerName) {
      const oldFirst = oldOwnerName.split(' ')[0]
      const newFirst = newOwnerName.split(' ')[0]

      if (oldFirst && newFirst && oldFirst.toLowerCase() !== newFirst.toLowerCase()) {
        const patched = patchAgentName(prompt, oldFirst, newFirst)
        if (patched !== prompt) {
          const err = applyPatch(patched, prompt, updates, warnings)
          if (err) return { warnings, error: err }
          prompt = patched
          console.log(`[settings] Owner name (CLOSE_PERSON) patched '${oldFirst}' → '${newFirst}' in prompt for client=${clientId}`)
        } else {
          warnings.push({ field: 'owner_name_not_patched', message: `Owner name saved — but "${oldFirst}" wasn't found in your agent's prompt. Run /prompt-deploy to update the prompt.` })
        }
      }
    }
  }

  // ── 3. Hours patch (business_hours_weekday) ─────────────────────────────
  // Replaces old literal hours text baked into the static prompt at provision time
  // ({{HOURS_WEEKDAY}} was substituted during buildPromptFromIntake).
  if (typeof body.business_hours_weekday === 'string' && body.business_hours_weekday.trim()) {
    const oldHours = ctx.currentBusinessHoursWeekday
    const newHours = body.business_hours_weekday.trim()
    if (oldHours && oldHours !== newHours) {
      const patched = patchHoursWeekday(prompt, oldHours, newHours)
      if (patched !== prompt) {
        const err = applyPatch(patched, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = patched
        console.log(`[settings] Hours weekday patched '${oldHours}' → '${newHours}' in prompt for client=${clientId}`)
      }
    }
  }

  // ── 4. Sensory patches (voice_style_preset) ─────────────────────────────
  if (typeof body.voice_style_preset === 'string' && body.voice_style_preset) {
    const preset = VOICE_PRESETS[body.voice_style_preset] || VOICE_TONE_PRESETS[body.voice_style_preset]
    if (preset) {
      const patched = patchVoiceStyleSection(prompt, preset.toneStyleBlock, preset.fillerStyle)
      if (patched !== prompt) {
        const err = applyPatch(patched, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = patched
        console.log(`[settings] Voice style patched to '${body.voice_style_preset}' for client=${clientId}`)
      }
      // D275: Also patch personality line in IDENTITY section
      if (preset.personalityLine) {
        const personalityPatched = patchIdentityPersonality(prompt, preset.personalityLine)
        if (personalityPatched !== prompt) {
          const err = applyPatch(personalityPatched, prompt, updates, warnings)
          if (err) return { warnings, error: err }
          prompt = personalityPatched
          console.log(`[settings] Identity personality patched to '${body.voice_style_preset}' for client=${clientId}`)
        }
      }
    }
  }

  // ── 4. Operational patches (services, sms, calendar, call_handling_mode) ─

  if (typeof body.services_offered === 'string' && body.services_offered.trim()) {
    const patched = patchServicesOffered(prompt, body.services_offered.trim())
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] Services offered patched in prompt for client=${clientId}`)
    } else {
      warnings.push({ field: 'services_not_patched', message: "Services saved — but your agent's prompt doesn't use the standard format and wasn't automatically updated. Changes will apply next time the prompt is regenerated." })
    }
  }

  if (typeof body.sms_enabled === 'boolean') {
    // Pass current agent mode so the SMS block content matches the agent's behavior
    const agentModeForSms = (body.agent_mode as string | undefined) ?? ctx.currentAgentMode
    const patched = patchSmsBlock(prompt, body.sms_enabled, agentModeForSms)
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] SMS block ${body.sms_enabled ? 'added to' : 'removed from'} prompt (mode=${agentModeForSms ?? 'default'}) for client=${clientId}`)
    }
  }

  if (typeof body.booking_enabled === 'boolean') {
    const patched = patchCalendarBlock(
      prompt,
      body.booking_enabled,
      getServiceType(ctx.currentNiche),
      getClosePerson(prompt, ctx.currentAgentName),
    )
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] Calendar block ${body.booking_enabled ? 'added to' : 'removed from'} prompt for client=${clientId}`)
    }
  }

  if ('forwarding_number' in body) {
    // Resolve effective forwarding number: body value (may be null to clear) or current DB value
    const effectiveForwardingNumber = body.forwarding_number !== undefined
      ? body.forwarding_number
      : ctx.currentForwardingNumber
    const patched = patchVipSection(prompt, !!effectiveForwardingNumber)
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] VIP section ${effectiveForwardingNumber ? 'added to' : 'removed from'} prompt for client=${clientId}`)
    }
  }

  if (typeof body.agent_mode === 'string' || typeof body.call_handling_mode === 'string') {
    const rawAgentMode = body.agent_mode ?? null
    const callHandlingMode = body.call_handling_mode ?? ctx.currentCallHandlingMode ?? 'triage'
    // agent_mode takes precedence unless it's the default 'lead_capture' (which defers to call_handling_mode)
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture')
      ? rawAgentMode
      : callHandlingMode
    const closePerson = getClosePerson(prompt, ctx.currentAgentName)
    const patched = patchCallHandlingMode(prompt, effectiveMode, closePerson)
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] Call handling mode patched to '${effectiveMode}' (agent_mode=${rawAgentMode ?? 'n/a'}, call_handling_mode=${callHandlingMode}) for client=${clientId}`)
    } else {
      warnings.push({ field: 'mode_not_patched', message: "Mode saved — but your agent's prompt doesn't have a CALL HANDLING MODE section. Run /prompt-deploy to update the prompt." })
    }

    // When agent_mode changes, refresh the SMS block if SMS is currently enabled —
    // the SMS instructions must match the agent's new behavior (e.g. booking vs voicemail).
    // Only triggers when agent_mode is explicitly in the body (not just call_handling_mode changes).
    if (rawAgentMode && ctx.currentSmsEnabled) {
      const smsRefreshed = patchSmsBlock(prompt, true, rawAgentMode)
      if (smsRefreshed !== prompt) {
        const err = applyPatch(smsRefreshed, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = smsRefreshed
        console.log(`[settings] SMS block refreshed for new agent_mode='${rawAgentMode}' for client=${clientId}`)
      }
    }
  }

  return { warnings }
}
