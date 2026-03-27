/**
 * prompt-patcher.ts — Post-generation prompt patching for feature toggles.
 *
 * When a client enables a feature (calendar, transfer, SMS) AFTER their prompt
 * was initially generated, the tools get injected via updateAgent() but the
 * system_prompt text lacks the corresponding instructions. This module patches
 * the stored system_prompt to add/remove instruction blocks.
 *
 * Used by: settings PATCH handler, Google OAuth callback.
 */

// ── Calendar booking block ──────────────────────────────────────────────────

const CALENDAR_HEADING = '# CALENDAR BOOKING FLOW'

/**
 * Build the standalone calendar booking flow block.
 * Matches the output of buildCalendarBlock() in prompt-builder.ts.
 */
function calendarBlock(serviceType: string, closePerson: string): string {
  return `# CALENDAR BOOKING FLOW

Use this when a caller wants to book a ${serviceType} directly on the call.

Step 1 — Ask what day works: "what day were you thinking?"
Step 2 — Check slots: say "one sec, let me pull that up..." in that SAME turn, then call checkCalendarAvailability with date in YYYY-MM-DD format. Use TODAY from callerContext to resolve "tomorrow", "next Monday", etc.
Step 3 — Read back up to 3 slots: "I've got [time], [time], and [time] — any of those work?"
Step 4 — If name not yet collected: "and your name?"
Step 5 — Book it: say "perfect, booking that now..." in the SAME turn as calling bookAppointment with:
  - date: YYYY-MM-DD
  - time: EXACTLY the displayTime from checkCalendarAvailability (do not reformat)
  - service: "${serviceType}"
  - callerName: caller's name
  - callerPhone: the CALLER PHONE from callerContext — always include this
Step 6 — Confirm and close: "you're booked — [day] at [time]. ${closePerson} will reach out before then!" → hangUp

SLOT TAKEN (booked=false, nextAvailable present): "that one just got taken — the next opening I've got is [nextAvailable]. does that work?"
DAY FULL (available=false or no slots): say "looks like we're full that day — let me check the next one..." then call checkCalendarAvailability for the following day. If also full, fall back to message mode.
TOOL ERROR (fallback=true or no response): fall back to message mode — collect preferred day/time and close as normal.`
}

/**
 * Patch a system prompt to add or remove the CALENDAR BOOKING FLOW block.
 * Returns the patched prompt, or the original if no change needed.
 */
export function patchCalendarBlock(
  prompt: string,
  enabled: boolean,
  serviceType = 'appointment',
  closePerson = 'the team',
): string {
  const hasBlock = prompt.includes(CALENDAR_HEADING)

  if (enabled && !hasBlock) {
    // Append calendar block at the end (before any trailing whitespace)
    return prompt.trimEnd() + '\n\n' + calendarBlock(serviceType, closePerson)
  }

  if (!enabled && hasBlock) {
    // Remove the calendar block: from "# CALENDAR BOOKING FLOW" to the next top-level heading or end
    const startIdx = prompt.indexOf(CALENDAR_HEADING)
    const afterStart = prompt.indexOf('\n#', startIdx + CALENDAR_HEADING.length)
    if (afterStart === -1) {
      // Calendar block is the last section
      return prompt.substring(0, startIdx).trimEnd()
    }
    return (prompt.substring(0, startIdx) + prompt.substring(afterStart))
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()
  }

  return prompt
}

// ── Voice style section patcher ──────────────────────────────────────────────

/**
 * SET-1: Patterns that identify standalone filler instruction lines.
 * These come from the {{FILLER_STYLE}} template variable in the VOICE NATURALNESS
 * section. When a preset is switched, the TONE section gets the new fillerStyle
 * but these standalone lines retain the old preset's instructions — causing
 * contradictions (e.g. "use backchannels" + "avoid backchannels").
 */
const STANDALONE_FILLER_RE = new RegExp(
  [
    // All 4 presets' first filler line patterns
    String.raw`^Start (?:every response|responses) with (?:a (?:quick backchannel|brief acknowledgment|gentle acknowledgment)|an? \w+).*$`,
    String.raw`^Do not start with backchannels or fillers\..*$`,
    // All 4 presets' second filler line patterns
    String.raw`^Use "(?:uh|like)"(?: or "um")? .*$`,
    String.raw`^Avoid "uh",?\s*"um".*$`,
    String.raw`^Never use "uh",?\s*"um".*$`,
    String.raw`^Use brief pauses between thoughts\..*$`,
    // Hand-crafted niche variants
    String.raw`^Use backchannels:.*$`,
    String.raw`^- Start with a backchannel when acknowledging:.*$`,
  ].join('|'),
  'gm',
)

/**
 * Strip standalone filler instruction lines that live outside the TONE section.
 * After stripping, collapse any resulting blank-line runs to max 2 newlines.
 */
