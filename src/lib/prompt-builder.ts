import { wrapSection } from '@/lib/prompt-sections'
import { getCapabilities } from '@/lib/niche-capabilities'
import { VOICE_PRESETS } from './voice-presets'
import { MODE_INSTRUCTIONS, getSmsBlock, getVipBlock } from './prompt-patcher'
import { type ServiceCatalogItem, parseServiceCatalog, formatServiceCatalog, buildBookingNotesBlock } from './service-catalog'

/**
 * prompt-builder.ts — TypeScript port of PROVISIONING/app/prompt_builder.py
 *
 * Builds Ultravox system prompts from the INBOUND_TEMPLATE_BODY using per-niche
 * defaults + intake form answers. Template-fill approach (industry standard).
 *
 * Flow:
 *   1. Start with NICHE_DEFAULTS for the selected niche
 *   2. Override with intake form answers
 *   3. Inject callerFAQ into PRODUCT KNOWLEDGE BASE section
 *   4. Inject agentRestrictions into FORBIDDEN ACTIONS section
 *   5. Fill {{VARIABLES}} and return the complete prompt
 *   6. validatePrompt() — checks required patterns before Ultravox agent creation
 *
 * Source template: BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md v3.1
 * Python source: PROVISIONING/app/prompt_builder.py
 */

import { INBOUND_TEMPLATE_BODY } from './prompt-config/template-body'

import { INSURANCE_PRESETS, PRICING_POLICY_MAP, UNKNOWN_ANSWER_MAP } from './prompt-config/insurance-presets'
import { buildNicheFaqDefaults, buildPrintShopFaq, buildKnowledgeBase, buildAfterHoursBlock, buildCalendarBlock, applyModeVariableOverrides, wrapSectionIfPresent } from './prompt-helpers'

// ── Voice style presets (re-exported from voice-presets.ts) ──────────────────
// Extracted to avoid pulling the entire prompt-builder into lightweight consumers.
export { VOICE_PRESETS, type VoicePreset } from './voice-presets'

import { NICHE_DEFAULTS } from './prompt-config/niche-defaults'
export { NICHE_DEFAULTS }

import { NICHE_CLASSIFICATION_RULES } from './prompt-config/niche-classification'
export { NICHE_CLASSIFICATION_RULES }

import { buildVoicemailPrompt } from './prompt-niches/voicemail-prompt'
import { buildRealEstatePrompt } from './prompt-niches/real-estate-prompt'

// ── Core prompt builder ───────────────────────────────────────────────────────

export function buildPrompt(variables: Record<string, string>): string {
  let filled = INBOUND_TEMPLATE_BODY.replace(
    /\{\{([A-Z_a-z]+)\}\}/g,
    (_, key: string) => variables[key.toUpperCase()] ?? variables[key.toLowerCase()] ?? '',
  )

  const remaining = [...filled.matchAll(/\{\{([A-Z_a-z]+)\}\}/g)].map(m => m[1])
  if (remaining.length > 0) {
    console.warn('[prompt-builder] WARNING: unfilled variables:', remaining)
  }

  return filled.trim()
}


// ── Main intake-to-prompt function ────────────────────────────────────────────

