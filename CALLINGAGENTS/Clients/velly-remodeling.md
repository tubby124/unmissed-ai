---
type: client
status: paused-unpaid
slug: velly-remodeling
ultravox_agent_id: 2164eda9-... (full UUID in Supabase clients row)
voice_id: aa601962-1cbd-4bbd-9d96-3c7a93c3414a
voice_style_preset: casual_friendly
twilio_did: +13069887699
plan: founding-29
tags: [client, renovation, concierge, founding, paused]
related:
  - Architecture/Control-Plane-Mutation-Contract
  - Features/Transfer
  - Product/Concierge-Onboarding-SOP
  - Tracker/D456
updated: 2026-05-29
---

# Velly Remodeling — Samantha (Renovation / New Build / Basement Suites)

> Manual concierge onboarding (D380). First client with `transferCall` actually wired.
> Owner Kausar Imam is Hasan's uncle — $29/mo founding rate forever, 100-min cap.
> Agent renamed Eric → **Samantha** (sometime before 2026-05-29; confirmed in both `agent_name` column and `system_prompt` body, zero "Eric" references remain).

## Current state — 2026-05-29 (post-reactivation)

| | |
|---|---|
| Status | `active` (reactivated 2026-05-29 — courtesy trial extension) |
| Subscription status | `trialing` |
| Trial expires | `2026-06-01T06:00:00Z` (= end of Sunday May 31 Saskatoon CST) |
| Stripe subscription id | NULL — **never charged** |
| Stripe customer id | `cus_UbbjZc7wQxeMYQ` (object exists, currency null, zero invoices ever) |
| `welcome_email_sent_at` | NULL — pipeline never delivered the original |
| Reminders Kausar actually received before 2026-05-29 | **0** (Telegram claimed 3, none reached him — see [[Tracker/D456]]) |
| Reserved Twilio DID | `+13069887699` — answering again; to release Mon 2026-06-01 if no decision |
| Re-engagement email | **SENT 2026-05-29** via Resend, message_id `a805c6ae-748c-48e8-a215-70c911def080`. From `Hasan Sharif <hello@endvoicemail.ai>`, to `kausarimam10@yahoo.com`, cc `info@vellyremodeling.com`, reply-to `hasan.sharif.realtor@gmail.com`. Subject: "Kausar — Velly account: decision needed by Sunday". CTA = $29 Core Founding payment link `plink_1TRKmr0tFbm4ZBYUB9B4GmXf` (verified live, $29.00 CAD/mo, HTTP 200). |
| Plan in DB right now | `lite` / 150-min cap — **drift from intended Core/100-min**. On payment, Stripe webhook will flip `selected_plan` back to `core`; minute cap will need a manual reset to 100. |
| `trial_reminder_sent` | cleared (was `{day3, day1}` — both flags were Telegram lies, see [[Tracker/D456]]) |

**Inbound webhook gating:** confirmed only gates on `trial_expires_at` past + `trial_converted=false`, minute limit, or grace period. Reactivation alone (no Ultravox toggle) is enough to make the line answer.

**Notification pipeline (post 2026-05-29 overhaul):** Velly is now at full parity with the `hasan-sharif` baseline. All three owner channels on, destinations configured: email → `info@vellyremodeling.com` cc `kausarimam10@yahoo.com`, owner SMS → `+13062416312` from `+13069887699`, Telegram → chat `7928494158`. `notification_filter_spam=false` (every call alerts). New AlertsTab spam-filter toggle live (commit `dd2ada3e`). Verification call to `+13069887699` still pending. See [[Tracker/D461]] for the Settings>Alerts SELECT divergence that affects how this client appears in `/dashboard/settings` (use `/dashboard/notifications` for accurate state in the meantime).

**If Kausar pays:** the Core $29 Founding price is `price_1TRKma0tFbm4ZBYUJi5p69s4` under product `prod_UCl8nni05Nk9lB`. Webhook auto-flips `selected_plan=core`. Manual post-payment cleanup: set `monthly_minute_limit=100`, `status='active'`, clear `trial_reminder_sent` JSON, confirm `last_agent_sync_at` refreshed.

**If Kausar releases:** release the Twilio DID, set `status='cancelled'`, archive the Ultravox agent.

