---
type: client
status: active
slug: calgary-property-leasing
ultravox_agent_id: a30e9023-9dc5-4aa7-b7cf-b1cf623fb082
client_id: 2c186f70-84cc-4253-a3ab-6cd0e9064d39
twilio_did: +16397393885
plan: trial
business_name: Calgary Edmonton Property Leasing
tags:
  - client
  - propertymanagement
  - brian-demo
related:
  - Features/MaintenanceRequest
  - Decisions/Knowledge-Threshold-Loosening-2026-04-25
  - Decisions/2026-04-29-voicemail-removal-required-for-cf
  - 00-Inbox/2026-06-02-brian-prompt-slimming-handoff
updated: 2026-07-07
shipped: 2026-04-25
---

# Calgary Edmonton Property Leasing — Brian Demo

> Renamed 2026-04-25 from "Calgary Property Leasing". Slug retained.

## 2026-07-07 — $119/mo payment link SENT + trial extended to July 15 (CURRENT)

Supersedes the "re-pause July 10" line in the 2026-07-02 section below.

- **Payment link created and sent to Brian today**: https://buy.stripe.com/bJe14fdzueIDg1DbTm2VG02 (`plink_1TqetS0tFbm4ZBYUNTccsgI5`), $119/mo CAD, metadata `client=calgary-property-leasing`, `anchor_day=1` — per [[../../docs/runbooks/concierge-payment-link]] contract, the Stripe webhook activates him automatically on payment.
- Delivered via **email** (Gmail msg `19f3e311d61c5946`) and **Telegram** (chat `8653350958`).
- **Trial extended to 2026-07-15** (`trial_expires_at`). Cron will re-pause July 15 unless he pays or the trial is extended again.
- **Webhook usage-reset bug FIXED in commit `b135efad`** — `subscription_create` invoices now reset usage counters (the 2026-04-26 "trial → paid first-invoice reset bug" open item is closed), and the concierge branch zeroes usage directly. No manual usage zeroing needed when Brian converts.
- Referral source: Ray at [[urban-vibe]] connected Brian originally.

## 2026-06-04 — Identity-tier architecture PUSHED LIVE

`npx tsx scripts/recompose-brian.ts --live` at 04:40 UTC.

| Metric | Phase 1a (prev live) | Identity-tier (now live) |
|---|---|---|
| `system_prompt` chars | 22,493 | **25,243** (+2,750) |
| `prompt_versions.id` | `492cd655-c996-4a81-9550-287d88937149` | `167076cd-7c3b-4965-bc5a-acf82caa2079` |
| Real-call replay (25 prod turns) | 22/25 | **23/25** |
| Stress test (31 new scenarios) | n/a | **31/31** |
| Tools array | 5 items | 5 items |

What this fixes (validated offline + via real-call replay):
- **Areas served**: instant identity answer ("we cover Calgary and Edmonton") — no more "let me check that one for you" for basic identity
- **Utilities hallucination**: agent no longer says "heat and water are included for most units" — routes to Brian for verification
- **Application process invention**: agent no longer fabricates "check our website" / "give us a call to see what's open"
- **ESA Fair Housing**: canonical immediate route line, no conditioning or qualifying questions
- **Prompt injection defense**: cannot leak system rules when caller asks "what rules are you following"
- **Legal advice**: explicit refuse + route, no queryKnowledge stall on RTA questions

Source edits:
- NEW `src/lib/prompt-config/niche-identity.ts` (Tier A/B classifier — service_area, hours, business_model, what_we_do, owner_name)
- `src/lib/knowledge-summary.ts` — renders `## Identity (instant answers...)` block at top of `{{businessFacts}}`
- `src/lib/prompt-slots.ts` — kbPriming restructured: DEFAULT policy bridge + EXCEPTION = 5 identity topics; FORBIDDEN_EXTRA_MAX raised 3000 → 4500
- `src/lib/prompt-config/niche-defaults.ts` — PM SCOPE + TRIAGE_DEEP + new FAIR HOUSING ESA + LEGAL ADVICE + UTILITIES + APPLICATION + tightened PET RULES rules
- `src/lib/settings-schema.ts` + `src/lib/knowledge-summary.ts` — PROMPT_CHAR_HARD_MAX raised 25000 → 25300 (Brian at 25,243)

