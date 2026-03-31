/**
 * SINGLE SOURCE OF TRUTH — unmissed.ai Pricing
 *
 * Edit THIS file to change pricing across the entire website.
 * After editing: rebuild + push to Railway.
 *
 * NOTE: Zara's prompt (clients/unmissed-demo/SYSTEM_PROMPT.txt) and
 * domain-knowledge.md must be manually kept in sync with these numbers.
 * Run /prompt-deploy unmissed-demo after updating.
 *
 * Stripe products/prices must also be updated separately via Stripe dashboard.
 */

// ─── Currency ───────────────────────────────────────────────────────
export const CURRENCY = "CAD";

// ─── Setup Fee ──────────────────────────────────────────────────────
export const SETUP = {
  price: 25,
  label: "$25 one-time setup",
  includes: "Built from your Google Business Profile and website — live before your first call",
  description: "Your agent is built from your business info as you onboard. Live before you forward your first call.",
};

// ─── Free Trial ─────────────────────────────────────────────────────
export const TRIAL = {
  days: 7,
  minutes: 50,
  allFeaturesIncluded: true,
  label: "7-day free trial",
  description: "Full access to your plan. No credit card required to start.",
};

// ─── Plans (3-tier) ─────────────────────────────────────────────────
export const PLANS = [
  {
    id: "lite" as const,
    name: "AI Voicemail",
    tagline: "Your calls get answered. You get the summary, not the voicemail.",
    monthly: 49,
    foundingMonthly: 29,
    annual: 24, // annual pricing TBD
    annualBilledTotal: 288, // annual pricing TBD
    minutes: 100,
    description: "Stop missing calls. Every message captured and forwarded to you instantly — who called, what they need, and when.",
    isPopular: false,
    stripeMonthlyPriceId: "price_1TELcq0tFbm4ZBYUK50MsRnA", // $49/mo CAD — NOT used for new signups (see STRIPE_SUBSCRIPTION_PRICE_ID env var)
    stripeAnnualPriceId: "price_1TELcr0tFbm4ZBYUwvbhTbRM",
    stripeProductId: "prod_UCl8SbXQTqNhT6",
    // TO GO LIVE AT $29 (no coupon): create a $29/mo CAD recurring price for prod_UCl8SbXQTqNhT6
    // in Stripe Dashboard, then update Railway env var STRIPE_SUBSCRIPTION_PRICE_ID to that price ID.
    // Sandbox $29 test price (sk_test_): "price_1TFVvt15xbnnajlTRXrQZcLV"
    features: [
      "100 minutes/month included",
      "Answers every call — even when you're on a job",
      "Captures caller name, number, and what they need",
      "Instant SMS to every caller after the call",
      "Trained on your trade: services, hours, and common questions",
      "Full call history in your dashboard",
    ],
    notIncluded: ["Booking", "Live call transfer", "Website & Google Business knowledge", "Caller priority ranking"],
    cta: "Start 7-Day Free Trial",
    href: "/onboard",
  },
  {
    id: "core" as const,
    name: "Smart Receptionist",
    tagline: "Answers questions, qualifies leads, and handles callers like a trained receptionist — 24/7.",
    monthly: 119,
    annual: 79, // annual pricing TBD
    annualBilledTotal: 948, // annual pricing TBD
    minutes: 400,
    description: "Your agent knows your business and never forgets it. Answers caller questions, ranks every lead, and tells you who's worth calling back — before you dial.",
    isPopular: true,
    stripeMonthlyPriceId: "price_1TELcr0tFbm4ZBYUIoRpqUMR", // $119/mo CAD
    stripeAnnualPriceId: "price_1TELcr0tFbm4ZBYUgCoLTyef",
    stripeProductId: "prod_UCl8nni05Nk9lB",
    features: [
      "400 minutes/month included",
      "Everything in AI Voicemail",
      "Answers from your own business info — website, hours, services",
      "Ranks every caller so you know who to call back first",
      "Instant SMS to every caller after the call",
      "Daily morning summary of all your calls",
      "Weekly review — your agent gets smarter from real call patterns",
    ],
    notIncluded: ["Booking", "Live call transfer"],
    cta: "Start 7-Day Free Trial",
    href: "/onboard",
  },
  {
    id: "pro" as const,
    name: "Receptionist + Booking",
    tagline: "Books the job while you're on the job.",
    monthly: 229,
    annual: 149, // annual pricing TBD
    annualBilledTotal: 1788, // annual pricing TBD
    minutes: 1000,
    description: "The only agent that actually books the appointment. No back-and-forth, no missed opportunities — jobs go straight into your calendar.",
    isPopular: false,
    stripeMonthlyPriceId: "price_1TELcs0tFbm4ZBYUcHGVoofT", // $229/mo CAD
    stripeAnnualPriceId: "price_1TELcs0tFbm4ZBYUTl9M87FL",
    stripeProductId: "prod_UCl8d1JTMthpf7",
    features: [
      "1,000 minutes/month included",
      "Everything in Smart Receptionist",
      "Books appointments automatically into your Google Calendar",
      "Transfers to you when it matters — urgent calls reach your phone live",
      "Collects full job details before you even pick up the phone",
      "Priority support",
      "Customizable follow-up messages",
    ],
    notIncluded: [],
    cta: "Start 7-Day Free Trial",
    href: "/onboard",
  },
];

