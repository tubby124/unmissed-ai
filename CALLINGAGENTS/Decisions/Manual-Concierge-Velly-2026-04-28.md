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
Founding rate locks in forever per [[Product/Concierge-Onboarding-SOP]]. 100-minute hard monthly cap. Set `monthly_minute_limit=100` directly on the clients row. Plan must remain `pro` so the `transferCall` tool registers (founding price ≠ founding feature gating).

### D3 — Transfer: agent-initiated only (defer manual button)
Use `transfer_conditions` rule to drive `transferCall` tool. Do NOT build the manual "Transfer this call to me" button on LiveCallBanner during this session. Deferred to [[Tracker/D-NEW-mid-call-transfer-button]] until Velly demonstrates real demand. Rationale: ship working transfer first, observe whether agent-initiated is sufficient, then add manual override only if needed.

### D4 — Hours: 24/7 always-answer with weekday business hours as callback context
Set `business_hours_weekday=Mon–Fri 8am–5pm`, `business_hours_weekend=by appointment`, `after_hours_behavior=always_answer`. Eric never says "we're closed" — he uses hours only to set callback expectations ("Kausar will call you back tomorrow morning"). Apply this pattern to future clients who want 24/7 answering on a weekday business — it's not a separate mode, just config.

### D5 — Returning customer detection: rely on existing `buildAgentContext()` injection
No new code. Auto-injects `RETURNING CALLER` + prior count + last summary into prompt at call time via [agent-context.ts:121-138](src/lib/agent-context.ts#L121-L138). Add a transfer-rule branch for "returning customer asking for Kausar directly" so Eric uses the auto-injected context to make a smart transfer decision.

### D6 — Welcome email mirrors Brian (Calgary Property Leasing)
Send manually after activation chain completes: dashboard URL + password setup link, Twilio number assigned, carrier forwarding instructions for Kausar's existing 306-241-6312 line, Stripe checkout link, Telegram bot setup link, "call to test" one-liner.

## Reality corrections logged
1. **Hasan and Omar do NOT have transfer enabled.** Both vault notes show `Transfer = [ ]`. Velly is the first production client with `forwarding_number` set + `transferCall` registered.
2. **Omar's IVR is binary**: press 1 = voicemail, else = AI agent. There is no "press 2 = direct to Omar" option. That feature was never built.
3. **The Overview "Live call transfer" sheet is config, not action.** It writes `forwarding_number` to DB and toggles whether `transferCall` registers. It does not transfer the call you're currently watching.

## Consequences / open follow-ups
- Velly will be the canary for `transferCall` in production — monitor first 10 transfers carefully via call_logs + transfer_status
- If Hasan or Omar later want the same capability, both have `plan=pro` already — just need to add `forwarding_number` + `transfer_conditions`
- Renovation niche scaffold is a future D-item (not blocking)
- Manual mid-call transfer button is a future D-item (not blocking)
- **Repeating concierge clients should follow this same pattern**: niche=other if no template, plan=pro for transfer entitlement, custom minute cap via direct DB update, agent-initiated transfer only until manual button ships