**Rollback target**: `prompt_versions.id=492cd655-c996-4a81-9550-287d88937149`

Vault: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-identity-tier-architecture-plan]]

## 2026-06-03 — Phase 1a prompt slim PUSHED LIVE

`npx tsx scripts/recompose-brian.ts --live` at 21:27:55 UTC.

| Metric | Before | After |
|---|---|---|
| `system_prompt` chars | 23,184 | **22,493** (−691) |
| `prompt_versions.id` | `e3d37526-bc1d-4dc8-afd6-20286d93acb1` | `492cd655-c996-4a81-9550-287d88937149` |
| Routing-strict (offline) | 2/6 | **4/6** |
| Scenario regression | 13/15 | 13/15 (zero flips) |
| Tools array | 5 items | 5 items (queryKnowledge intact) |

Source edit: one TRIAGE_DEEP block tightening in [src/lib/prompt-config/niche-defaults.ts](../../src/lib/prompt-config/niche-defaults.ts). No slot composer changes. Other niches unaffected.

**Key fix:** Edmonton fabrication on areas-served question eliminated. Was the legal-exposure scenario (recorded call claiming coverage Brian doesn't have).

**Known remaining gaps:** utilities-included scenario still says "heat and water included for most units" (pure invention), application-process scenario invented MORE steps in Phase 1a. Both queued for Phase 1c — needs a FORBIDDEN_EXTRA rule, not another TRIAGE_DEEP tweak.

**Validation pending:** one real call into `+16397393885` asking "what areas do you cover?" — expected: no mention of Edmonton. Roll back via `prompt_versions` row `e3d37526` if regressed.

Vault: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-brian-phase1a-pushed-live]]

## 2026-06-02 — JUNK classifier fix shipped + prompt-slimming queued

`/calls` audit on Brian's line over last 7d surfaced 3 system-wide bugs. Two shipped today (commit `9ae6548d` on main), one queued for next session.

### Shipped today
- **Fix 1 — silent-call summary hallucination** ([src/lib/openrouter.ts](src/lib/openrouter.ts) `buildShortCallFallback`): silent JUNK rows were getting Haiku-fabricated summaries because classifier returned empty summary → `completed/route.ts:247` fell through to Ultravox's auto-summary. Now writes deterministic *"Caller did not speak — no audible response captured from the caller side."* Net: silent JUNK rows read cleanly instead of inventing topics (Fred DeSilva June 1 calls fabricated "Fred called to follow up on wire transfer" when Fred said nothing).
- **Fix 2 — niche rules over-classify humans as JUNK** ([src/lib/prompt-config/niche-classification.ts](src/lib/prompt-config/niche-classification.ts) + base RULES in openrouter.ts): all 13 niche rules rewritten. New invariant baked everywhere: *"Real humans are NEVER JUNK regardless of topic. JUNK is reserved for silence, robocalls, and pre-recorded automated messages."* Off-topic real humans (vendors, friends, wrong-number-with-conversation) now route to COLD with full content captured. System-wide JUNK rate was 70% (451/30d, 317 JUNK). Brian's line was 60% JUNK with 50 of those having real caller speech — those should re-bucket starting next call.
- **Fix 4 — SMS template typo**: `sms_template` "Bryan" → "Brian" via Supabase PATCH. No agent restart needed (DB-read at SMS-send time).

### System-wide audit findings (queued)

| Bug | Hits | Status |
|---|---|---|
| Bug 3 — agent presumes topic on returning callers | 14/19 short returning calls (74%) — affects Eric, Aisha (Alisha), Hassan (Velly) | NEXT — pair with prompt slim |
| Bug 4 — prompts over 12K hard max from glm46-prompting-rules | **37 of 49 clients**. Brian's Eric = 22,922 chars (1.9x hard max). Worst: bowness 24.8K | NEXT — start with Brian |

### Next session — Brian's Eric prompt slimming
- Approach (per Hasan): **follow the slot pipeline** (D280 `recomposePrompt`) — Phase 6 Wave 1 backend is shipped. Full per-section audit.
- Target: under 12K chars (down from 22,922). Hasan's lean real_estate baseline = 8,361.
- Sacred sections to preserve: SAFETY 911 override, "never say AI unless asked," SCOPE rules (no unit-specific rent, no RTA legal advice), returning-caller name use, maintenance triage flow.
- Resume prompt: [[00-Inbox/2026-06-02-brian-prompt-slimming-handoff]]

