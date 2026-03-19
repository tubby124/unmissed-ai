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

/**
 * Replace the content of a named section in a stored prompt.
 * If the section marker doesn't exist, the section is appended to the end.
 */
export function replacePromptSection(prompt: string, sectionId: string, newContent: string): string {
  const marker    = `<!-- unmissed:${sectionId} -->`
  const endMarker = `<!-- /unmissed:${sectionId} -->`
  const re = new RegExp(`<!-- unmissed:${sectionId} -->[\\s\\S]*?<!-- \\/unmissed:${sectionId} -->`)
  const replacement = `${marker}\n${newContent}\n${endMarker}`
  if (re.test(prompt)) {
    return prompt.replace(re, replacement)
  }
  // Section not found — append it
  return `${prompt}\n\n${replacement}`
}

/**
 * Wrap a chunk of text in a named section marker.
 * Used by prompt-builder to mark sections at provisioning time.
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

export type SectionId =
  | (typeof CLIENT_EDITABLE_SECTIONS)[number]
  | (typeof ADMIN_ONLY_SECTIONS)[number]
