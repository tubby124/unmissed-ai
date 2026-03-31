---
type: product
status: critical-gap
tags: [product, prompt, intent, architecture]
related: [Architecture/Prompt Generation, Product/Onboarding Flow]
updated: 2026-03-31
---

# Intent Classification — Purpose-Driven Agents

> Source: `memory/project_purpose_driven_agents.md`
> Status: **CRITICAL GAP** — D240-D245 in tracker

## The Root Problem
Every auto-generated agent is an **information bot** — knows WHO the business is and WHAT services they offer, but has NO intent classification and NO purpose-driven routing.

Every call ends in "I'll have our team call you back" regardless of why the caller called.

The well-tuned agents (Windshield Hub, Urban Vibe, Hasan) only work because they were manually iterated via `/prompt-deploy` — NOT because the auto-template does it right.

## The Gap
`buildPromptFromIntake()` generates a generic TRIAGE section for all niches:
> "What can I help you with today?"

No routing. No intent buckets. No outcome per intent.

## The Fix (5 Layers)

### Layer 1 — Intent Taxonomy per Niche
4-5 caller intent buckets per niche, each with:
- Trigger keywords
- 2-3 triage questions specific to that intent  
- Outcome (book / answer / qualify+callback / transfer)

Example — Auto Glass:
- `windshield_repair` → "which window?", "how big?" → price range + book
- `quote_request` → "make/model/year?" → range quote + callback
- `insurance` → "direct bill or self-pay?" → insurance flow
- `emergency` → immediate escalation

### Layer 2 — TRIAGE Section Redesign
Replace "What can I help you with today?" with:
```
LISTEN for their first words. Based on what you hear:
- [broken/cracked/chip] → INTENT: repair → ask: [Q1], then [Q2]
- [price/cost/how much] → INTENT: quote → give range, qualify
- [book/schedule] → INTENT: booking → go to scheduling flow
- unclear → "are you calling about [A], [B], or something else?"
```

### Layer 3 — Onboarding Data Collection (D241)
Add to onboarding step 3: **"What are the top 3 reasons people call your business?"**
→ feeds intent taxonomy for that client's generated prompt

### Layer 4 — Unknown Niche Handling (D242)
For niche='other' at provision time:
1. Take website content + service catalog
2. Haiku: "What are 5 reasons people would call this business?"
3. Generate custom intent taxonomy
4. Write intent-aware TRIAGE into generated prompt

### Layer 5 — Intent Coverage UI (D244)
Replace capability toggles with intent coverage view:
"Service requests: ✅ | Pricing questions: ⚠️ no range set | Emergencies: ❌ no forwarding"

## D-Items
- [[Tracker/D240]] — audit all niche templates for intent gaps
- [[Tracker/D241]] — add "top 3 reasons" question to onboarding step 3
- [[Tracker/D242]] — Haiku intent inference for niche='other'
- [[Tracker/D243]] — TRIAGE section rewrite for all 5 niches
- [[Tracker/D244]] — Intent coverage UI (replaces feature toggles)
- [[Tracker/D245]] — Test intent routing on all 4 active clients

## Connections
- → [[Architecture/Prompt Generation]] (TRIAGE section is generated here)
- → [[Product/Onboarding Flow]] (step 3 needs intent question)
- → [[Architecture/Mode Architecture]] (intent routing must respect mode)
