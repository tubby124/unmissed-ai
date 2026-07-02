---
type: reference
status: verified
tags: [product, pricing, facts, demo, sales]
related: ["[[2026-07-02-demo-that-sells-SHIPPED]]"]
updated: 2026-07-02
---
> Extracted from CODE 2026-07-02 (pricing.ts, plan-entitlements.ts, carrier-codes.ts, guardrails/privacy/terms pages).
> Use this — NOT PRICING.md (stale) — for any sales copy, prompt facts, or customer answer about the product.
> Re-verify against pricing.ts before quoting if plans have changed since this date.

# End Voicemail / unmissed.ai — Product Ground-Truth Fact Sheet
Source of truth = code, not docs. PRICING.md is STALE (ignore it). Currency = CAD everywhere.

## 0. IDENTITY
- Brand: "End Voicemail", domain endvoicemail.ai, product "AI Receptionist", tagline "End voicemail. Answer every call." — src/lib/brand.ts:11-14
- Founder: Hasan Sharif, Canadian operator, Saskatoon SK + Calgary AB — src/app/about/page.tsx:37-58,246-258
- "Canadian-built, PIPEDA-first" — src/app/about/page.tsx:207-214
- Serves clients "across Canada and the United States", Saskatoon/Calgary home — src/app/about/page.tsx:255-257

## 1. PRICING (source: src/lib/pricing.ts, plan-entitlements.ts)
- IMPORTANT: PUBLIC_PLANS = PLANS filtered by `hidden:true`. lite/pro/tester are ALL hidden → only ONE plan is public: **Core "AI Receptionist"**. pricing.ts:153, hidden flags at :48,104,133
- Public plan = AI Receptionist (id "core"): standard $189/mo, **founding $119/mo** (charged amount), 250 included minutes. isPopular. — pricing.ts:69-95
  - Founding rate badge "locks in forever" — PricingCards.tsx:91; FOUNDING_PROMO — pricing.ts:262-271
  - Stripe: only a $119 price exists (price_1TQdWK...); "$189 is display-only — no $189 Stripe price exists" — pricing.ts:80
- HIDDEN tiers (not on public site, but resolvable internally):
  - Solo (lite): $49/mo std, founding $29, 100 min. Paused from public — pricing.ts:39-68,48
  - Front Desk Pro (pro): $189/mo, 1000 min, IVR+transfer. Hidden — pricing.ts:96-122,104
  - Tester (friends&family): $10/mo, 100 min, all Core features — pricing.ts:123-146
- Setup fee: **$0 / "No setup fee"** — pricing.ts:18-23 (SETUP.price=0). NOTE: PRICING.md's $20/$25 setup is STALE/dead.
- Activation minutes: **50** — TRIAL.minutes=50, "50 activation minutes included", 7-day window (TRIAL.days=7) — pricing.ts:26-32
- Homepage/pricing hero copy: "$119/mo with 250 included minutes" — PricingHero.tsx:54, marketing-content.ts:159

### Minute reload packs (3-tier ladder) — pricing.ts:178-202, buy-minutes/route.ts:9-11
- Pack 0: $10 → 50 min ($0.20/min)
- Pack 1: $15 → 100 min ($0.15/min)  [marketed as best value: "double for $5 more"]
- Pack 2: $30 → 200 min ($0.15/min)
- Dashboard buys via /api/billing/buy-minutes (packIndex→own Stripe price ID) — correct $10/$15/$30 pricing. BillingCard.tsx:104,217
- DISCREPANCY (AMBIGUOUS): a SECOND route /api/stripe/create-reload-checkout exists that charges flat $0.20/min in 50-min multiples (50–250 min) — create-reload-checkout/route.ts:11,34-36. This would mis-price the 100-min pack at $20 not $15. The dashboard does NOT use this route; it uses buy-minutes. Sales should quote $10/50, $15/100, $30/200.
- FAQ answer only mentions the $10/50 pack — marketing-content.ts:182
- Reloads require active/past_due subscription + provisioned phone number — BillingCard.tsx:47

### Overage / minutes-run-out behavior — inbound/route.ts:122-148
- effectiveLimit = monthly_minute_limit + bonus_minutes — :126
- When usage >= effectiveLimit and NOT in grace period → **call HARD-BLOCKED** (agent does not answer); owner gets alert "Call blocked — minute limit reached… Reload minutes in your dashboard to resume calls." — :131-139
- Grace period: if grace_period_end is in future, over-limit callers are still allowed (flagged isOverLimit) — :143-148
- NO automatic overage billing. Minutes do NOT auto-charge; user must buy reload packs. ("No surprise overages" — About/FAQ, marketing-content.ts:182,187)
- Rollover: NOT stated anywhere in code. `seconds_used_this_month` implies monthly reset; bonus_minutes (reloads) persist as a separate additive bucket. UNANSWERED whether unused *plan* minutes roll over — assume no.

