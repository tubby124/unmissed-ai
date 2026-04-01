---
type: moc
tags: [index, project]
updated: 2026-04-01
cleaned: 2026-03-31
last-tracker-cleanup: 2026-03-31
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Latest Session (2026-04-01)
- **D314 DONE**: Killed first-visit `TrialActiveSection` branch — ALL users now see `UnifiedHomeSection` (full product) from first login
- Sonar research confirmed: feature teasing > feature gating for trial conversion; full dashboard with upgrade hints beats simplified views
- Dashboard layout refactor shipped: CONFIG-first Overview, 3-col Knowledge/Calls/Settings, orb on all 4 pages
- QuickConfigStrip expanded to 8 pills: +Booking, +Transfer, +Routing (inline AI-generated triage)
- Settings page: capabilities overview + orb above tab bar, Agent tab kept for all users
- See [[Dashboard/Phase6-Wave2-Layout-Refactor]] for full details
- See [[Tracker/D314]] for unified dashboard decision + research

## Active Clients
- [[Clients/hasan-sharif]] — Hasan Sharif · Aisha · `f19b4ad7`
- [[Clients/exp-realty]] — Omar Sharif · Fatema · `c9019927`
- [[Clients/windshield-hub]] — Mark · Blake · `00652ba8`
- [[Clients/urban-vibe]] — Alisha · Ashley · `5f88f03b`
- [[Clients/manzil-isa]] — Fatima · Nour · TEST MODE
- [[Clients/plumber-calgary-nw]] — Test client · Dave · `d863d0c5` · plumbing niche
- [[Clients/muffin-house-cafe]] — Test client · Sofia · `8a97e54c` · restaurant niche · **Phase 6 architecture test**

## Architecture Contracts (read-first gates)
- [[Architecture/Control Plane Mutation]] — how every settings field flows DB → Ultravox
- [[Architecture/Per-Call Context]] — what gets injected at call time vs stored in prompt
- [[Architecture/Call Path Matrix]] — capabilities per call type (PSTN / WebRTC / Demo)
- [[Architecture/Webhook Chain]] — inbound → completed → Telegram → billing full flow
- [[Architecture/Billing and Stripe]] — subscription tiers, tool gating, minute enforcement
- [[Architecture/Mode Architecture]] — call_handling_mode, D180 bug, PRIMARY GOAL fix
- [[Architecture/Prompt Generation]] — buildPromptFromIntake(), template structure, deploy paths
- [[Architecture/Prompt Sandwich Spec]] — 19 named slots, char budgets, section order (Phase 1 output)
- [[Architecture/Prompt Slots]] — Phase 2→5: 19 slot functions LIVE. Phase 3: pgvector-first KB, conditional pricing, D296 fix. Phase 4: service catalog sync (D260), owner_name patcher (D281), business_name contract fix (D282). Phase 5: variable registry (39 vars), slot regenerator, service KB reseed (D300). 456 tests pass.

## Features
- [[Features/Plan Tiers and Gating]] — what each tier gets, quality floor rule, feature gates
- [[Features/Booking]] — calendar auth, patchCalendarBlock, plan gating
- [[Features/SMS]] — sms_enabled, twilio_number, sendTextMessage tool
- [[Features/Transfer]] — forwarding_number, transferCall HTTP tool
- [[Features/IVR]] — ivr_enabled, ivr_prompt, Gather TwiML
- [[Features/Knowledge RAG]] — pgvector, knowledge_chunks, queryKnowledge tool
- [[Features/AI Compiler]] — compile/apply, trust tiers, BLOCKED_KINDS
- [[Features/Voicemail]] — buildVoicemailTwiml, recording upload, Telegram alert
- [[Features/Notifications]] — Telegram + email alerts, notification_logs

## Product & Dashboard
- [[Dashboard/Dashboard Architecture]] — all pages, layout order, QuickConfigStrip pills, TestCallCard placement
- [[Dashboard/Phase6-Wave2-Layout-Refactor]] — 2026-03-31: 3-col layouts, CONFIG-first, orb on every page, booking+transfer pills
- [[Dashboard/Settings Cards]] — 19 cards, what saves where, Ultravox sync table
- [[Product/Onboarding Flow]] — 7 steps, removed step 4, mode-first redesign
- [[Product/Intent Classification]] — root problem (info bots), 5-layer fix, D240-D245
- [[Product/Demo Agent]] — Zara, unmissed-demo v12, wow-first philosophy
- [[Product/Working Agent Patterns]] — 9 patterns from 4 live agents, 6 onboarding questions (D253 output)
- [[Product/Business Pain Map]] — per-niche pain map: Hasan/Omar/Sabbir/Ray, the 7 elements every agent needs
- [[Product/Injectable Variables Architecture]] — how TRIAGE_DEEP/context_data/knowledge flow from owner input → working agent. The self-serve loop.

