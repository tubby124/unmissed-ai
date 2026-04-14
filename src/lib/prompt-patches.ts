/**
 * prompt-patches.ts — Pure synchronous prompt patch orchestrator.
 *
 * Applies feature-flag driven prompt mutations from a ClientPatchData record.
 * No DB calls, no side effects — safe to use in both route handlers and tests.
 *
 * Patch order: identity (agent_name) → sensory (voice_style) → operational (sms, calendar)
 *
 * Used by: auto-regen, post-build patch port, snapshot regen helpers.
 */

import {
  patchAgentName,
  patchCalendarBlock,
  patchSmsBlock,
  patchVoiceStyleSection,
  getServiceType,
  getClosePerson,
} from '@/lib/prompt-patcher'
import { VOICE_PRESETS } from '@/lib/voice-presets'
import { VOICE_TONE_PRESETS } from '@/lib/prompt-config/voice-tone-presets'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientPatchData = {
  agent_name: string | null
  intake_agent_name?: string | null  // original agent name from intake JSON; used to detect renames
  niche: string | null
  booking_enabled: boolean | null
  sms_enabled: boolean | null
  voice_style_preset: string | null
  agent_mode?: string | null
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Apply all feature-flag patches to a prompt in a single synchronous pass.
 *
 * Patch order:
 *   1. agent_name rename (identity)
 *   2. voice_style_preset (sensory)
 *   3. sms_enabled (operational)
 *   4. booking_enabled (operational)
 *
 * Returns the patched prompt, or the original if nothing changed.
 */
export function applyPromptPatches(prompt: string, client: ClientPatchData): string {
  let result = prompt

  // 1. Identity: agent name rename
  // Only rename when both names are known and they differ.
  if (client.agent_name && client.intake_agent_name && client.agent_name !== client.intake_agent_name) {
    result = patchAgentName(result, client.intake_agent_name, client.agent_name)
  }

  // 2. Sensory: voice style preset (check both VOICE_PRESETS and VOICE_TONE_PRESETS)
  if (client.voice_style_preset) {
    const preset = VOICE_PRESETS[client.voice_style_preset] || VOICE_TONE_PRESETS[client.voice_style_preset]
    if (preset) {
      result = patchVoiceStyleSection(result, preset.toneStyleBlock, preset.fillerStyle)
    }
  }

  // 3. Operational: SMS block
  if (client.sms_enabled) {
    result = patchSmsBlock(result, true, client.agent_mode ?? null)
  }

  // 4. Operational: calendar booking block
  if (client.booking_enabled) {
    result = patchCalendarBlock(
      result,
      true,
      getServiceType(client.niche),
      getClosePerson(result, client.agent_name),
    )
  }

  return result
}
