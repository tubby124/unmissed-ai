---
type: client
status: provisioning
slug: velly-remodeling
ultravox_agent_id: TBD
voice_id: TBD
twilio_did: TBD
plan: founding-29
tags: [client, renovation, concierge, founding]
related:
  - Architecture/Control-Plane-Mutation-Contract
  - Features/Transfer
  - Product/Concierge-Onboarding-SOP
updated: 2026-04-28
---

# Velly Remodeling — Eric (Renovation / New Build / Basement Suites)

> Manual concierge onboarding (D380). First client with `transferCall` actually wired.
> Owner Kausar Imam is Hasan's uncle — $29/mo founding rate forever, 100-min cap.

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
| Niche | `other` (no `renovation` niche scaffolded yet — D-NEW candidate) |
| Agent name | Eric |
| Plan | $29/mo Founding Member (FOUNDING29 coupon, Stripe `i0s7bCCd`) |
| Monthly minute limit | 100 |
| Hours behavior | Always answer 24/7. Business hours Mon–Fri 8am–5pm, weekends by appointment — used as callback timing context, not as gating. |

## Active Features (target state)
- [?] Transfer — **plan-tier-dependent**, see Plan Tier note below
- [ ] Booking
- [ ] SMS
- [ ] IVR
- [x] Knowledge RAG — pgvector seeded from website scrape
- [x] Returning caller detection — auto via `agent-context.ts` (no config needed)

## Plan tier — needs Hasan's confirmation before activation
FOUNDING29 coupon = $29/mo, built for Lite. Lite has `transferEnabled: false`. Two paths:
- **Path A — real Lite**: Eric just message-takes, no transferCall, no manual "Take this call" button (Overview toggle now blocks Lite users with an upgrade modal).
- **Path B — DB override**: admin sets `selected_plan='pro'` at DB level after Stripe checkout, keeping the $29 price via coupon. Transfer + manual button work. Hacky — bypasses plan gating.

Hasan said 2026-04-28 PM: most clients on $119 Core (transfer-eligible). Kausar specifically named "this light plan." If literal, Path A. If "light plan" = $29 founding price regardless of underlying tier, Path B.

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
"Thanks for calling Velly Remodeling, this is Eric. We do renovations, new builds, basement suites, kitchens and bathrooms. What are you looking to get done?"

Warm/concierge. After-hours: same greeting — never says "we're closed."

## Provisioning checklist
- [ ] Submit `/api/provision` payload (intake_submissions row, admin Telegram alert fires)
- [ ] Admin → /dashboard/clients → "Generate Prompt" with Sonar Pro enrichment ON (renovation has no niche template — Sonar fills FAQ + local context)
- [ ] Set `forwarding_number = +13062416312`
- [ ] Set `transfer_conditions` (paste from above)
- [ ] Set `monthly_minute_limit = 100`
- [ ] Admin → "Activate" → returns Stripe checkout URL with FOUNDING29 coupon → send to Kausar
- [ ] Kausar pays → activation chain auto-buys 306 Twilio number, sets webhook, creates Supabase auth user, sends password setup email
- [ ] Send welcome email mirroring [[Clients/calgary-property-leasing|Brian]]'s template: dashboard URL, Twilio number, carrier forwarding instructions for 306-241-6312, Telegram setup link, "call to test" line
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
