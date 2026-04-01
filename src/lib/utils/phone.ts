/**
 * Shared phone normalization utilities.
 * Used by CRM contacts, demo flows, webhook processing, and agent context.
 */

/**
 * Normalize a North American phone number to E.164 format (+1XXXXXXXXXX).
 * Returns the normalized string, or '' if the input can't be parsed.
 */
export function normalizePhoneNA(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1') && /^1[2-9]/.test(digits)) return `+${digits}`
  if (raw.startsWith('+1') && digits.length === 11) return `+${digits}`
  return ''
}

/**
 * Check if a phone string looks like a valid E.164 NA number.
 */
export function isValidE164NA(phone: string): boolean {
  return /^\+1[2-9]\d{9}$/.test(phone)
}
