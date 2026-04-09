/**
 * prompt-builder.ts — Voice agent prompt builder
 *
 * D268 (Phase 3): Delegates to slot composition via prompt-slots.ts.
 * The legacy template-body.ts monolith and _buildPrompt_legacy() were removed
 * in Phase H cleanup (2026-04-09). Rollback path is git history.
 */

import { buildSlotContext, buildPromptFromSlots } from './prompt-slots'

// ── Voice style presets (re-exported from voice-presets.ts) ──────────────────
// Extracted to avoid pulling the entire prompt-builder into lightweight consumers.
export { VOICE_PRESETS, type VoicePreset } from './voice-presets'

import { NICHE_DEFAULTS } from './prompt-config/niche-defaults'
export { NICHE_DEFAULTS }

import { NICHE_CLASSIFICATION_RULES } from './prompt-config/niche-classification'
export { NICHE_CLASSIFICATION_RULES }

import { buildVoicemailPrompt } from './prompt-niches/voicemail-prompt'

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
