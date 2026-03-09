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
  | "other";

export type NotificationMethod = "telegram" | "sms" | "email" | "both";

export type AfterHoursBehavior = "take_message" | "route_emergency" | "standard";

export type AgentTone = "casual" | "professional" | "match_industry";

export interface BusinessHours {
  open: string;   // "09:00" or ""
  close: string;  // "17:00" or ""
  closed: boolean;
}

export type PrimaryGoal = 'capture_info' | 'book_appointment' | 'faq_only' | '';

export interface OnboardingData {
  // Step 1
  niche: Niche | null;

  // Step 2
  businessName: string;
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

  // Step 4 — niche-specific (stored as key-value bag)
  nicheAnswers: Record<string, string | string[] | boolean>;

  // Step 5
  notificationMethod: NotificationMethod;
  notificationPhone: string;
  notificationEmail: string;

  // Step 6
  callerFAQ: string;
  agentRestrictions: string;
  agentTone: AgentTone;
  primaryGoal: PrimaryGoal;
  completionFields: string;
}

export const defaultHours: BusinessHours = {
  open: "09:00",
  close: "17:00",
  closed: false,
};

export const defaultOnboardingData: OnboardingData = {
  niche: null,
  businessName: "",
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
  nicheAnswers: {},
  notificationMethod: "telegram",
  notificationPhone: "",
  notificationEmail: "",
  callerFAQ: "",
  agentRestrictions: "",
  agentTone: "casual",
  primaryGoal: "",
  completionFields: "",
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
  other: "Sam",
};
