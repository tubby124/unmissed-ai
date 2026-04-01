---
type: feature
status: active
tags: [pricing, tiers, plan-gating, architecture]
related: [[Decisions/Tier Differentiation — Quality Floor Not Ceiling]], [[Architecture/Billing and Stripe]], [[D208]], [[D240]], [[D273]]
updated: 2026-04-01
---

# Plan Tiers and Gating

> **Core rule:** Quality is the floor, not the ceiling. Every agent on every plan gets the same conversation quality. See [[Decisions/Tier Differentiation — Quality Floor Not Ceiling]].

## What EVERY Agent Gets (All Plans)

These are non-negotiable. Even the cheapest plan gets all of this:

- Natural voice conversation (backchannels, contractions, personality)
- Purpose-driven triage (collect niche-relevant info: issue, location, timing, etc.)
- Lead classification (HOT / WARM / COLD / JUNK)
- Callback routing ("our plumber'll call ya back")
- Telegram summary alerts after every call
- After-hours detection + behavior
- Returning caller recognition
- Full prompt sandwich (all 19 slots active)
- Voicemail fallback (if Ultravox is down)

**Why:** The demo already shows this quality. Selling less than the demo is a credibility gap. A busy solopreneur (plumber, realtor, auto glass tech) just needs calls handled well — that's what they're paying for.

## Tier Feature Matrix (Phase 7 — 2026-04-01)

| Capability | Lite — Call Catcher | Core — AI Receptionist | Pro — Front Desk Pro |
|-----------|---------------------|------------------------|----------------------|
| **Conversation quality** | Full | Full | Full |
| **Triage + classification** | Full | Full | Full |
| **Telegram summaries** | Yes | Yes | Yes |
| **Monthly minutes** | 100 | 400 | 1,000 |
| **SMS follow-up** | Yes | Yes | Yes |
| **Knowledge base (pgvector)** | No | Yes | Yes |
| **Calendar booking** | No | **Yes** | Yes |
| **Call transfer** | No | No | **Yes** |
| **IVR pre-filter** | No | No | **Yes** |
| **Coaching loop** | No | Yes | Yes |
| **Outbound calls** | No | Planned | Planned |

## Who Buys What

**Lite — Call Catcher ($49/mo):** Busy solopreneur. One-person shop. They miss calls, they lose jobs. AI voicemail that captures every call and texts them the summary. SMS follow-up to callers. No booking, no transfer — just catch every call.

**Core — AI Receptionist ($119/mo):** The money tier. SMBs and individuals who want AI in their workflow. Full receptionist that answers questions, books appointments, scores leads, and knows the business. Everything except IVR and live transfer. This is what most clients want.

**Pro — Front Desk Pro ($229/mo):** For companies with massive call volume. IVR routing, live transfer to owner's phone, 1,000 minutes. The full front desk — targeted at real businesses that need actual receptionist-level automation.

## Where This Is Enforced

### Tool-level gating (runtime)
`buildAgentTools()` in `src/lib/ultravox.ts` gates tools based on `getPlanEntitlements(selected_plan)`. This is the single source of truth for what tools a plan gets. The prompt stays the same — only the tools change.

### Plan entitlements definition
`src/lib/plan-entitlements.ts` — `PLAN_ENTITLEMENTS` map with `LITE`, `CORE`, `PRO`, `TRIAL_ENTITLEMENTS`.

### What NOT to gate by plan
- Prompt quality (all 19 slots always active)
- Triage behavior (always collects niche-relevant info)
- Classification quality (always HOT/WARM/COLD/JUNK)
- Notification quality (Telegram always full detail)
- Voice personality (always natural, always has backchannels)

### Prompt disclaimer for gated features
When a tool is gated out, `buildAgentTools()` adds a disclaimer line to the prompt so the agent doesn't promise features it can't deliver. E.g., "You cannot book appointments — route to callback instead."

## Naming (Decided 2026-04-01 — Phase 7)

- **Lite → Call Catcher** — catches every call, texts the summary
- **Core → AI Receptionist** — the full receptionist, books appointments
- **Pro → Front Desk Pro** — IVR + transfer + volume, for real companies

Names are in `pricing.ts` and `plan-entitlements.ts`. Stripe product names to be updated.

## Key Files

- `src/lib/plan-entitlements.ts` — tier definitions
- `src/lib/ultravox.ts` → `buildAgentTools()` — runtime tool gating
- `src/lib/capability-flags.ts` → `buildCapabilityFlags()` — UI badge display
- `docs/architecture/control-plane-mutation-contract.md` — full field classification

## Related Tracker Items

- [[Tracker/D208]] — Feature-to-tier messaging on pricing page
- [[Tracker/D240]] — Purpose-driven agents (every agent does triage)
- [[Tracker/D273]] — Onboarding collects triage-relevant questions
- [[Tracker/D186]] — Mode capability preview
- [[Tracker/D189]] — Unify trial/paid dashboard
- [[Tracker/D190]] — Feature unlock CTAs