// ─── Guarantee & Policies ───────────────────────────────────────────
export const POLICIES = {
  guarantee: "7-day free trial — cancel anytime, no questions asked",
  contracts: "No contracts. Cancel anytime.",
  cancellation: "Cancel anytime — no notice period, no fees.",
  dataOwnership: "Your call log data lives in your dashboard — you own it.",
  setupTime: "Live before your first call — built during setup",
};

// ─── Competitor Data (for comparison tables) ────────────────────────
export const COMPETITORS = [
  {
    name: "Dialzara",
    plan: "$29/mo",
    minutes: "60 min",
    at200Calls: "$290+",
    catch: "2 min/day limit",
    model: "Per-minute",
  },
  {
    name: "Rosie",
    plan: "$49/mo",
    minutes: "250 min",
    at200Calls: "$99+",
    catch: "Booking requires $149/mo",
    model: "Per-minute",
  },
  {
    name: "My AI Front Desk",
    plan: "$99/mo",
    minutes: "200 min",
    at200Calls: "$199+",
    catch: "Bilingual requires $149/mo",
    model: "Per-minute",
  },
  {
    name: "Goodcall",
    plan: "$79/mo",
    minutes: "100 callers",
    at200Calls: "$129+",
    catch: "Per unique caller, not minutes",
    model: "Per-caller",
  },
  {
    name: "Smith.ai",
    plan: "$95/mo",
    minutes: "50 calls",
    at200Calls: "$455+",
    catch: "Human hybrid, very expensive",
    model: "Per-call",
  },
  {
    name: "Ask Benny",
    plan: "$49 CAD/mo",
    minutes: "150 min",
    at200Calls: "$99+ CAD",
    catch: "No niche-specific prompts",
    model: "Per-minute",
  },
];

