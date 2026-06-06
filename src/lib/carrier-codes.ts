/**
 * Canadian wireless conditional call-forwarding codes.
 *
 * All Canadian carriers (Rogers, Bell, Telus, Fido, Koodo, Virgin, Freedom,
 * Public Mobile, Chatr, Lucky, PC Mobile, Videotron) honour the standard
 * 3GPP/GSM per-condition codes below. We register all three so the user's
 * phone rings first, then forwards to the AI only when:
 *   - they don't answer (CFNRy — *61)
 *   - their line is busy (CFB    — *67)
 *   - phone is off / no signal (CFNRc — *62)
 *
 * This is "conditional forwarding" — NOT unconditional (`*21*` / `*72`),
 * which would send every call straight to the AI even when the user could
 * have picked up. We never want that for voicemail-replacement.
 *
 * Hard rule (Rogers official, applies to all carriers): carrier voicemail
 * must be FULLY REMOVED at the carrier level — not just paused — or it
 * intercepts the call before the conditional forward can fire.
 * Ref: https://www.rogers.com/customer/support/article/what-are-the-codes-for-call-forwarding-for-my-wireless-device
 *
 * Verified 2026-06-05 against carrier-official sources:
 *   - Rogers wireless: https://www.rogers.com/customer/support/article/what-are-the-codes-for-call-forwarding-for-my-wireless-device
 *   - Telus mobile:    https://www.telus.com/en/support/article/call-forward-mobile
 *   - Fido:            https://www.fido.ca/support/mobility/call-forwarding
 *   - Bell:            SmartTouch / community confirmation of GSM compatibility
 */

export interface CarrierConditionCode {
  /** Plain-English label shown to the user */
  label: string
  /** One-line description like "Forwards when you don't pick up" */
  desc: string
  /** Enable code with `{number}` placeholder for the Twilio destination */
  enable: string
  /** Disable code (no placeholder) */
  disable: string
}

export interface CarrierEntry {
  name: string
  /** Three conditional codes — register all three for full voicemail replacement */
  conditions: {
    noAnswer: CarrierConditionCode
    busy: CarrierConditionCode
    unreachable: CarrierConditionCode
  }
  /** Optional carrier-specific note shown above the codes */
  note?: string
}

const GSM_NO_ANSWER: CarrierConditionCode = {
  label: 'No answer',
  desc: "Forwards when you don't pick up",
  enable: '*61*{number}#',
  disable: '##61#',
}

const GSM_BUSY: CarrierConditionCode = {
  label: 'Busy',
  desc: 'Forwards when your line is already in use',
  enable: '*67*{number}#',
  disable: '##67#',
}

const GSM_UNREACHABLE: CarrierConditionCode = {
  label: 'Unreachable',
  desc: 'Forwards when your phone is off or has no signal',
  enable: '*62*{number}#',
  disable: '##62#',
}

const GSM_CONDITIONS = {
  noAnswer: GSM_NO_ANSWER,
  busy: GSM_BUSY,
  unreachable: GSM_UNREACHABLE,
} as const

export const CARRIER_CODES: Record<string, CarrierEntry> = {
  rogers:  { name: 'Rogers',           conditions: GSM_CONDITIONS },
  fido:    { name: 'Fido',             conditions: GSM_CONDITIONS },
  chatr:   { name: 'Chatr',            conditions: GSM_CONDITIONS },
  bell:    { name: 'Bell',             conditions: GSM_CONDITIONS },
  virgin:  { name: 'Virgin Plus',      conditions: GSM_CONDITIONS },
  lucky:   { name: 'Lucky Mobile',     conditions: GSM_CONDITIONS },
  telus:   { name: 'Telus',            conditions: GSM_CONDITIONS },
  koodo:   { name: 'Koodo',            conditions: GSM_CONDITIONS },
  public:  { name: 'Public Mobile',    conditions: GSM_CONDITIONS },
  freedom: { name: 'Freedom Mobile',   conditions: GSM_CONDITIONS },
  other: {
    name: 'Other / not sure',
    conditions: GSM_CONDITIONS,
    note: "If these standard codes don't work on your carrier, contact their support and ask them to enable conditional call forwarding (no-answer, busy, and unreachable) to your AI number.",
  },
}

export type CarrierKey = keyof typeof CARRIER_CODES

/** Helper: substitute the destination number into an enable code. Strips a leading + from E.164. */
export function fillEnableCode(template: string, twilioNumber: string): string {
  const digits = twilioNumber.startsWith('+') ? twilioNumber.slice(1) : twilioNumber
  return template.replace('{number}', digits)
}
