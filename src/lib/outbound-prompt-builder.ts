/**
 * outbound-prompt-builder.ts
 *
 * Assembles the outbound_prompt string from structured UI fields.
 * The resulting string is stored in clients.outbound_prompt and used verbatim
 * by dial-out/route.ts via resolveOutboundPrompt().
 *
 * Placeholders that dial-out substitutes at call time:
 *   {{LEAD_NAME}}, {{LEAD_PHONE}}, {{LEAD_NOTES}}, {{BUSINESS_NAME}}, {{AGENT_NAME}}
 */

export type OutboundTone = 'warm' | 'professional' | 'direct'

export interface OutboundPromptFields {
  goal: string
  tone: OutboundTone
  opening: string
  vmScript: string
  callNotes?: string | null
  specialInstructions?: string | null
}

const TONE_DESCRIPTIONS: Record<OutboundTone, string> = {
  warm: 'Be conversational, friendly, and empathetic. Use natural contractions. The goal is to build rapport first.',
  professional: 'Be polished and concise. Friendly but efficient. Minimal small talk — respect their time.',
  direct: 'Get to the point immediately. Respect their time above everything. Short sentences, clear ask.',
}

/**
 * Compile structured outbound fields into a single system prompt string.
 * This is the runtime prompt passed to Ultravox — keep it GLM-4.6 safe:
 * - Separated LIVE CALL and VOICEMAIL blocks prevent behavioral bleed
 * - Explicit interruption rule prevents listen-pause loop
 * - hangUp instructions at every exit point prevent dead air
 */
export function assembleOutboundPrompt(fields: OutboundPromptFields): string {
  const { goal, tone, opening, vmScript, callNotes, specialInstructions } = fields
  const toneDesc = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS.warm

  const callNotesBlock = callNotes?.trim()
    ? `\nCALL NOTES (read before proceeding):\n${callNotes.trim()}\n`
    : ''

  let prompt = `You are {{AGENT_NAME}}, an outbound calling agent for {{BUSINESS_NAME}}.
Goal: ${goal}
Tone: ${toneDesc}

CALLER CONTEXT:
Name: {{LEAD_NAME}}
Phone: {{LEAD_PHONE}}
Notes: {{LEAD_NOTES}}
${callNotesBlock}
---
## LIVE CALL

STEP 1 — OPEN (say this verbatim, then pause and wait):
"${opening}"

STEP 2 — CHECK IN (immediately after opening):
- Bad time → "No problem — when would be better?" Note callback time, say goodbye, call hangUp.
- No response after 3 seconds → Repeat your name and business once, then ask "Is now an okay time?"

STEP 3 — BRIDGE (1 sentence, under 15 seconds):
State the single most relevant reason for this call based on the CALLER CONTEXT Notes above.

STEP 4 — QUALIFY (ask ONE question, then listen fully without interrupting):
Make the question specific to their situation from the Notes.

STEP 5 — ADVANCE:
Based on their response, propose a clear next step or let them go graciously. Always end with hangUp.

INTERRUPTION RULE: The moment they speak, stop mid-sentence. Acknowledge first, then respond.

HARD RULES:
- Maximum 15 seconds per turn
- Never repeat the same point twice
- Never ask more than one question at a time
- Call hangUp at every exit: agreed callback, not interested, no response, end of voicemail
- Never pressure — one genuine ask, then respect their answer`

  if (specialInstructions?.trim()) {
    prompt += `\n\nSPECIAL INSTRUCTIONS:\n${specialInstructions.trim()}`
  }

  prompt += `

---
## VOICEMAIL

If the call goes to voicemail, say exactly this and nothing else, then call hangUp immediately:
"${vmScript}"`

  return prompt
}

export const DEFAULT_OUTBOUND_FIELDS: OutboundPromptFields = {
  goal: 'Follow up and schedule a conversation',
  tone: 'warm',
  opening: 'Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I\'m trying to reach {{LEAD_NAME}} — do you have a quick minute?',
  vmScript: 'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out to connect — give us a call back when you get a chance. Thanks!',
  callNotes: null,
  specialInstructions: null,
}
