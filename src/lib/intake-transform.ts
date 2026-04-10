import { OnboardingData, Niche, defaultAgentNames } from "@/types/onboarding";
import { planToMode } from "@/lib/plan-entitlements";

// Map province/state abbreviations to timezone
export const TIMEZONE_MAP: Record<string, string> = {
  // Canada
  AB: "America/Edmonton", BC: "America/Vancouver", SK: "America/Regina",
  MB: "America/Winnipeg", ON: "America/Toronto", QC: "America/Toronto",
  NB: "America/Halifax", NS: "America/Halifax", PE: "America/Halifax",
  NL: "America/St_Johns", NT: "America/Yellowknife", YT: "America/Whitehorse",
  NU: "America/Iqaluit",
  // US — Eastern
  CT: "America/New_York", DE: "America/New_York", GA: "America/New_York",
  IN: "America/New_York", KY: "America/New_York", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York",
  OH: "America/New_York", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", VT: "America/New_York", VA: "America/New_York",
  WV: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  // US — Central
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago",
  IA: "America/Chicago", KS: "America/Chicago", LA: "America/Chicago",
  MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago",
  NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  WI: "America/Chicago",
  // US — Mountain
  CO: "America/Denver", ID: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // US — Pacific
  CA: "America/Los_Angeles", NV: "America/Los_Angeles",
  OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  // US — Other
  AZ: "America/Phoenix", HI: "America/Honolulu", AK: "America/Anchorage",
  MI: "America/Detroit",
};

