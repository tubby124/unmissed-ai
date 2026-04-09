/**
 * prompt-sections.ts — Section marker utilities for componentized prompt editing.
 *
 * Stored prompts use invisible HTML comment markers so individual sections can be
 * replaced surgically without touching the full prompt text. Markers are stripped
 * before the prompt is sent to Ultravox.
 *
 * Marker format: <!-- unmissed:SECTION_ID --> ... <!-- /unmissed:SECTION_ID -->
 *
 * Section IDs:
 *   identity   — Agent name, role, company, greeting (client editable)
 *   hours      — Business hours text (client editable)
 *   knowledge  — Product knowledge / FAQ answers (client editable)
 *   after_hours — After-hours behavior text (client editable via A3)
 *   tone       — Tone and style block (admin only)
 *   flow       — Main conversation flow (admin only)
 *   technical  — hangUp rules, completion check (admin only)
 */

/** Parse all section markers from a stored prompt. Returns a map of sectionId → content. */
export function parsePromptSections(prompt: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const re = /<!-- unmissed:(\w+) -->([\s\S]*?)<!-- \/unmissed:\1 -->/g
  let m: RegExpExecArray | null
  while ((m = re.exec(prompt)) !== null) {
    sections[m[1]] = m[2].trim()
  }
  return sections
}

/** Map sectionId to common header variations found in hand-crafted prompts.
 *  Phase 2 (D274): Extended with all 19 sandwich-spec slot IDs.
 *  Old IDs kept for backward compat with existing client prompts.
 */
const SECTION_HEADER_ALIASES: Record<string, string[]> = {
  // Original IDs (backward compat)
  identity:    ['IDENTITY', 'AGENT IDENTITY'],
  knowledge:   ['KNOWLEDGE', 'KNOWLEDGE BASE', 'KNOWLEDGE LOOKUP', 'PRODUCT KNOWLEDGE BASE'],
  after_hours: ['AFTER HOURS', 'AFTER-HOURS'],
  tone:        ['TONE', 'TONE AND STYLE', 'TONE & STYLE'],
  triage:      ['TRIAGE', '3. TRIAGE'],

  // Phase 2 slot IDs (D274 — sandwich spec)
  safety_preamble:      ['LIFE SAFETY EMERGENCY OVERRIDE'],
  forbidden_actions:    ['ABSOLUTE FORBIDDEN ACTIONS', 'FORBIDDEN ACTIONS'],
  voice_naturalness:    ['VOICE NATURALNESS'],
  grammar:              ['GRAMMAR AND SPEECH', 'GRAMMAR'],
  // identity already above
  tone_and_style:       ['TONE AND STYLE', 'TONE & STYLE'],
  goal:                 ['GOAL'],
  conversation_flow:    ['DYNAMIC CONVERSATION FLOW', 'CONVERSATION FLOW'],
  // after_hours already above
  escalation_transfer:  ['ESCALATION AND TRANSFER', 'ESCALATION'],
  returning_caller:     ['RETURNING CALLER HANDLING', 'RETURNING CALLER'],
  inline_examples:      ['INLINE EXAMPLES'],
  call_handling_mode:   ['CALL HANDLING MODE'],
  faq_pairs:            ['FREQUENTLY ASKED QUESTIONS', 'FAQ'],
  objection_handling:   ['OBJECTION HANDLING'],
  // knowledge already above
  calendar_booking:     ['CALENDAR BOOKING FLOW'],
  sms_followup:         ['SMS FOLLOW-UP', 'SMS FOLLOWUP'],
  vip_protocol:         ['VIP CALLER', 'VIP PROTOCOL'],
}

/**
 * Find an existing section header in the prompt that matches the sectionId.
 * Returns the start index, end-of-section index, or null if not found.
 * Sections are delimited by all-caps headers on their own line.
 */