### Activation minutes (50) mechanics
- Trial mode: bonus_minutes=0, but getEffectiveMinuteLimit returns TRIAL.minutes=50 while subscription_status='trialing' — activate-client.ts:363, plan-entitlements.ts:175-177
- Paid activation: **bonus_minutes = 50** added on top of plan minutes (one-time) — activate-client.ts:363; monthly_minute_limit set from plan — :364
- Trial agent calls capped at 180s max duration; paid at 600s — per-call-context-contract §2.4 / call-path-matrix
- Card required to activate the AI number — PricingHero.tsx:63, keep-your-number:121

### 30-day guarantee — pricing.ts:156-166 (POLICIES), terms/page.tsx:100-116
- "30-day money-back guarantee. If it's not working for your business in your first 30 paid days, full refund — no questions, no forms." — pricing.ts:159
- Fine print: ONE refund per customer lifetime, first paid subscription only — pricing.ts:160, terms:106-108
- After 30 days: case-by-case for service-impacting issues only; no retroactive refunds for unused time — terms:108-110
- Refund contact: support@endvoicemail.ai — marketing-content.ts:237

### Cancel flow — POLICIES pricing.ts:161-162, terms:114-116,268-270
- "No contracts. Cancel anytime." Cancel from dashboard in one click, no notice period, no fees. Billing stops at end of current period.
- Stripe customer portal route wired (create-portal-session) but per tracker "BLOCKED ON HASAN" needs Stripe dashboard config (may not be live) — refactor-phase-tracker
- Data exportable 30 days post-cancellation — terms:284

## 2. FEATURES — what CORE ($119) actually includes (plan-entitlements.ts CORE :67-81)
- minutes: 250; defaultMode: lead_capture
- bookingEnabled: **true** (calendar booking) — :71 ("Phase 7: Core now includes booking")
- transferEnabled: **true** (live call transfer) — :72 ("D416: Transfer enabled for Core")
- smsEnabled: **true** (SMS follow-up/auto-text) — :73
- knowledgeEnabled: **true** (website+GBP ingestion) — :74; maxWebsiteUrls 3, maxKnowledgeDocs 5, maxKnowledgeSources 3 — :77-80
- learningLoopEnabled: **true** (weekly AI review) — :75
- leadScoringEnabled: **true** (HOT/WARM/COLD) — :76
- fileUploadEnabled: **true** — :79
- NOT included on Core: **IVR pre-filter** (Pro only) — pricing.ts:92, PRO transferEnabled note ":88 Pro includes IVR + transfer"
- Core marketed features list: 250 min, caller capture, answers from your business info, urgency/timing capture, lead ranking, "Daily morning summary of all your calls", "Weekly review — agent gets smarter" — pricing.ts:83-91

### PricingCards live capability rows (rendered from entitlements) — PricingCards.tsx:13-20
- SMS follow-up: included(Core) ✓; Calendar booking: ✓; Live call transfer: ✓
- IMPORTANT CAVEAT (call-path-capability-matrix §6): SMS requires twilio_number; live transfer + IVR are PHONE-CALLS-ONLY (no WebRTC/browser); trial has no twilio_number so SMS won't fire in trial.

### Feature reality check (per docs + code)
- Dashboard: call log, lead classification, transcripts, recordings+audio, capabilities card, knowledge editor, settings, live-call monitor, billing — dashboard-card-manifest, settings cards
- Alert channels: **Email default, Telegram optional** (faster). SMS is caller-facing follow-up, NOT the owner alert channel. — marketing-content.ts:143,202; keep-your-number:69; HOW_IT_WORKS
  - Telegram/email notification prefs are DB_ONLY flags — control-plane-mutation-contract
