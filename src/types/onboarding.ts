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
  | "print_shop"
  | "mechanic_shop"
  | "pest_control"
  | "electrician"
  | "locksmith"
  | "other";

export type NotificationMethod = "telegram" | "sms" | "email" | "both";

export type AfterHoursBehavior = "take_message" | "route_emergency" | "standard";

export type AgentTone = "casual_friendly" | "professional_warm" | "direct_efficient" | "empathetic_care";

export type PrimaryGoal = 'capture_info' | 'book_appointment' | 'faq_only' | '';

export type PricingPolicy =
  | "quote_range"       // Give a ballpark range if asked
  | "no_quote_callback" // Never quote — call back with a quote
  | "website_pricing"   // Direct to website for pricing
  | "collect_first"     // Collect info first, then give a range
  | "";

export type UnknownAnswerBehavior =
  | "take_message"      // Take a message and promise callback
  | "transfer"          // Transfer to live person
  | "find_out_callback" // Say "I'll find out and we'll call you back"
  | "";

// Phase E.6 Wave 3 — mirrors CALENDAR_MODE_OPTIONS in AgentPageView.tsx
// Day1EditPanel. Keep values in sync with that chip group.
export type CalendarMode =
  | "none"              // No calendar, just take messages
  | "request_callback"  // Ask preferred time, route to human callback
  | "book_direct"       // Book directly into owner calendar
  | "";

export interface BusinessHours {
  open: string;   // "09:00" or ""
  close: string;  // "17:00" or ""
  closed: boolean;
}

export interface WebsiteScrapeResult {
  businessFacts: string[];
  extraQa: { q: string; a: string }[];
  serviceTags: string[];
  warnings: string[];
  scrapedAt: string;
  scrapedUrl: string;
  approvedFacts: boolean[];
  approvedQa: boolean[];
  /** Haiku-extracted prices/policies/urgency block for context_data (D246) */
  contextData?: string | null;
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
  placeId?: string;               // Google Places place_id from autocomplete selection
  placesPhotoUrl?: string;        // Business photo URL from Google Places
  placesRating?: number;          // Google rating (1-5)
  placesReviewCount?: number;     // Total review count from Google
  gbpDescription?: string;        // Google Business Profile editorial summary (seeds business_facts)
  nicheCustomVariables?: Record<string, string>; // AI-generated prompt variables for 'other' businesses
  agentIntelligenceSeed?: Record<string, string>; // Full agent intelligence seed from generate-agent-intelligence
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
  unknownAnswerBehavior: UnknownAnswerBehavior;
  // Phase E.6 Wave 3 — closes the E.5 Wave 2 deferral. Pre-E.6 calendar_mode
  // was dashboard-only (Day1EditPanel chip group). Now flows through the
  // onboarding form intake-transform → clients.calendar_mode so fresh trial
  // signups carry their preference into the prompt.
  calendarMode: CalendarMode;
  // Phase E.7 — closes the business_notes phantom-data gap. Plan Phase E.2 +
  // E.9 called for a free-form "About your business" textarea with a 3000-char
  // cap. The DB column, ClientConfig type, and buildBusinessNotes slot all
  // shipped in Phase E, but no editor or persistence path landed. E.7 wires
  // the dashboard textarea, intake-transform line, and form default so the
  // <business_notes> slot can actually be populated.
  businessNotes: string;
  commonObjections: { question: string; answer: string }[];

  // New: voice + call handling + knowledge
  voiceId: string | null;
  voiceName: string;
  callHandlingMode: 'message_only' | 'triage' | 'full_service';
  faqPairs: { question: string; answer: string; source?: 'scraped' | 'manual' }[];
  knowledgeDocs: { id: string; filename: string; charCount: number }[];
  timezone: string;

  // SCRAPE1: Website scrape preview data (populated on step 6)
  websiteScrapeResult: WebsiteScrapeResult | null;

  // IVR pre-filter — voicemail menu before connecting to AI agent
  ivrEnabled: boolean;
  ivrPrompt: string;  // custom menu message (blank = use default)

  // New 6-step onboarding flow fields
  scheduleMode: '24_7' | 'business_hours' | 'custom';
  callForwardingEnabled: boolean;
  agentJob?: 'message_taker' | 'receptionist' | 'booking_agent';

  // Plan selection (step 4)
  selectedPlan: 'lite' | 'core' | 'pro' | null;

  // Internal behavior profile — Phase 1: carried through intake, not yet surfaced in UI.
  agentMode?: 'voicemail_replacement' | 'lead_capture' | 'info_hub' | 'appointment_booking';

  // D125/D126: Service catalog collected during onboarding (step 3)
  // selectedServices: simple name strings ticked from niche suggestions or added manually
  selectedServices?: string[];
  // parsedServiceDrafts: structured drafts from the freeform paste+parse flow (D126)
  parsedServiceDrafts?: { name: string; description?: string; price?: string; duration_mins?: number | null }[];

  // D127: Raw FAQ text entered during onboarding — parsed to extra_qa at provision time
  callerFaqText?: string;

  // D247: Owner's top reasons people call — used to generate custom TRIAGE_DEEP via Haiku
  callerReasons?: string[];

  // D258: What callers say when it's urgent — improves URGENT block in TRIAGE_DEEP
  urgencyWords?: string;

  // D259: Typical price range for most common service — injected into context_data
  priceRange?: string;

  // D393: Manual business description when no website + no GBP description available
  manualDescription?: string;

  // D417: Business address — optional, displayed in agent context
  businessAddress?: string;
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
  print_shop:           { hasPhysicalAddress: true  },
  mechanic_shop:        { hasPhysicalAddress: true  },
  pest_control:         { hasPhysicalAddress: false },
  electrician:          { hasPhysicalAddress: false },
  locksmith:            { hasPhysicalAddress: false },
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
  afterHoursBehavior: "standard",
  emergencyPhone: "",
  nicheAnswers: {},
  notificationMethod: "email",
  notificationPhone: "",
  notificationEmail: "",
  callerAutoText: false,
  callerAutoTextMessage: "",
  callerFAQ: "",
  agentRestrictions: "",
  agentTone: "casual_friendly",
  primaryGoal: "",
  completionFields: "",
  pricingPolicy: "",
  unknownAnswerBehavior: "",
  calendarMode: "",
  businessNotes: "",
  commonObjections: [],
  voiceId: null,
  voiceName: '',
  callHandlingMode: 'triage',
  faqPairs: [],
  knowledgeDocs: [],
  timezone: '',
  websiteScrapeResult: null,
  ivrEnabled: false,
  ivrPrompt: '',
  scheduleMode: 'business_hours',
  callForwardingEnabled: false,
  selectedPlan: null,
  selectedServices: [],
  parsedServiceDrafts: [],
  callerFaqText: '',
  urgencyWords: '',
  priceRange: '',
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
  print_shop: "Print Shop",
  mechanic_shop: "Auto Mechanic Shop",
  pest_control: "Pest Control",
  electrician: "Electrician",
  locksmith: "Locksmith",
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
  print_shop: "🖨️",
  mechanic_shop: "🔩",
  pest_control: "🐛",
  electrician: "⚡",
  locksmith: "🔑",
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
  print_shop: "Alex",
  mechanic_shop: "Jake",
  pest_control: "Tyler",
  electrician: "Ryan",
  locksmith: "Chris",
  other: "Sam",
};