## Identity
| Field | Value |
|-------|-------|
| Slug | `velly-remodeling` |
| Business name | Velly Remodeling Ltd. |
| Owner | Kausar Imam |
| Owner email | kausarimam10@yahoo.com |
| Owner phone (forwarding) | +1 306-241-6312 |
| Existing business line | +1 306-241-6312 (same — they want all calls filtered through Eric first) |
| City | Saskatoon, SK |
| Address | 4-216 33rd Street West, Saskatoon, SK |
| Website | https://www.vellyremodeling.com/ |
| Niche | `other` — **migration to `home_renovation` planned**, see [[Tracker/D-NEW-velly-kb-niche-migration]] (PR #87 shipped the home_renovation niche 2026-05-06) |
| Agent name | Samantha (renamed from Eric pre-2026-05-29) |
| Plan | $29/mo, Core feature gates, 100-minute cap (custom combo — see "Plan combo" section) |
| Monthly minute limit | 100 |
| Hours behavior | Always answer 24/7. Business hours Mon–Fri 8am–5pm, weekends by appointment — used as callback timing context, not as gating. |

## Active Features (target state)
- [?] Transfer — **plan-tier-dependent**, see Plan Tier note below
- [ ] Booking
- [ ] SMS
- [ ] IVR
- [x] Knowledge RAG — pgvector seeded from website scrape
- [x] Returning caller detection — auto via `agent-context.ts` (no config needed)

## Plan combo — LOCKED 2026-04-28 PM
Hasan locked the three-way combo:
| Lever | Value |
|---|---|
| Stripe price | $29/mo CAD (custom price under Core product `prod_UCl8nni05Nk9lB` — needs to be created in Stripe) |
| `selected_plan` | `core` (gives transfer + booking + knowledge + learning loop) |
| `monthly_minute_limit` | `100` (manual override, less than Core default 200) |

Not a hack — `selected_plan` controls features, `monthly_minute_limit` controls usage cap, Stripe price controls billing. Three independent levers. Trial uses the same `monthly_minute_limit` lever to cap at 50 regardless of plan.

**Do NOT use FOUNDING29 coupon** — it's a Lite-tier coupon ($49 - $20 = $29). Applied to Core ($119 - $20 = $99) it gives the wrong price. New Stripe price needed under Core product.

Activation path detailed in [[00-Inbox/NEXT-CHAT-Kausar-Velly-Activation]].

## Transfer rule (`transfer_conditions`) — only used if Path B in Plan tier above
> Transfer the call only when ONE of these is true:
> 1. Caller asks for Kausar by name, asks for "the owner," or asks to "speak to a person"
> 2. Caller mentions a deposit they already paid, an ongoing project, or a problem on an active jobsite
> 3. Returning customer (you'll see RETURNING CALLER in your context) who asks to be put through to Kausar directly
> 4. Caller refuses to give project details after one offer to take a quote intake AND gives a specific reason they need a human (not just "I want a person")
>
> Do NOT transfer for general info, pricing curiosity, or first-time quote requests — collect the intake first.

**Note:** [buildTransferTools()](src/lib/ultravox.ts#L463-L465) already has a working default ("caller asks for a person, says 'put me through', 'connect me'"). Setting custom `transfer_conditions` above adds the deposit/returning-customer/name-specific branches on top. If only the default behavior is wanted, leave `transfer_conditions` null.

## Intake to collect on every call (`completion_fields`)
1. Project type (renovation / new build / basement suite / kitchen / bathroom / addition / other)
2. Property address (or neighbourhood if they prefer)
3. Scope summary (what rooms, what scale)
4. Timeline (when do they want it done)
5. Budget range (if offered — never push)
6. Caller name + best callback number

## Greeting tone
"Thanks for calling Velly Remodeling, this is Samantha. We do renovations, new builds, basement suites, kitchens and bathrooms. What are you looking to get done?"

Warm/concierge. After-hours: same greeting — never says "we're closed."

## Provisioning checklist
- [ ] Submit `/api/provision` payload (intake_submissions row, admin Telegram alert fires)
- [ ] Admin → /dashboard/clients → "Generate Prompt" with Sonar Pro enrichment ON (renovation has no niche template — Sonar fills FAQ + local context)
- [ ] Set `forwarding_number = +13062416312`
- [ ] Set `transfer_conditions` (paste from above)
- [ ] Set `monthly_minute_limit = 100`
- [ ] Admin → "Activate" → returns Stripe checkout URL with FOUNDING29 coupon → send to Kausar
- [ ] Kausar pays → activation chain auto-buys 306 Twilio number, sets webhook, creates Supabase auth user, sends password setup email
- [x] Welcome email drafted at [clients/velly-remodeling/welcome-email-kausar.html](clients/velly-remodeling/welcome-email-kausar.html) + .txt version. Mirrors Brian's pattern. **Includes voicemail-removal callout per [[Decisions/2026-04-29-voicemail-removal-required-for-cf]].** Before sending: replace `VELLY_TOKEN_PLACEHOLDER` with actual Telegram registration token from `clients.telegram_registration_token`.
- [ ] Send the welcome email once Twilio + Stripe activation chain completes
- [ ] Browser test call — confirm Eric greets correctly, asks for project type, transfers when test caller insists on Kausar
- [ ] Live PSTN test — call new Twilio number from a different phone, run scenarios: (a) generic quote, (b) returning customer asking for Kausar, (c) "I paid a deposit and need to talk to him"

## Connections
- → [[Architecture/Control-Plane-Mutation-Contract]] — `forwarding_number` + `transfer_conditions` are `DB_PLUS_TOOLS` class
- → [[Features/Transfer]] (to be created if not exists)
- → [[Product/Concierge-Onboarding-SOP]] — D380 manual onboarding flow
- → [[Tracker/D-NEW-renovation-niche]] (candidate — scaffold real `renovation` niche after Velly proves the pattern)
- → [[Tracker/D-NEW-mid-call-transfer-button]] (candidate — manual "transfer this call to me" button on LiveCallBanner; deferred per 2026-04-28 decision)

## Lessons from this provisioning session (2026-04-28, revised PM)
- **Plan tier gates transfer at runtime, not just at billing.** Lite has `transferEnabled: false` per [plan-entitlements.ts:54](src/lib/plan-entitlements.ts#L54). Setting `forwarding_number` on a Lite client used to be a fake-control bug; now the Overview toggle is plan-gated and shows an upgrade modal for Lite users.
- **`transferCall` default trigger language is good enough for most cases** — VIP / extreme emergency / "I want to speak to someone" all fire it without setting custom `transfer_conditions`. Custom conditions only matter for name-specific or deposit-specific routing.
- **Manual "Take this call" button shipped 2026-04-28** as POST `/api/dashboard/calls/[id]/transfer-now` + LiveCallBanner button. Requires same prerequisites as agent-initiated: `forwarding_number` + plan supports transfer.
- **Omar's IVR is press-1-voicemail / else-AI.** Not "press 2 to dial Omar."
- **Niche=other works fine** as the fallback for niches we haven't scaffolded — falls back to generic NICHE_DEFAULTS in `prompt-config/niche-defaults.ts`. After Velly stabilizes, scaffold a real `renovation` niche via `/niche-new`.
- **24/7 answering with weekday business hours is a config pattern**, not a special mode — set `business_hours_weekday`, `business_hours_weekend`, and leave `after_hours_behavior=always_answer`.
- **Founding $29/mo + Stripe coupon FOUNDING29 = Lite price.** If transfer is needed at $29, that's a DB-level override of `selected_plan` after Stripe activation, not something the coupon does on its own.

## Live truth 2026-07-02 (verified vs Supabase + Stripe, supersedes older status above)
- **PAYING.** subscription_status=active, trial_converted=true, period ends 2026-08-01. Invoices PAID: $29 CAD on 2026-05-31 and 2026-07-01.
- Real Stripe customer: `cus_UcXVOIu8ew1PZI` (remodelingvelly@gmail.com). The older `cus_UbbjZc7wQxeMYQ` is an ORPHAN duplicate with zero invoices — clean up in Stripe, do not cite it.
- Usage: 1 call / 0 non-JUNK last 30d. He pays for presence (business line answered), not lead volume. No call forwarding — Twilio DID is his public line (direct-inbound mode).
- Lesson: vault status went stale because billing changes happen via Hermes/Stripe directly. **Answer billing/status questions from Supabase+Stripe live, never from this note's frontmatter.**
