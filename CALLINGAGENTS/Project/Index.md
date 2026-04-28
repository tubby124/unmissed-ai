---
type: moc
tags: [index, project]
updated: 2026-04-28
cleaned: 2026-04-01
last-tracker-cleanup: 2026-04-01
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Latest Session (2026-04-28 — Realtor onboarding polish + universal recording consent)
- 6 waves shipped in one session, build green (`npm run build` 6.2s)
- **Wave 1** — UI/copy fixes: "WebRTC" → "Web Browser Call" everywhere, inline "Save snippet" on call detail (call_snippet source), trial-clarity caption + forwarding note above chip grid, AgentIdentityCardCompact gets `isTrial` + `hasForwarding` props
- **Wave 1.5** — Universal recording consent (legal protection): migration `20260428010953_add_recording_consent.sql` + onboarding checkbox + grandfathered backfill modal + voicemail pipeline mirror + outbound `/api/dashboard/leads/dial-out` 403 gate. Auto-enables `RECORDING_DISCLOSURE` for new clients only — 4 grandfathered clients keep prompts untouched. See [[Features/Recording-Consent]] + [[Tracker/S16a]]
- **Wave 2** — GBP modal shows extracted fields (name, hours, website, rating), Knowledge page reads `?source=` param + Website chip deep-links to filtered Browse view
- **Wave 3** — AI Receptionist 400 → 200 minutes across pricing.ts + plan-entitlements.ts + UpgradeModal + BillingTab. Existing subs grandfathered. ADR: [[Decisions/2026-04-28-ai-receptionist-200-minutes]]
- **Wave 5 (DOC ONLY)** — Outbound Realtor ISA + Market RAG fully spec'd at [[Features/Outbound-Realtor-ISA-Market-RAG]] for future multi-month build
- **Deferred to next session:** Wave 4 (realtor prompt rebuild + Buy/Sell/Eval/Rent intent branching), Wave 5 implementation
- Manual ops pending (next session A1-A6): apply migration to prod Supabase `qwhvblomlgeapzhnuwlb`, update Stripe `prod_UCl8nni05Nk9lB` description, sweep marketing pages for "400 min" copy, smoke-test backfill modal on grandfathered clients
- Plan file: `/Users/owner/.claude/plans/yeah-okay-sounds-good-mellow-mountain.md`
- Handoff doc: [[Tracker/Session-2026-04-28-Realtor-Polish]]

## Previous Session (2026-04-24 — Wave 2 Chat A — Overview Surface)
- Branch `ship/wave2-overview-surface` shipped — 8 narrow commits, build green (1683/1683 tests, tsc clean, next build OK)
- **Closed:** D308 (label kept), D266 (shared `useCallLog` + `CallRow` reuse), D290 (`AgentKnowsCard`), D288 (Capabilities reframe), D341 (`AgentRoutesOnCard`), D306 (empty-state sweep)
- **Deleted:** `AgentKnowledgeTile`, `KnowledgeInlineTile`, `KnowledgeSourcesTile`, `TrialActiveSection` (orphans after rewire) + dead Recent-Calls inline block in `UnifiedHomeSection`
- **Deferred:** D286 (Settings reorg) → Wave 2 Chat B, separate PR
- Handoff doc: [[Tracker/Wave2-Chat-A-Handoff]]

## Previous Session (2026-04-01 — Tracker Cleanup)
- **53 DONE items archived** → [[Tracker/Archive-Done]]
- **5 removed/superseded items** cleaned out
- **5 duplicate clusters merged** (D283b→D341, D264→D346, D270→D359, D322→D345, D284→D297)
- **~45 open items** organized by priority below
- Previous: Call-Me card relocation, Banner 3-layer, Phase 7 testing, CRM Phase 0-2

## Active Clients
- [[Clients/hasan-sharif]] — Hasan Sharif · Aisha · `f19b4ad7`
- [[Clients/exp-realty]] — Omar Sharif · Fatema · `c9019927`
- [[Clients/windshield-hub]] — Mark · Blake · `00652ba8`
- [[Clients/urban-vibe]] — Alisha · Ashley · `5f88f03b`
- [[Clients/manzil-isa]] — Fatima · Nour · TEST MODE
- [[Clients/plumber-calgary-nw]] — Test client · Dave · `d863d0c5` · plumbing niche
- [[Clients/calgary-property-leasing]] — Brian · Eric · `a30e9023` (demo / property_management)
- [[Clients/velly-remodeling]] — **Kausar Imam · Eric** · TBD (provisioning 2026-04-28; renovation/`other`; **first client with transferCall enabled**) — see [[Decisions/Manual-Concierge-Velly-2026-04-28]]

