// Extracted from prompt-builder.ts by Phase 5 refactor.
// SMS follow-up template builder.

import { NICHE_DEFAULTS, resolveProductionNiche } from './prompt-config/niche-defaults'

/**
 * Build the SMS follow-up message text from intake form answers + niche defaults.
 * Called after every call completes — message sent via Twilio to the caller's number.
 *
 * Placeholders: {{business}} = business_name, {{niche_*}} = any niche-specific intake field
 */
export function buildSmsTemplate(intake: Record<string, unknown>): string {
  const niche = (intake.niche as string) || 'other'
  const nicheDefaults = NICHE_DEFAULTS[resolveProductionNiche(niche)] || NICHE_DEFAULTS.other
  const commonDefaults = NICHE_DEFAULTS._common || {}

  let template =
    nicheDefaults.sms_template ||
    commonDefaults.sms_template ||
    "Thanks for calling {{business}}! We'll call you back shortly."

  // Replace {{business}} with business name
  const businessName = (intake.business_name as string) || 'us'
  template = template.replace(/\{\{business\}\}/g, businessName)

  // Replace any remaining {{key}} placeholders from intake fields
  for (const [key, value] of Object.entries(intake)) {
    if (typeof value === 'string') {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
  }

  return template
}
