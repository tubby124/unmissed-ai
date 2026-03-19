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
  allFeaturesIncluded: true,
  label: "7-day free trial",
  description: "Full access to every feature. No credit card required to start.",
};

// ─── Base Plan (what they pay after trial) ──────────────────────────
export const BASE_PLAN = {
  name: "Starter",
  monthly: 30,
  dailyFraming: "~$1/day",
  minutes: 100,
  description: "Everything you need to stop missing calls.",
};

// ─── Beta Launch Promo ──────────────────────────────────────────────
export const BETA_PROMO = {
  enabled: true,
  monthly: 20,
  minutes: 100,
  badge: "Beta Pricing",
  label: "$20/mo — limited time",
  description: "Lock in our lowest rate. Price goes to $30/mo after beta.",
  regularPrice: BASE_PLAN.monthly,
};

// ─── Future Tiers (teased, not purchasable yet) ─────────────────────
export const FUTURE_TIERS = [
  { name: "Growth", price: 75, status: "coming-soon" as const },
  { name: "Pro", price: 140, status: "coming-soon" as const },
];

// ─── All Features (included on every plan, including trial) ─────────
export const ALL_FEATURES = [
  "AI agent answers every call 24/7",
  "Lead scoring (HOT / WARM / COLD)",
  "Instant Telegram + SMS alerts",
  "Automatic caller follow-up text",
  "Live call transfer to your phone",
  "Calendar booking (Google Calendar)",
  "Daily 8AM call digest",
  "Niche-specific AI prompt",
  "Dashboard with full call log",
  "The Learning Loop (weekly AI review)",
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
  { feature: "Pricing model", myai: "Per minute", goodcall: "Per caller", rosie: "Per minute", smithai: "Per call", askbenny: "Per minute", unmissed: "Flat rate" },
  { feature: "Starting price", myai: "$99/mo", goodcall: "$79/mo", rosie: "$49/mo", smithai: "$95/mo", askbenny: "$49 CAD/mo", unmissed: `$${BETA_PROMO.enabled ? BETA_PROMO.monthly : BASE_PLAN.monthly}/mo CAD` },
  { feature: "All features included", myai: "No — tiered", goodcall: "No — tiered", rosie: "No — tiered", smithai: "No — tiered", askbenny: "No — tiered", unmissed: "Yes" },
  { feature: "Setup", myai: "Self-serve", goodcall: "Self-serve", rosie: "Self-serve", smithai: "Assisted", askbenny: "Self-serve", unmissed: "Done for you (48hr)" },
  { feature: "Niche-specific prompts", myai: "No", goodcall: "No", rosie: "No", smithai: "No", askbenny: "No", unmissed: "Yes" },
  { feature: "Booking included", myai: "No ($149+)", goodcall: "No ($129+)", rosie: "No ($149+)", smithai: "No ($270+)", askbenny: "Yes", unmissed: "Yes" },
  { feature: "Live call transfer", myai: "Blind only", goodcall: "No", rosie: "No", smithai: "Yes", askbenny: "No", unmissed: "Yes" },
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

// ─── Helper: effective monthly price ────────────────────────────────
export function getEffectiveMonthly(): number {
  return BETA_PROMO.enabled ? BETA_PROMO.monthly : BASE_PLAN.monthly;
}

// ─── Helper: format for prompt/copy ─────────────────────────────────
export function getPricingSummary(): string {
  const price = getEffectiveMonthly();
  return BETA_PROMO.enabled
    ? `$${price}/mo CAD (beta pricing — regular $${BASE_PLAN.monthly}/mo)`
    : `$${price}/mo CAD`;
}
