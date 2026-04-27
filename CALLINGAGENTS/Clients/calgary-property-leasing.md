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
updated: 2026-04-25
shipped: 2026-04-25
---

# Calgary Edmonton Property Leasing — Brian Demo

> Renamed 2026-04-25 from "Calgary Property Leasing". Slug retained.

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