function stripStandaloneFillers(prompt: string, toneStart: number, toneEnd: number): string {
  // Only strip lines OUTSIDE the TONE section boundaries
  const before = prompt.substring(0, toneStart)
  const toneSection = prompt.substring(toneStart, toneEnd)
  const after = prompt.substring(toneEnd)

  const strip = (text: string) =>
    text.replace(STANDALONE_FILLER_RE, '').replace(/\n{3,}/g, '\n\n')

  return strip(before) + toneSection + strip(after)
}

/**
 * Find and replace the VOICE STYLE / TONE AND STYLE section in a stored prompt.
 *
 * Handles both formats found in live prompts:
 *   - "VOICE STYLE\n..." (hand-crafted, no # prefix)
 *   - "# TONE AND STYLE\n..." (template-generated, with # prefix)
 *
 * The section runs from the header line until the next all-caps heading or # heading.
 * Returns the original prompt unchanged if no voice/tone section is found.
 *
 * SET-1: Also strips standalone filler instructions outside the TONE section
 * to prevent contradictions when switching between voice presets.
 */
export function patchVoiceStyleSection(
  prompt: string,
  toneStyleBlock: string,
  fillerStyle: string,
): string {
  // Match the section header: optional "#" prefix, then VOICE STYLE or TONE AND STYLE
  const headerRe = /^(#+ *)?(?:VOICE STYLE|TONE AND STYLE|TONE & STYLE)\s*$/im
  const headerMatch = prompt.match(headerRe)
  if (!headerMatch) return prompt

  const headerStart = prompt.indexOf(headerMatch[0])
  const afterHeader = headerStart + headerMatch[0].length

  // Find the end: next heading (# or ALL-CAPS line that isn't a bullet/quote)
  const rest = prompt.slice(afterHeader)
  const nextHeadingRe = /^(?:#+\s+\S|[A-Z][A-Z ]{2,}[A-Z]$)/m
  const nextMatch = rest.match(nextHeadingRe)

  let sectionEnd: number
  if (nextMatch && nextMatch.index !== undefined) {
    sectionEnd = afterHeader + nextMatch.index
  } else {
    sectionEnd = prompt.length
  }

  // Preserve the original header text (keep whatever format the prompt uses)
  const header = headerMatch[0]
  const replacement = `${header}\n${toneStyleBlock}\n${fillerStyle}`

  let result = (
    prompt.substring(0, headerStart) +
    replacement +
    '\n\n' +
    prompt.substring(sectionEnd).trimStart()
  ).replace(/\n{3,}/g, '\n\n').trimEnd()

  // SET-1: Strip standalone filler lines outside the new TONE section
  // to eliminate contradictions (e.g. old "use backchannels" vs new "avoid backchannels")
  const newToneStart = headerStart
  const newToneEnd = headerStart + replacement.length
  result = stripStandaloneFillers(result, newToneStart, newToneEnd)

  return result.replace(/\n{3,}/g, '\n\n').trimEnd()
}

// ── Agent name patcher ──────────────────────────────────────────────────────

/**
 * Replace all occurrences of the old agent name with the new name in the prompt.
 *
 * Uses word-boundary matching so "Mark" doesn't match "Marketing" or "Bookmark".
 * Returns the original prompt unchanged if oldName equals newName (case-insensitive)
 * or if no occurrences are found.
 */
export function patchAgentName(
  prompt: string,
  oldName: string,
  newName: string,
): string {
  if (!oldName || !newName) return prompt
  if (oldName.trim().toLowerCase() === newName.trim().toLowerCase()) return prompt

  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'g')
  return prompt.replace(re, newName.trim())
}

// ── Business name patcher ───────────────────────────────────────────────────

/**
 * Replace all occurrences of the old business name with the new name in the prompt.
 *
 * Uses word-boundary matching (same pattern as patchAgentName) to avoid partial
 * replacements. Correctly handles quoted names (e.g. "Old Name" → "New Name")
 * because `"` is a non-word character that forms a natural word boundary.
 *
 * Returns the original prompt unchanged if oldName equals newName (case-insensitive)
 * or if no occurrences are found.
 */
export function patchBusinessName(
  prompt: string,
  oldName: string,
  newName: string,
): string {
  if (!oldName || !newName) return prompt
  if (oldName.trim().toLowerCase() === newName.trim().toLowerCase()) return prompt

  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'g')
  return prompt.replace(re, newName.trim())
}

// ── Services offered patcher ─────────────────────────────────────────────────

/**
 * Patch the "What services do you offer?" answer line in the PRODUCT KNOWLEDGE BASE.
 *
 * Targets the exact Q&A line generated by the prompt template:
 *   **What services do you offer?** "{{SERVICES_OFFERED}}"
 *
 * Only replaces the quoted answer value — does not touch any other part of the prompt.
 * Returns the original prompt unchanged if the pattern is not found (safe no-op for
 * hand-crafted prompts that don't use this exact Q&A line).
 */
