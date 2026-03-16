// Onboarding wizard types — shared across all steps

export type Niche =
  | "auto_glass"
  | "hvac"
  | "plumbing"
  | "dental"
  | "legal"
  | "salon"
  | "real_estate"
  | "property_management"
  | "outbound_isa_realtor"
  | "restaurant"
  | "voicemail"
  | "other";

export type NotificationMethod = "telegram" | "sms" | "email" | "both";

export type AfterHoursBehavior = "take_message" | "route_emergency" | "standard";

export type AgentTone = "casual" | "professional" | "match_industry";

export type PrimaryGoal = 'capture_info' | 'book_appointment' | 'faq_only' | '';

export type PricingPolicy =
  | "quote_range"       // Give a ballpark range if asked
  | "no_quote_callback" // Never quote — call back with a quote
  | "website_pricing"   // Direct to website for pricing
  | "collect_first"     // Collect info first, then give a range
  | "";

export interface BusinessHours {
  open: string;   // "09:00" or ""
  close: string;  // "17:00" or ""
  closed: boolean;
}

export interface OnboardingData {
  // Step 1
  niche: Niche | null;

  // Step 2
  businessName: string;
  streetAddress: string;       // Sprint 1 — conditional on NICHE_CONFIG.hasPhysicalAddress
  city: string;
  state: string;
  agentName: string;
  callbackPhone: string;
  ownerName: string;
  contactEmail: string;
  websiteUrl: string;
  businessHoursText: string;   // e.g. "Mon–Fri 9am–5pm, Sat 10am–2pm" — used when step 3 is skipped
  servicesOffered: string;     // brief services description — optional, used when step 4 is skipped

  // Step 3
  hours: {
    monday: BusinessHours;
    tuesday: BusinessHours;
    wednesday: BusinessHours;
    thursday: BusinessHours;
    friday: BusinessHours;
    saturday: BusinessHours;
    sunday: BusinessHours;
  };
  afterHoursBehavior: AfterHoursBehavior;
  emergencyPhone: string;      // Sprint 1 — shown only when afterHoursBehavior === "route_emergency"

  // Step 4 — niche-specific (stored as key-value bag)
  nicheAnswers: Record<string, string | string[] | boolean>;

  // Step 5
  notificationMethod: NotificationMethod;
  notificationPhone: string;
  notificationEmail: string;
  callerAutoText: boolean;        // Send follow-up SMS to caller after call
  callerAutoTextMessage: string;  // Custom message (blank = use default template)

  // Step 6
  callerFAQ: string;          // Moved to Settings > Advanced Context (kept in type for backwards compat)
  agentRestrictions: string;  // Moved to Settings > Advanced Context
  agentTone: AgentTone;
  primaryGoal: PrimaryGoal;
  completionFields: string;   // Moved to Settings > Advanced Context
  pricingPolicy: PricingPolicy;
}

// ── Niche metadata — controls which fields are shown per niche ────────────────
// Step sequence logic lives in getStepSequence() in page.tsx.
// All standard niches use 3-step fast-track [1, 2, 7].
// voicemail + real_estate use [1, 2, 4, 7] (their niche Q's feed custom prompt builders).
export const NICHE_CONFIG: Record<Niche, {
  hasPhysicalAddress: boolean;  // show streetAddress in step 2
}> = {
  auto_glass:           { hasPhysicalAddress: true  },
  hvac:                 { hasPhysicalAddress: false },
  plumbing:             { hasPhysicalAddress: false },
  dental:               { hasPhysicalAddress: true  },
  legal:                { hasPhysicalAddress: true  },
  salon:                { hasPhysicalAddress: true  },
  real_estate:          { hasPhysicalAddress: false },
  property_management:  { hasPhysicalAddress: true  },
  outbound_isa_realtor: { hasPhysicalAddress: false },
  restaurant:           { hasPhysicalAddress: true  },
  voicemail:            { hasPhysicalAddress: false },
  other:                { hasPhysicalAddress: false },
};

export const defaultHours: BusinessHours = {
  open: "09:00",
  close: "17:00",
  closed: false,
};

export const defaultOnboardingData: OnboardingData = {
  niche: null,
  businessName: "",
  streetAddress: "",
  city: "",
  state: "",
  agentName: "",
  callbackPhone: "",
  ownerName: "",
  contactEmail: "",
  websiteUrl: "",
  businessHoursText: '',
  servicesOffered: '',
  hours: {
    monday: { ...defaultHours },
    tuesday: { ...defaultHours },
    wednesday: { ...defaultHours },
    thursday: { ...defaultHours },
    friday: { ...defaultHours },
    saturday: { open: "", close: "", closed: true },
    sunday: { open: "", close: "", closed: true },
  },
  afterHoursBehavior: "take_message",
  emergencyPhone: "",
  nicheAnswers: {},
  notificationMethod: "telegram",
  notificationPhone: "",
  notificationEmail: "",
  callerAutoText: true,
  callerAutoTextMessage: "",
  callerFAQ: "",
  agentRestrictions: "",
  agentTone: "casual",
  primaryGoal: "",
  completionFields: "",
  pricingPolicy: "",
};

export const nicheLabels: Record<Niche, string> = {
  auto_glass: "Auto Glass Shop",
  hvac: "HVAC / Heating & Cooling",
  plumbing: "Plumbing",
  dental: "Dental Office",
  legal: "Law Firm",
  salon: "Salon / Barbershop",
  real_estate: "Real Estate Agent",
  property_management: "Property Management",
  outbound_isa_realtor: "Realtor ISA (Outbound)",
  restaurant: "Restaurant / Food Service",
  voicemail: "Voicemail / Message Taking",
  other: "Other Business",
};

export const nicheEmojis: Record<Niche, string> = {
  auto_glass: "🚗",
  hvac: "❄️",
  plumbing: "🔧",
  dental: "🦷",
  legal: "⚖️",
  salon: "✂️",
  real_estate: "🏠",
  property_management: "🏘️",
  outbound_isa_realtor: "📞",
  restaurant: "🍕",
  voicemail: "📬",
  other: "🏢",
};

export const defaultAgentNames: Record<Niche, string> = {
  auto_glass: "Mark",
  hvac: "Mike",
  plumbing: "Dave",
  dental: "Ashley",
  legal: "Jordan",
  salon: "Jamie",
  real_estate: "Alex",
  property_management: "Jade",
  outbound_isa_realtor: "Fatima",
  restaurant: "Sofia",
  voicemail: "Sam",
  other: "Sam",
};
