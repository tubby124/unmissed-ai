---
type: product
status: active
tags: [product, onboarding, audit, ux]
related: [Product/Onboarding Flow, Product/Working Agent Patterns]
updated: 2026-04-01
---

# Onboarding Flow Audit — 2026-04-01

## Test Run
Tested with "Red Swan Pizza - Calgary 37th St. SW" (restaurant niche) and "Justin Havre Real Estate Team with eXp Realty" (real estate niche).

## Current 7-Step Flow (actual code)

| Step | Label | What it collects |
|------|-------|-----------------|
| 1 | Your business | GBP search, business name, agent name, niche (silent auto-detect) |
| 2 | Voice | Voice picker, 2 preview cards (greeting/message), personality/tone (4 options) |
| 3 | Agent mode | 4 mode cards + services chips + FAQ text + 3 caller reasons + urgency words + price range + call forwarding + IVR |
| 4 | Schedule | 24/7 / business hours / custom |
| 5 | Train your agent | Doc upload, website scrape preview, niche Q&A form OR FAQ editor |
| 6 | Your plan | Plan selection (Lite/Core/Pro) |
| 7 | Launch | Email, password, phone, activate |

## Issues Found

### P1 — No niche detection feedback → [[Tracker/D315]]
GBP auto-detects niche from Google Places types (e.g. `restaurant`, `food`, `cafe` → `restaurant`). Detection works correctly. But there is **zero visual feedback** — the user never sees "Industry: Restaurant" anywhere. The amber niche picker only appears when detection fails (`niche='other'`).

**Impact:** User doesn't know what niche was selected. Niche determines the entire prompt template, service suggestions, and agent behavior.

### P2 — Voice preview cards are misleading → [[Tracker/D316]]
Step 2 shows two clickable cards: "Welcome Greeting" and "Message Taking". They look like you're choosing between two modes. In reality, they are **audio preview demos only** — clicking them plays the voice sample. No data is set. No choice is recorded.

**Impact:** User thinks they're making a choice. They're not. Fake control that causes confusion.

### P3 — Placeholder examples hardcoded to auto_glass → [[Tracker/D317]]
In Step 3, all placeholder/example text is hardcoded to windshield repair regardless of niche:
- "Why do people call you?" → `"Need a windshield replaced"`, `"Rock chip — want a price"`, `"Insurance claim question"`
- "What questions do callers ask most?" → `"Do you offer free estimates? How long does a windshield replacement take? Do you accept insurance?"`
- "Or paste a description..." → `"We do oil changes from $65, brake repairs, tire rotations..."`

These show even when the selected niche is real_estate or restaurant.

**Impact:** Confusing UX. User with a pizza restaurant sees windshield examples. Looks broken.

### P4 — Step 3 is a monster (10+ inputs) → [[Tracker/D318]]
Step 3 ("Agent mode") contains:
1. 4 agent mode cards — **essential, keep**
2. Services chips (niche-adaptive) — **useful but belongs in step 5**
3. FAQ text capture — **duplicates step 5**
4. 3 caller reason inputs — **important but advanced**
5. Urgency words input — **advanced, move to dashboard**
6. Price range input — **useful but optional**
7. Call forwarding toggle + number — **post-onboarding setting**
8. IVR toggle + prompt — **post-onboarding setting**

**Impact:** Overwhelming. Users scroll past a wall of inputs. The step takes longer than it should.

### P5 — Voice picker shows too many options → [[Tracker/D319]]
Currently shows all voices at once via GenderVoicePicker. User wants simple Male/Female choice first, with "more voices" available in dashboard.

**Impact:** Decision fatigue during onboarding. Most users just want male or female.

### P6 — urgencyWords not stored independently → [[Tracker/D320]]
`urgencyWords` is collected in the UI but NOT in `toIntakePayload()` and NOT in the provision route. It only survives if the AI-generated TRIAGE_DEEP (via `/api/onboard/infer-niche`) successfully bakes it in. If TRIAGE_DEEP generation fails, urgency words are silently lost.

**Impact:** Data loss on AI failure. Should be stored in `clients` independently.

### P7 — Step 3 and Step 5 duplicate FAQ collection → [[Tracker/D321]]
- Step 3 has `callerFaqText` (freeform "What questions do callers ask most?")
- Step 5 has structured `faqPairs` editor (question + answer cards)
- Both flow into the system via different paths:
  - `callerFaqText` → Haiku extraction → `extra_qa` in provision route
  - `faqPairs` → `niche_faq_pairs` in intake → knowledge seeding

