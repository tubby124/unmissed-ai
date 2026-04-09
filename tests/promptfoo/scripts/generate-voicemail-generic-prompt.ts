/**
 * Generate the Phase 1 default voicemail-generic prompt.
 *
 * This is the "smart voicemail / take-a-message" default agent shipped to every
 * new trial client before they pick a niche. Internally routes through the
 * `niche === 'voicemail'` branch in buildPromptFromIntake, which dispatches to
 * buildVoicemailPrompt (lightweight message-taking flow, no TRIAGE_DEEP).
 *
 * Output: tests/promptfoo/generated/voicemail-generic-prompt.txt
 *
 * Usage: npx tsx tests/promptfoo/scripts/generate-voicemail-generic-prompt.ts
 */

import { buildPromptFromIntake, validatePrompt } from '../../../src/lib/prompt-builder'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const intake: Record<string, unknown> = {
  // voicemail-generic → niche 'voicemail' routes to buildVoicemailPrompt
  niche: 'voicemail',
  business_name: 'Mountain View Dental',
  agent_name: 'Sam',
  owner_name: 'Dr. Patel',
  city: 'Calgary',
  call_handling_mode: 'message_only',
  agent_mode: 'lead_capture',
  callback_phone: '(403) 555-0188',
  hours_weekday: 'Mon-Fri 8am-5pm',
  hours_weekend: 'Closed Sat/Sun',
  voice_style_preset: 'casual_friendly',
  // voicemail-specific extras
  niche_messageRecipient: 'owner',
  niche_voicemailBehavior: 'message_only',
}

const prompt = buildPromptFromIntake(intake)
const validation = validatePrompt(prompt)

const outDir = join(__dirname, '..', 'generated')
const outPath = join(outDir, 'voicemail-generic-prompt.txt')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, prompt, 'utf-8')

process.stderr.write(`[voicemail-generic] wrote ${outPath}\n`)
process.stderr.write(`[voicemail-generic] chars=${validation.charCount} valid=${validation.valid}\n`)
// NOTE: see generate-auto-glass-prompt.ts for validator drift note. Same applies here.
if (validation.errors.length > 0) {
  process.stderr.write(`[voicemail-generic] validator WARN (see D.5 debt): ${validation.errors.join(' | ')}\n`)
}
if (validation.warnings.length > 0) {
  process.stderr.write(`[voicemail-generic] warnings: ${validation.warnings.join(' | ')}\n`)
}
