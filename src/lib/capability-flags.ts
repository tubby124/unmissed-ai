/**
 * Pure function — assembles the capability flag set for a client.
 * Used by the home route to populate CapabilitiesCard props.
 *
 * Rules:
 *   hasBooking  — requires booking_enabled=true AND calendar_auth_status='connected'
 *   hasSms      — requires sms_enabled=true AND a real Twilio number (SMS sends FROM that number)
 *   hasTransfer — requires forwarding_number set (agent is configured to transfer)
 */
export interface ClientCapabilityInput {
  knowledge_backend: string | null | undefined
  business_facts: string | null | undefined
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
  return {
    hasKnowledge: client.knowledge_backend === 'pgvector',
    hasFacts: !!client.business_facts,
    hasFaqs: Array.isArray(client.extra_qa) && client.extra_qa.length > 0,
    hasHours: !!client.business_hours_weekday,
    // Calendar must actually be connected — booking_enabled alone is insufficient
    hasBooking: !!(client.booking_enabled && client.calendar_auth_status === 'connected'),
    // SMS requires a Twilio number to send FROM — trial users have sms_enabled=true but no number
    hasSms: !!(client.sms_enabled && client.twilio_number),
    hasTransfer: !!client.forwarding_number,
    // URL set ≠ corpus ready. Requires approved scrape — 'extracted' = preview only, not live.
    hasWebsite: client.website_scrape_status === 'approved',
  }
}
