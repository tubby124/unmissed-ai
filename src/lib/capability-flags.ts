/**
 * Pure function — assembles the capability flag set for a client.
 * Used by the home route to populate CapabilitiesCard props.
 *
 * Rules:
 *   hasBooking  — requires booking_enabled=true AND calendar_auth_status='connected' AND plan.bookingEnabled
 *   hasSms      — requires sms_enabled=true AND a real Twilio number AND plan.smsEnabled
 *   hasTransfer — requires forwarding_number set AND plan.transferEnabled
 *   hasKnowledge — requires pgvector backend AND plan.knowledgeEnabled
 *
 * Plan gates mirror buildAgentTools() in lib/ultravox.ts — both must stay in sync.
 * When adding a new capability: update both this function AND buildAgentTools().
 */
import { getPlanEntitlements } from './plan-entitlements'

export interface ClientCapabilityInput {
  knowledge_backend: string | null | undefined
  business_facts: string | string[] | null | undefined
  extra_qa: unknown[] | null | undefined
  business_hours_weekday: string | null | undefined
  booking_enabled: boolean | null | undefined
  calendar_auth_status: string | null | undefined
  sms_enabled: boolean | null | undefined
  twilio_number: string | null | undefined
  forwarding_number: string | null | undefined
  website_url: string | null | undefined
  // 'approved' = scrape ran + user approved → corpus is live
  // null / any other value = URL set but not yet approved into knowledge base
  website_scrape_status: string | null | undefined
  // Plan fields — used to gate capabilities to plan entitlements (same logic as buildAgentTools)
  selected_plan?: string | null
  subscription_status?: string | null
  // Knowledge chunk count — when explicitly 0, hasKnowledge is false even if backend='pgvector'
  // null/undefined = unknown (don't gate — preserves behavior for callers that don't provide it)
  approved_knowledge_chunk_count?: number | null
}

export interface CapabilityFlags {
  hasKnowledge: boolean
  hasFacts: boolean
  hasFaqs: boolean
  hasHours: boolean
  hasBooking: boolean
  hasSms: boolean
  hasTransfer: boolean
  hasWebsite: boolean
}

export function buildCapabilityFlags(client: ClientCapabilityInput): CapabilityFlags {
  const planId = client.subscription_status === 'trialing'
    ? 'trial'
    : (client.selected_plan ?? null)
  const plan = getPlanEntitlements(planId)

  return {
    // pgvector flag + plan gate + chunk count: only show active when chunks actually exist
    // count=null/undefined → unknown → default to active (backwards-compatible for callers that omit it)
    hasKnowledge: client.knowledge_backend === 'pgvector' && plan.knowledgeEnabled
      && (client.approved_knowledge_chunk_count == null || client.approved_knowledge_chunk_count > 0),
    hasFacts: Array.isArray(client.business_facts) ? client.business_facts.length > 0 : !!client.business_facts,
    hasFaqs: Array.isArray(client.extra_qa) && client.extra_qa.length > 0,
    hasHours: !!client.business_hours_weekday,
    // Calendar must actually be connected — booking_enabled alone is insufficient
    hasBooking: !!(client.booking_enabled && client.calendar_auth_status === 'connected' && plan.bookingEnabled),
    // SMS requires a Twilio number to send FROM — trial users have sms_enabled=true but no number
    hasSms: !!(client.sms_enabled && client.twilio_number && plan.smsEnabled),
    // Transfer requires plan entitlement — Core/Lite users with forwarding_number won't get the tool
    hasTransfer: !!(client.forwarding_number && plan.transferEnabled),
    // URL set ≠ corpus ready. Requires approved scrape — 'extracted' = preview only, not live.
    hasWebsite: client.website_scrape_status === 'approved',
  }
}