export function detectCountry(stateOrProvince: string): string {
  const canadianProvinces = ["AB","BC","SK","MB","ON","QC","NB","NS","PE","NL","NT","YT","NU"];
  return canadianProvinces.includes(stateOrProvince.toUpperCase()) ? "CA" : "US";
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Returns true if the current agentName was auto-set by the system (not user-typed),
 * meaning it's safe to overwrite it with a new niche default.
 *
 * Rule: only overwrite if name is empty OR exactly matches the current niche's default.
 * This prevents clobbering user-typed names that happen to match a different niche's default.
 */
export function agentNameIsAutoSet(
  currentName: string,
  currentNiche: string | null,
): boolean {
  if (!currentName) return true;
  const currentNicheDefault = currentNiche ? defaultAgentNames[currentNiche as Niche] : null;
  return currentName === currentNicheDefault;
}

export function mapInsuranceToPreset(nicheInsurance: string): string {
  const mapping: Record<string, string> = {
    all_major: "all_insurance",
    private_pay: "private_only",
    pending: "waiting_approval",
    other: "private_only",
  };
  return mapping[nicheInsurance] || "private_only";
}

/**
 * T4: Collapse per-day hours into natural ranges.
 * "Monday 9:00 AM–5:00 PM, Tuesday 9:00 AM–5:00 PM, ..., Friday 9:00 AM–5:00 PM"
 * → "Monday–Friday 9:00 AM–5:00 PM"
 */
export function collapseIdenticalHours(perDayStr: string): string {
  // Parse "DayName HH:MM AM–HH:MM PM" entries
  const entries = perDayStr.split(',').map(s => s.trim()).filter(Boolean)
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const parsed: Array<{ day: string; hours: string }> = []
  for (const entry of entries) {
    const spaceIdx = entry.indexOf(' ')
    if (spaceIdx === -1) return perDayStr // can't parse, return unchanged
    const day = entry.slice(0, spaceIdx)
    const hours = entry.slice(spaceIdx + 1)
    if (!dayOrder.includes(day)) return perDayStr // unexpected format
    parsed.push({ day, hours })
  }
  if (parsed.length === 0) return perDayStr

  // Group consecutive days with identical hours
  const groups: Array<{ days: string[]; hours: string }> = []
  for (const { day, hours } of parsed) {
    const last = groups[groups.length - 1]
    if (last && last.hours === hours) {
      const lastDayIdx = dayOrder.indexOf(last.days[last.days.length - 1])
      const thisDayIdx = dayOrder.indexOf(day)
      if (thisDayIdx === lastDayIdx + 1) {
        last.days.push(day)
        continue
      }
    }
    groups.push({ days: [day], hours })
  }

  // Format ranges
  return groups.map(g => {
    if (g.days.length === 1) return `${g.days[0]} ${g.hours}`
    return `${g.days[0]}–${g.days[g.days.length - 1]} ${g.hours}`
  }).join(', ')
}

/**
 * Transform OnboardingData (camelCase, from wizard) into
 * intake payload (snake_case) stored in intake_json.
 */
export function toIntakePayload(data: OnboardingData) {
  const to12h = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  let hoursStr: string;
  if (data.businessHoursText?.trim()) {
    hoursStr = data.businessHoursText.trim();
  } else {
    try {
      const openDays = dayNames
        .filter(d => !data.hours[d].closed)
        .map(d => `${d.charAt(0).toUpperCase() + d.slice(1)} ${to12h(data.hours[d].open)}–${to12h(data.hours[d].close)}`);
      hoursStr = openDays.length > 0 ? collapseIdenticalHours(openDays.join(", ")) : "By appointment";
    } catch {
      hoursStr = data.businessHoursText || "By appointment";
    }
  }

  const digits = data.callbackPhone.replace(/\D/g, "");
  const areaCode = digits.length >= 10
    ? digits.slice(digits.length === 11 ? 1 : 0, digits.length === 11 ? 4 : 3)
    : "587";

  const niche = data.niche || "other";
  const defaultName = niche ? defaultAgentNames[niche as Niche] : "Sam";
  const stateCode = (data.state || "AB").toUpperCase();
  const country = detectCountry(stateCode);

  const rawInsurance = (data.nicheAnswers.insurance as string) || "";
  const insurancePreset = rawInsurance ? mapInsuranceToPreset(rawInsurance) : "private_only";

  const weekendPolicy = data.hours.saturday.closed && data.hours.sunday.closed
    ? "closed weekends"
    : !data.hours.saturday.closed && !data.hours.sunday.closed
    ? "open weekends"
    : !data.hours.saturday.closed
    ? "open Saturdays only"
    : "open Sundays only";

  // Build weekend hours string (null if both Saturday and Sunday closed)
  const satDay = data.hours?.saturday
  const sunDay = data.hours?.sunday
  let hoursWeekend: string | null = null
  if (satDay && !satDay.closed && sunDay && !sunDay.closed) {
    hoursWeekend = `Saturday ${to12h(satDay.open)}–${to12h(satDay.close)}, Sunday ${to12h(sunDay.open)}–${to12h(sunDay.close)}`
  } else if (satDay && !satDay.closed) {
    hoursWeekend = `Saturday ${to12h(satDay.open)}–${to12h(satDay.close)}`
  } else if (sunDay && !sunDay.closed) {
    hoursWeekend = `Sunday ${to12h(sunDay.open)}–${to12h(sunDay.close)}`
  }

  // Phase 7: Derive call_handling_mode from plan when available (Plan = Mode).
  // Fallback chain: selectedPlan → callHandlingMode → agentJob → agentMode → 'triage'
  let effectiveMode = data.callHandlingMode
  if (data.selectedPlan) {
    const planMode = planToMode(data.selectedPlan)
    effectiveMode = planMode === 'appointment_booking' ? 'full_service'
      : planMode === 'voicemail_replacement' ? 'message_only'
      : 'triage'
  } else if (!effectiveMode && data.agentJob) {
    effectiveMode = data.agentJob === 'booking_agent' ? 'full_service'
      : data.agentJob === 'message_taker' ? 'message_only'
      : 'triage'
  }
  if (!effectiveMode) effectiveMode = 'triage'

  // Override call_handling_mode when agent_mode requires it.
  // voicemail_replacement → message_only (minimal collection, no triage).
  // appointment_booking stays triage — do NOT derive full_service (avoids booking_enabled coupling).
  const agentModeVal = data.agentMode ?? (data.selectedPlan ? planToMode(data.selectedPlan) : 'lead_capture')
  if (agentModeVal === 'voicemail_replacement') {
    effectiveMode = 'message_only'
  }

  return {
    business_name: data.businessName,
    niche,
    area_code: areaCode,
    country,
    city: data.city || "N/A",
    province: stateCode,
    timezone: data.timezone || TIMEZONE_MAP[stateCode] || 'America/Edmonton',
    owner_name: data.ownerName || "",
    contact_email: data.contactEmail || "",
    website_url: data.websiteUrl || "",
    primary_goal: data.primaryGoal || "",
    completion_fields: data.completionFields || "",
    notification_method: data.notificationMethod || "telegram",
    notification_phone: data.notificationPhone || "",
    notification_email: data.notificationEmail || "",
    agent_name: data.agentName || defaultName,
    hours_weekday: hoursStr,
    insurance_preset: insurancePreset,
    weekend_policy: weekendPolicy,
    callback_phone: data.callbackPhone,
    after_hours_behavior: data.afterHoursBehavior || "take_message",
    emergency_phone: data.emergencyPhone || "",
    // voice_style_preset is written directly by provision/trial/route.ts — agent_tone is dead
    caller_faq: data.callerFAQ || "",
    agent_restrictions: data.agentRestrictions || "",
    services_offered: data.servicesOffered?.trim() ||
      (Array.isArray(data.nicheAnswers?.services)
        ? (data.nicheAnswers.services as string[]).join(', ')
        : (data.nicheAnswers?.services as string) || ''),
    services_not_offered: (() => {
      const excluded = Array.isArray(data.nicheAnswers?.excludedServices)
        ? (data.nicheAnswers.excludedServices as string[])
        : data.nicheAnswers?.excludedServices
          ? [data.nicheAnswers.excludedServices as string]
          : [];
      const labelMap: Record<string, string> = {
        no_rv: "RV windshields", no_large_crack: "cracks longer than 6 inches",
        no_fleet: "fleet accounts", no_tinting: "window tinting", no_adas: "ADAS recalibration",
        no_septic: "septic systems", no_commercial_grease: "commercial grease traps",
        no_gas: "gas line work", no_reno: "bathroom renovations", no_well: "well systems",
        no_commercial: "commercial HVAC", no_oil_furnace: "oil furnaces",
        no_radiant: "radiant heating", no_geothermal: "geothermal systems",
        no_duct_fabrication: "custom duct fabrication",
      };
      return excluded.map(k => labelMap[k] || k).join(", ");
    })(),
    urgency_keywords: (() => {
      const p1 = (data.nicheAnswers?.p1Triggers as string[]) || [];
      const em = (data.nicheAnswers?.maintenanceEmergencyTriggers as string[])
        || (data.nicheAnswers?.emergencyTriggers as string[]) || [];
      const labelMap: Record<string, string> = {
        burst_pipe: "burst pipe", flooding: "flooding", no_water: "no water supply",
        sewage_backup: "sewage backup", gas_smell: "gas smell", ceiling_dripping: "ceiling dripping",
        no_heat: "no heat", no_heat_winter: "no heat in winter", furnace_not_starting: "furnace not starting",
        carbon_monoxide: "carbon monoxide", no_cooling_extreme_heat: "no AC in extreme heat",
        system_flooded: "system flooded", sparking: "sparking outlet or wires",
        security: "security breach", no_hot_water: "no hot water", elevator_stuck: "stuck elevator", fire: "fire"
      };
      return [...p1, ...em].map(k => labelMap[k] || k).join(", ");
    })(),
    diagnostic_fee: (data.nicheAnswers?.diagnosticFee as string) || "",
    call_handling_mode: effectiveMode,
    agent_mode: data.agentMode ?? 'lead_capture',
    booking_enabled: effectiveMode === 'full_service' || agentModeVal === 'appointment_booking' || (data.niche === 'real_estate' && !!data.nicheAnswers?.calendarIntent),
    owner_phone: (data.callForwardingEnabled && data.emergencyPhone?.trim()) ? data.emergencyPhone.trim() : "",
    voice_id: data.voiceId || null,

    pricing_policy: data.pricingPolicy || "",
    unknown_answer_behavior: data.unknownAnswerBehavior || "",
    // Phase E.6 Wave 3 — closes E.5 Wave 2 deferral. Fresh trial signups
    // now carry calendar mode into clients.calendar_mode on first provision.
    calendar_mode: data.calendarMode || "",
    // Phase E.7 — closes the business_notes phantom-data gap. Trims to
    // the 3000-char cap enforced by the dashboard editor AND the slot
    // ceiling test (BUSINESS_NOTES: 3400).
    business_notes: (data.businessNotes || "").slice(0, 3000),
    common_objections: JSON.stringify(
      (data.commonObjections || []).filter(p => p.question?.trim() && p.answer?.trim())
    ),

    hours_weekend: hoursWeekend,
    niche_faq_pairs: JSON.stringify(data.faqPairs || []),
    ...(data.nicheCustomVariables ? { niche_custom_variables: data.nicheCustomVariables } : {}),
    // D413 — PM after-hours fields (explicit keys consumed by PM prompt builder)
    ...(data.niche === 'property_management' && data.nicheAnswers?.emergencyTechPhone
      ? { after_hours_emergency_phone: String(data.nicheAnswers.emergencyTechPhone) }
      : {}),
    ...(data.niche === 'property_management' && data.nicheAnswers?.afterHoursBehavior
      ? { after_hours_behavior: String(data.nicheAnswers.afterHoursBehavior) }
      : {}),
    // D417 — Business address
    ...(data.businessAddress?.trim() ? { niche_businessAddress: data.businessAddress.trim() } : {}),
    // Niche-specific context_data wiring (explicit niche data takes priority)
    // Fallback: use Haiku-extracted contextData from website scrape (D246)
    // D259: priceRange entered during onboarding is prepended to context_data when present
    // D320: urgencyWords persisted alongside priceRange in context_data
    ...(data.niche === 'restaurant' && data.nicheAnswers?.menuData
      ? { context_data: String(data.nicheAnswers.menuData), context_data_label: 'MENU' }
      : data.niche === 'property_management' && data.nicheAnswers?.tenantRoster
      ? { context_data: String(data.nicheAnswers.tenantRoster), context_data_label: 'TENANTS' }
      : data.niche === 'real_estate' && (data.nicheAnswers?.brokerage || (data.nicheAnswers?.serviceAreas as string[])?.length)
      ? (() => {
          const lines: string[] = []
          const brokerage = (data.nicheAnswers?.brokerage as string)?.trim()
          if (brokerage) lines.push(`Brokerage: ${brokerage}`)
          const areas = data.nicheAnswers?.serviceAreas as string[] | undefined
          if (areas?.length) lines.push(`Service areas: ${areas.join(', ')}`)
          const focus = (data.nicheAnswers?.focus as string)?.trim()
          if (focus && focus !== 'both') {
            lines.push(`Specialty: ${focus === 'commercial' ? 'Commercial real estate' : 'Residential homes'}`)
          }
          return lines.length > 0
            ? { context_data: lines.join('\n'), context_data_label: 'AGENT CONTEXT' }
            : {}
        })()
      : (() => {
          const pricePrefix = data.priceRange?.trim() ? `PRICES\n${data.priceRange.trim()}\n\n` : ''
          const urgencyPrefix = data.urgencyWords?.trim() ? `URGENCY KEYWORDS\n${data.urgencyWords.trim()}\n\n` : ''
          const scraped = data.websiteScrapeResult?.contextData ? String(data.websiteScrapeResult.contextData) : ''
          const combined = (pricePrefix + urgencyPrefix + scraped).trim()
          return combined
            ? { context_data: combined, context_data_label: 'BUSINESS INFO' }
            : {}
        })()),
    ...Object.fromEntries(
      Object.entries(data.nicheAnswers).map(([k, v]) =>
        [`niche_${k}`, Array.isArray(v) ? (v as string[]).join(", ") : String(v)]
      )
    ),
  };
}
