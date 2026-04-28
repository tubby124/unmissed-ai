/**
 * Shared phone number formatter — handles real phones AND test call markers.
 *
 * Used by: CallsList, ActivityFeed, ClientHome, AdminCommandStrip, ClientSelector,
 * CampaignCard, CapabilitiesCard, and any future component displaying caller_phone.
 */

/** Known test call marker values stored in call_logs.caller_phone */
const TEST_CALL_LABELS: Record<string, string> = {
  'trial-test': 'Web Browser Call',
  'webrtc-test': 'Web Browser Call',
}

/**
 * Returns true if the caller_phone value represents a test/trial call (not a real PSTN number).
 */
export function isTestCallPhone(phone: string | null | undefined): boolean {
  return !!phone && phone in TEST_CALL_LABELS
}

/**
 * Human-friendly label for a caller_phone value.
 * - Real E.164 numbers → formatted: +1 (604) 555-0100
 * - Test markers → friendly label: "Trial Test", "Browser Test"
 * - Null/empty → "Unknown"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'Unknown'

  // Test call markers
  const testLabel = TEST_CALL_LABELS[phone]
  if (testLabel) return testLabel

  // Standard NA phone formatting
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}
