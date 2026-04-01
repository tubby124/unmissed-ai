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

// Re-export from shared utility — all new code should import from '@/lib/utils/phone'
export { normalizePhoneNA } from './utils/phone'
