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

export type OutboundLeadSmsOutcome =
  | 'booked'
  | 'missed'
  | 'answered'
  | 'not_looking'
  | 'wrong_number'
  | 'do_not_call'
  | 'requested_listing'

export type OutboundLeadSmsCampaignType = 'generic' | 'realtor_lofty_revival'

export interface OutboundLeadSmsConfig {
  businessName: string
  agentName?: string | null
  callerName?: string | null
  /** Free-text slot the lead verbally agreed to, e.g. "tomorrow evening" */
  appointmentTime?: string | null
  /** Explicit campaign/mode; defaults to existing generic outbound behavior. */
  campaignType?: OutboundLeadSmsCampaignType | null
  /** Realtor mode only: opt-in flag required before no-answer texts are sent. */
  sendMissedCallText?: boolean | null
  /** Realtor mode only: verified listing/search link details, if actually supplied. */
  verifiedSearchUrl?: string | null
  verifiedSearchName?: string | null
}

const REALTOR_NO_ANSWER_TEXT = "Hi {name}, Aisha called for Hasan Sharif with eXp Realty about your home search. No rush—reply here if you’re still planning a move, or reply STOP to opt out."

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function verifiedHttpUrl(value: string | null | undefined): string | null {
  const candidate = clean(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

function firstNameOrThere(name: string | null | undefined): string {
  const trimmed = clean(name)
  return trimmed ? trimmed.split(/\s+/)[0] : 'there'
}

function realtorNoAnswerText(name: string | null | undefined): string {
  return REALTOR_NO_ANSWER_TEXT.replace('{name}', firstNameOrThere(name))
}

function getRealtorLoftyRevivalSmsTemplate(
  outcome: OutboundLeadSmsOutcome,
  config: OutboundLeadSmsConfig
): string | null {
  const name = config.callerName ? ` ${config.callerName}` : ''
  const when = clean(config.appointmentTime)

  // Suppression-only dispositions: do not send marketing or re-engagement SMS.
  if (outcome === 'do_not_call' || outcome === 'wrong_number' || outcome === 'not_looking') return null

  // Answered/no booking gets no automatic text in Lofty revival mode.
  if (outcome === 'answered') return null

  // No-answer is opt-in per campaign only, using truthful neutral copy.
  if (outcome === 'missed') {
    return config.sendMissedCallText === true ? realtorNoAnswerText(config.callerName) : null
  }

  // Confirmation is allowed only from an actually captured callback/booking time.
  if (outcome === 'booked') {
    if (!when) return null
    return `Hi${name}, it's Aisha for Hasan Sharif with eXp Realty — confirming your requested callback for ${when}. Reply here if you need to reschedule. Reply STOP to opt out.`
  }

  // Listing/search-link SMS is allowed only when an explicit verified URL + name
  // are supplied by upstream source data. Never fabricate a list or imply it was
  // sent unless this verified data exists.
  if (outcome === 'requested_listing') {
    const url = verifiedHttpUrl(config.verifiedSearchUrl)
    const searchName = clean(config.verifiedSearchName)
    if (!url || !searchName) return null
    return `Hi${name}, it's Aisha for Hasan Sharif with eXp Realty — here's the ${searchName} search link you requested: ${url} Reply STOP to opt out.`
  }

  return null
}

/**
 * Post-call SMS for OUTBOUND lead-qualification calls (speed-to-lead dials).
 * Direction matters: the lead did NOT call us, so the inbound templates above
 * (including the client's custom sms_template — "thanks for calling") read
 * wrong and must never be sent on this path.
 *
 * Generic outbound lanes preserve the pre-existing behavior. The scoped
 * realtor_lofty_revival campaign/mode is stricter: default no auto-SMS for
 * answered/no-answer calls, suppression-only for DNC/wrong-number/not-looking,
 * and confirmation/link texts only when backed by captured source data.
 */
export function getOutboundLeadSmsTemplate(
  outcome: OutboundLeadSmsOutcome,
  config: OutboundLeadSmsConfig
): string | null {
  const campaignType = config.campaignType ?? 'generic'
  if (campaignType === 'realtor_lofty_revival') {
    return getRealtorLoftyRevivalSmsTemplate(outcome, config)
  }

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