- Transcripts + recordings + AI summary in dashboard "within 30 seconds of call ending" — guardrails:36-37
- Lead classification HOT/WARM/COLD (leadScoringEnabled) — plan-entitlements.ts:37,76
- Calendar booking: Google Calendar; booking tool registers when booking_enabled; UI badge also needs calendar_auth_status='connected' — plan-entitlements/control-plane
- Live call transfer: transferCall tool, needs forwarding_number + PSTN — call-path-matrix
- SMS follow-up to callers: sendTextMessage tool, needs sms_enabled + twilio_number — control-plane
- Knowledge base / website scrape + GBP ingestion: pgvector knowledge_chunks, approve pipeline — control-plane
- IVR: Pro only (ivr_enabled); simple 2-choice pre-filter (1=voicemail, else agent) — call-path-matrix §7
- Voicemail fallback: served only when Ultravox call creation fails, or IVR digit 1 — call-path-matrix; voicemail recordings stored but NOT transcribed (deferred)
- Weekly digest / "weekly review": learningLoopEnabled + weekly_digest_enabled flag; digest cron noted "not yet built" in one place but minute/trial crons shipped — control-plane; pricing.ts:90. AMBIGUOUS whether weekly digest email is live.
- Daily morning summary: marketed (pricing.ts:89) — delivery mechanism not verified in this pass. AMBIGUOUS.

## 3. SETUP + CARRIERS
- Setup model: agent built from Google Business Profile + website + onboarding answers BEFORE first forwarded-call test; goes live after forwarding configured + real phone-path test — SETUP pricing.ts:18-23, POLICIES.setupTime :165
- AI IS trained on their business: GBP + website scrape + setup answers/services/hours/FAQs — marketing-content.ts:136,192; HOW_IT_WORKS step 02
- Forwarding = CONDITIONAL call forwarding (not unconditional). Customer keeps their number; forward only fires when unanswered/busy/unreachable, after 4-6 rings — keep-your-number:62; carrier-codes.ts:8-15
- Conditional forwarding codes (GSM, all Canadian carriers) — carrier-codes.ts:51-70:
  - No answer (CFNRy): enable `*61*{number}#`, disable `##61#`
  - Busy (CFB): `*67*{number}#` / `##67#`
  - Unreachable (CFNRc): `*62*{number}#` / `##62#`
- Carriers supported (all use same GSM codes): Rogers, Fido, Chatr, Bell, Virgin Plus, Lucky Mobile, Telus, Koodo, Public Mobile, Freedom Mobile, + "Other/not sure" — carrier-codes.ts:78-94
- WHAT BREAKS VOICEMAIL: carrier voicemail must be FULLY REMOVED (not paused/toggled) — it shares the same network slot; "whichever activated last wins." iPhone Visual Voicemail must also be removed. — carrier-codes.ts:16-19; marketing FAQ :222,227; keep-your-number:99-107
- Setup time to remove voicemail: "5-minute call to carrier support"; we give script + support number — FAQ :222,227; keep-your-number:105
- CarrierCompatibilityCheck component gates dial codes behind voicemail-removal confirmation — refactor-phase-tracker
- Setup time overall: "Built during setup; live after forwarding is tested" — POLICIES pricing.ts:165

## 4. TRUST / GUARDRAILS (src/app/guardrails/page.tsx — 8 bounded promises :22-55)
1. Only says what you told it (trained on GBP/website/onboarding); out of scope → "let me have them call you back"
2. Never makes up prices — flags as knowledge gap in weekly review
3. No promises you can't keep (no booking unless calendar connected + slot; no service area unless listed)
4. Every call recorded + reviewable (audio + transcript + summary in dashboard <30s)
5. Learns from calls but YOU approve every change (surfaces suggestions after 5+ patterns; nothing changes without sign-off)
6. Tells callers it's an AI assistant IF asked ("I'm an AI assistant for [business]") — doesn't pretend to be human
7. Can transfer to you (on eligible plan / when live transfer enabled)
8. Hangs up on abuse/spam — "You don't pay minutes for caught spam"
- Recording/privacy: encrypted at rest AES-256, in transit TLS; only the founder has human access; no third parties — FAQ marketing-content.ts:232; privacy:159-160
- No-AI-training pledge: "Your call recordings and transcripts are never used to train AI models, sold, or shared." — POLICIES.dataNeverTrains pricing.ts:164; privacy:122
- PIPEDA: right-to-erasure on cancel; PIPEDA-aware handling; CASL-ready messaging — FAQ :232; about:207-214
- Data residency (privacy:166-172): **US-based infrastructure** — Twilio (telephony US), [Ultravox/Supabase], Resend (email US), Stripe (billing US). "PIPEDA-aware… data may be processed and stored outside Canada." If Canadian-only residency is a hard requirement → contact them. IMPORTANT for prospects who ask about data staying in Canada: it does NOT.
- Recording consent: single-party-consent jurisdictions incl. Alberta — privacy:141; recording disclosure line available but only enabled per-client when jurisdiction requires (GATE-2 mechanism shipped, not on all live clients) — refactor-phase-tracker
- Data ownership: "Your call log data lives in your dashboard — you own it." — POLICIES pricing.ts:163