### Outstanding from prior session (still pending)
- Brian must complete Rogers voicemail removal + dial combo code → flip `forwarding_self_attested=true`
- Spot-check call routing once forwarding is verified

## Current state — 2026-05-29

Brian reported "calls going to voicemail." Audit: not the system — pipeline answered 4 calls today (last at 19:02 UTC, including one caller asking for Bryan by name at 17:09). All 5 inbound hard-blocks clean (trial expires 2026-06-15, 5% of minute cap, agent synced 14:44 UTC, no grace-period issue). Conclusion: Rogers conditional forwarding from his personal cell to `+16397393885` is no longer active — `forwarding_self_attested=false`, `forwarding_verified_at=NULL`. Most likely cause: Rogers re-enabled voicemail during a recent plan/SIM change, which blocks conditional forwarding on Rogers lines (per [[Decisions/2026-04-29-voicemail-removal-required-for-cf]]).

### Actions taken today

- **Email sent to Brian via Resend** (message_id `b6470b1c-bdd4-46b8-b240-041e1f842183`). From `Hasan Sharif <hello@endvoicemail.ai>`, to `edmontonpropertyleasing@gmail.com`, cc `urbanvibe.ca@gmail.com` + `calgarypropertyleasing@gmail.com`, reply-to `hasan.sharif.realtor@gmail.com`. Subject: "Brian — quick fix for your call forwarding". Body: 2-step fix (Rogers `1-800-764-3771` voicemail removal, then dial combo code `**004*16397393885#`) + 3 conditional code fallbacks + test instructions.
- **DB alert routing repaired and consolidated** — discovered via Ray's April 28 onboarding email that Brian's real reading inbox is `edmontonpropertyleasing@gmail.com` (Gmail contact name "Dragon Mitrovic"). Hasan later confirmed `calgarypropertyleasing@gmail.com` doesn't actually exist as a real Gmail inbox — was used as a placeholder during signup. Final state:
  - `alert_email`: `edmontonpropertyleasing@gmail.com` (was calgary)
  - `alert_email_cc`: NULL (briefly was calgary; cleared once we learned calgary is dead)
  - `contact_email`: `edmontonpropertyleasing@gmail.com` (was calgary — flipped so weekly digest also reaches him)
  - All other notification flags untouched.
  - **Login email unchanged**: `auth.users.email` for the owner row still reads `calgarypropertyleasing@gmail.com`. Password resets / account recovery would fail until this is rotated to edmonton via Supabase admin API (not a direct table write).
  - Outbound email I sent today (`b6470b1c...`) had calgary on CC — that CC bounced into the void; the TO (edmonton) and the other CC (urbanvibe) delivered normally.

### Notification pipeline now armed for Brian

| Channel | Destination | Source | Status |
|---|---|---|---|
| Email | `edmontonpropertyleasing@gmail.com` (no cc) | `email_notifications_enabled=true`, alert_email set, cc cleared because calgary inbox is fake | WILL FIRE every call |
| Owner SMS | `+1 (403) 620-2377` (alert_phone) | sent FROM `+16397393885` (twilio_number), `sms_alerts_enabled=true` | WILL FIRE every call (~$0.01/text) |
| Telegram | chat `8653350958` | bot token + `telegram_notifications_enabled=true` | WILL FIRE every call |
| Spam filter | OFF (`notification_filter_spam=false`) | new column per [[Tracker/D457]] | JUNK calls still notify all 3 channels |
| Weekly digest | `edmontonpropertyleasing@gmail.com` | `weekly_digest_enabled=true`, `contact_email` flipped to edmonton | Will land in reading inbox |

### Pending verification

- Brian must complete the Rogers voicemail removal + dial the combo code. Once he confirms, flip `forwarding_self_attested=true` in DB.
- Spot-check: have someone call his personal cell, don't answer; confirm it rolls to Eric within 4-5 rings.
- Watch `notification_logs` for next call → confirm all 3 channels fired without errors.

