---
type: product
status: active
tags: [product, onboarding, ux]
related: [Product/Intent Classification, Architecture/Prompt Generation, Dashboard/Settings Cards]
updated: 2026-03-31
---

# Onboarding Flow

## Current 7-Step Flow
```
Step 1 — GBP Search (google places lookup)
  → pulls: business_name, website_url, hours, phone, address
  → known bug D176: GBP returns 24h time format ("17pm") → needs 12h conversion
  → known bug D177: GBP website URL has UTM params → strip to base URL

Step 2 — Niche selection
  → maps to: clients.niche (immutable after provision)
  → drives: buildAgentTools() defaults, capability flags, prompt template sections

Step 3 — Voice / TTS selection
  → Cartesia voices, live TTS preview
  → sets: clients.agent_voice_id

Step 4 — Capabilities selection (REMOVED from flow — see D gap below)
  → was: knowledge scrape, FAQ input
  → now: skipped → clients onboard with NO knowledge base

Step 5 — Account creation
  → email + password (default QWERTY123 — D124 security gap)

Step 6 — Plan selection + Stripe checkout
  → sets: selected_plan, subscription_status

Step 7 — Launch (agent provisioned)
  → buildPromptFromIntake() generates system_prompt
  → createAgent() spins up Ultravox agent
  → ensureTwilioProvisioned() buys phone number
```

## Critical Gap: Knowledge Step Removed
Step 4 was removed. Clients now onboard with NO knowledge chunks.
D226: parse-services route built but not wired to step 3.
D227: knowledge conflict/docs/preview-question routes built but not wired to knowledge page.

## What Needs to Change (D185 + redesign plan)
**Mode-first onboarding** — show 3 modes upfront:
- AI Voicemail (message_only) → skip FAQ, knowledge, service catalog
- Smart Receptionist (info_hub) → need FAQs + knowledge
- Receptionist + Booking → everything + calendar

Each mode = different steps shown.

See: [[Product/Intent Classification]] for why step 3 needs a "top 3 reasons people call" question.
See: [[Architecture/Prompt Generation]] for how onboarding data feeds the prompt.

## Key Files
- `src/app/onboarding/` — step components
- `src/app/onboarding/step1-gbp.tsx` — GBP search
- `src/app/onboarding/step3-capabilities.tsx` — voice + services
- `src/lib/intake-transform.ts` → `toIntakePayload()` — maps form data to DB
- `src/app/api/provision/trial/route.ts` — writes clients row + spins up agent

## Connections
- → [[Architecture/Prompt Generation]] (onboarding data → prompt)
- → [[Product/Intent Classification]] (step 3 missing "why do people call you?")
- → [[Tracker/D185]] (mode-first onboarding)
- → [[Tracker/D189]] (trial vs paid dashboard after onboarding)
