/**
 * Canadian mobile carrier call-forwarding dial codes.
 *
 * Used by the Go Live tab Section 4 (`<CallForwardingCard />`) to render the
 * carrier-specific GSM dial code with the client's Twilio number substituted
 * into `{number}`. The "other" entry intentionally has null codes — the UI
 * renders the GSM `*72`/`*73` family fallback for that case.
 *
 * Verification status (2026-04-26 via Perplexity Sonar Pro):
 *   - Rogers: cited and confirmed (*21*{number}# / ##21#)
 *   - Fido / Bell / Telus / Koodo / Virgin / Freedom: Sonar could not cite
 *     authoritative sources; defaults below are the GSM standard most
 *     Canadian carriers use. Update via one-line PR if a carrier publishes
 *     an authoritative override.
 */
export const CARRIER_CODES = {
  rogers:  { name: 'Rogers',  enable: '*21*{number}#', disable: '##21#' },
  fido:    { name: 'Fido',    enable: '*21*{number}#', disable: '##21#' },
  bell:    { name: 'Bell',    enable: '*72{number}',   disable: '*73'   },
  telus:   { name: 'Telus',   enable: '*72{number}',   disable: '*73'   },
  koodo:   { name: 'Koodo',   enable: '*72{number}',   disable: '*73'   },
  virgin:  { name: 'Virgin',  enable: '*72{number}',   disable: '*73'   },
  freedom: { name: 'Freedom', enable: '*72{number}',   disable: '*73'   },
  other:   { name: 'Other / not sure', enable: null, disable: null },
} as const

export type CarrierKey = keyof typeof CARRIER_CODES
