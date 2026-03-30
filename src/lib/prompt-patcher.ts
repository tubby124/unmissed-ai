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
 * Also injects the transitionToBookingStage trigger when enabling, so existing
 * prompts don't need a full regeneration when booking is toggled on.
 * Returns the patched prompt, or the original if no change needed.
 */
export function patchCalendarBlock(
  prompt: string,
  enabled: boolean,
  serviceType = 'appointment',
  closePerson = 'the team',
): string {
  const hasBlock = prompt.includes(CALENDAR_HEADING)
  const stageTriggerLine = "Once you have confirmed the caller's name AND their service need, call transitionToBookingStage. Do NOT call until both are confirmed."
  const hasStageTrigger = prompt.includes('transitionToBookingStage')

  if (enabled && !hasBlock) {
    // Append calendar block; also prepend stage trigger line if missing
    let patched = prompt.trimEnd() + '\n\n' + calendarBlock(serviceType, closePerson)
    if (!hasStageTrigger) {
      const insertAt = patched.lastIndexOf(CALENDAR_HEADING)
      patched = patched.slice(0, insertAt) + stageTriggerLine + '\n\n' + patched.slice(insertAt)
    }
    return patched
  }

  if (!enabled && hasBlock) {
    // Remove the calendar block: from "# CALENDAR BOOKING FLOW" to the next top-level heading or end
    const startIdx = prompt.indexOf(CALENDAR_HEADING)
    const afterStart = prompt.indexOf('\n#', startIdx + CALENDAR_HEADING.length)
    let patched: string
    if (afterStart === -1) {
      patched = prompt.substring(0, startIdx).trimEnd()
    } else {
      patched = (prompt.substring(0, startIdx) + prompt.substring(afterStart))
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd()
    }
    // Also remove stage trigger line if present
    if (hasStageTrigger) {
      patched = patched.replace(stageTriggerLine + '\n\n', '').replace('\n' + stageTriggerLine, '')
    }
    return patched
  }

  return prompt
}

// ── SMS follow-up block ──────────────────────────────────────────────────────

export const SMS_HEADING = '# SMS FOLLOW-UP'

/**
 * Build the standalone SMS follow-up instruction block.
 * Returns mode-appropriate instructions — different agent modes have different SMS behaviors.
 * NOTE: Does NOT claim VoIP detection — that capability is not implemented.
 */
export function getSmsBlock(agentMode?: string | null): string {
  switch (agentMode) {
    case 'voicemail_replacement':
      return `# SMS FOLLOW-UP

After collecting the caller's name, phone, and message:
1. Call sendTextMessage in the SAME turn as your closing line to confirm receipt.
2. Keep the text brief: confirm you received their message and that someone will call back.
3. Do not ask for permission. Only send if the caller has provided a phone number.
The backend handles opt-out compliance automatically.`

    case 'appointment_booking':
      return `# SMS FOLLOW-UP

After confirming a booking:
1. Call sendTextMessage in the SAME turn as your closing confirmation.
2. Include the appointment date, time, and service in the text.
3. Do not ask for permission. Only send if the caller has provided a phone number.
The backend handles opt-out compliance automatically.`

    case 'info_hub':
      return `# SMS FOLLOW-UP

If the caller asks for written information or a summary of key details discussed:
1. Call sendTextMessage with the relevant info before hanging up.
2. Do not offer to send a text unless the caller explicitly requests it.
3. Only send if the caller has provided a phone number.
The backend handles opt-out compliance automatically.`

    case 'lead_capture':
    default:
      return `# SMS FOLLOW-UP

After collecting the caller's information (name and reason for calling), and before hanging up:
1. Call sendTextMessage in the SAME turn as your closing line.
2. Do not ask for permission. Do not describe the text contents.
3. Only send if the caller has provided a phone number.
The backend handles opt-out compliance automatically.`
  }
}

/**
 * Patch a system prompt to add, remove, or refresh the SMS FOLLOW-UP block.
 * - enabled + no block → append mode-appropriate block
 * - enabled + block exists + agentMode → replace block with mode-appropriate version
 * - enabled + block exists + no agentMode → no-op (preserve existing block)
 * - disabled + block exists → remove block
 */
