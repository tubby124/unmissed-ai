/**
 * Classification-aware SMS template selection.
 *
 * Returns the SMS body to send after a call, or null if no SMS should be sent.
 * Priority: transfer recovery → client custom template → niche default → classification tier.
 */

export interface SmsTemplateConfig {
  businessName: string
  callerName?: string | null
  summary?: string | null
  niche?: string | null
  /** Client's custom sms_template from settings (overrides tier defaults) */
  smsTemplate?: string | null
  /** True when the call was a transfer recovery (owner didn't answer) */
  isTransferRecovery?: boolean
}

export function getSmsTemplate(
  status: string,
  config: SmsTemplateConfig
): string | null {
  const biz = config.businessName || 'us'

  // No SMS for JUNK or UNKNOWN
  if (status === 'JUNK' || status === 'UNKNOWN') return null

  // Transfer recovery — caller spoke to AI after owner didn't pick up
  if (config.isTransferRecovery) {
    const name = config.callerName ? `${config.callerName}, t` : 'T'
    return `${name}hanks for calling ${biz}! The team was unavailable but got your message and will follow up shortly.`
  }

  // Client has a custom template — interpolate variables and use it
  if (config.smsTemplate) {
    return config.smsTemplate
      .replace(/\{\{business\}\}/g, biz)
      .replace(/\{\{summary\}\}/g, (config.summary || '').slice(0, 100))
      .replace(/\{\{caller_name\}\}/g, config.callerName || 'there')
  }

  // Voicemail niche default
  if (config.niche === 'voicemail') {
    return `Hi, this is ${biz}'s assistant. We got your message and will get back to you shortly. For faster service, you can also text us at this number.`
  }

  // Classification-tier templates
  switch (status) {
    case 'HOT': {
      const name = config.callerName ? `${config.callerName}, t` : 'T'
      return `${name}hanks for calling ${biz}! We'll call you back within the hour.`
    }
    case 'WARM':
      return `Thanks for calling ${biz}! We'll follow up with you shortly.`
    case 'COLD':
      return `Thanks for reaching out to ${biz}. Feel free to call back anytime.`
    case 'MISSED':
      return `We missed your call at ${biz}! We'll call you back shortly.`
    default:
      // Fallback for any other status (e.g. UNKNOWN already filtered above)
      return `Thanks for calling ${biz}! We'll follow up with you shortly.`
  }
}

// ── Outbound lead-qualification SMS ─────────────────────────────────────────

export interface OutboundLeadSmsConfig {
  businessName: string
  agentName?: string | null
  callerName?: string | null
  /** Free-text slot the lead verbally agreed to, e.g. "tomorrow evening" */
  appointmentTime?: string | null
}

/**
 * Post-call SMS for OUTBOUND lead-qualification calls (speed-to-lead dials).
 * Direction matters: the lead did NOT call us, so the inbound templates above
 * (including the client's custom sms_template — "thanks for calling") read
 * wrong and must never be sent on this path.
 *
 * Lanes (call-quality-overhaul design 2026-06-12):
 *  - booked   → confirmation text. The agent's close promises "we'll text to
 *               confirm" — this is the only thing that fulfills that promise.
 *  - missed   → vm/no-answer. Instant SMS paired with the voicemail (VM+SMS
 *               same-minute roughly doubles contact rate vs VM alone).
 *  - answered → null. Answered-but-not-booked (browsing/warm) gets NOTHING —
 *               the list email already went out; extra texts add noise.
 */
export function getOutboundLeadSmsTemplate(
  outcome: 'booked' | 'missed' | 'answered',
  config: OutboundLeadSmsConfig
): string | null {
  const biz = config.businessName || 'our office'
  const from = config.agentName ? `${config.agentName} at ${biz}` : biz
  const name = config.callerName ? ` ${config.callerName}` : ''

  if (outcome === 'booked') {
    const when = config.appointmentTime ? ` for ${config.appointmentTime}` : ''
    return `Hi${name}, it's ${from} — confirming your chat with one of our agents${when}. Reply here if you need to reschedule. Reply STOP to opt out.`
  }
  if (outcome === 'missed') {
    return `Hey${name}, it's ${from} — your home list just landed in your email. Want showings or tweaks to the list? Just text back here. Reply STOP to opt out.`
  }
  return null
}
