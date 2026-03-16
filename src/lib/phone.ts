/**
 * Shared phone number utilities.
 * Used by: api/webhook/stripe, api/admin/numbers, api/admin/unassign-number
 */

export const PROVINCE_AREA_CODES: Record<string, string[]> = {
  AB: ['587', '403', '780'],
  SK: ['639', '306'],
  BC: ['778', '604', '236'],
  ON: ['647', '416', '905', '519'],
  MB: ['431', '204'],
  QC: ['514', '438'],
  NS: ['902'], NB: ['506'], NL: ['709'], PE: ['902'],
  NT: ['867'], YT: ['867'], NU: ['867'],
}

/** Reverse lookup: area code → province code (first match wins) */
export function detectProvinceFromAreaCode(areaCode: string): string | null {
  for (const [province, codes] of Object.entries(PROVINCE_AREA_CODES)) {
    if (codes.includes(areaCode)) return province
  }
  return null
}

/**
 * Format E.164 phone number for display.
 * +14031234567 → +1 (403) 123-4567
 * +16045551234 → +1 (604) 555-1234
 * Falls back to raw number if format doesn't match.
 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4)
    const mid  = digits.slice(4, 7)
    const last = digits.slice(7)
    return `+1 (${area}) ${mid}-${last}`
  }
  return e164
}

/**
 * Extract area code from an E.164 number.
 * +14031234567 → '403'
 */
export function extractAreaCode(e164: string): string | null {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1, 4)
  }
  return null
}
