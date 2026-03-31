---
type: moc
tags: [index, project]
updated: 2026-03-31
cleaned: 2026-03-31
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Active Clients
- [[Clients/hasan-sharif]] — Hasan Sharif · Aisha · `f19b4ad7`
- [[Clients/exp-realty]] — Omar Sharif · Fatema · `c9019927`
- [[Clients/windshield-hub]] — Mark · Blake · `00652ba8`
- [[Clients/urban-vibe]] — Alisha · Ashley · `5f88f03b`
- [[Clients/manzil-isa]] — Fatima · Nour · TEST MODE
- [[Clients/plumber-calgary-nw]] — Test client · Dave · `d863d0c5` · plumbing niche

## Architecture Contracts (read-first gates)
- [[Architecture/Control Plane Mutation]] — how every settings field flows DB → Ultravox
- [[Architecture/Per-Call Context]] — what gets injected at call time vs stored in prompt
- [[Architecture/Call Path Matrix]] — capabilities per call type (PSTN / WebRTC / Demo)
- [[Architecture/Webhook Chain]] — inbound → completed → Telegram → billing full flow
- [[Architecture/Billing and Stripe]] — subscription tiers, tool gating, minute enforcement
- [[Architecture/Mode Architecture]] — call_handling_mode, D180 bug, PRIMARY GOAL fix
- [[Architecture/Prompt Generation]] — buildPromptFromIntake(), template structure, deploy paths
- [[Architecture/Prompt Sandwich Spec]] — 19 named slots, char budgets, section order (Phase 1 output)
- [[Architecture/Prompt Slots]] — Phase 2→4: 19 slot functions LIVE. Phase 3: pgvector-first KB, conditional pricing, D296 fix. Phase 4: service catalog sync (D260), owner_name patcher (D281), business_name contract fix (D282), FILTER_EXTRA+3 bug fix. 448 tests pass.

## Features
- [[Features/Booking]] — calendar auth, patchCalendarBlock, plan gating
- [[Features/SMS]] — sms_enabled, twilio_number, sendTextMessage tool
- [[Features/Transfer]] — forwarding_number, transferCall HTTP tool
- [[Features/IVR]] — ivr_enabled, ivr_prompt, Gather TwiML
- [[Features/Knowledge RAG]] — pgvector, knowledge_chunks, queryKnowledge tool
- [[Features/AI Compiler]] — compile/apply, trust tiers, BLOCKED_KINDS
- [[Features/Voicemail]] — buildVoicemailTwiml, recording upload, Telegram alert
- [[Features/Notifications]] — Telegram + email alerts, notification_logs

## Product & Dashboard
- [[Dashboard/Dashboard Architecture]] — all pages, home gaps, calls, knowledge, trial/paid split
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
| 5 — Agent Knowledge UX | NOT STARTED | Variable registry, section regen (D283a/b/c), D286, D288, D290, D300 |
| 6 — North Star | NOT STARTED | Full recomposePrompt(), Agent Brain, no raw editor |

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
- [[Tracker/D283]] — All prompt variables visible + editable 🔴 (split: D283a/b/c)
- [[Tracker/D286]] — Dashboard + onboarding UI alignment 🔴
- [[Tracker/D300]] — Service catalog knowledge reseed (NEW — extends D260) 🔴
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

## Open Tracker (priority order)

### 🔴 Root Fix — Agent Quality
- [[Tracker/D260]] — ✅ Service catalog → agent sync DONE (Phase 4). Gap: KB reseed → D300
- [[Tracker/D300]] — Service catalog knowledge reseed (pgvector gap from D260) 🔴
- [[Tracker/D265]] — Remove hardcoded PRODUCT KNOWLEDGE BASE from prompt-builder 🔴
- [[Tracker/D243]] — Intent coverage view (replace badges with readiness gaps)
- [[Tracker/D242]] — Onboarding "top 3 reasons" question
- [[Tracker/D244]] — Knowledge gap → triage improvement pipeline

### Recently Completed (2026-03-31)
- [[Tracker/D235]] — ✅ Knowledge reseed gate removal (already fixed in SCRAPE7)
- [[Tracker/D285]] — ✅ Prompt sandwich framework spec (19 slots)
- [[Tracker/D246]] — ✅ Haiku context data extractor
- [[Tracker/D247]] — ✅ 6 onboarding questions → Haiku → TRIAGE_DEEP
- [[Tracker/D248]] — ✅ Telegram HOT/WARM/INFO action cards
- [[Tracker/D249]] — ✅ Agent readiness gate (6 dimensions)
- [[Tracker/D250]] — ✅ ROI card
- [[Tracker/D251]] — ✅ Per-section prompt editor
- [[Tracker/D252]] — ✅ Knowledge gap → one-click fix CTA
- [[Tracker/D253]] — ✅ Working patterns extracted from 4 live agents
- [[Tracker/D254]] — ✅ CallRoutingCard
- [[Tracker/D257]] — ✅ AI-Assisted Prompt Suggestions Feed
- [[Tracker/D258]] — ✅ Urgency signals onboarding field
- [[Tracker/D259]] — ✅ Price range onboarding field
- [[Tracker/D275]] — ✅ Voice preset personality fix

### Investigations
- ~~[[Tracker/D277]]~~ — Lag root cause (plumber-calgary-nw) — REMOVED: architecture fix solves it
- [[Tracker/D276]] — Calendar/booking auto-updates call flow
- [[Tracker/D284]] — Self-improving agent loop (architectural)
- [[Tracker/D233]] — CRON_SECRET verify in Railway ⚠️ ops

### Dashboard UX
- [[Tracker/D189]] — Unify trial/paid dashboard
- [[Tracker/D219]] — Missed call auto-SMS
- [[Tracker/D220]] — Lead queue / callback tracking
- [[Tracker/D229]] — "Call back now" button

## Decisions Log
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

### Post-Phase 6 — Product Excellence
- [[Tracker/D291]] — GBP auto-import onboarding (CRITICAL)
- [[Tracker/D292]] — Guided call forwarding wizard (HIGH)
- [[Tracker/D293]] — "Paste URL → agent ready" streamlined flow (HIGH)
- [[Tracker/D294]] — Post-activation "Your Agent Is Live" summary (HIGH)
- [[Tracker/D295]] — Audio preview of knowledge in action (MEDIUM)
- [[Tracker/D296]] — Agent health score dashboard (HIGH)
- [[Tracker/D297]] — Learning loop UX (MEDIUM)
- [[Tracker/D298]] — AI Compiler as universal knowledge gateway (MEDIUM)
- [[Tracker/D299]] — Collective niche intelligence (MEDIUM)

---

## Live Queries (Dataview)

### Open Tracker Items
```dataview
TABLE priority, affects-clients
FROM "Tracker"
WHERE status = "open"
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