// ─── Feature Comparison (for detailed table) ────────────────────────
export const FEATURE_COMPARISON = [
  { feature: "Pricing model", myai: "Per minute", goodcall: "Per caller", rosie: "Per minute", smithai: "Per call", askbenny: "Per minute", unmissed: "Flat rate per plan" },
  { feature: "Starting price", myai: "$99/mo", goodcall: "$79/mo", rosie: "$49/mo", smithai: "$95/mo", askbenny: "$49 CAD/mo", unmissed: `$${PLANS[0].monthly}/mo CAD` },
  { feature: "Predictable monthly cost", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes — flat base rate, no surprise overage fees" },
  { feature: "Setup", myai: "Self-serve", goodcall: "Self-serve", rosie: "Self-serve", smithai: "Assisted", askbenny: "Self-serve", unmissed: "Done for you — live during signup" },
  { feature: "Niche-specific prompts", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes" },
  { feature: "Books appointments automatically", myai: "No ($149+)", goodcall: "No ($129+)", rosie: "No ($149+)", smithai: "No ($270+)", askbenny: "Yes", unmissed: `Yes (${PLANS[2].name} — $${PLANS[2].monthly}/mo)` },
  { feature: "Transfers to you when it matters", myai: "Blind only", goodcall: "No", rosie: "No", smithai: "Yes", askbenny: "No", unmissed: `Yes (${PLANS[2].name} — $${PLANS[2].monthly}/mo)` },
  { feature: "Bilingual", myai: "No ($149+)", goodcall: "Limited", rosie: "Yes", smithai: "Yes", askbenny: "EN/FR", unmissed: "English (more coming)" },
  { feature: "Learns from calls", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes (weekly review)" },
  { feature: "Your data", myai: "Vendor-locked", goodcall: "Vendor-locked", rosie: "Vendor-locked", smithai: "Vendor-locked", askbenny: "Vendor-locked", unmissed: "Dashboard (yours)" },
  { feature: "Instant call alerts to owner", myai: "Email", goodcall: "Email", rosie: "Email", smithai: "Email + SMS", askbenny: "SMS/Email", unmissed: "Telegram + SMS" },
  { feature: "Contracts", myai: "Monthly", goodcall: "Monthly", rosie: "Monthly", smithai: "Monthly", askbenny: "Monthly", unmissed: "None — cancel anytime" },
];

// ─── Supported Niches ───────────────────────────────────────────────
export const NICHES = {
  live: ["Auto glass", "Property management", "Real estate", "Print shops", "General"],
  comingSoon: ["HVAC", "Plumbing", "Roofing", "Dental", "Legal"],
};

// ─── Minute Reload Packs ────────────────────────────────────────────
export const MINUTE_RELOAD = {
  price: 10,
  minutes: 50,
  label: "$10 for 50 extra minutes",
  perMinuteRate: 0.20,
};

export const MINUTE_RELOAD_LARGE = {
  price: 30,
  minutes: 200,
  label: "$30 for 200 extra minutes",
  perMinuteRate: 0.15,
};

export const MINUTE_RELOAD_PACKS = [MINUTE_RELOAD, MINUTE_RELOAD_LARGE];

// ─── Stripe IDs (LIVE MODE) ──────────────────────────────────────────
// Keep this section updated whenever you create/change Stripe objects.
// Dashboard: https://dashboard.stripe.com/products
// Tier prices are in PLANS[].stripeMonthlyPriceId above. Legacy IDs below are for setup/reload/subscription30.
export const STRIPE_IDS = {
  // Products (LIVE)
  monthlyPlanProduct: "prod_UAAaWOiJh2h9lQ",   // "unmissed.ai Monthly Plan"
  setupFeeProduct: "prod_UAAaWQ57Tje9ui",       // "Voice Agent Setup Fee"
  minuteReloadProduct: "prod_UBCwssI4xxHSkH",   // "Minute Reload Pack"

  // Prices (LIVE) — legacy flat-rate + add-ons (tier prices are in PLANS[] above)
  subscription30: "price_1TCqWD0tFbm4ZBYUCY6ZPT8B",  // $30/mo CAD recurring (legacy)
  setupFresh25: "price_1TBqFM0tFbm4ZBYUw652WMUb",    // $25 one-time (fresh number)
  setupInventory20: "price_1TBqFM0tFbm4ZBYUC6rzz3pH", // $20 one-time (inventory number)
  minuteReload10: "price_1TCqWF0tFbm4ZBYUm6MZjnpN",   // $10 one-time (50 min reload)

  // Coupons & Promo Codes (LIVE)
  betaCoupon: "WFO1Xm9V",                        // $10 off/mo forever → $20/mo (legacy)
  betaPromoCode: "BETA20",                       // Customer-facing code (legacy)
  foundingCoupon: "i0s7bCCd",                    // $20 off/mo forever → Lite $29/mo
  foundingPromoCode: "FOUNDING29",               // Customer-facing code
  foundingPromoId: "promo_1TEXP20tFbm4ZBYUSUAOBUjs", // Stripe promo code object ID

  // Env var mapping (what Railway needs):
  // STRIPE_SUBSCRIPTION_PRICE_ID = subscription30
  // STRIPE_SETUP_PRICE_ID = setupFresh25
  // STRIPE_SETUP_INVENTORY_PRICE_ID = setupInventory20

  // TEST MODE IDs (for local dev with sk_test_ key):
  // subscription30_test: "price_1TCqDg15xbnnajlTxcmoDfRB"
  // setupFresh25_test: "price_1TBq9G15xbnnajlTSbay8T8f"
  // setupInventory20_test: "price_1TBq9H15xbnnajlTTELdagZi"
  // minuteReload10_test: "price_1TCqS415xbnnajlTAmq9sLty"
  // betaCoupon_test: "l5jvNI95"
};

// ─── Backward-compat exports ─────────────────────────────────────────
// These keep existing components working without changes.
// Migrate them to PLANS[] over time.
export const BASE_PLAN = {
  name: PLANS[1].name,
  monthly: PLANS[1].monthly,
  dailyFraming: "~$3.97/day",
  minutes: PLANS[1].minutes,
  description: PLANS[1].description,
};

export const FOUNDING_PROMO = {
  enabled: true,
  monthly: PLANS[0].monthly,
  foundingMonthly: 29,
  minutes: PLANS[0].minutes,
  badge: "Founding Rate",
  label: "$29/mo locked for founding members",
  description: "Lock in $29/mo AI Voicemail forever. Standard price: $49/mo.",
  regularPrice: PLANS[0].monthly,
};

/** @deprecated Use FOUNDING_PROMO instead */
export const BETA_PROMO = FOUNDING_PROMO;

export const FUTURE_TIERS: Array<{ name: string; price: number; status: "coming-soon" }> = [];

export const ALL_FEATURES = [...PLANS[1].features];

// ─── Helpers ────────────────────────────────────────────────────────
export function getEffectiveMonthly(): number {
  return PLANS[0].monthly; // Lite plan — "starting at" price
}

export function getPricingSummary(): string {
  return `from $${PLANS[0].monthly}/mo CAD`;
}