## Operations
- [[Operations/Deployment]] — Railway build process, known failure causes, "DONE" definition
- [[Operations/Cron Jobs]] — 10 jobs, CRON_SECRET dependency, drift check
- [[Operations/Lead Classification]] — HOT/WARM/COLD/JUNK system, AI classification
- [[Operations/Environment Variables]] — all Railway env vars, dev vs prod delta

## 🔴 NORTH STAR — User Designs the Prompt (D280)
> The user IS the prompt builder. They don't know it. Every field they fill in becomes a template variable injected into the system prompt. The user's data is authoritative — never override with hardcoded defaults. See [[Decisions/Prompt Sandwich Ownership Model]], [[Tracker/D280]], [[Tracker/D285]].

### Ownership Model
```
BREAD (us, non-negotiable):  Safety + Forbidden + Voice + Grammar + Returning Caller → Slots 1-4, 11
FILLING (them, their data):  Identity + Tone + Goal + Flow + Knowledge + Features → Slots 5-10, 12-19
```
Three onboarding tiers: "Decide for me" | "Let me tweak" | "Here's my stuff"
All three produce the same output: populated variables → sandwich assembles → prompt.
See [[Decisions/Prompt Sandwich Ownership Model]] for full philosophy.

### Prompt Architecture Refactor — 6 Phases
> Execution plan: `docs/architecture/prompt-architecture-execution-plan.md`
> outbound_isa_realtor excluded (n8n workflow). 4 working clients untouched.

| Phase | Status | Key Output |
|-------|--------|------------|
| 1 — Foundation | **DONE ✅** | Sandwich spec (19 slots), 70 golden tests, Sonar research |
| 2 — Named Slots | **DONE ✅** | 19 slot functions, shadow tests, 191 tests, UI audit |
| 3 — Shrink+Clean | **DONE ✅** | Slot composition live, pgvector-first KB, conditional pricing, 406 tests |
| 4 — Gap Wiring | **DONE ✅** | Service sync (D260), owner name (D281), business name (D282), 448 tests |
| 5 — Agent Knowledge UX | **DONE ✅** | Variable registry (39 vars), slot regenerator, service KB reseed, 456 tests |
| 6 — North Star | **Wave 1 DONE ✅** | recomposePrompt, variable API, preview, booking regen. Wave 2 UI in progress |

### Key D-items for this vision
- [[Tracker/D285]] — Prompt sandwich framework ✅ DONE
- [[Tracker/D274]] — System prompt = template with named slots ✅ DONE
- [[Tracker/D268]] — Minimal base prompt + dynamic sections ✅ DONE
- [[Tracker/D269]] — Knowledge base as primary info source ✅ DONE
- [[Tracker/D272]] — Remove business-logic constraints from prompts ✅ DONE
- [[Tracker/D265]] — Remove hardcoded PRODUCT KNOWLEDGE BASE ✅ DONE
- [[Tracker/D260]] — Service catalog → agent sync ✅ DONE (Phase 4)
- [[Tracker/D281]] — Owner name (CLOSE_PERSON) editable ✅ DONE (Phase 4)
- [[Tracker/D282]] — Business name change → auto-patch prompt ✅ DONE (Phase 4)
- [[Tracker/D283]] — All prompt variables visible + editable ✅ backend (D283a/c done, D283b UI deferred)
- [[Tracker/D300]] — Service catalog knowledge reseed ✅ DONE (Phase 5)
- [[Tracker/D286]] — Dashboard + onboarding UI alignment 🔴 (deferred to UI wave)
- [[Tracker/D280]] — UI-driven prompt composition (end state) 🔴
- [[Tracker/D278]] — "Agent Brain" dashboard 🔴
- [[Tracker/D279]] — Niche-contextual knowledge editing

### Phase 1 Findings (carry forward)
- 19 slots (not 18) — OBJECTION_HANDLING discovered as 19th
- Current prompts 17-20K chars — Phase 3 target < 8K
- Sonar caution: shorter ≠ always better — golden tests are the safety net
- KNOWLEDGE_BASE marker wraps too far — fix in Phase 2
- Voicemail builder untouched (separate template)
- Char baselines: `CALLINGAGENTS/00-Inbox/Phase1-Char-Count-Baselines.md`
- Sonar research: `CALLINGAGENTS/00-Inbox/Research-Phase1-Prompt-Architecture.md`

