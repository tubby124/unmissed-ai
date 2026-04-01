---
type: architecture
status: active
tags: [phase7, onboarding, audit, sonar-validated]
related:
  - "[[Product/Onboarding Flow]]"
  - "[[Tracker/D314]]"
  - "[[Architecture/Prompt Generation]]"
updated: 2026-04-01
---

# Phase 7 — Onboarding Audit & Simplification Plan

> Sonar-validated 2026-04-01. Code-audited same session.
> Goal: New client → working agent in 2 minutes.

## Current State (7 steps, ~5 minutes)

```
Step 1 — GBP Search (Google Places lookup)
Step 2 — Voice + Personality (voice picker + 4 personality presets + TTS preview)
Step 3 — Capabilities (mode, services, FAQs, caller reasons, urgency, pricing, add-ons)
Step 4 — Schedule (business hours)
Step 5 — Account creation (email + password)
Step 6 — Activate (Stripe checkout + provision)
```

## Confirmed Bugs (code audit 2026-04-01)

### BUG 1: FAQ examples are hardcoded to auto_glass (ALL niches)
**File:** `src/app/onboard/steps/step3-capabilities.tsx:433`
```
placeholder={`e.g. "Do you offer free estimates? How long does a windshield replacement take? Do you accept insurance?"`}
```
This placeholder is NOT niche-aware. Every niche (real estate, dental, plumbing) sees windshield examples.

### BUG 2: "Why do people call you" examples hardcoded to auto_glass
**File:** `src/app/onboard/steps/step3-capabilities.tsx:471-473`
```
i === 0 ? 'e.g. "Need a windshield replaced"' :
i === 1 ? 'e.g. "Rock chip — want a price"' :
           'e.g. "Insurance claim question"'
```
Same issue — every niche sees windshield caller reasons.

### BUG 3: Agent personality saves to DB but dashboard can't edit it
- **Onboarding:** 4 presets in `step2-voice-preview.tsx:246-251` → saves to `data.agentTone`
- **Provision:** `provision/trial/route.ts:170` → writes `voice_style_preset: data.agentTone || 'casual_friendly'`
- **Prompt:** `prompt-slots.ts:891` reads `voice_style_preset` and maps to VOICE_PRESETS → injects into prompt
- **Dashboard:** Settings `AgentTab.tsx` has a VoiceStyleCard — but need to verify if the 4 presets match and if changes actually trigger prompt repatch
- **Gap:** If personality changes in dashboard don't call `patchVoiceStyleSection()`, the prompt text is stale

### BUG 4: Welcome greeting vs message taking — unclear mode mapping
- **Onboarding:** `step2-voice-preview.tsx` shows two TTS cards: "WELCOME GREETING" and "MESSAGE TAKING"
- These are **preview demos only** — they don't set a DB field directly
- The actual mode is set in Step 3 via `agentMode` (lead_capture / appointment_booking / voicemail_replacement)
- **Gap:** User sees greeting vs message-taking as a choice, but it's just a preview of what the agent sounds like. The actual behavior comes from `callHandlingMode` set in Step 3. This is confusing UX.

### BUG 5: Services have niche chips but examples don't match
- **Services chips:** `NICHE_SERVICE_SUGGESTIONS` at line 63 — correctly per-niche (real_estate gets "Buyer consultation", etc.)
- **FAQ examples:** Hardcoded auto_glass (BUG 1)
- **Caller reason examples:** Hardcoded auto_glass (BUG 2)
- **Description paste example:** Line references "We do oil changes from $65, brake repairs..." — also wrong for non-auto niches

## Sonar Research Findings (2026-04-01)

### Ideal onboarding for SMB SaaS
- **3-7 steps max** in initial flow (target: 0-60 seconds for Phase 1, 1-5 minutes for Phase 2)
- **1-3 questions at signup**, defer rest via progressive profiling
- Every extra field cuts completion by 10-15%
- **3-step minimum viable onboarding:** business name → one value CTA ("Test a call now") → quick-win setup

### What to ask upfront vs defer

| Field | Upfront? | Why |
|-------|----------|-----|
| Business name (via GBP) | YES | Enables personalization, auto-populate |
| Niche | YES (auto-detect from GBP categories) | Segments the agent template |
| Voice (male/female) | YES (simplified) | 2 choices, not 12+ |
| Personality (4 presets) | NO — defer | Use "Friendly" default, customize on dashboard |
| Services offered | NO — defer | Auto-populate from GBP categories; refine on dashboard |
| FAQ / caller questions | NO — defer | AI infers from niche; user adds on dashboard |
| Urgency phrases | NO — defer | Niche defaults handle this |
| Price ranges | NO — defer | Not needed for agent to answer calls |
| Caller reasons / routing | NO — defer | QuickConfigStrip routing pill handles this on dashboard |
| Add-ons (IVR, forwarding) | NO — defer | Show on dashboard, not onboarding |

