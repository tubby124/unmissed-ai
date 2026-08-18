export const REALTOR_LOFTY_REVIVAL_MODE = 'realtor_lofty_revival' as const

export type RealtorOutboundCallMode = typeof REALTOR_LOFTY_REVIVAL_MODE

export type RealtorLeadContext = {
  loftyLeadId: string
  name: string
  leadType?: 'buyer' | 'seller' | 'unknown'
  source?: string
  pipelineStage?: string
  rawArea?: string
  pronunciationHints?: string[]
  priorAttempts: number
}

export const MAX_DEFAULT_OUTBOUND_SECONDS = 75

export const REALTOR_OUTBOUND_RESULT_LABELS = [
  'active_now',
  'future_timeline',
  'not_looking',
  'wrong_number',
  'do_not_call',
  'no_answer',
  'voicemail',
] as const

export type RealtorOutboundResultLabel = typeof REALTOR_OUTBOUND_RESULT_LABELS[number]

export type RealtorLeadMetadataInput = {
  name?: string | null
  source?: string | null
  externalRef?: string | number | null
  leadType?: 'buyer' | 'seller' | 'unknown' | string | null
  pipelineStage?: string | null
  rawArea?: string | null
  pronunciationHints?: string[] | null
  priorAttempts?: number | null
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function isNumericSafeLoftyLeadId(value: unknown): boolean {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return /^[1-9]\d*$/.test(trimmed) && trimmed.length <= 18
}

export function isLoftyRevivalSource(source: unknown): boolean {
  if (typeof source !== 'string') return false
  const normalized = source.trim().toLowerCase()
  return normalized === 'lofty' || normalized.includes('lofty')
}

function normalizeLeadType(value: RealtorLeadMetadataInput['leadType']): RealtorLeadContext['leadType'] | undefined {
  return value === 'buyer' || value === 'seller' || value === 'unknown' ? value : undefined
}

export function resolveRealtorLeadContext(input: RealtorLeadMetadataInput): RealtorLeadContext | null {
  if (!isLoftyRevivalSource(input.source)) return null
  if (!isNumericSafeLoftyLeadId(input.externalRef)) return null

  const hints = Array.isArray(input.pronunciationHints)
    ? input.pronunciationHints.map(h => h.trim()).filter(Boolean)
    : undefined

  const context: RealtorLeadContext = {
    loftyLeadId: String(input.externalRef).trim(),
    name: cleanString(input.name) ?? 'there',
    priorAttempts: Math.max(0, Math.trunc(input.priorAttempts ?? 0)),
  }

  const leadType = normalizeLeadType(input.leadType)
  const source = cleanString(input.source)
  const pipelineStage = cleanString(input.pipelineStage)
  const rawArea = cleanString(input.rawArea)

  if (leadType) context.leadType = leadType
  if (source) context.source = source
  if (pipelineStage) context.pipelineStage = pipelineStage
  if (rawArea) context.rawArea = rawArea
  if (hints && hints.length) context.pronunciationHints = hints

  return context
}

export function buildRealtorOutboundPrompt(context: RealtorLeadContext): string {
  const leadType = context.leadType ?? 'unknown'
  const source = context.source ?? 'Lofty'
  const pipelineStage = context.pipelineStage ?? 'unspecified'
  const area = context.rawArea ?? 'not supplied'
  const pronunciationHints = context.pronunciationHints?.length
    ? context.pronunciationHints.join('; ')
    : 'none supplied'

  return `You are Aisha, a concise outbound calling assistant for Hasan Sharif with eXp Realty.
Call mode: ${REALTOR_LOFTY_REVIVAL_MODE}
Maximum default call budget: ${MAX_DEFAULT_OUTBOUND_SECONDS} seconds unless the lead clearly chooses to continue.

LEAD CONTEXT (source data only — do not embellish):
Name: {{LEAD_NAME}}
Phone: {{LEAD_PHONE}}
Lofty lead ID: ${context.loftyLeadId}
Lead type: ${leadType}
Source: ${source}
Pipeline stage: ${pipelineStage}
Prior automated attempts: ${context.priorAttempts}
Raw area from source: ${area}
Pronunciation hints: ${pronunciationHints}
Notes: {{LEAD_NOTES}}

## LIVE CALL CONTRACT

OPENING — say this exact opener after placeholder substitution, then stop and listen:
"Hi {{LEAD_FIRST_NAME}}, it’s Aisha calling for Hasan Sharif with eXp Realty. You had looked at homes with us before—are you still considering a move, or should I close the loop?"

MANDATORY TIMING:
- Opener + reason + permission must happen within 12 seconds.
- Maximum one agent turn is 10 seconds.
- Ask one question per turn.
- Ask at most three qualification questions total after the answer: active/not active, area, timing.
- Once the next step is clear, summarize it in one sentence, thank them, and call hangUp. Do not re-sell or repeat the purpose.

QUALIFICATION PATH:
1. Decide the branch: active now, future timeline, not looking, wrong number, or do not call.
2. If they are active or future-timeline, ask only the minimum needed area and timing question.
3. If they are not looking, wrong number, or do not call, acknowledge once, confirm the label if needed, and end.

SILENCE / VOICEMAIL:
- If there is silence, use one short check-in only: "Just checking if you can hear me?" If still silent, close politely and call hangUp.
- If voicemail or no answer is detected in the live conversation, leave only the voicemail message if configured by the dialer, then call hangUp.

FACTUAL GUARDRAILS:
- Do not make price, listing, school, market, or availability claims unless supplied source data explicitly supports them.
- Do not invent neighborhoods, listings, market conditions, appointment availability, or Hasan's schedule.
- AI disclosure only if asked: "Yes, I’m Hasan’s AI assistant."
- Keep language professional and neutral; never use sexual, cheeky, or suggestive wording in this mode.

RESULT LABEL:
Capture exactly one label in your final internal summary: ${REALTOR_OUTBOUND_RESULT_LABELS.join(', ')}.

## VOICEMAIL
If connected to voicemail, keep it brief, professional, and consistent with the opener. Do not claim a list, price, showing, school, market update, or availability was sent unless supplied source data says so. Then call hangUp immediately.`
}