---

## What's Left — Organized by Theme

### NOW: Ship-Blocking Bugs & Gaps (fix before next client)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D340]] | Menu/knowledge upload → pgvector → agent answers | CRITICAL |
| [[Tracker/D350]] | Knowledge source drawers don't expand (click = nothing) | HIGH |
| [[Tracker/D353]] | WebRTC test calls not logged — no call history | HIGH |
| [[Tracker/D363]] | ShareNumberCard lost copy-to-clipboard in redesign | HIGH |
| [[Tracker/D317]] | Verify personality preset round-trip | MEDIUM |
| [[Tracker/D360]] | Raise prompt char limit to 25K | MEDIUM |

### NEXT: Onboarding Excellence (Phase 7 remaining)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D291]] | GBP auto-import (2-minute agent flagship) | CRITICAL |
| [[Tracker/D273]] | Pre-populate from best source (GBP/scrape/manual) | HIGH |
| [[Tracker/D293]] | Paste URL → agent ready (streamlined flow) | HIGH |
| [[Tracker/D292]] | Guided call forwarding wizard (#1 friction point) | HIGH |
| [[Tracker/D294]] | Post-onboarding "Your Agent Is Live" summary | HIGH |
| [[Tracker/D255]] | Guided context data entry (when no website) | HIGH |
| [[Tracker/D325]] | Onboarding visual redesign (through /ui-ux-pro-max) | HIGH |
| [[Tracker/D242]] | Haiku niche inference for niche='other' | MEDIUM |
| [[Tracker/D345]] | Intelligence seed loading indicator (subsumes D322) | MEDIUM |
| [[Tracker/D357]] | Greeting confidence for new onboardings | HIGH |
| [[Tracker/D185]] | Mode-first onboarding (skip irrelevant steps) | MEDIUM |

### NEXT: Dashboard UX Polish (Phase 6 Wave 2 remaining + Phase 8)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D341]] | PromptVariablesCard — surface variables in dashboard (was D283b+D358) | HIGH |
| [[Tracker/D346]] | Knowledge upload CTA on Overview (absorbs D264) | HIGH |
| [[Tracker/D355]] | Quick-view modal for knowledge sources on Overview | HIGH |
| [[Tracker/D306]] | Empty states for every card | HIGH |
| [[Tracker/D307]] | Recompose warning UX (diff + confirm modal) | HIGH |
| [[Tracker/D308]] | Tab naming decision (Overview vs Agent Brain) | HIGH |
| [[Tracker/D286]] | Dashboard + onboarding UI alignment | HIGH |
| [[Tracker/D288]] | Capability preview ("your agent can do X right now") | HIGH |
| [[Tracker/D290]] | "What Your Agent Knows" unified surface | HIGH |
| [[Tracker/D213]] | Per-section prompt editor UI (full multi-section) | HIGH |
| [[Tracker/D189]] | Unify trial/paid dashboard (locked = preview, not blank) | HIGH |
| [[Tracker/D190]] | Feature unlock CTAs (click → modal → upgrade/configure) | HIGH |
| [[Tracker/D349]] | Orb as global loading indicator everywhere | MEDIUM |
| [[Tracker/D361]] | Call-me card: no "call again" after success | LOW |
| [[Tracker/D362]] | Call-me card: remember phone number | LOW |
| [[Tracker/D364]] | color-mix() CSS browser compat | LOW |
| [[Tracker/D365]] | ClientHome parent banners still full-width | MEDIUM |
| [[Tracker/D366]] | Call-me card mobile layout cramped | MEDIUM |
| [[Tracker/D367]] | Dead component cleanup (ShareNumberCard, SoftTestGateCard) | LOW |

### LATER: Post-Call ROI & Leads (Phase 8)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D219]] | Missed call auto-SMS | HIGH |
| [[Tracker/D220]] | Lead queue / callback tracking view | HIGH |
| [[Tracker/D229]] | "Call back now" button on call rows | HIGH |
| [[Tracker/D206]] | Live quote lookup (Windshield Hub) | HIGH |
| [[Tracker/D186]] | Mode capability preview in dashboard | HIGH |
| [[Tracker/D356]] | Telegram notification preview on Overview | MEDIUM |

### LATER: Agent Intelligence Loop (Phase 9)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D243]] | TRIAGE section rewrite: intent-first routing | CRITICAL |
| [[Tracker/D244]] | Intent coverage UI in call analytics | MEDIUM |
| [[Tracker/D297]] | Agent learning loop UX (absorbs D284 vision) | HIGH |
| [[Tracker/D359]] | Smart KB→Prompt promotion (absorbs D270) | HIGH |
| [[Tracker/D279]] | Niche-contextual knowledge editing | HIGH |

### LATER: Platform Moat (Phase 10)
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D298]] | AI Compiler as universal knowledge refinery | CRITICAL |
| [[Tracker/D299]] | Collective niche intelligence | HIGH |
| [[Tracker/D295]] | Multi-source knowledge ingestion | HIGH |

