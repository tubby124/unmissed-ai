/**
 * No-LLM keyword shortcuts. Cheap and instant — single-word, lowercased,
 * registered keywords map straight to a slash command. Anything else falls
 * through to the LLM assistant.
 *
 * These keep cost predictable and protect Tier 1 latency for the most
 * common questions. Owners shouldn't pay for an LLM round trip when they
 * type "calls".
 */

const KEYWORD_TO_COMMAND: Record<string, string> = {
  calls: '/calls',
  call: '/calls',
  today: '/today',
  missed: '/missed',
  callback: '/missed',
  callbacks: '/missed',
  last: '/lastcall',
  lastcall: '/lastcall',
  minutes: '/minutes',
  minute: '/minutes',
  balance: '/minutes',
  usage: '/minutes',
  help: '/help',
  menu: '/help',
  commands: '/help',
}

export function matchKeywordShortcut(text: string): string | null {
  const trimmed = text.trim().toLowerCase()
  // Single-word match only — multi-word phrases go to the LLM
  if (!/^[a-z]+$/.test(trimmed)) return null
  return KEYWORD_TO_COMMAND[trimmed] ?? null
}
