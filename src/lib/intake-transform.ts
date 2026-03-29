import { OnboardingData, Niche, defaultAgentNames } from "@/types/onboarding";

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
      hoursStr = openDays.length > 0 ? openDays.join(", ") : "By appointment";
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

  // Derive call_handling_mode: step3 is canonical; fallback to agentJob if step3 was skipped
  let effectiveMode = data.callHandlingMode
  if (!effectiveMode && data.agentJob) {
    effectiveMode = data.agentJob === 'booking_agent' ? 'full_service'
      : data.agentJob === 'message_taker' ? 'message_only'
      : 'triage'
  }
  if (!effectiveMode) effectiveMode = 'triage'

  // Override call_handling_mode when agent_mode requires it.
  // voicemail_replacement → message_only (minimal collection, no triage).
  // appointment_booking stays triage — do NOT derive full_service (avoids booking_enabled coupling).
  const agentModeVal = data.agentMode ?? 'lead_capture'
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
    agent_tone: data.agentTone || "casual",
    caller_faq: data.callerFAQ || "",
    agent_restrictions: data.agentRestrictions || "",
    services_offered: data.servicesOffered?.trim() ||
      (Array.isArray(data.nicheAnswers?.services)
        ? (data.nicheAnswers.services as string[]).join(', ')
        : (data.nicheAnswers?.services as string) || ''),
    call_handling_mode: effectiveMode,
    agent_mode: data.agentMode ?? 'lead_capture',
    booking_enabled: effectiveMode === 'full_service',
    owner_phone: (data.callForwardingEnabled && data.emergencyPhone?.trim()) ? data.emergencyPhone.trim() : "",
    voice_id: data.voiceId || null,

    pricing_policy: data.pricingPolicy || "",
    unknown_answer_behavior: data.unknownAnswerBehavior || "",
    common_objections: JSON.stringify(
      (data.commonObjections || []).filter(p => p.question?.trim() && p.answer?.trim())
    ),

    hours_weekend: hoursWeekend,
    niche_faq_pairs: JSON.stringify(data.faqPairs || []),
    // Niche-specific context_data wiring (only one niche active at a time)
    ...(data.niche === 'restaurant' && data.nicheAnswers?.menuData
      ? { context_data: String(data.nicheAnswers.menuData), context_data_label: 'MENU' }
      : data.niche === 'property_management' && data.nicheAnswers?.tenantRoster
      ? { context_data: String(data.nicheAnswers.tenantRoster), context_data_label: 'TENANTS' }
      : {}),
    ...Object.fromEntries(
      Object.entries(data.nicheAnswers).map(([k, v]) =>
        [`niche_${k}`, Array.isArray(v) ? (v as string[]).join(", ") : String(v)]
      )
    ),
  };
}
