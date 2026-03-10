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
  pricingPolicy: PricingPolicy; // Sprint 1 — conditional on NICHE_CONFIG.showPricingPolicy
}

// ── Niche metadata — controls which fields are shown per niche ────────────────
// To change what a niche shows/hides: edit ONE row here, no step files needed.
export const NICHE_CONFIG: Record<Niche, {
  hasPhysicalAddress: boolean;  // show streetAddress in step 2
  showPricingPolicy: boolean;   // show pricingPolicy in step 6
  showFullHours: boolean;       // show full 7-day hours picker vs. simplified
}> = {
  auto_glass:           { hasPhysicalAddress: true,  showPricingPolicy: true,  showFullHours: true  },
  hvac:                 { hasPhysicalAddress: false, showPricingPolicy: true,  showFullHours: true  },
  plumbing:             { hasPhysicalAddress: false, showPricingPolicy: true,  showFullHours: true  },
  dental:               { hasPhysicalAddress: true,  showPricingPolicy: false, showFullHours: true  },
  legal:                { hasPhysicalAddress: true,  showPricingPolicy: false, showFullHours: true  },
  salon:                { hasPhysicalAddress: true,  showPricingPolicy: true,  showFullHours: true  },
  real_estate:          { hasPhysicalAddress: false, showPricingPolicy: false, showFullHours: false },
  property_management:  { hasPhysicalAddress: true,  showPricingPolicy: false, showFullHours: true  },
  outbound_isa_realtor: { hasPhysicalAddress: false, showPricingPolicy: false, showFullHours: false },
  voicemail:            { hasPhysicalAddress: false, showPricingPolicy: false, showFullHours: false },
  other:                { hasPhysicalAddress: false, showPricingPolicy: false, showFullHours: true  },
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
  voicemail: "Sam",
  other: "Sam",
};
