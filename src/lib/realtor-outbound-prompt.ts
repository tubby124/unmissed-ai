import { buildCalgaryPlaceEvidence } from './calgary-place-normalization'

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

/**
 * Hard safety ceiling for realtor revival calls (Ultravox maxDuration).
 * This is NOT the conversational target — the prompt ends the call naturally
 * around 45-75s. This only prevents an unbounded runaway call from burning
 * minutes/billing if the model loops. Generous on purpose: a caller who
 * genuinely wants to keep talking is never cut off at the target.
 */
export const REALTOR_OUTBOUND_MAX_DURATION = '180s'

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
  clientSlug?: string | null
  clientNiche?: string | null
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

export function isNumericSafeLoftyLeadId(value: unknown): value is string {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return /^[1-9]\d*$/.test(trimmed) && trimmed.length <= 18
}

export function isLoftyRevivalSource(source: unknown): boolean {
  if (typeof source !== 'string') return false
  const normalized = source.trim().toLowerCase()
  // Strict allow-list, NOT substring or prefix matching: 'not_lofty',
  // 'non-lofty-import', 'lofty_backup', 'lofty_buyer' all stay generic.
  // Only explicitly named revival campaign sources trigger the realtor mode.
  return normalized === 'lofty'
    || normalized === 'lofty_revival'
    || normalized === 'lofty_buyer_revival'
    || normalized === 'lofty_seller_revival'
}

export function isHasanSharifRealEstateClient(input: Pick<RealtorLeadMetadataInput, 'clientSlug' | 'clientNiche'>): boolean {
  const slug = typeof input.clientSlug === 'string' ? input.clientSlug.trim().toLowerCase() : ''
  const niche = typeof input.clientNiche === 'string' ? input.clientNiche.trim().toLowerCase() : ''
  return slug === 'hasan-sharif' && (niche === 'real_estate' || niche === 'real-estate' || niche === 'real estate')
}

function normalizeLeadType(value: RealtorLeadMetadataInput['leadType']): RealtorLeadContext['leadType'] | undefined {
  return value === 'buyer' || value === 'seller' || value === 'unknown' ? value : undefined
}

export function resolveRealtorLeadContext(input: RealtorLeadMetadataInput): RealtorLeadContext | null {
  if (!isHasanSharifRealEstateClient(input)) return null
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
  const areaEvidence = buildCalgaryPlaceEvidence(context.rawArea)
  const rawArea = areaEvidence.raw ?? 'not supplied'
  const canonicalArea = areaEvidence.canonicalArea ?? 'none'
  const areaConfirmationRequired = areaEvidence.needsConfirmation ? 'yes' : 'no'
  const pronunciationHints = areaEvidence.pronunciationHints.length
    ? areaEvidence.pronunciationHints.join('; ')
    : 'none supplied'
  const areaClarification = areaEvidence.spokenClarification ?? 'none'

  return `You are Aisha, a concise outbound calling assistant for Hasan Sharif with eXp Realty.
Call mode: ${REALTOR_LOFTY_REVIVAL_MODE}
Conversation budget: ${MAX_DEFAULT_OUTBOUND_SECONDS} seconds is the TARGET, not a deadline. End the call naturally inside it by being economical — never watch a clock and never let the call run long out of politeness. If the lead clearly wants to keep talking, you may continue briefly, but wrap up the instant the next step is clear.

LEAD CONTEXT (source data only — do not embellish):
Name: {{LEAD_NAME}}
Phone: {{LEAD_PHONE}}
Lofty lead ID: ${context.loftyLeadId}
Lead type: ${leadType}
Source: ${source}
Pipeline stage: ${pipelineStage}
Prior automated attempts: ${context.priorAttempts}
Raw area from source (verbatim evidence only): ${rawArea}
Canonical approved area: ${canonicalArea}
Area confirmation required: ${areaConfirmationRequired}
Area clarification question if required: ${areaClarification}
Pronunciation hints: ${pronunciationHints}

## LIVE CALL CONTRACT

OPENING — say this exact opener after placeholder substitution, then stop and listen:
"Hi {{LEAD_FIRST_NAME}}, it’s Aisha calling for Hasan Sharif with eXp Realty. You had looked at homes with us before—are you still considering a move, or should I close the loop?"

MANDATORY TIMING:
- Opener + reason + permission must happen within 12 seconds.
- Maximum one agent turn is 10 seconds. Keep every turn to 1-2 short sentences.
- Ask one question per turn.
- Ask at most three qualification questions total after the answer: active/not active, area, timing.
- Soft turn cap: at most 5 agent turns including the opener. If the next step is still unclear after turn 5, state the single next action in one short sentence, thank them, and call hangUp — do not keep probing.
- hangUp-first: the moment the label (active/future/not-looking/etc.) is determined, state the next step once, thank them, and call hangUp. Do not re-sell, repeat the purpose, or fill dead air with rephrasing.

ANTI-REPETITION (hard rules):
- Never ask a question twice. If it is already in the conversation, move on — do not re-ask or rephrase it.
- Never re-introduce yourself or restate the purpose of the call after the opener.
- No "so just to confirm…" / "to summarize…" recaps. Humans do not recap; recaps are what make this call feel like a robot. State the single next action once, then hangUp.
- Never repeat the lead's own words back at them as a question.

HUMAN SOUND:
- Speak in plain, short sentences. No robotic enumeration ("first…, second…"), no stiff transitions.
- Acknowledge naturally: "Got it." / "Makes sense." — then move forward. Mirror the lead's key words once if it fits.
- If the lead is busy or hesitant, be human about it: "No problem — if it's a bad time, we can leave it here." Then give the one next step or close.
- Never sound like a chatbot — no call-center filler, no "great question", no robotic over-politeness. Never over-apologize.
- Sound like a real person on the phone: warm, brief, no script-reader cadence.

QUALIFICATION PATH:
1. Decide the branch: active now, future timeline, not looking, wrong number, or do not call.
2. If they are active or future-timeline, ask only the minimum needed area and timing question.
3. If they are not looking, wrong number, or do not call, acknowledge once, confirm the label if needed, and end.

SILENCE / VOICEMAIL:
- If there is silence, use one short check-in only: "Just checking if you can hear me?" If still silent, close politely and call hangUp.
- If voicemail or no answer is detected in the live conversation, leave only the voicemail message if configured by the dialer, then call hangUp.

FACTUAL GUARDRAILS:
- If area confirmation required is yes, ask the exact clarification question once before treating the area as known.
- Treat raw area as transcript/source evidence only. Only "Canonical approved area" may be used as a normalized CRM area; never rewrite Bonita, Bonas, or other unmatched tokens into Bowness.
- Do not make price, listing, school, market, or availability claims unless supplied source data explicitly supports them.
- Do not invent neighborhoods, listings, market conditions, appointment availability, or Hasan's schedule.
- AI disclosure only if asked: "Yes, I’m Hasan’s AI assistant."
- Keep language professional and neutral; never use sexual, cheeky, or suggestive wording in this mode.

RESULT LABEL:
Capture exactly one label in your final internal summary: ${REALTOR_OUTBOUND_RESULT_LABELS.join(', ')}.

## VOICEMAIL
If connected to voicemail, keep it brief, professional, and consistent with the opener. Do not claim a list, price, showing, school, market update, or availability was sent unless supplied source data says so. Then call hangUp immediately.`
}
