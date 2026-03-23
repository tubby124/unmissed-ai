/**
 * Shared localStorage utility for demo visitor info.
 * Used by /try page and TalkToAgentWidget to persist name/email/phone
 * so repeat visitors skip the form.
 */

const STORAGE_KEY = 'unmissed_demo_visitor'

export type VisitorInfo = { name: string; email: string; phone: string }

export function loadVisitor(): VisitorInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.name || parsed.email || parsed.phone) return parsed
  } catch { /* ignore */ }
  return null
}

export function saveVisitor(info: VisitorInfo): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(info)) } catch { /* ignore */ }
}

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
