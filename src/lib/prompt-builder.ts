/**
 * prompt-builder.ts — Voice agent prompt builder
 *
 * D268 (Phase 3): Now delegates to slot composition via prompt-slots.ts.
 * The old template-body.ts monolith path is preserved as dead code for rollback.
 *
 * Flow (new):
 *   1. buildSlotContext(intake) — assembles all variables from intake data
 *   2. buildPromptFromSlots(ctx) — calls 19 slot functions and composes
 *
 * Patchers (patchCalendarBlock, patchAgentName, etc.) still operate on stored
 * prompts of the 4 existing clients — they are NOT affected by this change.
 */

import { buildSlotContext, buildPromptFromSlots } from './prompt-slots'

// ── Dead imports — kept for INBOUND_TEMPLATE_BODY rollback + re-exports ──────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { INBOUND_TEMPLATE_BODY } from './prompt-config/template-body'

// ── Voice style presets (re-exported from voice-presets.ts) ──────────────────
// Extracted to avoid pulling the entire prompt-builder into lightweight consumers.
export { VOICE_PRESETS, type VoicePreset } from './voice-presets'

import { NICHE_DEFAULTS } from './prompt-config/niche-defaults'
export { NICHE_DEFAULTS }

import { NICHE_CLASSIFICATION_RULES } from './prompt-config/niche-classification'
export { NICHE_CLASSIFICATION_RULES }

import { buildVoicemailPrompt } from './prompt-niches/voicemail-prompt'

// ── Core prompt builder ───────────────────────────────────────────────────────

// D268: buildPrompt() is no longer used — slot functions produce content directly.
// Kept as dead code for rollback reference alongside INBOUND_TEMPLATE_BODY.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildPrompt_legacy(variables: Record<string, string>): string {
  let filled = INBOUND_TEMPLATE_BODY.replace(
    /\{\{([A-Z_a-z]+)\}\}/g,
    (_, key: string) => variables[key.toUpperCase()] ?? variables[key.toLowerCase()] ?? '',
  )

  const remaining = [...filled.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)].map(m => m[1])
  if (remaining.length > 0) {
    console.warn('[prompt-builder] WARNING: unfilled variables:', remaining)
  }

  return filled.trim()
}


// ── Main intake-to-prompt function ────────────────────────────────────────────

export function buildPromptFromIntake(intake: Record<string, unknown>, websiteContent?: string, knowledgeDocs?: string): string {
  // Backward compat params — intentionally ignored (content served via pgvector/KnowledgeSummary)
  if (websiteContent) {
    console.log(`[prompt-builder] websiteContent (${websiteContent.length} chars) NOT inlined — served via KnowledgeSummary + pgvector retrieval`)
  }
  if (knowledgeDocs?.trim()) {
    console.log(`[prompt-builder] knowledgeDocs (${knowledgeDocs.length} chars) NOT inlined — served via pgvector retrieval`)
  }

  const niche = (intake.niche as string) || 'other'

  // D184 — message_only mode → voicemail builder (lightweight message-taking flow) regardless of niche
  if ((intake.call_handling_mode as string) === 'message_only') return buildVoicemailPrompt(intake)

  // Voicemail uses its own lightweight template (no city, no inbound triage)
  if (niche === 'voicemail') return buildVoicemailPrompt(intake)

  // D268 (Phase 3): Slot composition — replaces the 700-line template-body injection pipeline
  const ctx = buildSlotContext(intake)
  return buildPromptFromSlots(ctx)
}

// ── Legacy builder body (D268 rollback reference) ─────────────────────────────
// The 700+ line injection pipeline that was the body of buildPromptFromIntake() before
// Phase 3 is now replicated in prompt-slots.ts via 19 named slot functions.
// INBOUND_TEMPLATE_BODY is preserved as dead import above for rollback.
// To rollback: restore this function body from git (commit before Phase 3).
// ── End legacy reference ──────────────────────────────────────────────────────

// ── Validation pass (extracted to prompt-validation.ts) ──────────────────────
export { validatePrompt, type PromptValidationResult } from './prompt-validation'

// ── Niche registry helpers ─────────────────────────────────────────────────────

/** Returns true if the niche has a registered entry in NICHE_DEFAULTS.
 *  Used by /niche-test and the onboard wizard to catch unregistered niches early. */
export function isNicheRegistered(niche: string): boolean {
  return niche in NICHE_DEFAULTS && niche !== '_common'
}

/** Returns all registered niche slugs (excluding internal keys). */
export function getRegisteredNiches(): string[] {
  return Object.keys(NICHE_DEFAULTS).filter(k => k !== '_common')
}

// ── SMS template (extracted to sms-template.ts) ────────────────────────────
export { buildSmsTemplate } from './sms-template'