## Open Tracker

### Phase 6 — North Star (Wave 1 DONE, Wave 2 IN PROGRESS)
**Wave 1 — Backend** — ALL DONE ✅:
1. [[Tracker/D302]] — ✅ Preserve niche intake fields
2. [[Tracker/D280]] — ✅ `recomposePrompt()`
3. [[Tracker/D303]] — ✅ Variable edit API
4. [[Tracker/D305]] — ✅ Dry-run/preview mode
5. [[Tracker/D276]] — ✅ Booking toggle regeneration

**Wave 2 — UI Design** (all must pass `/ui-ux-pro-max` before done):
- [[Tracker/D278]] — Overview page 5-tier layout ✅ DONE
- [[Tracker/D309]] — Knowledge page redesign ✅ DONE
- [[Tracker/D310]] — Knowledge Health Score ✅ DONE
- [[Tracker/D311]] — GBP provenance fix + Overview knowledge tile merge ✅ DONE (2026-04-01)
- [[Tracker/D312]] — Settings page bento grid layout ✅ DONE (2026-04-01)
- [[Tracker/D313]] — Telegram bot link click-through ✅ DONE (2026-04-01)
- [[Tracker/D283]] — PromptVariablesCard (D283b — read-only variable display)
- [[Tracker/D305]] — Diff preview UI (current vs proposed) — frontend
- [[Tracker/D288]] — Capability preview card
- [[Tracker/D290]] — "What Your Agent Knows" surface
- [[Tracker/D286]] — Dashboard settings reorganization (bento grid done, card content reorganization remaining)

Also Phase 6:
- [[Tracker/D276]] — Calendar/booking auto-updates call flow
- [[Tracker/D287]] — Niche-adaptive onboarding (chips, checkboxes)
- [[Tracker/D289]] — Services input UX (structured chips)
- [[Tracker/D301]] — 29 locked variables post-onboarding
- [[Tracker/D304]] — Old-client prompt migration (add section markers to 4 live clients)

### Onboarding UX Overhaul (2026-04-01 audit)
> Full audit: [[Product/Onboarding Audit 2026-04-01]]
- [[Tracker/D315]] — Niche badge on confirmed business card (HIGH)
- [[Tracker/D316]] — Voice preview cards are fake controls (HIGH)
- [[Tracker/D317]] — Placeholder examples hardcoded to auto_glass (HIGH)
- [[Tracker/D318]] — Step 3 bloat — trim to mode selection only (CRITICAL)
- [[Tracker/D319]] — Simplify voice picker to Male/Female first (MEDIUM)
- [[Tracker/D320]] — urgencyWords not stored independently (MEDIUM)
- [[Tracker/D321]] — Step 3 and Step 5 duplicate FAQ collection (HIGH)
- [[Tracker/D322]] — Loading orb during GBP lookup (MEDIUM)
- [[Tracker/D323]] — **Radical onboarding simplification — 3-step flow** (CRITICAL)
- [[Tracker/D324]] — **Plan = Mode — eliminate separate mode selection** (CRITICAL)
- [[Tracker/D325]] — Onboarding visual redesign (HIGH)
- Decision: [[Decisions/Plan-Equals-Mode]]

### Phase 7 — "2-Minute Agent" (after Phase 6)
> Onboarding leverages the compose pipeline. Sonar-validated 2026-04-01.
> **Audit + plan:** [[Architecture/Phase7-Onboarding-Audit]]
> **Target:** 3 steps (Find Business → Meet Agent → Account + Go Live)

**Bugs to fix first:**
- [[Tracker/D315]] — Fix hardcoded auto_glass FAQ examples (BUG — all niches see windshield text)
- [[Tracker/D316]] — Fix hardcoded auto_glass caller reason examples (BUG — same)
- [[Tracker/D317]] — Verify personality preset round-trip (onboarding → DB → prompt → dashboard)

**Core Phase 7:**
- [[Tracker/D291]] — GBP auto-import via Google Places API (NOT Apify — no credits). Auto-detect niche from categories.
- [[Tracker/D293]] — Paste URL → agent ready (alt path to GBP)
- [[Tracker/D292]] — Guided call forwarding wizard (post-activation, on dashboard)
- D318 — Simplify voice selection: male/female toggle + "More voices" expand
- D319 — Remove personality preset from onboarding (use niche default)
- D320 — Remove FAQ/services/caller-reasons/urgency/pricing from onboarding (defer to dashboard)
- D321 — Collapse onboarding to 3 steps
- D322 — Niche badge on confirmed business card
- D323 — Orb loading state for GBP lookup + provision steps