export function findExistingSectionHeader(
  prompt: string,
  sectionId: string,
): { start: number; end: number } | null {
  const aliases = SECTION_HEADER_ALIASES[sectionId]
  if (!aliases) return null

  const escaped = aliases.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = escaped.join('|')
  // Match header line: optional prefix (##, **, #, numbers) then the alias, optional suffix (**, —, :)
  const headerRe = new RegExp(
    `^[ \\t]*(?:#{1,3}\\s+|\\*\\*)?(?:${pattern})(?:\\s*(?:\\*\\*|:|\\s*[—\\-])[^\\n]*)?\\s*$`,
    'im',
  )
  const m = headerRe.exec(prompt)
  if (!m) return null

  const start = m.index
  // Find end: next all-caps header line (at least 2 uppercase words or a single uppercase word 4+ chars)
  // or end of string
  const afterHeader = start + m[0].length
  const nextHeaderRe = /^[ \t]*(?:#{1,3}\s+|\*\*)?[A-Z][A-Z &/\-]{2,}(?:\*\*)?[ \t]*$/m
  const rest = prompt.slice(afterHeader)
  const nextMatch = nextHeaderRe.exec(rest)
  const end = nextMatch ? afterHeader + nextMatch.index : prompt.length

  return { start, end }
}

/**
 * Replace the content of a named section in a stored prompt.
 * If markers exist, replaces between markers.
 * If no markers but a matching header exists, replaces that section with a marked version.
 * Otherwise appends a new marked section.
 */
export function replacePromptSection(prompt: string, sectionId: string, newContent: string): string {
  const marker    = `<!-- unmissed:${sectionId} -->`
  const endMarker = `<!-- /unmissed:${sectionId} -->`
  const re = new RegExp(`<!-- unmissed:${sectionId} -->[\\s\\S]*?<!-- \\/unmissed:${sectionId} -->`)
  const replacement = `${marker}\n${newContent}\n${endMarker}`
  if (re.test(prompt)) {
    return prompt.replace(re, replacement)
  }
  // No markers — check for an existing section header to replace
  const existing = findExistingSectionHeader(prompt, sectionId)
  if (existing) {
    return prompt.slice(0, existing.start) + replacement + prompt.slice(existing.end)
  }
  // No markers and no existing header — append
  return `${prompt}\n\n${replacement}`
}

/**
 * Wrap a chunk of text in a named section marker.
 * Used by prompt-builder to mark sections at provisioning time.
 *
 * ── Slot ceiling budgeting rule (Phase E.6 Wave 4, documented from E.5 Wave 6) ──
 * Marker wrapper adds ~50 chars per section. The full "slot wrapper" for
 * Day-1 slots (TODAY_UPDATE, BUSINESS_NOTES) also includes a header
 * paragraph and XML-style safety tags:
 *
 *   # TODAY'S UPDATE — READ THIS FIRST
 *
 *   The owner left this note for today's calls. ... (~230 chars)
 *
 *   <today_update>
 *   ...content...
 *   </today_update>
 *
 * Measured overhead for TODAY_UPDATE with max 200-char payload = 482 chars
 * total (282 chars of wrapper). Rule of thumb for ANY future slot that uses
 * wrapSection + a human-readable header: **budget ~300 chars of wrapper
 * overhead on top of raw content** before picking a SLOT_CEILINGS value.
 * Add ~15% headroom (matches the Phase D convention) and you land close to
 * the actual populated-path length. Forgetting this is why the E.5 Wave 6
 * initial TODAY_UPDATE ceiling (450) flapped on first run.
 */
export function wrapSection(content: string, sectionId: string): string {
  return `<!-- unmissed:${sectionId} -->\n${content}\n<!-- /unmissed:${sectionId} -->`
}

/**
 * Strip all section markers from a prompt before sending to Ultravox.
 * Ultravox doesn't understand HTML comments — they add noise to the context.
 */
export function stripPromptMarkers(prompt: string): string {
  return prompt
    .replace(/<!-- unmissed:\w+ -->\n?/g, '')
    .replace(/<!-- \/unmissed:\w+ -->\n?/g, '')
}

/** Section IDs that clients are allowed to edit via the settings UI. */
export const CLIENT_EDITABLE_SECTIONS = ['identity', 'knowledge', 'after_hours'] as const

/** Section IDs that are locked to admin-only editing. */
export const ADMIN_ONLY_SECTIONS = ['tone', 'flow', 'technical'] as const

/** All 19 sandwich-spec slot IDs (D274). */
export const SLOT_IDS = [
  'safety_preamble', 'forbidden_actions', 'voice_naturalness', 'grammar',
  'identity', 'tone_and_style', 'goal', 'conversation_flow',
  'after_hours', 'escalation_transfer', 'returning_caller', 'inline_examples',
  'call_handling_mode', 'faq_pairs', 'objection_handling', 'knowledge',
  'calendar_booking', 'sms_followup', 'vip_protocol',
] as const

export type SlotId = (typeof SLOT_IDS)[number]

export type SectionId =
  | (typeof CLIENT_EDITABLE_SECTIONS)[number]
  | (typeof ADMIN_ONLY_SECTIONS)[number]
