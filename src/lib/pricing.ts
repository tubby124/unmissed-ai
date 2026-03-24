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
  includes: "50 free minutes included",
  description: "We build your AI agent, tune it to your niche, and get you live.",
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
    name: "Lite",
    tagline: "Never miss the message",
    monthly: 49,
    foundingMonthly: 29,
    annual: 24, // annual pricing TBD
    annualBilledTotal: 288, // annual pricing TBD
    minutes: 100,
    description: "For missed calls and after-hours coverage.",
    isPopular: false,
    stripeMonthlyPriceId: "price_1TELcq0tFbm4ZBYUK50MsRnA", // $49/mo CAD (FOUNDING29 promo = $29/mo)
    stripeAnnualPriceId: "price_1TELcr0tFbm4ZBYUwvbhTbRM",
    stripeProductId: "prod_UCl8SbXQTqNhT6",
    foundingStripeMonthlyPriceId: "", // Not needed — founding rate uses promo code FOUNDING29 ($20/mo off coupon)
    features: [
      "Live AI voicemail (24/7)",
      "Captures name, number & reason for call",
      "Call summary texted to owner",
      "SMS notification on every call",
      "Niche-specific AI prompt",
      "Dashboard with full call log",
    ],
    notIncluded: ["Booking", "Call transfer", "Website knowledge", "Lead scoring"],
    cta: "Start 7-Day Free Trial",
    href: "/onboard",
  },
  {
    id: "core" as const,
    name: "Core",
    tagline: "Never miss the customer",
    monthly: 119,
    annual: 79, // annual pricing TBD
    annualBilledTotal: 948, // annual pricing TBD
    minutes: 400,
    description: "For busy businesses that can't afford missed leads.",
    isPopular: true,
    stripeMonthlyPriceId: "price_1TELcr0tFbm4ZBYUIoRpqUMR", // $119/mo CAD
    stripeAnnualPriceId: "price_1TELcr0tFbm4ZBYUgCoLTyef",
    stripeProductId: "prod_UCl8nni05Nk9lB",
    features: [
      "Everything in Lite",
      "Full AI receptionist (answers 24/7)",
      "Website + Google Business knowledge",
      "Lead capture & scoring (HOT / WARM / COLD)",
      "Automatic caller follow-up text",
      "Daily 8AM call digest",
      "The Learning Loop (weekly AI review)",
    ],
    notIncluded: ["Booking", "Call transfer"],
    cta: "Start 7-Day Free Trial",
    href: "/onboard",
  },
  {
    id: "pro" as const,
    name: "Pro",
    tagline: "Turn calls into booked jobs",
    monthly: 229,
    annual: 149, // annual pricing TBD
    annualBilledTotal: 1788, // annual pricing TBD
    minutes: 1000,
    description: "For businesses that want calls turned into bookings and handoffs.",
    isPopular: false,
    stripeMonthlyPriceId: "price_1TELcs0tFbm4ZBYUcHGVoofT", // $229/mo CAD
    stripeAnnualPriceId: "price_1TELcs0tFbm4ZBYUTl9M87FL",
    stripeProductId: "prod_UCl8d1JTMthpf7",
    features: [
      "Everything in Core",
      "Calendar booking (Google Calendar)",
      "Live call transfer to your phone",
      "Structured intake & qualification",
      "Smarter call routing logic",
      "Priority support",
      "Advanced follow-up controls",
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
  setupTime: "Agent live within 48 hours",
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
  { feature: "No per-minute overages", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes" },
  { feature: "Setup", myai: "Self-serve", goodcall: "Self-serve", rosie: "Self-serve", smithai: "Assisted", askbenny: "Self-serve", unmissed: "Done for you (48hr)" },
  { feature: "Niche-specific prompts", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes" },
  { feature: "Booking included", myai: "No ($149+)", goodcall: "No ($129+)", rosie: "No ($149+)", smithai: "No ($270+)", askbenny: "Yes", unmissed: `Yes (Pro — $${PLANS[2].monthly}/mo)` },
  { feature: "Live call transfer", myai: "Blind only", goodcall: "No", rosie: "No", smithai: "Yes", askbenny: "No", unmissed: `Yes (Pro — $${PLANS[2].monthly}/mo)` },
  { feature: "Bilingual", myai: "No ($149+)", goodcall: "Limited", rosie: "Yes", smithai: "Yes", askbenny: "EN/FR", unmissed: "English (more coming)" },
  { feature: "Learns from calls", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes (Learning Loop)" },
  { feature: "Your data", myai: "Vendor-locked", goodcall: "Vendor-locked", rosie: "Vendor-locked", smithai: "Vendor-locked", askbenny: "Vendor-locked", unmissed: "Dashboard (yours)" },
  { feature: "Instant mobile alerts", myai: "Email", goodcall: "Email", rosie: "Email", smithai: "Email + SMS", askbenny: "SMS/Email", unmissed: "Telegram + SMS" },
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
  description: "Lock in $29/mo Lite forever. Standard price: $49/mo.",
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
