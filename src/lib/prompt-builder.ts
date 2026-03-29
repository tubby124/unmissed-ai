import { wrapSection } from '@/lib/prompt-sections'
import { getCapabilities } from '@/lib/niche-capabilities'
import { VOICE_PRESETS } from './voice-presets'
import { MODE_INSTRUCTIONS, getSmsBlock } from './prompt-patcher'
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

  // Voicemail uses its own lightweight template (no city, no inbound triage)
  if (niche === 'voicemail') return buildVoicemailPrompt(intake)

  // Real estate uses its own persona-style template
  if (niche === 'real_estate') return buildRealEstatePrompt(intake)

  const nicheDefaults = NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS.other

  // Layer: common → niche → intake overrides
  const variables: Record<string, string> = {
    ...NICHE_DEFAULTS._common,
    ...nicheDefaults,
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
    modeTriageDeep = `Lead with booking. Ask which service they need: ${nameList}. Call checkCalendarAvailability right away. Do not push through a long triage script.`
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
  const triageDeep = modeForcesTriageDeep ? modeTriageDeep : (nicheDefaults.TRIAGE_DEEP || modeTriageDeep || '')
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