### Google Places API vs Apify
- **Google Places API is the move** — 95%+ accuracy, official listings, real-time updates
- Already have `places-lookup`, `places-autocomplete`, `places-details` routes built
- Returns: name, address, hours, phone, website, rating, reviews, categories (primary + up to 9 additional)
- Categories map directly to niche detection (e.g. "plumber" → plumbing, "real_estate_agency" → real_estate)
- **No need for Apify** — Google Places gives us everything we need for auto-populate
- Cost: ~$17/1K requests (acceptable for onboarding)

### Voice selection
- Simplify to **male/female first** (2 choices), with "More voices" expand option
- Default to a neutral female voice (broad appeal)
- Full voice library moves to dashboard
- Personality preset: use niche default, defer to dashboard

### Progressive disclosure pattern
- **Step 1:** Business name → auto-fetch GBP data → generate agent preview
- **Step 2:** Confirm/edit basics (verify hours, pick voice gender)
- **Post-onboarding:** Dashboard nudges ("Add FAQs", "List prices") with AI suggestions from GBP data

## Proposed New Flow (3 steps)

### Step 1 — Find Your Business
- GBP search (already built)
- Auto-detect: business_name, website_url, hours, phone, address, niche (from GBP categories)
- Show confirmed business card with **niche badge**
- Loading state: **use the orb** (same as provision step)

### Step 2 — Meet Your Agent
- Show agent name (auto-set from niche, editable)
- **Male or Female** voice toggle (2 options, not 12+)
- "More voices" expand if they want to browse
- Live TTS preview of greeting
- Skip personality preset — use niche default (casual_friendly for trades, professional_warm for professional services)

### Step 3 — Account + Go Live
- Email + password
- Plan selection + Stripe checkout
- Provision agent
- Land on full dashboard (D314 — UnifiedHomeSection)

### Everything else → Dashboard
- Services, FAQs, caller questions, urgency, pricing → Knowledge page + QuickConfigStrip
- IVR, forwarding, booking → QuickConfigStrip pills
- Personality, detailed voice → Settings page
- GBP data visible on Overview (already done via D311)

## New/Updated Tracker Items

### Bugs to fix NOW (pre-Phase 7)
- **D315** — Fix hardcoded auto_glass FAQ examples in step3 (niche-aware placeholders)
- **D316** — Fix hardcoded auto_glass caller reason examples in step3 (niche-aware placeholders)
- **D317** — Verify personality preset round-trips: onboarding → DB → prompt → dashboard edit → prompt repatch

### Phase 7 items
- **D291** — REVISED: GBP auto-import via Google Places API (NOT Apify). Auto-detect niche from categories.
- **D318** — Simplify voice selection: male/female toggle + "More voices" expand
- **D319** — Remove personality preset from onboarding (use niche default)
- **D320** — Remove FAQ/services/caller-reasons/urgency/pricing from onboarding (defer to dashboard)
- **D321** — Collapse onboarding to 3 steps: Find Business → Meet Agent → Account + Go Live
- **D322** — Niche badge on confirmed business card in onboarding
- **D323** — Orb loading state for GBP lookup + provision steps
- **D293** — Paste URL → agent ready (already tracked — fits as alt path to GBP)
- **D292** — Guided call forwarding wizard (post-activation, on dashboard)

### Coordination note
Another Claude Code instance is working on niche detection in a separate session. D291 (GBP auto-import + niche detection from categories) may overlap — check before implementing.

## Key Files

| File | What |
|------|------|
| `src/app/onboard/steps/step1-gbp.tsx` | GBP search + business card |
| `src/app/onboard/steps/step2-voice-preview.tsx` | Voice + personality |
| `src/app/onboard/steps/step3-capabilities.tsx` | Mode + services + FAQs + routing + add-ons |
| `src/app/onboard/config/steps.ts` | Step sequence configuration |
| `src/lib/intake-transform.ts` | `toIntakePayload()` — maps form → DB |
| `src/app/api/provision/trial/route.ts` | Writes to clients table + spins up agent |
| `src/app/api/onboard/places-details/route.ts` | Google Places API integration |
| `src/components/onboard/GenderVoicePicker.tsx` | Voice selection component |
| `src/lib/prompt-slots.ts` | Where personality maps to prompt text |
