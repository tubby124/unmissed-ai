---
type: decision
status: active
tags: [pricing, product, architecture, tiers]
related: [[D240]], [[D245]], [[D273]], [[D280]], [[Prompt Architecture Refactor Plan]]
updated: 2026-03-31
---

# Tier Differentiation — Quality Is the Floor, Not the Ceiling

## Decision

Every agent on every plan gets the same conversation quality. Plan tiers differentiate on **minutes, features, and capabilities** — never on how well the agent talks.

## Context

After shipping Phases 1-5 of the prompt architecture refactor, we tested the e2e-test-plumbing-co agent (Dave). Two test calls scored A/A-: natural conversation, proper triage, issue/location/timing collection, HOT/WARM classification, clean routing to callback.

The question: is this the middle tier (Smart Receptionist) or should this be the baseline?

**Answer: This is the baseline.** Every agent, even Lite, should do this at minimum.

## The Rule

**What stays the same across ALL plans:**
- Natural voice conversation (backchannels, contractions, no robot speech)
- Purpose-driven triage (collect niche-relevant info, not just "leave a message")
- Lead classification (HOT/WARM/INFO)
- Callback routing
- Telegram/notification summaries

**What differentiates by plan:**

| Capability | Lite | Core | Pro |
|-----------|------|------|-----|
| Conversation quality | Full | Full | Full |
| Triage + classification | Full | Full | Full |
| Telegram summaries | Yes | Yes | Yes |
| Monthly minutes | 100 | 250 | 500 |
| SMS follow-up | No | Yes | Yes |
| Knowledge base (pgvector) | No | Yes | Yes |
| Call transfer | No | Yes | Yes |
| Calendar booking | No | No | Yes |
| IVR pre-filter | No | No | Yes |
| Coaching loop | No | No | Yes |

## Why

1. **The demo already shows Dave-level quality.** Nobody will pay for less than what they just heard. A "voicemail tier" that's worse than the demo is a credibility gap.
2. **Lite is for busy people** — a solopreneur plumber, a one-person shop. They need calls handled well, they just don't need SMS or booking. Quality is what they're paying for.
3. **Core is the money tier** — this is what most clients want. Everything except booking. Limited minutes push upgrades.
4. **Pro is for scale** — booking, IVR, coaching loop, more minutes. For businesses with real call volume.
5. **Minutes are the natural upgrade lever.** A happy Lite user who gets more calls will upgrade for minutes, not for "better conversation."

## Architecture Implication

The slot system (Phases 1-5) already enforces this. Every new agent gets all 19 slots including TRIAGE, FLOW, GOAL, CLOSING regardless of plan. Plan gating happens at the **tool level** (`buildAgentTools()` in `lib/ultravox.ts`), not the prompt level. No code change needed to implement this decision — just don't add plan-gated prompt degradation.

## What's Left

- D273: Onboarding collects the right questions to populate triage (partially done)
- D280: `recomposePrompt()` makes this systematic for existing clients (Phase 6)
- Pricing page messaging should reflect "same quality, more features" (D208)
- Remove "AI Voicemail" as a tier name — it undersells the product. Consider: "Essentials / Professional / Business" or similar.

## Source

Product decision by Hasan, 2026-03-31. Confirmed after reviewing two live test calls on e2e-test-plumbing-co that demonstrated baseline agent quality exceeds what was previously considered "middle tier."
