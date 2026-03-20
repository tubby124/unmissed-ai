/**
 * B3: Call State — Ultravox-native tool-to-tool workflow state
 *
 * State is invisible to the LLM. It flows between HTTP tools only:
 * - Read:  KNOWN_PARAM_CALL_STATE auto-injected into X-Call-State header
 * - Write: X-Ultravox-Update-Call-State response header (JSON dict, shallow-merged)
 * - Init:  initialState field on POST /calls or POST /agents/{id}/calls
 *
 * Tools use state to tailor their _instruction responses
 * (e.g. "3rd booking attempt — offer callback instead").
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ToolOutcome =
  | 'slots_found'
  | 'no_slots'
  | 'booked'
  | 'slot_taken'
  | 'booking_error'
  | 'calendar_unavailable'
  | 'knowledge_found'
  | 'knowledge_empty'
  | 'knowledge_error'
  | 'transferred'
  | 'transfer_error'
  | 'sms_sent'
  | 'sms_blocked'
  | 'sms_error'

export interface CallState {
  workflowType: 'booking' | 'intake' | 'triage' | 'support' | 'callback'
  step: number
  fieldsCollected: string[]
  escalationFlag: boolean
  slotAttempts: number
  bookingAttempts: number
  knowledgeQueries: number
  lastToolOutcome: ToolOutcome | null
}

// ── Niche → workflow type mapping ────────────────────────────────────────────

const NICHE_WORKFLOW: Record<string, CallState['workflowType']> = {
  auto_glass: 'intake',
  real_estate: 'triage',
  property_mgmt: 'support',
  voicemail: 'support',
}

/** Build the initial call state for a given niche. Passed as `initialState` on call creation. */
export function defaultCallState(niche?: string | null): CallState {
  return {
    workflowType: NICHE_WORKFLOW[niche || ''] || 'support',
    step: 0,
    fieldsCollected: [],
    escalationFlag: false,
    slotAttempts: 0,
    bookingAttempts: 0,
    knowledgeQueries: 0,
    lastToolOutcome: null,
  }
}

// ── Header read/write ────────────────────────────────────────────────────────

/** Parse call state from X-Call-State header (auto-injected by Ultravox). Returns null if missing. */
export function parseCallState(req: { headers: { get(name: string): string | null } }): CallState | null {
  const raw = req.headers.get('x-call-state')
  if (!raw) return null
  try {
    return JSON.parse(raw) as CallState
  } catch {
    return null
  }
}

/** Set X-Ultravox-Update-Call-State header on a response to write state back. */
export function setStateUpdate(
  response: { headers: { set(name: string, value: string): void } },
  updates: Partial<CallState>,
): void {
  response.headers.set('X-Ultravox-Update-Call-State', JSON.stringify(updates))
}

// ── State-aware instruction helpers ──────────────────────────────────────────

/** Generate coaching instruction based on slot-check state. */
export function slotInstruction(state: CallState, slotsFound: boolean): string {
  if (!slotsFound) {
    if (state.slotAttempts >= 3) {
      return `No slots again — attempt #${state.slotAttempts}. Offer to have someone call them back with more options instead of checking another date.`
    }
    return ''
  }
  if (state.slotAttempts >= 2) {
    return 'Slots found — the caller has checked multiple dates. Gently confirm which time works best instead of offering to check more dates.'
  }
  return ''
}

/** Generate coaching instruction based on booking state. */
export function bookingInstruction(state: CallState, booked: boolean, slotTaken: boolean): string {
  if (booked) return ''
  if (slotTaken && state.bookingAttempts >= 2) {
    return `Booking attempt #${state.bookingAttempts} failed (slot taken). Offer to take a message so someone can call back to confirm.`
  }
  if (!slotTaken && state.bookingAttempts >= 2) {
    return `Booking has failed ${state.bookingAttempts} times. Apologize and offer to take a message for manual booking.`
  }
  return ''
}

/** Generate coaching instruction based on knowledge query state. */
export function knowledgeInstruction(state: CallState, found: boolean): string {
  if (state.knowledgeQueries >= 3 && !found) {
    return 'Multiple knowledge searches have come up empty. Offer to have someone follow up with that information instead of searching again.'
  }
  return ''
}
