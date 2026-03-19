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
