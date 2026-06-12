/**
 * Shared runtime assembly for OUTBOUND dial paths.
 *
 * scheduled-callbacks cron and dashboard dial-out are parallel implementations
 * of the same dial pipeline — capability logic (which tools the outbound agent
 * gets, what runtime context it needs) must live HERE, in one place, per the
 * no-dual-capability-logic rule. Both routes call these helpers.
 */

import { buildCalendarBookingTools } from '@/lib/ultravox'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

/** Client columns the outbound booking gate reads. Add to both routes' selects. */
export interface OutboundBookingGateInput {
  booking_enabled?: boolean | null
  calendar_auth_status?: string | null
  selected_plan?: string | null
  subscription_status?: string | null
}

/**
 * True when this client's outbound agent should carry the direct calendar
 * tools (checkCalendarAvailability + bookAppointment — NO stage transition;
 * the outbound monoprompt drives booking itself).
 */
export function outboundBookingReady(client: OutboundBookingGateInput): boolean {
  if (!client.booking_enabled) return false
  if (client.calendar_auth_status !== 'connected') return false
  // Same plan gate as inbound buildAgentTools, incl. trialing bypass.
  if (client.subscription_status === 'trialing') return true
  return getPlanEntitlements(client.selected_plan).bookingEnabled
}

function toolName(t: Record<string, unknown>): string | undefined {
  return (t.toolName as string | undefined)
    ?? (t.nameOverride as string | undefined)
    ?? ((t.temporaryTool as Record<string, unknown> | undefined)?.modelToolName as string | undefined)
}

/**
 * Append the direct calendar booking tools to an outbound tools array,
 * shape-aware-deduped (clients.tools may already carry tools in any of the
 * three wire shapes — same dedup pattern as the hangUp guard).
 */
export function appendOutboundBookingTools(
  tools: Record<string, unknown>[],
  slug: string,
): Record<string, unknown>[] {
  const existing = new Set(tools.map(toolName).filter(Boolean))
  const calendarTools = (buildCalendarBookingTools(slug) as unknown as Record<string, unknown>[])
    .filter(t => !existing.has(toolName(t)))
  return [...tools, ...calendarTools]
}

/**
 * Minimal runtime context block for outbound calls. The inbound
 * callerContextBlock carries office-hours/after-hours/VIP noise that doesn't
 * fit an outbound persona; booking only needs date anchoring (so the model
 * can resolve "tomorrow" → YYYY-MM-DD) and CALLER PHONE (the bookAppointment
 * tool description tells the model to read it from exactly that label).
 */
export function buildOutboundDateBlock(timezone: string | null | undefined, leadPhone: string): string {
  const tz = timezone || 'America/Edmonton'
  const now = new Date()
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' })
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  return `[TODAY: ${dateFmt.format(now)} (${dayFmt.format(now)})\nCURRENT TIME: ${timeFmt.format(now)} (${tz})\nCALLER PHONE: ${leadPhone}]`
}
