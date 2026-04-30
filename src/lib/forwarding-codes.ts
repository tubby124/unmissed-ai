/**
 * Carrier-aware Canadian call-forwarding code builder.
 *
 * Inputs: a Twilio DID (any format with or without +) and an optional carrier
 * key. Returns paste-ready GSM dial codes for all forwarding modes plus the
 * carrier voicemail-removal support number.
 *
 * Used by the /concierge-status skill (and future Go Live wizard, D292) so
 * carrier-specific dial codes never need to be hand-formatted again.
 *
 * Source of truth for codes + support numbers:
 *   ~/.claude/projects/-Users-owner/memory/unmissed-canadian-forwarding-codes.md
 *   ~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md
 *
 * Note on unconditional codes: CARRIER_CODES (in ./carrier-codes) only exposes
 * the 8 carriers used by the Go Live UI. The 3 extra carrier values stored in
 * clients.carrier (rogers_business, sasktel, public_mobile) are mapped to the
 * correct GSM family below so unconditional codes resolve correctly. Combo and
 * conditional codes are universal GSM and never depend on the carrier.
 */

import { CARRIER_CODES, type CarrierKey } from './carrier-codes'

export type ConciergeCarrierKey =
  | CarrierKey
  | 'rogers_business'
  | 'sasktel'
  | 'public_mobile'

export type ForwardingCodes = {
  did: string                       // normalized digits-only, e.g. "13069887699"
  combo: string                     // **004*1<DID># — recommended default
  comboCancel: string               // ##004#
  conditional: {
    busy: string                    // *67*1<DID>#
    unreachable: string             // *62*1<DID>#
    noAnswer: string                // *61*1<DID>#
  }
  conditionalCancel: {
    busy: string                    // ##67#
    unreachable: string             // ##62#
    noAnswer: string                // ##61#
  }
  unconditional: {
    enable: string | null           // carrier-specific
    disable: string | null
  }
  status: {
    all: string                     // *#004#
    unconditional: string           // *#21#
    busy: string                    // *#67#
    unreachable: string             // *#62#
    noAnswer: string                // *#61#
  }
  voicemailSupport: string          // carrier voicemail-removal phone number
}

const SUPPORT_NUMBERS: Record<ConciergeCarrierKey, string> = {
  rogers: '1-800-764-3771',
  rogers_business: '1-866-727-2141',
  bell: '1-800-668-6878',
  telus: '1-866-558-2273',
  fido: '1-888-481-3436',
  koodo: '1-866-995-6636',
  virgin: '1-888-999-2321',
  freedom: '1-877-946-3184',
  sasktel: '1-800-727-5835',
  public_mobile: '*611 from a Public Mobile line (chat-only via app)',
  other: 'unknown carrier — ask client',
}

// Map concierge carrier values to the 8-carrier GSM family in CARRIER_CODES.
// Used only for the unconditional code (combo + conditional are universal GSM).
const UNCONDITIONAL_FAMILY: Record<ConciergeCarrierKey, CarrierKey> = {
  rogers: 'rogers',
  rogers_business: 'rogers',  // Rogers GSM family
  fido: 'fido',
  bell: 'bell',
  telus: 'telus',
  koodo: 'koodo',
  virgin: 'virgin',
  freedom: 'freedom',
  sasktel: 'rogers',          // SaskTel uses *21*<num># per memory
  public_mobile: 'bell',       // Public Mobile is Telus prepaid → Bell/Telus family
  other: 'other',
}

function isConciergeCarrier(value: string | null | undefined): value is ConciergeCarrierKey {
  return !!value && value in SUPPORT_NUMBERS
}

export function normalizeDid(twilioDid: string): string {
  return twilioDid.replace(/[^0-9]/g, '')
}

export function buildForwardingCodes(
  twilioDid: string,
  carrier?: string | null,
): ForwardingCodes {
  const did = normalizeDid(twilioDid)
  const carrierKey: ConciergeCarrierKey = isConciergeCarrier(carrier) ? carrier : 'other'

  const familyKey = UNCONDITIONAL_FAMILY[carrierKey]
  const family = CARRIER_CODES[familyKey]
  const enable = family.enable ? family.enable.replace('{number}', did) : null
  const disable = family.disable ?? null

  return {
    did,
    combo: `**004*${did}#`,
    comboCancel: '##004#',
    conditional: {
      busy: `*67*${did}#`,
      unreachable: `*62*${did}#`,
      noAnswer: `*61*${did}#`,
    },
    conditionalCancel: {
      busy: '##67#',
      unreachable: '##62#',
      noAnswer: '##61#',
    },
    unconditional: { enable, disable },
    status: {
      all: '*#004#',
      unconditional: '*#21#',
      busy: '*#67#',
      unreachable: '*#62#',
      noAnswer: '*#61#',
    },
    voicemailSupport: SUPPORT_NUMBERS[carrierKey],
  }
}