### DEFERRED: Architecture & Migration
| # | Title | Priority |
|---|-------|----------|
| [[Tracker/D304]] | Old-client prompt migration (add markers to 4 live clients) | MEDIUM |
| [[Tracker/D301]] | 29 prompt variables locked post-onboarding | HIGH |
| [[Tracker/D287]] | Niche-adaptive onboarding (chips, checkboxes) | CRITICAL |
| [[Tracker/D289]] | Services input UX (structured chips, not text) | HIGH |
| [[Tracker/forwarding-verify-twilio]] | Verify-call infra on disk, UI dropped 2026-04-27 | MEDIUM |
| [[Tracker/after-hours-emergency-forward]] | Runtime routing unverified — Go Live UI deferred | LOW |
| [[Tracker/D344]] | Niche promptfoo test registry | MEDIUM |
| [[Tracker/D283]] | Variable visibility (D283b remaining = D341) | PARTIAL |

---

## Completed Work (reference)
- **53 done + 5 removed** → [[Tracker/Archive-Done]]
- Phase 1-6 architecture: ALL DONE
- Phase 7 onboarding simplification: 3-step flow SHIPPED
- Phase 7 CRM contacts: Phase 0-2 DONE (D334-D338)
- Phase 6 Wave 2 dashboard: Overview + Knowledge + Settings layouts DONE

---

## Operations
- [[Operations/Second Brain Sync]] — vault → GitHub → VPS auto-sync (LaunchAgent, cron) — **push blocked by ProtonVPN as of 2026-04-07**
- [[Operations/Cron Jobs]] — scheduled jobs
- [[Operations/Deployment]] — Railway deploy process

## System Map
- [[Architecture/Control-Plane Mutation Contract]] — how every field flows UI → DB → agent
- [[Architecture/Per-Call Context Contract]] — what gets injected per call vs stored
- [[Architecture/Call-Path Capability Matrix]] — which features work on which call path
- [[Architecture/Webhook Security and Idempotency]] — every webhook route audited
- [[Architecture/Phase7-75-Second-Agent]] — 75-second agent execution plan

## Features
- [[Features/Plan Tiers and Gating]] — Lite/Core/Pro entitlements matrix
- [[Features/Booking]] — calendar OAuth, tools, gating
- [[Features/Knowledge System]] — pgvector RAG, AI Compiler, seeding paths
- [[Features/SMS]] — sms_logs, opt-out, sendSmsTracked()
- [[Features/Transfer]] — HTTP transferCall → Twilio redirect → recovery
- [[Features/IVR]] — ivr_enabled, ivr_prompt, digit routing
- [[Features/Recording-Consent]] — universal acknowledgment + RECORDING_DISCLOSURE auto-enable + outbound gate (shipped 2026-04-28)
- [[Features/Outbound-Realtor-ISA-Market-RAG]] — future-roadmap spec for outbound dialer + per-realtor MLS RAG

## Decisions
- [[Decisions/Prompt Sandwich Ownership Model]]
- [[Decisions/Overview-5-Tier-Layout]]
- [[Decisions/2026-04-26-overview-2col-quickadd-beside-orb]] — Hero 3-col → 2-col, Quick Add beside orb
- [[Decisions/2026-04-27-ai-receptionist-119-standard-plan]]
- [[Decisions/2026-04-28-ai-receptionist-200-minutes]] — 400 → 200 min, grandfathered (2026-04-28)
- [[Decisions/Dashboard-Tab-Naming]]
- [[Decisions/Plan-Equals-Mode]]
