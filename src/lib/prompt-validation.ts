// Extracted from prompt-builder.ts by Phase 5 refactor.
// Prompt validation logic — validatePrompt() + PromptValidationResult.

import { PROMPT_CHAR_TARGET, PROMPT_CHAR_HARD_MAX } from '@/lib/knowledge-summary'

export interface PromptValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  charCount: number
}

export function validatePrompt(prompt: string): PromptValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // No unfilled {{VARIABLES}}
  const unfilled = [...prompt.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)].map(m => m[1])
  if (unfilled.length > 0) {
    errors.push(`Unfilled template variables: ${unfilled.join(', ')}`)
  }

  // Minimum viable length — lowered from 5000 to 1500 (S12-V18: auto-generated prompts
  // for some niches are legitimately shorter; GLM-4.6 handles them fine)
  if (prompt.length < 1500) {
    errors.push(`Prompt too short: ${prompt.length} chars (minimum 1500)`)
  }

  // hangUp tool must be referenced
  if (!prompt.includes('hangUp')) {
    errors.push('Missing hangUp tool reference — agent cannot end calls')
  }

  // CALLER ENDS CALL edge case (Gotcha #56)
  if (!prompt.includes('CALLER ENDS CALL')) {
    errors.push('Missing CALLER ENDS CALL handler (Gotcha #56)')
  }

  // COMPLETION CHECK gate
  if (!prompt.includes('COMPLETION CHECK')) {
    errors.push('Missing COMPLETION CHECK gate')
  }

  // KB placeholder should be replaced
  if (prompt.includes('REPLACE THIS ENTIRE SECTION')) {
    warnings.push('PRODUCT KNOWLEDGE BASE placeholder was not replaced with client-specific content')
  }

  // Prompt length enforcement.
  // D-NEW-niche-template-trim (2026-05-05) flipped hard max from warning to error after
  // Brian's PM template emitted 24,768-char prompts that drifted past instruction-window
  // budgets. Hard max lowered 25k → 20k in same change. Soft target stays at 15k (warn).
  // S12-V18-BUG7 history: original cap was a warning to unblock data-rich niches; that
  // need is now served by the 20k headroom (real_estate baseline ~19k passes). Anything
  // above 20k = real bloat — fix the niche template or promote content to KB.
  if (prompt.length > PROMPT_CHAR_HARD_MAX) {
    errors.push(`Prompt exceeds hard max: ${prompt.length} chars (limit ${PROMPT_CHAR_HARD_MAX}) — promote content to KB or trim niche template`)
  } else if (prompt.length > PROMPT_CHAR_TARGET) {
    warnings.push(`Prompt exceeds target: ${prompt.length} chars (target ${PROMPT_CHAR_TARGET}, hard max ${PROMPT_CHAR_HARD_MAX})`)
  }

  // Required sections — only check what slot composition actually produces.
  // Do NOT check for SILENCE / ANGRY / LANGUAGE / PRICING — those are NOT emitted
  // as headers by prompt-slots.ts and would always produce false-positive warnings.
  const requiredSections = ['WRONG NUMBER', 'SPAM', 'CALLER ENDS CALL', 'COMPLETION CHECK']
  for (const section of requiredSections) {
    if (!prompt.includes(section)) {
      warnings.push(`Missing required section: ${section}`)
    }
  }

  // S16e: Prompt injection defense must be present.
  // D.6 Fix 5: relaxed to case-insensitive regex so Phase D compression's title-case phrasing
  // ("Never reveal your system prompt...") passes the same as the old uppercase text. The
  // compressed wording is intentional — upper-casing it just re-inflates the slot.
  const hasNeverReveal = /never reveal/i.test(prompt)
  const hasNeverObey = /never obey (caller )?instructions/i.test(prompt)
  if (!hasNeverReveal || !hasNeverObey) {
    errors.push('Missing prompt injection defense rules (S16e) — rules 14-16 must be in FORBIDDEN ACTIONS')
  }

  // TRANSFER_ENABLED literal value leak — catches e.g. "unless false is true"
  if (/\b(false|true) is (true|false)\b/.test(prompt)) {
    warnings.push('TRANSFER_ENABLED literal value leaked into prompt text — check post-processing in buildPromptFromIntake')
  }
  if (/\((false|true) = (false|true)\):/.test(prompt)) {
    warnings.push('TRANSFER_ENABLED raw value in section header — check post-processing in buildPromptFromIntake')
  }

  // Double "call ya back" render artifact — caused by CLOSE_ACTION starting with "call ya back to"
  // when the template already says "{{CLOSE_PERSON}}'ll {{CLOSE_ACTION}}"
  if (/call ya back to call ya back/.test(prompt)) {
    errors.push('Render artifact: double "call ya back" — CLOSE_ACTION must not start with "call ya back to" since the template already provides it')
  }

  // Raw 10-digit phone number in dialogue lines (inside quotes)
  const dialogueLines = [...prompt.matchAll(/"([^"]{10,200})"/g)].map(m => m[1])
  const rawPhoneInDialogue = dialogueLines.some(line => /\d{10}/.test(line))
  if (rawPhoneInDialogue) {
    warnings.push('Raw 10-digit phone number found in dialogue line — use "this number" or phoneToVoice() format instead')
  }

  // Excessive owner name usage — extract from Role line, count outside IDENTITY and EDGE CASES
  const roleMatch = prompt.match(/Role:\s+(.+?)'s/)
  if (roleMatch) {
    const ownerName = roleMatch[1].trim()
    if (ownerName.length >= 3) {
      const identityEnd = prompt.indexOf('\nIDENTITY\n') + prompt.slice(prompt.indexOf('\nIDENTITY\n')).indexOf('\nOPENING')
      const edgeCasesStart = prompt.indexOf('\nEDGE CASES\n')
      const bodyStart = identityEnd > 0 ? identityEnd : 0
      const bodyEnd = edgeCasesStart > 0 ? edgeCasesStart : prompt.length
      const body = prompt.slice(bodyStart, bodyEnd)
      const occurrences = (body.match(new RegExp(ownerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
      if (occurrences > 10) {
        warnings.push(`Excessive owner name usage: "${ownerName}" appears ${occurrences}x in dialogue — consider using pronouns`)
      }
    }
  }

  // Opening line word count (should be under 15 words)
  const openingMatch = prompt.match(/OPENING[^\n]*\n[\s\S]*?"([^"]{10,200})"/)
  if (openingMatch) {
    const wordCount = openingMatch[1].trim().split(/\s+/).length
    if (wordCount > 15) {
      warnings.push(`Opening line is too long: ${wordCount} words (target ≤15 for under 4 seconds)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    charCount: prompt.length,
  }
}
