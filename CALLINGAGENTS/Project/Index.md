---
type: moc
tags: [index, project]
updated: 2026-04-29
cleaned: 2026-04-01
last-tracker-cleanup: 2026-04-01
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Latest Session (2026-04-30 PM — D448 mutation contract resolved + audit-script bug surfaced)
- **D448 RESOLVED** — mutation contract `clients.tools` runtime-authority claim is CORRECT. Two parallel sub-agent dispatches (code-reading + empirical Supabase diff) confirmed: H1 (synthesized at call site) FALSE, H2 (`removeAll: true` doesn't strip) FALSE, H3 (stale clients.tools) refuted on stated symptom. The "universal hangUp gap on all 5 clients" was a D442 audit script extractor bug — script scanned only `modelToolName` and missed built-in tools using `toolName` key. `hangUp` IS in `clients.tools` for `windshield-hub` (zero drift) and `hasan-sharif` (only `pageOwner` missing). Other 3 clients pending re-verification with corrected scan.
- **Recurring bug pattern surfaced** — [[Tracker/D444]] closed this exact bug class as "false-alarm" but the fix was never applied; D442 re-bit. Concept: [[concepts/unmissed/unmissed-tool-extractor-bug]]. Durable rule: never close as "false alarm" if the underlying script still has the bug — leave open with `status: known-fix-deferred`.
- **`syncClientTools()` is pure DB write** — no `updateAgent()` call, no Ultravox API call, no prompt rebuild ([src/lib/sync-client-tools.ts:1-53](../../src/lib/sync-client-tools.ts) header explicit). Standing no-redeploy rule does NOT apply to standalone calls. The D448 spec was wrong about this — claimed it rebuilds the prompt.
- **No code changed this session.** Vault-only updates.
  - [[Tracker/D448]] resolved with full findings
  - [[Tracker/D449]] new spec — per-field "Saved, but not live yet" warning chip
  - [[Tracker/D450]] new spec — `twilio_number` → `needsAgentSync` one-liner
  - [[00-Inbox/NEXT-CHAT-D442-Followup]] rev 3 with corrected priorities
  - Master vault: [[2026-04-30-d448-mutation-contract-resolved]] session log + [[concepts/unmissed/unmissed-tool-extractor-bug]] durable concept + index 107→108 + memory.md appended
- **D447 (runtime-truth Overview chip) recommendation: defer indefinitely.** With the universal symptom refuted, D443 (shipped) + D449 + D450 close the addressable trust gap. D447's exclusive value (`partial_failure` + novel-drift detection) is latent.
- **Architectural risk surfaced (D452 candidate):** any new tool added to `buildAgentTools()` produces latent universal drift across all clients without a recent `needsAgentSync` PATCH. Mitigation needed — either PR discipline (one-shot migration script per tool addition) or weekly cron sweep on `last_synced_at < 30 days`.
- **Next:**
  - File D451 (audit script extractor fix — verify [[Tracker/D446]] doesn't already cover it)
  - Re-verify `exp-realty` + `urban-vibe` + `calgary-property-leasing` with corrected scan
  - Targeted `syncClientTools()` add for `hasan-sharif` (pure DB, safe) — and others if step 2 finds drift
  - Velly test + send still pending from earlier session

## Previous Session (2026-04-29 PM — Voicemail removal SOP + Admin Redesign Wave B SHIPPED)
- **PR [#56](https://github.com/tubby124/unmissed-ai/pull/56)** squash-merged → `main` (commit `c0a781b`). Railway deployment `13333cb7` SUCCESS.
  - Carrier voicemail must be FULLY REMOVED before conditional CF works. Validated 2026-04-29 on Hasan's Rogers Business 403-808-9705 line. Voicemail and `*61/*67/*62` share the same GSM supplementary service slot — voicemail wins, forward never fires.
  - Go Live page: collapsible amber "Test went to voicemail instead?" disclosure with Rogers/Bell/Telus/Fido/SaskTel numbers + script
  - Brian welcome email (HTML+TXT): voicemail-removal callout under Step 1
  - Velly welcome email (HTML+TXT): created from Brian's pattern (DID `**004*13069887699#`, $29/mo, Kausar). `VELLY_TOKEN_PLACEHOLDER` to swap before send.
  - Concierge Onboarding SOP Step 6 split into 6a (mandatory voicemail removal) → 6b (forwarding codes) → 6c (verify)
  - ADR: [[Decisions/2026-04-29-voicemail-removal-required-for-cf]]
- **PR [#57](https://github.com/tubby124/unmissed-ai/pull/57)** squash-merged → `main` (commit `42265f7`). Initial deploy `d99c85e4` FAILED on TS error (squash dropped `isAdmin` from `GoLiveView` destructure even though Props declared it and JSX used it).
  - Admin Redesign Phase 0.5 → 3 Wave B: feature flag, audit log table, `useClientScope()` hook, `<ClientSwitcher>` pill, Command Center moved to `/dashboard/admin`, `admin-scope-helpers.ts` + 25 routes guarded for cross-client writes
  - Behind `ADMIN_REDESIGN_ENABLED=false` → zero user impact at merge time
- **PR [#58](https://github.com/tubby124/unmissed-ai/pull/58)** hotfix squash-merged → `main` (commit `b421c4d`). Railway deployment `1865f782` SUCCESS.
  - One-line forward-fix: add `isAdmin` to `GoLiveView({ client, isAdmin }: Props)` destructure
  - All three commits ([`c0a781b`, `42265f7`, `b421c4d`]) now LIVE in production
- **Next:**
  - Velly: swap `VELLY_TOKEN_PLACEHOLDER` and send Kausar's welcome email (still unblocked from earlier session)
  - D437 concierge provisioning gate (P0 study) — 6-gate state derivation per client, free-50-min vs card-required pricing decision
  - When ready: flip `ADMIN_REDESIGN_ENABLED=true` in Railway env to activate Wave B for users
- Decisions: [[Decisions/2026-04-29-voicemail-removal-required-for-cf]]
- Memory: `~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md`

## Previous Session (2026-04-29 AM — Learning Bank platform + Zara rewrite SHIPPED)
- **PR [#55](https://github.com/tubby124/unmissed-ai/pull/55)** squash-merged to `main` (commit `eb7c42e`). Railway auto-deployed.
- **D440 Learning Bank LIVE** — 4 migrations applied to `qwhvblomlgeapzhnuwlb` via `supabase db push` (also caught up the queued `admin_audit_log` migration). New tables: `prompt_patterns` (24 rows seeded), `prompt_lessons` (will populate as new calls land), `pattern_application_log`, `call_transcripts` (93 rows backfilled). View `v_active_patterns_by_niche` live. `/completed` webhook auto-generates lessons from `call_insights` thresholds. Admin UI at `/dashboard/admin/learning-bank`. Gated pattern injection in `slot-regenerator.ts` behind `LEARNING_BANK_INJECT=true` (default OFF — flip per-niche after manual validation). Backfill `scripts/backfill-transcripts.ts` working (slug join fixed, type fix on `CallLogRow`). `/learn` skill registered.
- **D441 Zara rewrite LIVE** — v13 deployed to Supabase + Ultravox (revision `d5325717-a53a-4bd7-9aa7-8a636f36df24`). 11,991 → 10,708 chars; 14 NEVER rules → 5; cut EMERGENCY/RETURNING/<25w-rule/casual-forcing-function; ported capability-triage (windshield-hub) + energy-match + confirm-back (urban-vibe) + skip-step (hasan-sharif). Identity drift fixed: `clients.agent_name` Aria → Zara.
- **Pre-existing migration drift fixed** — `20260428210000_create_telegram_pending_actions.sql` and `20260428300000_create_admin_audit_log.sql` both now in sync remote↔local.
- **Next:** test call to Zara to verify warmer voice; review first auto-generated `prompt_lessons` after a few new production calls land; flip `LEARNING_BANK_INJECT=true` for one niche when ready to validate pattern injection.
- Decisions: [[Decisions/2026-04-29-Learning-Bank]] · [[Decisions/2026-04-29-Zara-Rewrite]]
- Feature: [[Features/Learning-Bank]]
- Tracker: [[Tracker/D440]] · [[Tracker/D441]]

## Previous Session (2026-04-28 PM — Telegram Tier 1 + 2 LIVE, Tier 3 READY)
- **Tier 1** PR #41 squash-merged sha `03ad11c0`. Migration `telegram_updates_seen` applied. `/help` `/calls` `/today` `/missed` `/lastcall` `/minutes` live across registered clients.
- **Tier 2** PR #47 squash-merged sha `74f1ac4`. Migration `telegram_assistant_log` applied. `OPENROUTER_API_KEY` set in Railway. Bot menu + persistent inline keyboard + `callback_query` re-dispatch + Haiku 4.5 NL Q&A + citation guard + keyword shortcuts + PII-free cost telemetry. 32+ tests green.
- **Tier 2 cleanup** — PR #48 (`const outcome` lint, sha `a0e409f`).
- **Tier 3 READY** — cold-start at [[00-Inbox/NEXT-CHAT-Telegram-Tier3]]. Scope: confirmable mutations (`cb:<id>`/`mk:<id>`/`cf:<uuid>`), DB-backed `telegram_pending_actions`, operator `/clients` `/health` `/spend` gated by slug='hasan-sharif', per-client spend cap, 1% reply-audit, group-chat `/start` guard. 9 commits planned. Followups + gaps: [[00-Inbox/Telegram-Tier3-Followups-2026-04-28]].
- **Bot renamed** 2026-04-28 evening: `@hassitant_1bot` → **`@AIReceptionist_bot`** via @BotFather. Token unchanged → zero disruption to registered clients. Railway env vars `TELEGRAM_BOT_USERNAME` + `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` set to `AIReceptionist_bot`; all 7 code fallbacks updated. Rename ops plan: [[00-Inbox/Telegram-Bot-Rename-Plan-2026-04-28]].
- Decisions: [[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]] · [[Decisions/2026-04-28-Telegram-Tier2-NL-Assistant]] · [[Decisions/2026-04-28-Telegram-Tier3-Mutation-Surface]]
- Feature note: [[Features/Telegram-Two-Way-Assistant]]
- Audit doc: [[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]
- **Next:** Open a fresh chat, paste the Tier 3 cold-start block, ship Tier 3.

## Previous Session (2026-04-28 — Realtor onboarding polish + universal recording consent)
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
| [[Tracker/D442]] | Overview drift audit + fix — Phase 1 ✅ 2026-04-30; Fixes 1/1.5/2/3/4 next | CRITICAL |
| [[Tracker/D443]] | Fix 1.5: Registry-readonly enforcement (universal Greeting fake-control) — in-progress | HIGH |
| [[Tracker/D444]] | Investigate `clients.tools.hangUp` Section 7 contract violation — in-progress | HIGH |
| [[Tracker/D445]] | Snowflake migration deep plan (replaces D442 Fix 5; supersedes D304) — owner-gated | MEDIUM |
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