## 5. LIMITS / EDGE
- US availability: Marketing (about) says serves Canada + US. BUT all carrier forwarding codes are CANADIAN GSM only (carrier-codes.ts) — no US carrier list. Twilio number provisioning is US-capable but forwarding setup is documented for Canada only. AMBIGUOUS/PARTIAL: US setup path not built in code.
- Languages: **English only**. schema availableLanguage "English" — schema.ts:93. Agent explicitly declines non-English: "sorry — I only speak English… hangUp after one repeat" — prompt-slots.ts:481. No bilingual/French/Spanish support.
- Multiple phone lines/locations: NOT supported in code — one client = one twilio_number = one agent. No multi-location/multi-line feature found. UNANSWERED for enterprise.
- Call volume limits: rate limiter 30 calls/slug/60s — call-path-matrix. Monthly cap = plan minutes (250 Core) then hard block until reload.
- Contract terms: No contracts, cancel anytime, month-to-month — POLICIES pricing.ts:161. No uptime SLA ("no contractual uptime SLAs at this time" — terms:157).
- Who's behind it: Hasan Sharif, solo Canadian founder, Saskatoon+Calgary. First vertical = auto glass — about:169-173.
- Outbound calling: NONE (no dialer/campaign) — call-path-matrix §Path F.

## 6. FAQ PAGE CONTENT (src/lib/marketing-content.ts FAQ_ITEMS :173-239 — rendered by FaqAccordion.tsx on homepage + /pricing)
1. Will customers know they're talking to AI? — Sounds natural; discloses "I'm an AI assistant for [business]" if asked directly; most callers don't mind.
2. What do I actually get? — One plan, everything included; flat $119/mo founding; reload $10/50min for more.
3. How different from Dialzara/Rosie/My AI Front Desk? — (a) flat $119/mo vs per-minute/per-caller; (b) we build agent from GBP+website vs self-serve config; (c) trained on your trade not generic; booking + live transfer on eligible plans.
4. Setup fee? — "No setup fee." Built from GBP/website/answers.
5. What if agent says something wrong? — Only answers from knowledge base; out-of-scope → follow up directly; never invents; gaps flagged in weekly review.
6. Works after hours/weekends? — Yes, 24/7/365 once forwarding configured; email summary default, Telegram optional.
7. How to update what agent knows? — Dashboard knowledge base edits picked up next call; or message us, handled within 24h.
8. Cancel? — Cancel anytime, no contracts/fees, keep your data, + money-back guarantee.
9. Will customers see YOUR number? — No; they dial your number; conditional forwarding only when unanswered; agent uses your business name.
10. Works with Rogers/Bell/Telus/Fido? — Yes, star-61/67/62 codes on all major carriers + sub-brands; catch: carrier voicemail must be fully removed; ~5-min support call; iPhone VVM too.
11. Voicemail box on plan now? — Must call carrier to fully REMOVE voicemail (not reset); then codes work; we give script + support number.
12. Where do recordings go / data safe? — Dashboard, AES-256 at rest, TLS in transit; only founder has human access; never used to train AI; export or PIPEDA deletion on cancel.
13. Subscribe and hate it? — 30-day money-back; email support@endvoicemail.ai; one refund/customer, first sub only; after day 30 cancel anytime but guarantee window passed.

## KEY DISCREPANCIES / AMBIGUITIES TO FLAG
- PRICING.md is fully STALE (Starter/Pro/Business $147/$247/$397, $20/$25 setup, $0.10/min reload). DO NOT quote it. pricing.ts governs.
- Two reload-checkout routes with different pricing logic; dashboard uses the correct $10/$15/$30 buy-minutes route.
- Only Core is public — reps should quote a SINGLE plan ($119 founding / $189 std, 250 min). Solo/$29 and Pro/1000-min exist in code but are hidden/paused.
- Rollover of unused plan minutes: NOT specified — do not promise rollover. Reload (bonus) minutes are additive and persist.
- US availability claimed in marketing but forwarding setup is Canada-only in code.
- Weekly digest email + daily morning summary delivery: marketed; live delivery not fully confirmed in this pass.
- Data residency is US infrastructure despite "Canadian-built" branding — be honest if asked.