export function patchSmsBlock(prompt: string, enabled: boolean, agentMode?: string | null): string {
  const hasBlock = prompt.includes(SMS_HEADING)

  if (enabled && !hasBlock) {
    return prompt.trimEnd() + '\n\n' + getSmsBlock(agentMode)
  }

  if (enabled && hasBlock && agentMode != null) {
    // Replace existing block with mode-appropriate version (handles mode change while SMS stays on)
    const startIdx = prompt.indexOf(SMS_HEADING)
    const afterStart = prompt.indexOf('\n#', startIdx + SMS_HEADING.length)
    const withoutBlock = afterStart === -1
      ? prompt.substring(0, startIdx).trimEnd()
      : (prompt.substring(0, startIdx) + prompt.substring(afterStart)).replace(/\n{3,}/g, '\n\n').trimEnd()
    return withoutBlock + '\n\n' + getSmsBlock(agentMode)
  }

  if (!enabled && hasBlock) {
    const startIdx = prompt.indexOf(SMS_HEADING)
    const afterStart = prompt.indexOf('\n#', startIdx + SMS_HEADING.length)
    if (afterStart === -1) {
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

/** Mode instruction text — shared with prompt-builder.ts. */
export const MODE_INSTRUCTIONS: Record<string, string> = {
  // call_handling_mode values (customer-facing product tier)
  message_only:
    "Your ONLY goal is to collect the caller's name, phone number, and a brief message. Do not ask follow-up questions, do not triage, do not offer information. Get the 3 fields and close.",
  full_service:
    "You are a full-service receptionist. Answer detailed questions from the KNOWLEDGE BASE and FAQ sections. If the caller wants to book an appointment, collect their preferred date/time and confirm you'll have {{CLOSE_PERSON}} confirm the booking.",
  triage:
    "Use the triage script below to understand what the caller needs, collect relevant info, and route to callback.",
  // agent_mode values (internal conversational behavior profile)
  voicemail_replacement:
    "Your primary goal is to act as a voicemail. Greet briefly and collect name, phone number, and a brief message — one question at a time, each response under 15 words. If asked about services or hours, give a one-sentence answer from the KNOWLEDGE BASE, then redirect: 'let me grab your info and have them call you back.' Close the call the moment you have name, phone, and message. Do not triage, diagnose, or extend the conversation.",
  lead_capture:
    "Use the triage script below to understand what the caller needs, collect relevant info, and route to callback.",
  info_hub:
    "You are an information assistant. When the caller asks a question, answer it directly and completely from the KNOWLEDGE BASE — do not ask for contact info first. After answering, ask 'Is there anything else I can help with?' Only ask for name and phone after you have answered their questions, or if they want follow-up.",
  appointment_booking:
    "You are a booking assistant. Your primary goal is to schedule an appointment on this call. Open with: 'I can check availability and book you right now — what service were you looking for?' Once you have the service and a time preference, call checkCalendarAvailability immediately. Offer the first available option, confirm it, then collect name and phone. Never end the call without a confirmed booking or at minimum a specific date and time captured.",
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
  newMode: string,
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
  if (instruction.includes('{{CLOSE_PERSON}}')) {
    instruction = instruction.replace('{{CLOSE_PERSON}}', closePerson || 'the team')
  }

  return (
    prompt.substring(0, headingIdx) +
    heading + '\n' + instruction + '\n\n' +
    prompt.substring(sectionEnd).trimStart()
  ).replace(/\n{3,}/g, '\n\n').trimEnd()
}

// ── VIP caller protocol patcher ──────────────────────────────────────────────

export const VIP_HEADING = '# VIP CALLER PROTOCOL'

/**
 * Build the standalone VIP caller protocol block.
 * Instructs the agent how to handle callers identified as VIPs via callerContext injection.
 */
export function getVipBlock(): string {
  return `# VIP CALLER PROTOCOL
When callerContext includes a "VIP CONTACTS:" line, these are the owner's priority contacts.
When callerContext includes a "VIP CALLER:" line, the current caller is one of these priority contacts.

For VIP callers:
1. Greet them warmly by first name immediately: "Hi [Name]! Great to hear from you."
2. Treat their request as highest priority — do not make them wait or repeat information.
3. If "Transfer: enabled" appears in the VIP CALLER line, offer to connect them to the owner directly. Use transferCall if available.
4. If the transfer is unavailable or they prefer a callback, call pageOwner to send an urgent alert SMS to the owner.
5. Never treat a VIP like a cold caller. Reference their relationship naturally if helpful.
6. If pageOwner is not available (not a Pro plan feature), take a thorough message and promise the owner will be personally notified.`
}

/**
 * Patch a system prompt to add or remove the VIP CALLER PROTOCOL block.
 * Idempotent: calling twice with the same args produces no change.
 * Returns the patched prompt, or the original if no change needed.
 */
/**
 * Patch a system prompt when business hours change.
 * Replaces all literal occurrences of the old hours text with the new hours text.
 * Fixes the baked-in HOURS/LOCATION scripted responses and after-hours instruction
 * that were generated at provision time via {{HOURS_WEEKDAY}} variable substitution.
 *
 * Returns the patched prompt, or the original if no change needed.
 */
export function patchHoursWeekday(
  prompt: string,
  oldHours: string,
  newHours: string,
): string {
  if (!oldHours?.trim() || !newHours?.trim() || oldHours === newHours) return prompt
  return prompt.split(oldHours).join(newHours)
}

export function patchVipSection(prompt: string, enabled: boolean): string {
  const hasSection = prompt.includes(VIP_HEADING)

  if (enabled && !hasSection) {
    return prompt.trimEnd() + '\n\n' + getVipBlock()
  }

  if (!enabled && hasSection) {
    const startIdx = prompt.indexOf(VIP_HEADING)
    const afterStart = prompt.indexOf('\n#', startIdx + VIP_HEADING.length)
    if (afterStart === -1) {
      return prompt.substring(0, startIdx).trimEnd()
    }
    return (prompt.substring(0, startIdx) + prompt.substring(afterStart))
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()
  }

  return prompt
}