**Deferred (still valid):**
- [[Tracker/D273]] — Pre-populate from best source
- [[Tracker/D255]] — Guided context data entry
- [[Tracker/D294]] — Post-activation summary
- [[Tracker/D242]] — Haiku intent inference for niche='other'
- [[Tracker/D185]] — Mode-first onboarding
- [[Tracker/D304]] — Old-client prompt migration

### Phase 8 — Dashboard Polish + Post-Call ROI (parallel with Ph7)
> Independent features. Can interleave with Phase 7.
- [[Tracker/D230]] — Activation smoke test (CRITICAL)
- [[Tracker/D219]] — Missed call auto-SMS
- [[Tracker/D220]] — Lead queue / callback tracking
- [[Tracker/D229]] — "Call back now" button
- [[Tracker/D189]] — Unify trial/paid dashboard
- [[Tracker/D190]] — Feature unlock CTAs
- [[Tracker/D213]] — Per-section prompt editor (full)
- [[Tracker/D186]] — Mode capability preview
- [[Tracker/D218]] — Minutes usage warning
- [[Tracker/D261]]-[[Tracker/D264]] — Dashboard UX batch

### Phase 9 — Agent Intelligence (needs call data)
> Close the learning loop. Needs real call volume from active clients.
- [[Tracker/D243]] — Intent coverage view
- [[Tracker/D244]] — Knowledge gap → triage improvement
- [[Tracker/D279]] — Niche-contextual knowledge editing
- [[Tracker/D284]] — Self-improving agent loop
- [[Tracker/D297]] — Agent learning loop UX

### Phase 10 — Platform Moat (10+ clients per niche)
- [[Tracker/D298]] — AI Compiler as universal refinery
- [[Tracker/D299]] — Collective niche intelligence
- [[Tracker/D295]] — Multi-source knowledge ingestion
- [[Tracker/D206]] — Live quote lookup (Windshield Hub)

### Completed (26 items)
Phase 1-3: D235 D285 D274 D265 D268 D269 D272 D296 — all ✅
Phase 4: D260 D281 D282 — all ✅
Phase 5: D283 (backend) D300 D302 — all ✅
Phase 6 Wave 1: D280 D303 D305 D276 — all ✅
Phase 6 Wave 2: D278 D309 D310 D311 D312 D313 — all ✅
Root Fix wave: D233 D241 D245 D247 D249 D251 D252 D254 D257 D275 — all ✅
Removed: ~~D240~~ · ~~D277~~ · ~~D228~~

## Decisions Log
- [[Decisions/Tier Differentiation — Quality Floor Not Ceiling]] — every agent gets full conversation quality; tiers = minutes + features, NOT quality
- [[Decisions/n8n Retirement]] — why n8n was retired Mar 2026
- [[Decisions/Agents API vs createCall]] — toolOverrides pattern, initialState rejected
- [[Decisions/clients.tools as Runtime Source]] — why agent stored tools are overridden every call
- [[Decisions/Voice Personality Lock]] — never change voice/tone without explicit ask
- [[Decisions/User Designs Prompt]] — core principle: user's data is authoritative, prompt is derived
- [[Decisions/Prompt Sandwich Ownership Model]] — bread (us) vs filling (them), 3 onboarding tiers, variable priority

## System Map
```
Caller → Twilio PSTN → /api/webhook/[slug]/inbound
         → buildAgentContext() + clients.tools
         → callViaAgent() [Agents API]
              → Ultravox stream ↔ Agent (system_prompt + tools)
                   → Tool calls → /api/webhook/[slug]/{transfer,sms,booking,knowledge}
         → POST-CALL: /api/webhook/[slug]/completed
              → AI classification (HOT/WARM/COLD/JUNK) → Telegram alert → billing
         → Stripe webhook → plan change → syncClientTools() → tool resync

Demo:
Visitor → /api/demo/start → createDemoCall() → WebRTC browser ↔ Zara (unmissed-demo)
```

---

## Live Queries (Dataview)

### Open Tracker Items
```dataview
TABLE priority, status
FROM "Tracker"
WHERE status != "done" AND status != "removed"
SORT priority DESC
```

### Active Clients
```dataview
TABLE ultravox_agent_id, plan, status
FROM "Clients"
WHERE type = "client"
SORT file.name ASC
```

### Recent Decisions
```dataview
TABLE date, status
FROM "Decisions"
SORT date DESC
```