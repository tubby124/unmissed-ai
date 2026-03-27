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
  getServiceType,
  getClosePerson,
} from './prompt-patcher'
import { replacePromptSection } from './prompt-sections'
import { VOICE_PRESETS } from './prompt-builder'
import { validatePrompt, type PromptWarning, type SettingsBody } from './settings-schema'

// ── Types ───────────────────────────────────────────────────────────────────────

interface PatchOrchestratorInput {
  supabase: SupabaseClient
  clientId: string
  body: SettingsBody
  updates: Record<string, unknown>
}

interface PatchOrchestratorResult {
  warnings: PromptWarning[]
}

// ── Patcher context (fetched once) ──────────────────────────────────────────────

interface PatcherContext {
  currentPrompt: string | null
  currentNiche: string | null
  currentAgentName: string | null
  currentBusinessName: string | null
}

/**
 * Fields that trigger prompt auto-patching.
 * If any of these are present in the body, we need to fetch the current prompt.
 */
const PATCH_TRIGGER_FIELDS = [
  'section_id', 'booking_enabled', 'sms_enabled', 'voice_style_preset',
  'agent_name', 'business_name', 'services_offered', 'call_handling_mode',
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
    .select('system_prompt, niche, agent_name, business_name')
    .eq('id', clientId)
    .single()

  return {
    // Use prompt from updates (if system_prompt was directly set in body) or from DB
    currentPrompt: typeof updates.system_prompt === 'string'
      ? updates.system_prompt as string
      : (data?.system_prompt as string) ?? null,
    currentNiche: (data?.niche as string) ?? null,
    // Use OLD names from DB — needed for replacement patching
    currentAgentName: (data?.agent_name as string) ?? null,
    currentBusinessName: (data?.business_name as string) ?? null,
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

  if (!needsPromptPatching(body)) {
    return { warnings }
  }

  // Single DB fetch for all patcher context
  const ctx = await fetchPatcherContext(supabase, clientId, updates)

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

  // ── 3. Sensory patches (voice_style_preset) ─────────────────────────────
  if (typeof body.voice_style_preset === 'string' && body.voice_style_preset) {
    const preset = VOICE_PRESETS[body.voice_style_preset]
    if (preset) {
      const patched = patchVoiceStyleSection(prompt, preset.toneStyleBlock, preset.fillerStyle)
      if (patched !== prompt) {
        const err = applyPatch(patched, prompt, updates, warnings)
        if (err) return { warnings, error: err }
        prompt = patched
        console.log(`[settings] Voice style patched to '${body.voice_style_preset}' for client=${clientId}`)
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
    const patched = patchSmsBlock(prompt, body.sms_enabled)
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] SMS block ${body.sms_enabled ? 'added to' : 'removed from'} prompt for client=${clientId}`)
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

  if (typeof body.call_handling_mode === 'string') {
    const closePerson = getClosePerson(prompt, ctx.currentAgentName)
    const patched = patchCallHandlingMode(prompt, body.call_handling_mode, closePerson)
    if (patched !== prompt) {
      const err = applyPatch(patched, prompt, updates, warnings)
      if (err) return { warnings, error: err }
      prompt = patched
      console.log(`[settings] Call handling mode patched to '${body.call_handling_mode}' for client=${clientId}`)
    } else {
      warnings.push({ field: 'mode_not_patched', message: "Mode saved — but your agent's prompt doesn't have a CALL HANDLING MODE section. Run /prompt-deploy to update the prompt." })
    }
  }

  return { warnings }
}