export function buildPromptFromIntake(intake: Record<string, unknown>, websiteContent?: string, knowledgeDocs?: string): string {
  // ── Website content — NOT inlined into stored prompt ─────────────────────
  // Website-scraped facts/QA are already:
  //   1. Merged into business_facts/extra_qa (approve-website-knowledge route)
  //   2. Seeded into knowledge_chunks for pgvector retrieval
  //   3. Injected at call-time via KnowledgeSummary (agent-context.ts Phase 3)
  // Inlining them here caused double-injection + prompt bloat on GLM-4.6.
  // The websiteContent param is kept for backward compat but intentionally ignored.
  if (websiteContent) {
    console.log(`[prompt-builder] websiteContent (${websiteContent.length} chars) NOT inlined — served via KnowledgeSummary + pgvector retrieval`)
  }

  const niche = (intake.niche as string) || 'other'

  // D184 — message_only mode → voicemail builder (lightweight message-taking flow) regardless of niche
  if ((intake.call_handling_mode as string) === 'message_only') return buildVoicemailPrompt(intake)

  // Voicemail uses its own lightweight template (no city, no inbound triage)
  if (niche === 'voicemail') return buildVoicemailPrompt(intake)

  // Real estate uses its own persona-style template
  if (niche === 'real_estate') return buildRealEstatePrompt(intake)

  const nicheDefaults = NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS.other

  // Layer: common → niche → AI-inferred custom vars (for 'other' businesses) → intake overrides
  const customVars = (niche === 'other' && intake.niche_custom_variables)
    ? (intake.niche_custom_variables as Record<string, string>)
    : {}
  const variables: Record<string, string> = {
    ...NICHE_DEFAULTS._common,
    ...nicheDefaults,
    ...customVars,
  }

  // Direct intake field mappings
  const directMappings: Array<[string, string]> = [
    ['business_name', 'BUSINESS_NAME'],
    ['city', 'CITY'],
    ['agent_name', 'AGENT_NAME'],
    ['db_agent_name', 'AGENT_NAME'],
    ['hours_weekday', 'HOURS_WEEKDAY'],
    ['services_offered', 'SERVICES_OFFERED'],
    ['weekend_policy', 'WEEKEND_POLICY'],
    ['callback_phone', 'CALLBACK_PHONE'],
    ['services_not_offered', 'SERVICES_NOT_OFFERED'],
    ['emergency_phone', 'EMERGENCY_PHONE'],
  ]
  for (const [intakeKey, varKey] of directMappings) {
    const val = intake[intakeKey] as string | undefined
    if (val?.trim()) variables[varKey] = val
  }

  // niche_services fallback: use checkbox answers only if services_offered free-text is absent or still default
  if (!variables.SERVICES_OFFERED?.trim() || variables.SERVICES_OFFERED === nicheDefaults.SERVICES_OFFERED) {
    const nicheServices = intake.niche_services as string | undefined
    if (nicheServices?.trim()) variables.SERVICES_OFFERED = nicheServices
  }

  // service_catalog — structured services list, overrides SERVICES_OFFERED when non-empty
  let catalog: ServiceCatalogItem[] = []
  let catalogServiceNames: string[] = []
  if (intake.service_catalog) {
    catalog = parseServiceCatalog(intake.service_catalog)
    if (catalog.length > 0) {
      variables.SERVICES_OFFERED = formatServiceCatalog(catalog)
      catalogServiceNames = catalog.map(s => s.name.trim())
    }
  }

  // Insurance preset
  const insurancePreset = intake.insurance_preset as string | undefined
  if (insurancePreset && INSURANCE_PRESETS[insurancePreset]) {
    variables.INSURANCE_STATUS = INSURANCE_PRESETS[insurancePreset].status
    variables.INSURANCE_DETAIL = INSURANCE_PRESETS[insurancePreset].detail
  } else {
    if ((intake.insurance_status as string)?.trim()) variables.INSURANCE_STATUS = intake.insurance_status as string
    if ((intake.insurance_detail as string)?.trim()) variables.INSURANCE_DETAIL = intake.insurance_detail as string
  }

  // Mobile policy from niche answers
  const niche_mobile = intake.niche_mobileService as string | undefined
  if (niche_mobile === 'yes') variables.MOBILE_POLICY = 'we come to you'
  else if (niche_mobile === 'no') variables.MOBILE_POLICY = "you'd bring it to us"
  else if (niche_mobile === 'emergency_only') variables.MOBILE_POLICY = "usually you'd come to us, but we can come out for emergencies"

  // Salon booking type
  const niche_booking = intake.niche_bookingType as string | undefined
  if (niche_booking === 'appointment_only') variables.SERVICE_TIMING_PHRASE = 'book an appointment'
  else if (niche_booking === 'walk_in') variables.SERVICE_TIMING_PHRASE = 'come on in'

  // Print shop niche-specific field handling
  if (niche === 'print_shop') {
    const pickupOnly = intake.niche_pickupOnly !== false
    if (pickupOnly) variables.MOBILE_POLICY = "pickup only — we don't do delivery or shipping"
  }

  // Barbershop niche-specific field handling
  if (niche === 'barbershop') {
    const priceRange = (intake.niche_priceRange as string)?.trim()
    if (priceRange) variables.PRICE_RANGE = priceRange
    const walkInPolicy = (intake.niche_walkInPolicy as string)?.trim()
    if (walkInPolicy) variables.WALK_IN_POLICY = walkInPolicy
  }

  // Restaurant niche-specific field handling
  if (niche === 'restaurant') {
    const cuisineType = (intake.niche_cuisineType as string)?.trim()
    if (cuisineType) variables.INDUSTRY = cuisineType
    const orderTypes = (intake.niche_orderTypes as string) || ''
    if (orderTypes.includes('delivery') || orderTypes.includes('takeout')) {
      const deliveryNote = 'NEVER take delivery or takeout orders over the phone — direct to online ordering.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + deliveryNote
        : deliveryNote
    }
    const cancelPolicy = (intake.niche_cancelPolicy as string) || ''
    if (cancelPolicy === '24h') {
      const cancelNote = 'Cancellation policy: 24 hours notice required — inform callers who try to cancel same-day.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + cancelNote
        : cancelNote
    } else if (cancelPolicy === 'no_cancel') {
      const cancelNote = 'Cancellations not accepted — deposits are non-refundable. Inform callers politely.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + cancelNote
        : cancelNote
    }
    const partySize = (intake.niche_partySize as string)?.trim()
    if (partySize && partySize !== 'No limit') {
      const partySizeNote = `Maximum party size for reservations is ${partySize} — for larger groups, take a message for a callback.`
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + partySizeNote
        : partySizeNote
    }
  }

  // HVAC niche-specific field handling
  if (niche === 'hvac') {
    const hvacEmergency = (intake.niche_emergency as string) || ''
    if (hvacEmergency === 'yes_premium') {
      variables.WEEKEND_POLICY = 'we handle after-hours calls at a premium rate'
    } else if (hvacEmergency === 'business_hours') {
      variables.WEEKEND_POLICY = 'no after-hours calls — business hours only'
      const noEmergencyNote = 'NEVER accept emergency or after-hours service requests — tell caller we only work during business hours.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noEmergencyNote
        : noEmergencyNote
    } else if (hvacEmergency === 'no') {
      variables.WEEKEND_POLICY = 'no emergency service — call back during business hours'
      const noEmergencyNote = 'NEVER accept emergency or after-hours service requests — tell caller we only work during business hours.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noEmergencyNote
        : noEmergencyNote
    }
    const hvacServiceArea = (intake.niche_serviceArea as string)?.trim()
    if (hvacServiceArea) variables.CITY = hvacServiceArea
    const hvacBrands = (intake.niche_brands as string)?.trim()
    if (hvacBrands) {
      const brandsLine = `Brands we service: ${hvacBrands}`
      variables.SERVICES_OFFERED = variables.SERVICES_OFFERED
        ? `${variables.SERVICES_OFFERED}\n${brandsLine}`
        : brandsLine
    }
    const hvacPricingModel = (intake.niche_pricingModel as string) || ''
    if (hvacPricingModel === 'free_estimate') {
      variables.INSURANCE_DETAIL = 'we offer free estimates — we come out and assess before any work starts'
    } else if (hvacPricingModel === 'flat_rate') {
      variables.INSURANCE_DETAIL = 'flat-rate pricing — fixed price per service type, no surprises'
    } else if (hvacPricingModel === 'hourly') {
      variables.INSURANCE_DETAIL = 'time and materials pricing — billed hourly plus parts'
    } else if (hvacPricingModel === 'diagnostic_fee') {
      variables.INSURANCE_DETAIL = 'we charge a diagnostic fee for the initial assessment, then quote from there'
    }
  }

  // Plumbing niche-specific field handling
  if (niche === 'plumbing') {
    const plumbingEmergency = (intake.niche_emergency as string) || ''
    if (plumbingEmergency === 'yes_24_7') {
      variables.WEEKEND_POLICY = 'we handle emergency calls 24/7 — flooding, burst pipes, no water'
    } else if (plumbingEmergency === 'yes_business_hours') {
      variables.WEEKEND_POLICY = 'we handle emergency calls during business hours only'
    } else if (plumbingEmergency === 'no') {
      variables.WEEKEND_POLICY = 'no emergency service — call back during business hours'
      const noEmergencyNote = 'NEVER accept emergency calls — redirect caller to business hours.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noEmergencyNote
        : noEmergencyNote
    }
    const plumbingServiceArea = (intake.niche_serviceArea as string)?.trim()
    if (plumbingServiceArea) variables.CITY = plumbingServiceArea
    const plumbingClientType = (intake.niche_clientType as string) || ''
    if (plumbingClientType === 'residential') {
      variables.INDUSTRY = 'residential plumbing company'
    } else if (plumbingClientType === 'commercial') {
      variables.INDUSTRY = 'commercial plumbing company'
    }
  }

  // Dental niche-specific field handling
  if (niche === 'dental') {
    const newPatients = (intake.niche_newPatients as string) || ''
    if (newPatients === 'waitlist') {
      const waitlistNote = "For new patients: add to waitlist only — do NOT confirm a booking. Say 'we\\'re currently on a waitlist for new patients — I\\'ll add your name and have the team call ya back.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + waitlistNote
        : waitlistNote
    } else if (newPatients === 'no') {
      const closedNote = "NEVER book a new patient — we are not accepting new patients. Tell caller: 'we\\'re not taking new patients right now — I can take your info and have the team call ya back.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + closedNote
        : closedNote
    }
    const dentalInsurance = (intake.niche_insurance as string)?.trim()
    if (dentalInsurance) {
      variables.INSURANCE_DETAIL = `we accept: ${dentalInsurance} — bring your card and we'll sort it out`
    }
    const emergencyAppts = (intake.niche_emergencyAppts as string) || ''
    if (emergencyAppts === 'no') {
      const noSameDayNote = 'NEVER promise a same-day or emergency appointment — we schedule ahead only. Collect info and route to callback for earliest available slot.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noSameDayNote
        : noSameDayNote
    }
  }

  // Legal niche-specific field handling
  if (niche === 'legal') {
    const practiceAreas = (intake.niche_practiceAreas as string)?.trim()
    if (practiceAreas) {
      variables.SERVICES_OFFERED = `law firm specializing in: ${practiceAreas}`
    }
    const consultations = (intake.niche_consultations as string) || ''
    if (consultations === 'yes_paid') {
      const paidConsultNote = "Consultations are paid — NEVER offer a free consult. Tell caller: 'consultations are paid — I\\'ll have someone call ya back with the details and fee.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + paidConsultNote
        : paidConsultNote
    } else if (consultations === 'referral_only') {
      const referralNote = "NEVER book a cold inquiry — referrals only. Tell caller: 'we work by referral only — I can take your name and the team will let ya know if we\\'re able to help.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + referralNote
        : referralNote
    }
    const urgentRouting = (intake.niche_urgentRouting as string)
    if (urgentRouting === 'false') {
      const noUrgentNote = 'Do NOT flag any matter as [URGENT] — treat all inquiries the same regardless of urgency.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noUrgentNote
        : noUrgentNote
    }
  }

  // Property management niche-specific field handling
  if (niche === 'property_management') {
    const propertyType = (intake.niche_propertyType as string) || ''
    if (propertyType === 'residential') {
      variables.INDUSTRY = 'residential property management company'
    } else if (propertyType === 'commercial') {
      variables.INDUSTRY = 'commercial property management company'
    } else if (propertyType === 'both') {
      variables.INDUSTRY = 'property management company (residential + commercial)'
    }
    const hasEmergencyLine = (intake.niche_hasEmergencyLine as string)
    if (hasEmergencyLine === 'false') {
      const noEmergencyNote = 'NEVER imply there is a 24/7 emergency line — take a message and flag [URGENT] for the team to call back.'
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + noEmergencyNote
        : noEmergencyNote
    }
  }

  // Salon niche-specific field handling
  if (niche === 'salon') {
    const namedStylists = (intake.niche_namedStylists as string)?.trim()
    if (namedStylists) {
      const stylistLine = `Stylists: ${namedStylists}`
      variables.SERVICES_OFFERED = variables.SERVICES_OFFERED
        ? `${variables.SERVICES_OFFERED}\n${stylistLine}`
        : stylistLine
    }
    const depositPolicy = (intake.niche_depositPolicy as string) || ''
    if (depositPolicy === 'new_clients') {
      const depositNote = "New clients require a deposit to book — say: 'we do ask for a small deposit for new clients — the team will call ya back to sort that out.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + depositNote
        : depositNote
    } else if (depositPolicy === 'yes') {
      const depositNote = "All bookings require a deposit — say: 'we do require a deposit to hold your spot — the team will call ya back to collect that and confirm.'"
      variables.FORBIDDEN_EXTRA = variables.FORBIDDEN_EXTRA
        ? variables.FORBIDDEN_EXTRA + '\n' + depositNote
        : depositNote
    }
  }

  // Universal: if owner provided their name, personalise CLOSE_PERSON to first name (all niches)
  const ownerNameGlobal = (intake.owner_name as string)?.trim()
  if (ownerNameGlobal) {
    variables.CLOSE_PERSON = ownerNameGlobal.split(' ')[0] || ownerNameGlobal
  }

  // Transfer — if owner_phone provided AND niche supports live transfers
  const ownerPhone = intake.owner_phone as string | undefined
  const caps = getCapabilities(niche)
  if (ownerPhone?.trim() && caps.transferCalls) {
    variables.OWNER_PHONE = ownerPhone
    variables.TRANSFER_ENABLED = 'true'
  }

  // After-hours behavior
  const afterHoursBehavior = (intake.after_hours_behavior as string) || 'standard'
  const emergencyPhone = (intake.emergency_phone as string) || ''
  variables.AFTER_HOURS_BLOCK = buildAfterHoursBlock(afterHoursBehavior, emergencyPhone || undefined)
  if (emergencyPhone.trim()) {
    variables.EMERGENCY_PHONE = emergencyPhone
  }

  // Pricing policy — maps to a spoken instruction appended to knowledge base
  const pricingPolicy = (intake.pricing_policy as string) || ''
  const pricingInstruction = PRICING_POLICY_MAP[pricingPolicy] || ''

  // Unknown answer behavior — maps to a fallback instruction
  const unknownAnswerBehavior = (intake.unknown_answer_behavior as string) || ''
  const unknownInstruction = UNKNOWN_ANSWER_MAP[unknownAnswerBehavior] || ''

  // Common objections — Q&A pairs for objection handling
  let objectionsBlock = ''
  const objRaw = intake.common_objections as string | undefined
  if (objRaw) {
    try {
      const pairs = JSON.parse(objRaw) as { question: string; answer: string }[]
      const valid = pairs.filter(p => p.question?.trim() && p.answer?.trim())
      if (valid.length > 0) {
        objectionsBlock = '## OBJECTION HANDLING\n\nWhen a caller pushes back, use these responses:\n\n' +
          valid.map(p => `**"${p.question.trim()}"**\n"${p.answer.trim()}"`).join('\n\n')
      }
    } catch { /* invalid JSON — skip */ }
  }

  // Voice style preset — replaces old 2-way agent_tone split
  // Priority: intake.voice_style_preset > intake.agent_tone (legacy compat) > 'casual_friendly'
  const presetId = (intake.voice_style_preset as string)
    || (intake.agent_tone === 'professional' ? 'professional_warm' : undefined)
    || 'casual_friendly'
  const preset = VOICE_PRESETS[presetId] || VOICE_PRESETS.casual_friendly

  // Apply preset closePerson override (e.g. professional presets use 'our team' instead of 'the boss')
  if (preset.closePerson && variables.CLOSE_PERSON === 'the boss') {
    variables.CLOSE_PERSON = preset.closePerson
  }

  variables.TONE_STYLE_BLOCK = preset.toneStyleBlock
  variables.FILLER_STYLE = preset.fillerStyle
  variables.GREETING_LINE = preset.greetingLine
  variables.CLOSING_LINE = preset.closingLine

  // D171 — Wow-first niche capability greeting
  // Overrides preset greetingLine with a capability-first opening that leads with what we can DO.
  // Rules: one question max, under 25 words, capability before qualification, no "How can I help?".
  // Only applies to niches where we have a meaningful capability to lead with.
  // Preserves AI disclosure required for compliance ("AI assistant" or "virtual assistant").
  const NICHE_WOW_GREETINGS: Record<string, string> = {
    auto_glass:         `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I can usually get you booked same-day — what's going on with your vehicle?"`,
    hvac:               `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. We handle heating and cooling calls 24/7, including emergencies — what's going on with your system?"`,
    plumbing:           `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. We take emergency calls too, not just regular repairs — what's happening?"`,
    dental:             `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I can get you on the schedule — are you a new patient or coming back to see us?"`,
    legal:              `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I make sure every inquiry gets to the right person quickly — what's brought you to call today?"`,
    salon:              `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I can check availability and hold your spot — what service were you looking to book?"`,
    property_management:`"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I track every request so nothing slips — are you a tenant, owner, or looking to lease?"`,
    barbershop:         `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I can lock in your chair — are you looking to walk in or book ahead?"`,
    restaurant:         `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I handle reservations and can answer any questions — what can I help you with?"`,
    print_shop:         `"{{BUSINESS_NAME}} — {{AGENT_NAME}} here, AI assistant. I can get your order started and answer any spec questions — what are you looking to print?"`,
  }
  if (NICHE_WOW_GREETINGS[niche]) {
    variables.GREETING_LINE = NICHE_WOW_GREETINGS[niche]
  }

  // Legacy TONE_INSTRUCTIONS — map from preset for backward compatibility
  if (presetId === 'professional_warm') {
    variables.TONE_INSTRUCTIONS = "Use polished, warm language. Use contractions naturally but avoid slang. Keep sentences clean and direct. Sound confident and approachable."
  } else if (presetId === 'casual_friendly') {
    variables.TONE_INSTRUCTIONS = "Use contractions, colloquial language, and a friendly, laid-back tone. Say things like 'hey there', 'no worries', 'you betcha'."
  } else {
    variables.TONE_INSTRUCTIONS = ''
  }

  // After-hours behavior (AFTER_HOURS_INSTRUCTIONS for prompt variable injection)
  if (afterHoursBehavior === 'route_emergency' && emergencyPhone) {
    variables.AFTER_HOURS_INSTRUCTIONS = `If the caller mentions it's after hours or an emergency: "for emergencies, i can connect ya to ${emergencyPhone} — want me to do that?" If yes, use transferCall tool. If no: "no worries, i'll take a message and {{CLOSE_PERSON}} will call ya back first thing."`
  } else if (afterHoursBehavior === 'standard') {
    variables.AFTER_HOURS_INSTRUCTIONS = 'If the caller mentions it\'s after hours: "we\'re closed right now — our hours are {{HOURS_WEEKDAY}}. i can take a message and have {{CLOSE_PERSON}} call ya back when we open."'
  } else {
    // take_message (default) — same behavior during and after hours
    variables.AFTER_HOURS_INSTRUCTIONS = ''
  }

  // Completion fields from intake (if provided)
  const completionFields = intake.completion_fields as string | undefined
  if (completionFields?.trim()) variables.COMPLETION_FIELDS = completionFields

  // Compute LOCATION_STRING — empty if city is missing or "N/A" (e.g. voicemail fast-track)
  const rawCity = variables.CITY || ''
  variables.LOCATION_STRING = rawCity && rawCity !== 'N/A' ? ` in ${rawCity}` : ''

  // Call handling mode instructions — two-path resolver (agent_mode takes precedence over call_handling_mode)
  const rawAgentMode = (intake.agent_mode as string) || null
  const callHandlingMode = (intake.call_handling_mode as string) || 'triage'
  const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
  let modeInstruction = MODE_INSTRUCTIONS[effectiveMode] ?? MODE_INSTRUCTIONS.triage
  if (modeInstruction.includes('{{CLOSE_PERSON}}')) {
    modeInstruction = modeInstruction.replace('{{CLOSE_PERSON}}', variables.CLOSE_PERSON || 'the team')
  }
  variables.CALL_HANDLING_MODE_INSTRUCTIONS = modeInstruction

  // Phase 2b — apply agent-mode variable defaults for deeper build-time behavior.
  // Must run after niche+intake overrides (already in variables) and after effectiveMode is known.
  // Returns FORBIDDEN_EXTRA append text and TRIAGE_DEEP fallback for the post-build pipeline.
  let { modeForbiddenExtra, modeTriageDeep, modeForcesTriageDeep } = applyModeVariableOverrides(effectiveMode, variables)

  // service_catalog — override TRIAGE_DEEP + FIRST_INFO_QUESTION for appointment_booking with catalog
  if (effectiveMode === 'appointment_booking' && catalogServiceNames.length > 0) {
    const nameList = catalogServiceNames.join(', ')
    modeTriageDeep = `Lead with booking. Ask which service they need: ${nameList}. Once you have their name and service, call transitionToBookingStage to check availability and book directly. Do not push through a long triage script.`
    if (catalogServiceNames.length <= 3) {
      const last = catalogServiceNames[catalogServiceNames.length - 1]
      const rest = catalogServiceNames.slice(0, -1)
      variables.FIRST_INFO_QUESTION = rest.length > 0
        ? `What would you like to book — ${rest.join(', ')}, or ${last} — and when works for you?`
        : `I can help book a ${last} — what day works best for you?`
    }
  }

  // FAQ pairs from structured input
  const faqPairsRaw = intake.niche_faq_pairs as string | undefined
  let faqPairsFormatted = ''
  if (faqPairsRaw) {
    try {
      const pairs = JSON.parse(faqPairsRaw) as { question: string; answer: string }[]
      if (pairs.length > 0) {
        faqPairsFormatted = pairs
          .filter(p => p.question?.trim() && p.answer?.trim())
          .map(p => `**Q: ${p.question.trim()}**\n"${p.answer.trim()}"`)
          .join('\n\n')
      }
    } catch { /* invalid JSON — skip */ }
  }
  // Merge with legacy caller_faq if present
  const legacyFaq = (intake.caller_faq as string)?.trim() || ''
  variables.FAQ_PAIRS = [faqPairsFormatted, legacyFaq].filter(Boolean).join('\n\n') || 'No FAQ pairs configured yet.'

  // Knowledge docs — NOT inlined into stored prompt
  // Uploaded docs are already seeded into knowledge_chunks for pgvector retrieval.
  // Inlining raw document text bloats prompts past GLM-4.6 limits.
  if (knowledgeDocs?.trim()) {
    console.log(`[prompt-builder] knowledgeDocs (${knowledgeDocs.length} chars) NOT inlined — served via pgvector retrieval`)
  }

  // Fallback defaults
  variables.AGENT_NAME = variables.AGENT_NAME || 'Alex'
  variables.SERVICES_NOT_OFFERED = variables.SERVICES_NOT_OFFERED || ''
  variables.URGENCY_KEYWORDS = variables.URGENCY_KEYWORDS || '"emergency", "flooding", "no heat", "electrical fire", "burst pipe", "gas leak", "water everywhere"'

  // Pre-resolve variable values that reference other variables.
  // e.g. voicemail niche sets CLOSE_PERSON = '{{BUSINESS_NAME}}' — must resolve before template fill
  // because buildPrompt does a single pass and won't catch values introduced by earlier substitutions.
  for (const key of Object.keys(variables)) {
    if (variables[key]?.includes('{{')) {
      variables[key] = variables[key].replace(
        /\{\{([A-Z_]+)\}\}/g,
        (_, k: string) => variables[k] ?? '',
      )
    }
  }

  // Build base prompt
  let prompt = buildPrompt(variables)

  // D183 — Inject YOUR PRIMARY GOAL at top of # GOAL section to anchor GLM-4.6
  // Must run before any section replacements so subsequent injections don't interfere.
  const PRIMARY_GOAL_MAP_BUILD: Record<string, string> = {
    message_only: "Take the caller's name, phone, and message. That is your only job.",
    voicemail_replacement: "Take the caller's name, phone, and message. Answer 1-2 basic questions if asked. Then close.",
    info_hub: "Answer the caller's question using your knowledge base. Qualify the lead. Capture their info.",
    appointment_booking: "Book an appointment on this call. Answer questions, check the calendar, confirm the slot.",
    full_service: "Answer questions, qualify the lead, and book an appointment if the caller is ready.",
  }
  const buildPrimaryGoal = PRIMARY_GOAL_MAP_BUILD[effectiveMode] ?? "Understand what the caller needs, collect their info, and route to callback."
  const goalHeadingIdx = prompt.indexOf('\n# GOAL\n')
  if (goalHeadingIdx !== -1) {
    const insertAt = goalHeadingIdx + '\n# GOAL\n'.length
    prompt = prompt.slice(0, insertAt) + '\nYOUR PRIMARY GOAL: ' + buildPrimaryGoal + '\n' + prompt.slice(insertAt)
  }

  // Fix TRANSFER_ENABLED literal value leaking into prompt text (e.g. "unless false is true")
  if (variables.TRANSFER_ENABLED === 'false') {
    prompt = prompt
      .replace(/unless false is true/g, 'unless transfer is enabled')
      .replace(/\(only if false is true\)/g, '(only if transfer is enabled)')
      .replace(/\(false = true\):/g, '(transfer enabled):')
      .replace(/\(false = false\):/g, '(transfer not enabled):')
  } else if (variables.TRANSFER_ENABLED === 'true') {
    prompt = prompt
      .replace(/unless true is true/g, 'when transfer is enabled')
      .replace(/\(only if true is true\)/g, '(transfer is enabled)')
      .replace(/\(true = true\):/g, '(transfer enabled):')
      .replace(/\(true = false\):/g, '(transfer not enabled):')
  }

  // Inject agent restrictions + niche FORBIDDEN_EXTRA after rule 9
  // For print_shop: prepend Rule 3 override (price quoting allowed from KB) before any intake restrictions
  const nicheRestriction = niche === 'print_shop'
    ? 'PRICE QUOTING EXCEPTION: You MAY quote standard product prices from the knowledge base in this prompt. Use the exact amounts listed — do not guess or estimate. For custom sizes or unusual requests, say the team will call back with a firm quote.'
    : ''
  const forbiddenExtra = nicheDefaults.FORBIDDEN_EXTRA || ''
  const agentRestrictions = intake.agent_restrictions as string | undefined
  const effectiveRestrictions = [nicheRestriction, forbiddenExtra, modeForbiddenExtra, agentRestrictions?.trim()].filter(Boolean).join('\n')
  if (effectiveRestrictions) {
    const restrictionLines: string[] = []
    let ruleNum = 10
    for (const line of effectiveRestrictions.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) {
        restrictionLines.push(`${ruleNum}. ${trimmed}`)
        ruleNum++
      }
    }
    if (restrictionLines.length > 0) {
      const insertMarker = '9. A single "okay" or "alright" by itself is NOT a goodbye'
      const markerIdx = prompt.indexOf(insertMarker)
      if (markerIdx !== -1) {
        const lineEnd = prompt.indexOf('\n', markerIdx)
        if (lineEnd !== -1) {
          prompt = prompt.slice(0, lineEnd) + '\n' + restrictionLines.join('\n') + prompt.slice(lineEnd)
        }
      }
    }
  }

  // Inject FILTER_EXTRA before "ANYTHING ELSE" filter case
  const filterExtra = nicheDefaults.FILTER_EXTRA || ''
  if (filterExtra) {
    const filterMarker = 'ANYTHING ELSE (unusual request, unclear, doesn\'t fit above):'
    if (prompt.includes(filterMarker)) {
      prompt = prompt.replace(filterMarker, filterExtra + '\n\n' + filterMarker)
    }
  }

  // Replace shallow triage with deep version.
  // Mode wins when it explicitly redefines call intent (modeForcesTriageDeep);
  // otherwise niche wins and mode is a fallback for niches without a TRIAGE_DEEP.
  let triageDeep = modeForcesTriageDeep ? modeTriageDeep : (nicheDefaults.TRIAGE_DEEP || modeTriageDeep || '')

  // Niche-specific triageDeep modifiers
  if (niche === 'restaurant' && triageDeep) {
    const takesPhoneOrders = (intake.niche_takesPhoneOrders as string) || ''
    if (takesPhoneOrders === 'yes') {
      triageDeep += '\nPHONE ORDERS: We do take phone orders — collect the full order, name, pickup/delivery preference, and phone number.'
    } else if (takesPhoneOrders === 'no') {
      triageDeep += '\nNO PHONE ORDERS: We do NOT take phone orders — direct callers to order online or in-person.'
    }
  }

  if (niche === 'hvac' && triageDeep) {
    const hvacEmergency = (intake.niche_emergency as string) || ''
    if (hvacEmergency === 'business_hours' || hvacEmergency === 'no') {
      triageDeep += '\nNO EMERGENCY SERVICE: If caller has an urgent/after-hours need, let them know we only work during business hours and take a message for callback.'
    }
  }

  if (niche === 'plumbing' && triageDeep) {
    const plumbingEmergency = (intake.niche_emergency as string) || ''
    if (plumbingEmergency === 'yes_business_hours') {
      triageDeep += '\nIMPORTANT: Emergency service is business hours only — for after-hours calls, take a message and flag [URGENT] so the team can call first thing.'
    } else if (plumbingEmergency === 'no') {
      triageDeep += '\nNO EMERGENCY SERVICE: We do not offer emergency service. Take a message and route to next available appointment.'
    }
  }

  if (niche === 'property_management' && triageDeep) {
    const maintenanceContacts = (intake.niche_maintenanceContacts as string)?.trim()
    if (maintenanceContacts) {
      triageDeep += `\nMAINTENANCE ROUTING: When a tenant has an emergency or urgent repair, give them the direct contact from this list based on the issue type:\n${maintenanceContacts}\nMatch the issue to the right person (plumbing issue → plumber, electrical → electrician, general/locks/appliances → general maintenance) and give their name + number directly: "for that you'll want to reach [Name] at [number] — they handle [issue type]."`
    }
  }

  if (niche === 'dental' && triageDeep) {
    const emergencyAppts = (intake.niche_emergencyAppts as string) || ''
    if (emergencyAppts === 'no') {
      triageDeep = triageDeep.replace(
        /flag \[URGENT\] → "I'm flagging this urgent[^"]*"/,
        '"we don\'t have same-day appointments — I\'ll flag this as urgent and have the team call ya back right away to get you in asap"'
      )
    }
  }

  // Inject stage transition trigger when booking is enabled (D81 — Phase 5 Call Stages)
  if (intake.booking_enabled === true && caps.bookAppointments && triageDeep) {
    triageDeep += '\nOnce you have confirmed the caller\'s name AND their service need, call transitionToBookingStage with: callerPhone (copy from CALLER PHONE exactly), callerName (their confirmed name), serviceType (what they need). Do NOT call until both name and service are confirmed.'
  }

  if (triageDeep) {
    const triageStart = prompt.indexOf('## 3. TRIAGE')
    const infoStart = prompt.indexOf('## 4. INFO COLLECTION')
    if (triageStart !== -1 && infoStart !== -1) {
      prompt = prompt.slice(0, triageStart) + '## 3. TRIAGE\n\n' + triageDeep + '\n\n' + prompt.slice(infoStart)
    }
  }

  // Booking notes — append SERVICE NOTES block after TRIAGE when appointment_booking + catalog has notes
  if (effectiveMode === 'appointment_booking' && catalog.length > 0) {
    const notesBlock = buildBookingNotesBlock(catalog)
    if (notesBlock) {
      const infoHeader = prompt.indexOf('\n## 4. INFO COLLECTION')
      if (infoHeader !== -1) {
        prompt = prompt.slice(0, infoHeader) + '\n\n' + notesBlock + prompt.slice(infoHeader)
      }
    }
  }

  // Replace generic info collection with niche-specific flow
  const infoFlowOverride = nicheDefaults.INFO_FLOW_OVERRIDE || ''
  if (infoFlowOverride) {
    const infoStart = prompt.indexOf('## 4. INFO COLLECTION')
    const schedStart = prompt.indexOf('## 5. SCHEDULING')
    if (infoStart !== -1 && schedStart !== -1) {
      prompt = prompt.slice(0, infoStart) + '## 4. INFO COLLECTION\n\n' + infoFlowOverride + '\n\n' + prompt.slice(schedStart)
    }
  }

  // Replace generic closing with niche-specific closing
  const closingOverride = nicheDefaults.CLOSING_OVERRIDE || ''
  if (closingOverride) {
    const closeStart = prompt.indexOf('## 6. CLOSING')
    const escStart = prompt.indexOf('# ESCALATION')
    if (closeStart !== -1 && escStart !== -1) {
      prompt = prompt.slice(0, closeStart) + '## 6. CLOSING\n\n' + closingOverride + '\n\n' + prompt.slice(escStart)
    }
  }

  // Replace generic inline examples with niche-specific examples.
  // End marker is ## CALL HANDLING MODE (not # PRODUCT KNOWLEDGE BASE) so that the
  // CALL HANDLING MODE and FAQ sections are preserved after the replacement.
  const nicheExamples = nicheDefaults.NICHE_EXAMPLES || ''
  if (nicheExamples) {
    const exStart = prompt.indexOf('# INLINE EXAMPLES')
    const callHandlingStart = prompt.indexOf('\n## CALL HANDLING MODE')
    const exEnd = callHandlingStart !== -1 ? callHandlingStart : prompt.indexOf('\n# PRODUCT KNOWLEDGE BASE')
    if (exStart !== -1 && exEnd !== -1) {
      prompt = prompt.slice(0, exStart) + '# INLINE EXAMPLES — READ THESE CAREFULLY\n\n' + nicheExamples + prompt.slice(exEnd)
    }
  }

  // Second variable fill pass — niche content blocks contain {{CLOSE_PERSON}} etc.
  // that were injected AFTER buildPrompt() already did its single pass
  prompt = prompt.replace(
    /\{\{([A-Z_a-z]+)\}\}/g,
    (match, key: string) => variables[key.toUpperCase()] ?? variables[key.toLowerCase()] ?? match,
  )

  // Replace PRODUCT KNOWLEDGE BASE placeholder with actual FAQ content
  const callerFaq = intake.caller_faq as string | undefined
  const nicheFaq = niche === 'print_shop'
    ? buildPrintShopFaq(intake, variables)
    : buildNicheFaqDefaults(niche, variables)
  const effectiveCallerFaq = callerFaq?.trim() || nicheFaq
  const kbMarker = '> **REPLACE THIS ENTIRE SECTION with client-specific Q&A.**'
  if (prompt.includes(kbMarker)) {
    const kbContent = buildKnowledgeBase(effectiveCallerFaq, niche)
    const kbStart = prompt.indexOf(kbMarker)
    const afterKb = prompt.slice(kbStart)
    const nextSection = afterKb.indexOf('\n---')
    if (nextSection !== -1) {
      prompt = prompt.slice(0, kbStart) + kbContent + prompt.slice(kbStart + nextSection)
    } else {
      prompt = prompt.slice(0, kbStart) + kbContent
    }
  }


  // Append pricing policy instruction to knowledge base
  if (pricingInstruction) {
    const kbEndMarker = '# PRODUCT KNOWLEDGE BASE'
    const kbEndIdx = prompt.indexOf(kbEndMarker)
    if (kbEndIdx !== -1) {
      // Find end of KB section (next # heading or end of prompt)
      const afterKb = prompt.slice(kbEndIdx)
      const nextHeading = afterKb.indexOf('\n#', 1)
      const insertAt = nextHeading !== -1 ? kbEndIdx + nextHeading : prompt.length
      prompt = prompt.slice(0, insertAt) + '\n\n' + pricingInstruction + prompt.slice(insertAt)
    } else {
      prompt += '\n\n' + pricingInstruction
    }
  }

  // Append unknown answer behavior instruction
  if (unknownInstruction) {
    const kbEndMarker = '# PRODUCT KNOWLEDGE BASE'
    const kbEndIdx = prompt.indexOf(kbEndMarker)
    if (kbEndIdx !== -1) {
      const afterKb = prompt.slice(kbEndIdx)
      const nextHeading = afterKb.indexOf('\n#', 1)
      const insertAt = nextHeading !== -1 ? kbEndIdx + nextHeading : prompt.length
      prompt = prompt.slice(0, insertAt) + '\n\n' + unknownInstruction + prompt.slice(insertAt)
    } else {
      prompt += '\n\n' + unknownInstruction
    }
  }

  // Inject objection handling section before PRODUCT KNOWLEDGE BASE
  if (objectionsBlock) {
    const kbHeading = '# PRODUCT KNOWLEDGE BASE'
    const kbIdx = prompt.indexOf(kbHeading)
    if (kbIdx !== -1) {
      prompt = prompt.slice(0, kbIdx) + objectionsBlock + '\n\n' + prompt.slice(kbIdx)
    } else {
      prompt += '\n\n' + objectionsBlock
    }
  }


  // Knowledge docs are served via pgvector retrieval — no longer appended to stored prompt

  // Append calendar booking block if booking_enabled AND niche supports appointments
  if (intake.booking_enabled === true && caps.bookAppointments) {
    const serviceType = variables.SERVICE_APPOINTMENT_TYPE || 'appointment'
    const closePerson = variables.CLOSE_PERSON || 'the team'
    prompt += '\n\n' + buildCalendarBlock(serviceType, closePerson)
  }

  // Append SMS follow-up block if sms_enabled — mode-aware so instructions match agent behavior
  if (intake.sms_enabled === true) {
    prompt += '\n\n' + getSmsBlock((intake.agent_mode as string) || null)
  }

  // Append VIP caller protocol block when forwarding_number is set at provision time.
  // Only forwarding_number (not owner_phone) — pageOwner SMS sends TO the forwarding number.
  // patchVipSection() handles post-provision additions when forwarding_number is set later.
  const forwardingNumber = (intake.forwarding_number as string)?.trim()
  if (forwardingNumber) {
    prompt += '\n\n' + getVipBlock()
  }

  // B4 — Wrap named sections in markers so clients can edit them via the settings UI.
  // Markers are stripped before sending to Ultravox (see stripPromptMarkers in prompt-sections.ts).
  prompt = wrapSectionIfPresent(prompt, '# IDENTITY', '# VOICE NATURALNESS', 'identity')
  prompt = wrapSectionIfPresent(prompt, '# PRODUCT KNOWLEDGE BASE', null, 'knowledge')

  return prompt
}

// ── Validation pass (extracted to prompt-validation.ts) ──────────────────────
export { validatePrompt, type PromptValidationResult } from './prompt-validation'

// ── Niche registry helpers ─────────────────────────────────────────────────────

/** Returns true if the niche has a registered entry in NICHE_DEFAULTS.
 *  Used by /niche-test and the onboard wizard to catch unregistered niches early. */
export function isNicheRegistered(niche: string): boolean {
  return niche in NICHE_DEFAULTS && niche !== '_common'
}

/** Returns all registered niche slugs (excluding internal keys). */
export function getRegisteredNiches(): string[] {
  return Object.keys(NICHE_DEFAULTS).filter(k => k !== '_common')
}

// ── SMS template (extracted to sms-template.ts) ────────────────────────────
export { buildSmsTemplate } from './sms-template'
