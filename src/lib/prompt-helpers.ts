// Extracted from prompt-builder.ts by phase2-extract.ts — DO NOT EDIT manually.
// P0.1 Phase D (2026-04-09): buildNicheFaqDefaults + buildPrintShopFaq removed.
// The niche default FAQ auto-injection was causing ~1,865 chars of prompt bloat
// when callers didn't provide caller_faq. Knowledge now flows through pgvector
// (KnowledgeSummary at call-time) or explicit caller_faq only.
// Zero runtime callers remained in src/ at time of removal.

import { MODE_VARIABLE_OVERRIDES } from './prompt-config/mode-overrides'
import { wrapSection } from '@/lib/prompt-sections'

// ── Knowledge base builder ────────────────────────────────────────────────────

export function buildKnowledgeBase(callerFaq: string, _niche: string): string {
  const lines: string[] = []

  if (callerFaq?.trim()) {
    for (const entry of callerFaq.trim().split('\n')) {
      const trimmed = entry.trim()
      if (!trimmed) continue

      let matched = false
      for (const sep of [' — ', ' - ', ': ', '?']) {
        if (trimmed.includes(sep)) {
          const parts = trimmed.split(sep)
          const q = parts[0].trim().replace(/\?$/, '') + '?'
          const a = parts.slice(1).join(sep).trim().replace(/^["']|["']$/g, '')
          lines.push(`**${q}** "${a}"`)
          matched = true
          break
        }
      }
      if (!matched) {
        lines.push(`**Common question:** "${trimmed}"`)
      }
    }
  }

  if (lines.length === 0) {
    lines.push(`**What services do you offer?** "we handle all the usual stuff — i'll have our team call ya back with the specifics."`)
  }

  return lines.join('\n\n')
}

// ── After-hours block builder ─────────────────────────────────────────────────

export function buildAfterHoursBlock(behavior: string, emergencyPhone?: string): string {
  switch (behavior) {
    case 'route_emergency':
      return emergencyPhone
        ? `When callers reach you outside business hours, check if it's urgent. If urgent, tell them to call ${emergencyPhone}. If not urgent, take a message and let them know someone will call back during business hours.`
        : 'When callers reach you outside business hours, check if it\'s urgent. If urgent, route to callback immediately and flag as [URGENT]. If not urgent, take a message and let them know someone will call back during business hours.'
    case 'take_message':
      return 'When callers reach you outside business hours, take a message and let them know someone will call back during business hours.'
    default:
      return ''
  }
}

// ── Calendar booking block (injected when booking_enabled=true) ───────────────

export function buildCalendarBlock(serviceType: string, closePerson: string): string {
  return `
# CALENDAR BOOKING FLOW

Use this when a caller wants to book a ${serviceType} directly on the call.

Step 1 — Ask what day works: "what day were you thinking?"
Step 2 — Check slots: say "one sec, let me pull that up..." in that SAME turn, then call checkCalendarAvailability with date in YYYY-MM-DD format. Use TODAY from callerContext to resolve "tomorrow", "next Monday", etc.
Step 3 — If caller already named a specific time AND that time appears in the slots: skip listing — go straight to "perfect, let me grab that [time] for you..." and proceed to Step 4. Only list up to 3 options when the caller has NOT named a time, or when their requested time is unavailable.
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
TOOL ERROR (fallback=true or no response): fall back to message mode — collect preferred day/time and close as normal.`.trim()
}

// ── Agent-mode variable overrides ────────────────────────────────────────────

export function applyModeVariableOverrides(
  effectiveMode: string,
  variables: Record<string, string>,
): { modeForbiddenExtra: string; modeTriageDeep: string; modeForcesTriageDeep: boolean } {
  const overrides = MODE_VARIABLE_OVERRIDES[effectiveMode]
  if (!overrides) return { modeForbiddenExtra: '', modeTriageDeep: '', modeForcesTriageDeep: false }

  // Variable overrides: only apply when variable is not already set by niche or intake.
  // Modes that redefine call intent (voicemail_replacement, info_hub, appointment_booking) force-override
  // behavioral fields regardless of niche, because mode intent must win over niche collection behavior.
  // lead_capture has no overrides and continues to defer entirely to niche.
  const FORCE_OVERRIDE_FIELDS: Partial<Record<string, ReadonlyArray<string>>> = {
    appointment_booking: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
    voicemail_replacement: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
    info_hub: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
  }
  const forced = FORCE_OVERRIDE_FIELDS[effectiveMode] ?? []
  const varFields = ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'] as const
  for (const field of varFields) {
    if (overrides[field] && (!variables[field] || forced.includes(field))) {
      variables[field] = overrides[field]!
    }
  }

  return {
    modeForbiddenExtra: overrides.FORBIDDEN_EXTRA ?? '',
    modeTriageDeep: overrides.TRIAGE_DEEP ?? '',
    modeForcesTriageDeep: forced.length > 0 && !!overrides.TRIAGE_DEEP,
  }
}

// ── Section wrapper helper ────────────────────────────────────────────────────

export function wrapSectionIfPresent(prompt: string, startHeading: string, endHeading: string | null, sectionId: string): string {
  const startIdx = prompt.indexOf(startHeading)
  if (startIdx === -1) return prompt
  const endIdx = endHeading ? prompt.indexOf(endHeading, startIdx + 1) : -1
  const sectionContent = endIdx !== -1
    ? prompt.slice(startIdx, endIdx).trimEnd()
    : prompt.slice(startIdx).trimEnd()
  const wrapped = wrapSection(sectionContent, sectionId)
  if (endIdx !== -1) {
    return prompt.slice(0, startIdx) + wrapped + '\n\n' + prompt.slice(endIdx)
  }
  return prompt.slice(0, startIdx) + wrapped
}
