---
type: decision
status: accepted
date: 2026-04-28
related:
  - Clients/velly-remodeling
  - Product/Concierge-Onboarding-SOP
  - Tracker/D-NEW-mid-call-transfer-button
tags: [concierge, transfer, niche, onboarding]
---

# Decision — Velly Remodeling Concierge Onboarding (2026-04-28)

## Context
Hasan is signing his uncle Kausar Imam (Velly Remodeling Ltd., Saskatoon SK) as a $29/mo founding-member client. This is the second concierge onboarding after Brian (Calgary Property Leasing demo) and the first to actually wire `transferCall`. Velly's business is renovation / new build / basement suites — no scaffolded niche template exists. They want all calls filtered through the AI to triage spam, with mid-call transfer to Kausar's phone (+1 306-241-6312) when the caller insists or is a returning customer with an active project.

## Decisions

### D1 — Niche: `other` (do not scaffold `renovation` yet)
Use the generic NICHE_DEFAULTS fallback in `prompt-config/niche-defaults.ts`. Scaffolding a `renovation` niche before observing real call patterns risks building defaults that don't match how callers actually talk to a contractor. **After Velly takes 50+ real calls, scaffold the `renovation` niche from observed patterns** — that's the right time. Tracked in vault as a candidate D-item.

### D2 — Plan: $29/mo Founding (Stripe FOUNDING29 coupon `i0s7bCCd`)
Founding rate locks in forever per [[Product/Concierge-Onboarding-SOP]]. 100-minute hard monthly cap. Set `monthly_minute_limit=100` directly on the clients row.

**Plan tier = OPEN QUESTION** (flagged 2026-04-28 PM):
- The FOUNDING29 coupon is built for the Lite plan ($49 - $20 = $29). Lite has `transferEnabled: false` per [plan-entitlements.ts:54](src/lib/plan-entitlements.ts#L54).
- Original plan in this doc said "set `selected_plan='pro'` so transferCall registers." That's a workaround — hack `selected_plan` at DB level to bypass plan gating while charging Lite price via coupon.
- Hasan's 2026-04-28 evening message: "We have this light plan, which I'm just hooking up this KAUSAR person with, but mostly everybody's going to get the $119 a month plan." Reads as Kausar on actual Lite, no override.
- **Decision needed before activation:** (a) Kausar on real Lite — no transfer (Eric just message-takes), or (b) DB-override workaround — Lite price + Pro features.

### D3 — Transfer: depends on D2 plan decision
**If Kausar is on real Lite:** No `transferCall` tool. Eric runs full-intake every call, no escape hatch to a human. The "Take this call" manual button (D-NEW shipped 2026-04-28) ALSO requires `forwarding_number` to be set — and the Overview toggle is now plan-gated, so Lite users can't even save a forwarding number from the dashboard.

**If DB override (selected_plan=pro at $29 price):** Use the default trigger language built into [buildTransferTools()](src/lib/ultravox.ts#L463-L465) — "transfer when caller asks for someone directly, says 'put me through', 'connect me'" — that's enough for VIP / extreme emergency cases without setting custom `transfer_conditions`. Only set custom conditions if name-specific routing matters ("when caller asks for Kausar by name").

The manual "Take this call" button (deferred earlier in this doc) was **shipped 2026-04-28** as POST `/api/dashboard/calls/[id]/transfer-now` + LiveCallBanner button. Available whenever `forwarding_number` is set + plan supports transfer.

### D4 — Hours: 24/7 always-answer with weekday business hours as callback context
Set `business_hours_weekday=Mon–Fri 8am–5pm`, `business_hours_weekend=by appointment`, `after_hours_behavior=always_answer`. Eric never says "we're closed" — he uses hours only to set callback expectations ("Kausar will call you back tomorrow morning"). Apply this pattern to future clients who want 24/7 answering on a weekday business — it's not a separate mode, just config.

### D5 — Returning customer detection: rely on existing `buildAgentContext()` injection
No new code. Auto-injects `RETURNING CALLER` + prior count + last summary into prompt at call time via [agent-context.ts:121-138](src/lib/agent-context.ts#L121-L138). Add a transfer-rule branch for "returning customer asking for Kausar directly" so Eric uses the auto-injected context to make a smart transfer decision.

### D6 — Welcome email mirrors Brian (Calgary Property Leasing)
Send manually after activation chain completes: dashboard URL + password setup link, Twilio number assigned, carrier forwarding instructions for Kausar's existing 306-241-6312 line, Stripe checkout link, Telegram bot setup link, "call to test" one-liner.

## Reality corrections logged
1. **Hasan and Omar do NOT have transfer enabled** — they have `selected_plan='pro'` (transfer-eligible) but `forwarding_number` is null, so the tool never registers. Velly will be the first production client to actually exercise transfer if the DB-override workaround in D2 is approved.
2. **Omar's IVR is binary**: press 1 = voicemail, else = AI agent. There is no "press 2 = direct to Omar" option. That feature was never built.
3. **The Overview "Live call transfer" sheet is config, not action.** It writes `forwarding_number` to DB and toggles whether `transferCall` registers. The manual mid-call action shipped separately as the "Take this call" button on LiveCallBanner (2026-04-28 PR #39).
4. **Plan-gating on the toggle was a fake-control bug for Lite users** — fixed 2026-04-28 PM. Lite users now see an upgrade modal instead of a working-looking toggle that did nothing at runtime ([InlineModalsV2.tsx:639-657](src/components/dashboard/home/InlineModalsV2.tsx#L639-L657)).
5. **`transfer_conditions` is OPTIONAL, not required.** [buildTransferTools()](src/lib/ultravox.ts#L463-L465) has a sensible default ("transfer when caller asks for someone directly / says 'put me through' / 'connect me'"). Custom conditions are only needed for name-specific routing or emergency-keyword routing. Earlier claim that transfer "doesn't work without `transfer_conditions`" was wrong.

## Consequences / open follow-ups
- Velly will be the canary for `transferCall` in production — monitor first 10 transfers carefully via call_logs + transfer_status
- If Hasan or Omar later want the same capability, both have `plan=pro` already — just need to add `forwarding_number` + `transfer_conditions`
- Renovation niche scaffold is a future D-item (not blocking)
- Manual mid-call transfer button is a future D-item (not blocking)
- **Repeating concierge clients should follow this same pattern**: niche=other if no template, plan=pro for transfer entitlement, custom minute cap via direct DB update, agent-initiated transfer only until manual button ships
