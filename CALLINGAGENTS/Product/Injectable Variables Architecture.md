---
type: product
status: active
tags: [architecture, onboarding, prompt, injectable]
related: ["[[D247]]", "[[Working Agent Patterns]]", "[[Business Pain Map]]", "[[D251]]", "[[D252]]"]
updated: 2026-03-31
---

# Injectable Variables Architecture

## The Core Insight

The reason 4 agents work and every new provisioned agent is generic: **the 4 working agents have the right injectable variables because Hasan manually answered them over 60 revisions**. The product never asked. 

The fix: ask the owner those same questions at onboarding — specifically, freeform. Then have Haiku translate their answers into the exact prompt variables the system needs.

---

## What "Injecting" Means Here

There are 3 layers of injection, and they all need to be owned by the client:

### 1. `TRIAGE_DEEP` — Call Intent Router (most important)
**What:** The block in the prompt that says "when someone calls about X, do Y."
**Without it:** Agent says "How can I help?" and then summarizes whatever the caller says → no purpose, no routing.
**With it:** Agent hears "chip repair" → immediately routes to ADAS question + price range + book. Caller feels like they reached someone who knows the business.
**Source:** Owner answers "why do people call?" → Haiku generates this block.
**File:** `src/lib/prompt-config/niche-defaults.ts` (niche defaults) | `niche_custom_variables.TRIAGE_DEEP` (client override)

### 2. `context_data` — Live Reference Data
**What:** Prices, policies, urgency keywords, tenant rosters, menus — anything that changes per call context.
**Without it:** Agent says "I don't have that info — someone will call you back."
**With it:** "Rock chip repairs start around $80-120 depending on location and ADAS — want me to book?"
**Source:** Website scraper (Haiku extracts PRICES/POLICIES/URGENCY block), or owner fills in dashboard.
**File:** `clients.context_data` (DB) → injected via `{{contextData}}` at call time.

### 3. `business_facts` / `extra_qa` — Knowledge Base
**What:** FAQs, hours, specific policies, unique facts.
**Without it:** Agent can't answer "do you do mobile service?" or "do you accept ICBC?"
**With it:** Answers confidently before routing.
**Source:** Website scrape → approval → `knowledge_chunks`, or owner adds manually via Settings > FAQ.
**File:** `clients.business_facts`, `clients.extra_qa` → pgvector chunks or inline businessFacts block.

---

## The Variables That Make Agents Work

From analyzing the 4 live agents (`memory/working-agent-patterns.md`):

| Variable | What it controls | Owner's input that sets it |
|----------|-----------------|---------------------------|
| `TRIAGE_DEEP` | Which caller types get which routing | "Why do people call?" (D247) |
| `URGENCY_WORDS` | Which phrases trigger immediate escalation | Part of context_data (D246 scraper) |
| `INFO_TO_COLLECT` | What the agent asks for before it can help | Part of TRIAGE_DEEP routing per intent |
| `CLOSE_ACTION` | Book, message, or answer per intent | Part of TRIAGE_DEEP per intent |
| `OPENING_LINE` | First impression — signals competence | Agent name + niche + mode (already in prompt) |
| `FORBIDDEN` | What to never say/do (legal, liability) | Already in prompt template |

---

## The Self-Serve Loop (what makes this scalable)

```
Onboarding → 3 intent questions → Haiku → TRIAGE_DEEP stored in niche_custom_variables
         ↓
Agent goes live → misses questions → knowledge_query_log populated
         ↓
D252 surfaces gaps: "Your agent missed 'pricing' 3x this week → [Add price range]"
         ↓
Owner clicks → opens D251 per-section editor → edits TRIAGE section inline
         ↓
/prompt-deploy equivalent → updateAgent() → live
         ↓
Next week: agent handles those calls correctly
```

The loop closes when: owner input → Haiku → TRIAGE_DEEP → agent → call → gap detected → owner fixes → agent improves.

---

## What Needs Building (D-items)

| # | What | Status |
|---|------|--------|
| D246 | context_data via website scraper (Haiku extracts PRICES/POLICIES/URGENCY) | ✅ DONE |
| D247 | 3 intent questions in onboarding → TRIAGE_DEEP via Haiku | 🟡 IN PROGRESS |
| D251 | Per-section editor UI so owners can edit TRIAGE_DEEP post-onboarding | open |
| D252 | Gap → one-click fix CTA when agent misses same question 3x | open |

---

## The Vision (from Hasan, 2026-03-31)

> "It's basically like voicemail, except we don't waste each other's time. We just talk to the agent, ask actual questions, and the agent is so dialed in that it knows the business and understands how to handle the call for them. It gets the message across or books the appointment."

The bar: a plumber finishes a job, gets in his truck, glances at a 🔥 HOT Telegram card. "$800 job. Caller needs emergency pipe repair, has flooding." He calls back before he drives away. Job booked. All because the agent knew "emergency flood = URGENT, get name + address + call owner NOW."

That context — "emergency flood = urgent" — is `TRIAGE_DEEP`. And it comes from the owner answering "why do people call?" in onboarding.

---

## The Unified Owner Input Model

Every piece of owner input — from onboarding OR the dashboard — maps to an injectable that the agent uses on every call. This is the same data powering D249 (readiness), D247 (intent), D250 (ROI), and every other dashboard surface.

| Owner Input | Where Entered | Injectable | How Agent Uses It |
|-------------|--------------|-----------|-------------------|
| Business hours | Onboarding step 3 / Settings | `callerContextBlock` | OFFICE HOURS + after-hours detection |
| Services offered | Onboarding step 3 / Settings | `business_facts` | Answers "do you do X?" |
| FAQs | Onboarding / Settings FAQ card | `extra_qa` → knowledge_chunks | Answers specific questions |
| **"Why do people call?"** | **Onboarding step 3 (D247)** | **TRIAGE_DEEP** | **Routes every call to the right outcome** |
| Prices & policies | Website scrape (D246) / Manual (D255) | `context_data` | Gives ballpark quotes, explains policies |
| Today's Update | Dashboard "Today's Update" card | `injected_note` | Live override for that day's context |
| Forwarding number | Settings / Onboarding | `transferCall` tool | Transfers urgent calls to owner |
| Calendar connected | OAuth flow | `bookAppointment` tool | Books appointments directly |

**The D249 readiness score IS this table:** how many injectables have been filled in? Score 5/5 = working agent. Score 1/5 = generic info bot.

**The D252 gap loop IS this table:** which rows are empty? Surface them to the owner with one-click fill.

**D254** brings the D247 intent editor to the dashboard (post-onboarding edits).
**D255** ensures context_data is always populated — website scrape OR guided manual entry.
