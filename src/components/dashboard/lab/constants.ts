// ── Niche-specific scenario hints ─────────────────────────────────────────────

export const NICHE_HINTS: Record<string, string[]> = {
  auto_glass: [
    "Try: 'I have a crack on the driver's side windshield — can you come today?'",
    "Try: 'My insurance is covering it, what info do you need?'",
    "Try: 'Is mobile repair available? I'm at work.'",
  ],
  property_mgmt: [
    "Try: 'My kitchen faucet has been leaking for two days.'",
    "Try: 'I'm interested in the 2-bedroom unit I saw online.'",
    "Try: 'My rent cheque is lost — how do I pay online?'",
  ],
  real_estate: [
    "Try: 'I'm looking to sell my home — what's the process?'",
    "Try: 'What are homes selling for in my area right now?'",
    "Try: 'Can I book a showing this weekend?'",
  ],
  salon: [
    "Try: 'I need a haircut and colour — how far out are you?'",
    "Try: 'Do you have any cancellations today?'",
    "Try: 'What's the price for a balayage?'",
  ],
  print_shop: [
    "Try: 'I need 500 business cards by Friday — is that doable?'",
    "Try: 'Can you print a 4x8 coroplast sign for my yard sale?'",
    "Try: 'Do you do same-day banners?'",
  ],
  voicemail: [
    "Try: 'Hi I'm calling about your services'",
    "Try: 'What are your hours?'",
    "Try: 'Can I leave a message?'",
  ],
}

export const DEFAULT_HINTS = [
  "Try asking about availability",
  "Try: 'What services do you offer?'",
  "Try asking a follow-up question after the agent responds",
]

export function getNicheHints(niche: string | null): string[] {
  if (!niche) return DEFAULT_HINTS
  return NICHE_HINTS[niche] ?? DEFAULT_HINTS
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string | null
  created_at: string
  is_active: boolean
}

export interface CallResult {
  transcripts: TranscriptEntry[]
  classification: "HOT" | "WARM" | "COLD" | "JUNK" | null
  classifying: boolean
  durationSecs: number | null
}

import type { TranscriptEntry } from "@/components/dashboard/BrowserTestCall"

export interface LabViewProps {
  isAdmin: boolean
  clientId: string | null
  livePrompt: string | null
  agentName: string
  niche: string | null
  initialVersions: PromptVersion[]
}

// ── Char count helpers ────────────────────────────────────────────────────────

export const CHAR_WARN = 40000
export const CHAR_MAX = 50000

export function charCountColor(len: number): string {
  if (len >= CHAR_MAX) return "#dc2626"
  if (len >= CHAR_WARN) return "#d97706"
  return "var(--color-text-3)"
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