**Impact:** Confusing — user enters FAQ info twice. Should be consolidated.

### P8 — No loading orb during GBP lookup → [[Tracker/D322]]
When searching for a business and waiting for Places API results, the only loading indicator is a tiny 4px spinner inside the input field. No visible feedback that the system is working.

User wants the same orb used on the Launch step shown during this wait.

**Impact:** Perceived slowness. User thinks nothing is happening.

## Data Flow Verification

| Field | Collected in | Flows to DB? | Flows to prompt? | Status |
|-------|-------------|-------------|-----------------|--------|
| `businessName` | Step 1 | ✅ `clients.business_name` | ✅ `BUSINESS_NAME` variable | Working |
| `agentName` | Step 1 | ✅ `clients.agent_name` | ✅ `AGENT_NAME` variable | Working |
| `niche` | Step 1 (auto-detect) | ✅ `clients.niche` | ✅ drives template selection | Working (no UI feedback) |
| `voiceId` | Step 2 | ✅ `clients.agent_voice_id` | N/A (Ultravox voice, not prompt) | Working |
| `agentTone` | Step 2 | ✅ `clients.voice_style_preset` | ✅ `TONE_STYLE_BLOCK`, `FILLER_STYLE`, `GREETING_LINE`, etc. | **Working** — drives 5 prompt variables via VOICE_PRESETS |
| `agentMode` | Step 3 | ✅ `clients.call_handling_mode` | ✅ `PRIMARY_GOAL`, `CLOSING_ACTION` | Working |
| `selectedServices` | Step 3 | ✅ `client_services` table + `SERVICES_OFFERED` | ✅ via service_catalog | Working |
| `callerFaqText` | Step 3 | ✅ `extra_qa` (via Haiku extraction) | ✅ injected as businessFacts | Working |
| `callerReasons` | Step 3 | ❌ Not directly stored | ⚠️ Only via AI-generated TRIAGE_DEEP | Indirect — fragile |
| `urgencyWords` | Step 3 | ❌ Not stored | ⚠️ Only via AI-generated TRIAGE_DEEP | **Gap — data loss risk** |
| `priceRange` | Step 3 | ✅ prepended to `context_data` | ✅ via contextData injection | Working |
| `callForwardingEnabled` | Step 3 | ✅ `clients.forwarding_number` | ✅ transfer tool registered | Working |
| `ivrEnabled` | Step 3 | ✅ `clients.ivr_enabled` | ✅ IVR gating in inbound webhook | Working |
| `businessHoursText` | Step 4 | ✅ `clients.business_hours_*` | ✅ callerContextBlock | Working |
| `faqPairs` | Step 5 | ✅ `niche_faq_pairs` → knowledge seeds | ✅ via KB seeding | Working |
| `knowledgeDocs` | Step 5 | ✅ `client_knowledge_docs` | ✅ via KB chunks | Working |
| Voice preview cards | Step 2 | ❌ No data set | ❌ | **Fake control** |

## Recommended Restructure

| Step | Focus | What to keep | What to remove/move |
|------|-------|-------------|-------------------|
| 1 | Your business | GBP, name, agent name, **+ niche badge** | — |
| 2 | Voice | **Male/Female toggle** → auto-play, personality (keep 4 cards) | Remove preview cards (greeting/message) — they set nothing |
| 3 | Agent mode | **Just the 4 mode cards** | Move services → step 5. Move FAQ/reasons → step 5. Remove forwarding/IVR (dashboard only). Remove urgency/price (dashboard only). |
| 4 | Schedule | Keep as-is | — |
| 5 | Teach your agent | Doc upload + website scrape + niche Q&A + services chips + caller reasons (merged from step 3) | Remove duplicate callerFaqText (keep structured faqPairs only) |
| 6 | Plan | Keep as-is | — |
| 7 | Launch | Keep as-is | — |

## Connections
- → [[Product/Onboarding Flow]] (update with current reality)
- → [[Product/Working Agent Patterns]] (what actually makes agents good)
- → [[Product/Intent Classification]] (caller reasons → TRIAGE_DEEP)
- → [[Tracker/D315]] through [[Tracker/D322]]