export function patchServicesOffered(
  prompt: string,
  newServices: string,
): string {
  if (!newServices?.trim()) return prompt
  const re = /(\*\*What services do you offer\?\*\*\s*)"([^"]*)"/i
  if (!re.test(prompt)) return prompt
  return prompt.replace(re, `$1"${newServices.trim()}"`)
}

// ── Service type lookup ─────────────────────────────────────────────────────

const NICHE_SERVICE_TYPES: Record<string, string> = {
  auto_glass: 'service appointment',
  'auto-glass': 'service appointment',
  plumbing: 'service call',
  hvac: 'service call',
  electrical: 'service call',
  dental: 'appointment',
  real_estate: 'consultation',
  property_mgmt: 'appointment',
  'property-management': 'appointment',
  salon: 'appointment',
  restaurant: 'reservation',
  other: 'appointment',
}

/**
 * Get the service appointment type for a niche.
 */
export function getServiceType(niche: string | null | undefined): string {
  if (!niche) return 'appointment'
  return NICHE_SERVICE_TYPES[niche] || 'appointment'
}

/**
 * Extract closePerson from a prompt by looking for common patterns.
 * Falls back to the provided agent_name or "the team".
 */
export function getClosePerson(
  prompt: string,
  agentName?: string | null,
): string {
  // Try to find CLOSE_PERSON in the prompt text (e.g. "i'll get Mark to call ya back")
  const closeMatch = prompt.match(/i['\u2018\u2019']ll get (\w+) to call/i)
  if (closeMatch?.[1]) return closeMatch[1]

  // Try to find owner name from real_estate template (e.g. "You are Fatema, Omar's assistant")
  const reMatch = prompt.match(/You are \w+, (\w+)(?:'s|'s|\u2019s) assistant/i)
  if (reMatch?.[1]) return reMatch[1]

  // Try CLOSE_PERSON from template (e.g. "{{CLOSE_PERSON}}" already replaced)
  const identityMatch = prompt.match(/assistant at .+?\. You work/)
  if (identityMatch && agentName) return agentName

  return agentName || 'the team'
}

// ── Call handling mode patcher ──────────────────────────────────────────────

/** Mode instruction text — shared with prompt-builder.ts (lines 2142-2149). */
export const MODE_INSTRUCTIONS: Record<string, string> = {
  message_only:
    "Your ONLY goal is to collect the caller's name, phone number, and a brief message. Do not ask follow-up questions, do not triage, do not offer information. Get the 3 fields and close.",
  full_service:
    "You are a full-service receptionist. Answer detailed questions from the KNOWLEDGE BASE and FAQ sections. If the caller wants to book an appointment, collect their preferred date/time and confirm you'll have {{CLOSE_PERSON}} confirm the booking.",
  triage:
    "Use the triage script below to understand what the caller needs, collect relevant info, and route to callback.",
}

/**
 * Patch the ## CALL HANDLING MODE section in a stored prompt.
 *
 * Finds the heading and replaces its content until the next ## heading or end.
 * For full_service mode, replaces {{CLOSE_PERSON}} with the provided closePerson.
 * Returns the original prompt unchanged if the heading is not found.
 */
export function patchCallHandlingMode(
  prompt: string,
  newMode: 'message_only' | 'triage' | 'full_service',
  closePerson?: string,
): string {
  const heading = '## CALL HANDLING MODE'
  const headingIdx = prompt.indexOf(heading)
  if (headingIdx === -1) return prompt

  const afterHeading = headingIdx + heading.length

  // Find the end: next ## heading or end of string
  const rest = prompt.slice(afterHeading)
  const nextHeadingMatch = rest.match(/^## /m)
  let sectionEnd: number
  if (nextHeadingMatch?.index !== undefined && nextHeadingMatch.index > 0) {
    sectionEnd = afterHeading + nextHeadingMatch.index
  } else {
    // Check for # heading (top-level) as well
    const nextTopMatch = rest.match(/^# /m)
    if (nextTopMatch?.index !== undefined && nextTopMatch.index > 0) {
      sectionEnd = afterHeading + nextTopMatch.index
    } else {
      sectionEnd = prompt.length
    }
  }

  let instruction = MODE_INSTRUCTIONS[newMode] ?? MODE_INSTRUCTIONS.triage
  if (newMode === 'full_service' && closePerson) {
    instruction = instruction.replace('{{CLOSE_PERSON}}', closePerson)
  } else if (newMode === 'full_service') {
    instruction = instruction.replace('{{CLOSE_PERSON}}', 'the team')
  }

  return (
    prompt.substring(0, headingIdx) +
    heading + '\n' + instruction + '\n\n' +
    prompt.substring(sectionEnd).trimStart()
  ).replace(/\n{3,}/g, '\n\n').trimEnd()
}
