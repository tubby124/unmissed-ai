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
 * Find and replace the VOICE STYLE / TONE AND STYLE section in a stored prompt.
 *
 * Handles both formats found in live prompts:
 *   - "VOICE STYLE\n..." (hand-crafted, no # prefix)
 *   - "# TONE AND STYLE\n..." (template-generated, with # prefix)
 *
 * The section runs from the header line until the next all-caps heading or # heading.
 * Returns the original prompt unchanged if no voice/tone section is found.
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

  return (
    prompt.substring(0, headerStart) +
    replacement +
    '\n\n' +
    prompt.substring(sectionEnd).trimStart()
  ).replace(/\n{3,}/g, '\n\n').trimEnd()
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