## Identity
| Field | Value |
|-------|-------|
| Slug | `calgary-property-leasing` |
| Ultravox Agent | `a30e9023-9dc5-4aa7-b7cf-b1cf623fb082` |
| Twilio DID | `+1 (639) 739-3885` (legacy TC n8n number repurposed) |
| Niche | `property_management` |
| Owner | Brian (callback person) |
| Agent persona | Eric (front desk) |
| Address | 1925 18 Ave NE, Calgary |

## CRITICAL Rules
- **Eric is the front-desk agent. Brian is the callback owner.** No Emon, no Alisha.
- Never quote prices, rates, timelines, fees, lease terms, or RTA legal advice — always route to Brian.
- Callback line: "Brian will call ya back at the number you're calling from."
- Hours: Mon–Sun, 24/7 (no after-hours block).

## Active Features
- [x] MaintenanceRequest tool (`submitMaintenanceRequest`) — registered on Ultravox
- [x] Knowledge backend = pgvector
- [ ] Booking
- [ ] SMS
- [ ] Transfer
- [ ] IVR

## Tools live on agent
1. `hangUp`
2. `queryKnowledge`
3. `checkForCoaching`
4. `submitMaintenanceRequest`

## Wave 2 ship (2026-04-25)
- Stored prompt is hand-tuned (not generated). 26,357 chars. Eric persona + PROPERTY-NOT-AVAILABLE branch + severity-check maintenance flow.
- Surgical placeholder fix: `{{availableProperties}}` + `{{faqPairs}}` substituted with static "defer to Brian" copy. `{{callerContext}}` resolves at call time.
- DB: `available_properties JSONB DEFAULT '[]'::jsonb` column added. Empty by default — Wave 3 dashboard editor will populate it.
- maintenance_requests RLS fixed (was `client_id = auth.uid()`, now joins via `client_users`).
- Repo: PR [#17](https://github.com/tubby124/unmissed-ai/pull/17) merged.

## Wave 3 follow-ups (deferred)
- Per-call context wiring for `availableProperties` (templateContext + contextSchema + agent-context.ts reader + inbound webhook injection). Same for `faqPairs`.
- 4 dashboard components: AvailablePropertiesEditor, MaintenanceRequestsInbox, TelegramConnectButton, RescrapeButton.
- Move legacy Overview surfaces to Advanced tab.
- Telegram disconnect endpoint.

## Open issues
- Twilio status_callback empty (matches other Railway clients — no policy gap).
- `website_scrape_status='approved'` but `website_last_scraped_at=NULL` — partial onboard state. 11 chunks seeded but page never re-scraped end-to-end. User to retrigger via dashboard Knowledge tab.

## 2026-04-25 — Multi-URL knowledge surface + onboarding source-tracking

### What was broken
- New `WebsiteSourcesList` component existed but was orphaned (never imported anywhere). User saw the legacy `WebsiteKnowledgeCard` showing only most-recent scrape, no list view, no "+ Add URL" button. `client_website_sources` backend (D85, shipped 2026-03-30) had no UI.
- Brian's row in `client_website_sources` was empty — onboarding bypass. The 11 chunks lived in `knowledge_chunks` from his trial provisioning but the source-tracking row never got written. Hand-backfilled in prod to unblock his demo.

### Fixes shipped
| Fix | PR | Merge SHA | Status |
|-----|-----|-----------|--------|
| Wire `WebsiteSourcesList` into knowledge drawer (above legacy `WebsiteKnowledgeCard`) | [#20](https://github.com/tubby124/unmissed-ai/pull/20) | `7a4c2752` | ✅ deployed |
| Backfill Brian's `client_website_sources` row directly | (DB write) | — | ✅ |
| Patch `provision/trial` + `stripe/create-public-checkout` to write `client_website_sources` during initial scrape; pass `sourceUrl` to `seedKnowledgeFromScrape()` so chunks get URL attribution | [#21](https://github.com/tubby124/unmissed-ai/pull/21) | `cc91bc9d` | ✅ deployed |
| Add `upsertOnboardingWebsiteSource()` shared helper in [src/lib/seed-knowledge.ts](src/lib/seed-knowledge.ts) | #21 | — | ✅ |
| Static-analysis regression test [src/lib/__tests__/onboarding-source-tracking.test.ts](src/lib/__tests__/onboarding-source-tracking.test.ts) — asserts both onboarding routes write source rows AFTER seeding chunks | #21 | — | ✅ |
| Fix `clients.business_facts` array-vs-string bug in [src/app/api/dashboard/approve-website-knowledge/route.ts](src/app/api/dashboard/approve-website-knowledge/route.ts) — surfaced when Brian retried scrape approve and hit "Failed to save approved knowledge" toast (Postgres rejected string write to text[] column) | [#22](https://github.com/tubby124/unmissed-ai/pull/22) | `9841000` | ✅ deployed |
| Regression test [src/lib/__tests__/approve-website-knowledge-array.test.ts](src/lib/__tests__/approve-website-knowledge-array.test.ts) | #22 | — | ✅ |

### Still to do for Brian
- [x] User can now manually add `/properties` or other URLs via the new dashboard UI ("+ Add URL" button in scrape drawer)
- [ ] If recall problems surface on real-customer traffic (not test calls): drop `SIMILARITY_FLOOR` 0.45 → 0.40 in [src/lib/embeddings.ts](src/lib/embeddings.ts) and `PATCH /api/dashboard/settings { business_name: 'Calgary Edmonton Property Leasing' }` to canonicalize brand name in prompt patches

## 2026-04-25 — Test call audit + middle-tier knowledge fix

### What broke
Ray called at 22:12 asking *"tell me about the rent guarantee program"*. Eric called `queryKnowledge` once, got `knowledge_empty`, deferred to Brian. 11 approved chunks existed in `knowledge_chunks` but **`hit_count=0` for every chunk** — the system has never returned a knowledge result for this client.

### Root causes
1. **Hybrid match RPC tokenization gap** — `hybrid_match_knowledge` uses tsvector keyword + cosine RRF. Query "rent guarantee program" tokenizes to `rent | guarante | program`. The matching chunk read `Services offered: rent guarantee, tenant screening, ...` — has `rent + guarante` but NO `program`. With `plainto_tsquery` AND-semantics, all three tokens required → keyword_rank = NULL.
2. **Cosine threshold (0.60) too tight** for short, comma-separated chunks vs. natural-language queries.
3. **System prompt drift** — persona anchor still said "Calgary Property Leasing" 6× even after dashboard rename. The user's rename appears to have updated `business_facts` (which got "Calgary/Edmonton Property Leasing") but `clients.business_name` and `system_prompt` were not patched. `patchBusinessName()` exists in [src/lib/prompt-patcher.ts:395](src/lib/prompt-patcher.ts#L395) and is wired into [src/lib/settings-patchers.ts:309](src/lib/settings-patchers.ts#L309) — re-test that flow on the dashboard.

### Fixes applied (2026-04-25)
| Fix | Where | Status |
|-----|-------|--------|
| Renamed `clients.business_name` → "Calgary Edmonton Property Leasing" | Supabase | ✅ direct DB write |
| Patched `system_prompt` (6 occurrences old name → 7 new) | Supabase + Ultravox | ✅ live agent synced via PATCH `/api/agents/{id}` |
| Added rule 30: "ALWAYS use queryKnowledge BEFORE deferring to Brian on factual questions" | system_prompt | ✅ live |
| Rewrote 3 `knowledge_chunks` with richer rent guarantee phrasing (regenerates fts via generated column) | Supabase | ✅ direct DB write |
| Refreshed `business_facts` array + `extra_qa` (added "How does the rent guarantee program work?" Q) | Supabase | ✅ direct DB write |
| Loosened `SIMILARITY_FLOOR` 0.60 → 0.45 for caller-phrasing tolerance | [src/app/api/knowledge/[slug]/query/route.ts:8](src/app/api/knowledge/[slug]/query/route.ts#L8) | ⏳ awaiting deploy |

### Still to do
- [ ] Deploy code change (SIMILARITY_FLOOR loosening)
- [ ] User triggers fresh website scrape from dashboard Knowledge tab to backfill `website_last_scraped_at` + add deeper page chunks (calgarypropertyleasing.ca has more service detail than what's currently seeded)
- [ ] Verify on next test call: caller asks "tell me about the rent guarantee" → Eric should now answer with the 90% / no-fees / monthly-guaranteed framing
- [ ] Investigate why dashboard rename didn't propagate to `business_name` field (might be silent control / save-button missed / patcher gated)

### Reusable lessons
- **Middle-tier clients with rich website knowledge** need `SIMILARITY_FLOOR` ≤ 0.50 because limited call data + sparse keyword overlap between caller phrasing and short scraped facts.
- **Knowledge chunks should embed the natural-language query phrase**, not just the canonical fact list. "Rent guarantee program: ..." beats "Services offered: rent guarantee, ...".
- **`hit_count=0` across all chunks** is the cleanest single-metric drift signal that the RPC + threshold combo is broken — query this before any other knowledge debugging.

## Test scripts
**Leasing scenario:** call DID, say "I'm looking at the place at 9302 98th Street NW, the 3-bedroom" → expect `mmhmm... that one isn't available right now... Brian will call ya back at the number you're calling from...`

**Maintenance scenario:** call DID, say "I have a leak in my unit" → severity check fires → "yeah water's coming out fast" → collect name + unit → `submitMaintenanceRequest urgent` → close.


## 2026-04-26 PM — Welcome email sent + DB aligned

**Recipient:** `edmontonpropertyleasing@gmail.com` (Brian's real inbox, NOT the dashboard login string `calgarypropertyleasing@gmail.com`). CC'd `urbanvibe.ca@gmail.com` (Ray Kassam, who connected us). Sent from `hasan.sharif.realtor@gmail.com` via `gmail.py`.

**Subject:** `Brian — Eric is ready, 3 quick steps to start`

**Email format = new snowflake-onboarding template** (use for next ~9 manual clients):
3 numbered step-cards: (1) required forward `**004*16397393885#` big-blue card, (2) Telegram for "see what Eric is doing" white card, (3) Stripe card-on-file white card framed as no-charge-today / first-charge-May-1. Dashboard creds tucked in muted grey footer with "username is just a login string" disclaimer. Source files: `clients/calgary-property-leasing/welcome-email-brian.{html,txt}`.

### DB writes before send (Supabase prod `qwhvblomlgeapzhnuwlb`, service-role PATCH)
| Field | Before | After | Why |
|-------|--------|-------|-----|
| `monthly_minute_limit` | 50 | **250** | 200 plan + 50 April bonus matches email promise |
| `seconds_used_this_month` | 1406 | **0** | Band-aid for trial→paid reset bug — Brian had 23 min of test calls that would have carried into May |
| `minutes_used_this_month` | (non-zero) | **0** | Same |

`twilio_number=+16397393885`, `ultravox_agent_id=a30e9023-9dc5-4aa7-b7cf-b1cf623fb082`, `subscription_status=trialing`, `status=active` all unchanged.

### Pricing locked tonight
- $119/mo from May 1, anchored to 1st of month forever
- 200 min plan + 50 bonus minutes for Apr 26-30 (partial month)
- ~88% gross margin at ~$0.065/min variable cost
- Future $0.10/min overage policy deferred this week

### Stripe webhook safety verified
[ensure-twilio-provisioned.ts:55-72](src/lib/ensure-twilio-provisioned.ts#L55-L72) — when Brian pays via Payment Link, webhook calls `activateClient()` which calls `ensureTwilioProvisioned()` which reads `clients.twilio_number` first and returns immediately with `skipped: true, skipReason: 'already provisioned'` since Brian's row has `+16397393885` set. **No double-buy of a number.** activateClient still writes `stripe_customer_id` + `stripe_subscription_id` and flips status, sends Hasan the `🎉 Trial converted` Telegram alert.

### Why we did NOT pre-flip status to active
[webhook/stripe/route.ts:596-604](src/app/api/webhook/stripe/route.ts#L596-L604) skip-guard requires BOTH `status=active` AND `stripe_subscription_id`. Pre-flipping without the subscription_id would cause activateClient to run an empty/half activation when Brian pays, potentially failing to write the Stripe IDs. Cleaner to let webhook do everything when card hits.

### Open issues (deferred, not blocking tonight)
- [ ] Trial → paid first-invoice reset bug — `webhook/stripe/route.ts:127` only matches `subscription_cycle`, not `subscription_create`. Tonight's manual zero is the band-aid; ship the ~10 line fix this week.
- [ ] Global `CORE.minutes` 400 → 200 drop in `src/lib/plan-entitlements.ts` + add $0.10/min overage. Verify founding-4 `hand_tuned=true` rows unaffected.
- [ ] Future: Telegram-driven self-serve (minute balance + renewal/top-up via stored Stripe card).

### Brian's actual onboarding priorities (in his order, not ours)
1. Forward business number to `+1 (639) 739-3885` — without this, nothing works
2. Tap Stripe link, enter card (no charge until May 1)
3. (Recommended) Tap Telegram deep link for call summaries
4. Feedback to Hasan directly via text/call — dashboard non-functional, no expectation Brian uses it

### Snowflake template — durable
Same 3-step format for next ~9 manually-onboarded clients. Per-client swaps: name + business + DID digits + Telegram token + Stripe link + login creds. Then automate via dashboard onboarding (D291 / Phase 7 territory).

### Send confirmation
**Sent 2026-04-26 PM** — Gmail msg `19dcca67408e3c0c`. TO `edmontonpropertyleasing@gmail.com`, CC `urbanvibe.ca@gmail.com`. Watch for `clients.telegram_chat_id` populate (Telegram tap), `checkout.session.completed` Stripe event (card hit), first real inbound call_log row (forward activated).

### `setup_complete` ≠ payment (clarified 2026-04-26 PM)
`setup_complete` tracks **phone forwarding**, not Stripe. Per [derive-activation-state.ts:11-12](src/lib/derive-activation-state.ts#L11-L12) the 3 states are `awaiting_number` / `forwarding_needed` (Brian's current) / `ready`. Per [activate-client.ts:355-356](src/lib/activate-client.ts#L355-L356), `activateClient()` re-writes `setup_complete: false` on paid activation — Stripe webhook never sets it true. Field is `mutationClass: DB_ONLY`, only flips via manual dashboard PATCH or DB write.

**Rule:** leave false until real (non-test) inbound `call_logs` rows arrive from Brian's actual customer phone numbers. That's the only ground-truth proof the `**004*` forward landed. Pre-flipping is pointless — Stripe payment overwrites it back to false anyway.

Payment (Stripe → `subscription_status` + `stripe_*_id`) and setup (Brian → `setup_complete`) are independent. He could pay and never forward, or forward and never pay. Tracked separately by design.

## 2026-05-16 PM — Second trial extension (still no payment)

Hasan extended Brian's trial by 30 days. Brian still has not tapped the Stripe Payment Link from the 2026-04-26 welcome email. Original trial was set to expire 2026-05-12; he silently lapsed for 4 days before this extension.

### DB writes (Supabase prod `qwhvblomlgeapzhnuwlb`, service-role PATCH)
| Field | Before | After | Why |
|-------|--------|-------|-----|
| `trial_expires_at` | 2026-05-12T00:14:59Z (expired) | **2026-06-15T23:59:59Z** | Give him another 30 days from today |
| `seconds_used_this_month` | 1623 (~27 min) | **0** | Fresh minute pool for the new window |
| `minutes_used_this_month` | 28 | **0** | Same |
| `monthly_minute_limit` | 250 | 250 (unchanged) | 200 plan + 50 bonus from original deal stays |
| `subscription_status` | `trialing` | `trialing` (unchanged) | No Stripe activity to update |
| `stripe_customer_id` | NULL | NULL (unchanged) | Brian has never created a customer record — never tapped the Payment Link |
| `stripe_subscription_id` | NULL | NULL (unchanged) | Same |
| `setup_complete` | false | false (unchanged) | Phone forwarding ground-truth still not verified via real inbound `call_logs` from his customers |

### Usage during trial month 1 (2026-04-25 → 2026-05-12)
- ~27 minutes of calls over 17-21 days = modest but real (not zero)
- 11 knowledge chunks seeded, but `hit_count` was 0 across all of them until the 2026-04-25 mid-tier-knowledge fix (SIMILARITY_FLOOR 0.60 → 0.45, hybrid-match phrasing rewrites)
- Forwarding codes (`*67`, `*62`, `*61`) handed to Brian 2026-04-30 — never confirmed they activated via a real inbound from his customer phone
- 21 days of silence on Stripe side. He's likely (a) still testing, (b) waiting for a customer call to validate before paying, or (c) ghosted

### Why this is the SECOND extension, not the first
The original deal was: trial Apr 25 → forwarding setup → Stripe charge May 1 → ongoing. Brian got the welcome email 2026-04-26 PM (Gmail msg `19dcca67408e3c0c`). May 1 came and went. The webhook never fired. He silently rolled into an unsanctioned extra week before `trial_expires_at` hit. **Tonight's PATCH is courtesy extension #2.**

### Pattern this exposes — sales-side, not technical
- Technical product works (calls are landing, knowledge is answering, voicemail removed, codes set)
- **Conversion is the bottleneck.** Brian needs to be told the deadline is real and asked to tap the link, OR a different commercial frame needs to be tried (free month, lower price, or honest off-ramp).
- The auto-trial-to-paid flow assumed engagement that didn't happen. Future snowflake clients need a **human Day-3 / Day-7 / Day-14 check-in** before deadline hits, not just a one-shot welcome email.

### Followups (decisions pending, Hasan-only)
- [ ] Nudge Brian directly (text/call/email) — let him know the trial was extended + soft ask to tap the Stripe link. Without it, this same scenario repeats June 15.
- [ ] Calendar reminder ~2026-06-10 (5 days pre-expiry) for the next check-in before this trial lapses
- [ ] Decide: continue extending indefinitely, or set a hard "by date X tap the link or we shut down" deadline
- [ ] Marketing copy: if `endvoicemail.ai` rebrand goes live before June 15, decide whether Brian sees the new brand on his dashboard or is grandfathered

## 2026-04-30 — Voicemail removal call + individual conditional codes handed to Brian

Brian called Rogers to fully remove voicemail from his line (per the [[Decisions/2026-04-29-voicemail-removal-required-for-cf]] non-skippable step). After that call he was instructed to dial these three individual conditional-forwarding codes — combo `**004*16397393885#` was set aside in favor of the explicit per-condition codes:

```
*67*16397393885#   ← busy (CFB)
*62*16397393885#   ← unreachable / phone off (CFNRc)
*61*16397393885#   ← no answer (CFNRy)
```

All three set destination DID `+16397393885` (Eric / Brian's AI). Same end behavior as the combo — owner phone rings first, AI catches anything unanswered. Order doesn't matter to the carrier; this is the order Hasan handed Brian.

**Why individual instead of combo:** combo `**004*` can fail on some Rogers postpaid plans with "Error performing request" or accept the activation but not actually fire on unanswered calls. Splitting into the three conditional codes is the audited fallback — same outcome, sometimes accepted where combo isn't. Validated 2026-04-29 on Hasan's own Rogers Business 403 line.

**Verification expected:** once voicemail removal completes + all three codes accepted, have a friend call `+1 (587) 825-9408` (Brian's number) and let it ring. Eric on `+1 (639) 739-3885` should pick up after a few rings. If it still goes to Rogers voicemail, voicemail wasn't actually removed — call Rogers Business `1-866-727-2141` again.

**Memory updated:** `~/.claude/projects/-Users-owner/memory/unmissed-canadian-forwarding-codes.md` — Brian's worked example logged with timestamps + the combo-vs-individual fallback rule. Reusable for any future client.

## Live truth 2026-07-02 (verified vs Supabase + Stripe, supersedes older status above)
- Trial expired 2026-07-01, cron auto-paused (DB-only; Twilio number + Ultravox agent untouched). **Re-enabled 2026-07-02**: status=active, subscription_status=trialing, trial_expires_at=2026-07-10T05:59:59Z. Cron will re-pause July 10 unless converted or manually extended.
- **Never paid — no Stripe customer exists at all.** stripe_customer_id NULL.
- Usage last 30d: 60 calls, 18 non-JUNK — strong value evidence. ~42 junk calls likely alerted him real-time on all 3 channels (spam filter off) = alert fatigue, probable driver of lukewarm perception.
- Conversion playbook (decided 2026-07-02): lead with VALUE RECEIPT, not invoice — text him counts + 2-3 example real inquiries, then the $119 payment link. Discount time (first month) if needed, never cut the $119 anchor.
- Forwarding still unverified (Rogers voicemail collision) — must be locked down before/at conversion or he churns on a half-working product.
