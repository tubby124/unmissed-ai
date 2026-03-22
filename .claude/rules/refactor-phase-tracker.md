# Refactor Phase Tracker (Active)

> Full history of completed phases: `docs/refactor-completed-phases.md`
> Master operator prompt: `docs/unmissed-master-operator-prompt.md`

## Cross-Phase Gates (apply to EVERY phase)

- **Sonar Pro Fact-Check:** Run 2-3 Perplexity Sonar Pro queries (via `$OPENROUTER_API_KEY`) before and after implementation. Phase output must include "Fact-check queries run" section.
- **Research-First Rule:** If a research doc exists for the item (see Research Index below), READ IT FIRST. If NO research exists, run Sonar Pro BEFORE writing code. Never fabricate technical decisions.
- **Conflicting Research:** Flag conflicts to the user before proceeding. Do not silently pick one.

---

## Research & Plans Index

**S12 Phase 3c (Tour + Trial):** `docs/s12-audit/S12-PHASE3C-IMPLEMENTATION-PLAN.md` (master plan)
- TOUR1 library: DECIDED driver.js. Decision: `docs/s12-audit/s12-tour-library-decision.md`
- TRIAL1 WebRTC: `docs/s12-audit/s12-trial1-competitor-webrtc-research.md` + `memory/ultravox-client-sdk-reference.md` + `memory/webrtc-component-architecture.md`
- TRIAL1 conversion: `docs/s12-audit/s12-trial-conversion-research.md`
- TOUR1 research: `docs/research-notes/s12-tour1-onboarding-library-research.md` + `s12-tour1-onboarding-tour-research.md`

**S12 Phase 3d (Scrape):** `docs/s12-audit/scrape-architecture-findings.md` | Plan: `~/.claude/plans/twinkly-wibbling-fountain.md`
- SCRAPE1-3: DONE. SCRAPE4-10: see archive.

**S12 Phase 3b (Prompt Tests):** NO RESEARCH yet.
**S15 (Domain Migration):** Scope analysis in archive. No external research needed.
**Other (S10, S11, S14, S16-S20):** NO RESEARCH yet. See archive for details.
**Phase 0:** `docs/research-notes/phase0-tooling-research.md` | `docs/refactor-baseline/PHASE-0D-TRUTH-MAP.md`

**Settings Cards (D11-D16 + SET-1 to SET-6):** `docs/settings-card-tracker.md` — dedicated tracker for settings card bugs found via Playwright testing. Architecture ref: `memory/settings-card-architecture.md`

**Sonar Pro Research (2026-03-22):**
- Realtime best practices: RLS > client-side filters, debounce rapid updates, cap array sizes, max 500 channels/connection
- Voice AI dashboard UX: sentiment deep metrics, frustration counters, weekly failure digests, live call observability emerging as standard
- Prompt management: surgical patching confirmed correct, multi-field patch ordering (identity→voice→operational), coherence drift detection after 5+ patches

---

## Completed Phases Summary

All phases below are DONE (2026-03-21/22). Sub-item details in `docs/refactor-completed-phases.md`.

| Phase | Name | Key Outcome |
|-------|------|-------------|
| 0 | Baseline & Truth Map | Snapshots, drift register (11 items), truth-tracer/drift-detector tools |
| S1 | Tool-Builder Unification | `buildAgentTools()` single source of truth, all 11 deploy paths fixed, VAD 0.3s |
| S2 | Notification Observability | `notification_logs` + enhanced `bookings` tables, `/review-call` integration |
| S3 | Webhook Decomposition | `completed-notifications.ts` extracted, idempotency guard, 555→279 lines |
| S4 | Self-Serve Regen + Deploy Audit | Owner regen, all 11 deploy paths audited, `buildAgentTools` everywhere |
| S5 | Knowledge Tool Truth | Knowledge gating (0 chunks = no tool), auto-sync on mutations |
| S6 | Settings Cleanup | `syncClientTools` shared util, audit columns, rate limiting, intake fallback |
| S7 | Onboarding Defaults | Activation tool sync, prompt version restore audit, 429 UX, `insertPromptVersion` shared util |
| S8 | Path Parity / Eval | 36 unit tests, canary eval harness, tool registration parity |
| S9 | Notification Reliability | Smart retry, preference guards, stuck-processing recovery, seconds guard |
| S9.5 | Missed Gaps | Transfer await, admin-alerts wiring, fetch timeouts, cron scheduling |
| S9.6 | Live Call Hardening | `persistCallStateToDb` async, call creation timeouts, stuck row remediation |
| S12 Ph1 | Revenue Unblock Bugs | BUG1-6, DATA1-5, CODE1-4, OPS1-8, V1-V18 partial (email FAIL) |
| S12 SCRAPE1-3 | Website Scrape | Preview UI, chunk seeding, pre-populated knowledge base |
| S13 | Security Hardening | Cron auth, rate limiting, RLS audit (26 tables), HMAC signing, demo budget |
| S13.5 | Call Quality | Agents API fix (`toolOverrides` format), transcript isolation, `priorCallId` removed |
| S18 partial | Guard Rails | Pre-push hooks (build+grep+.then baseline), cron parity tests, Supabase types generated |
| S19a | Webhook Liveness | `notification-health` cron monitors `billed_duration_seconds IS NULL` |
| S13-REC1 | Recording Privacy | Bucket private, `lib/recording-url.ts` signed URLs, legacy URL compat, policy cleanup |
| S16e | Prompt Injection Defense | Rules 14-16 generic + 12-14 real_estate + voicemail, `validatePrompt()` gate, deployed to all 5 live agents, 12 promptfoo adversarial tests |
| S14a-d | Voicemail Fallback | `buildVoicemailTwiml()`, recording callback, Telegram notify, branded fallback, settings UI |
| S10a-f | Dashboard Observability | Prompt version history, notifications tab, bookings (Calendar page), call detail context, failed notif badge |
| D1-D13 | GATE-4 Session Discoveries | 10 bugs/gaps found + 3 refactors. Dual-ID lookup, server filters, realtime subs, pagination, voice_style/injected_note fixes, AgentTab extraction |

---

## P0-LAUNCH-GATE (do before ANY new S12 features)

### GATE-1 -- Auth + Email Deliverability
| Item | Source | Status |
|------|--------|--------|
| S15-PRE1-7 | S15 | NOT STARTED -- domain purchase + DNS + external configs |
| S15-ENV1-4 | S15 | NOT STARTED -- Railway env var updates after domain |
| S15-CODE1-11 | S15 | NOT STARTED -- brand text + legal pages + SEO metadata |
| S12-V15 | S12 | NOT STARTED -- email deliverability E2E |
| S12-LOGIN1 | S12 | BLOCKED on S15-PRE3 |
| S12-V22 | S12 | NOT STARTED -- Supabase email template branding |

### GATE-2 -- Privacy + Compliance + Safety
| Item | Source | Status |
|------|--------|--------|
| S13-REC1 | S13 | **DONE** 2026-03-22 -- bucket private, signed URLs, legacy compat, overpermissive policy dropped |
| S13-REC2 | S13-REC1 | NOT STARTED -- backfill existing recording_url values from full public URLs to paths (one-time migration) |
| S16a | S16 | NOT STARTED -- call recording consent disclosure |
| S16e | S16 | **DONE** 2026-03-22 -- rules 14-16 in generic + 12-14 in real_estate + voicemail, validatePrompt() check |
| S16e-LIVE | S16e | **DONE** 2026-03-22 -- deployed to all 5 agents (hasan v56, windshield v23, urban-vibe v25, exp-realty v18, demo v7) |

### GATE-3 -- Outage Resilience (core only)
| Item | Source | Status |
|------|--------|--------|
| S14a | S14 | **DONE** 2026-03-22 -- `buildVoicemailTwiml()` in twilio.ts, replaces "technical difficulties" hangup in inbound catch block |
| S14b | S14 | **DONE** 2026-03-22 -- `/api/webhook/[slug]/voicemail` recording callback, downloads to Supabase storage, updates call_log |
| S14c | S14 | **DONE** 2026-03-22 -- Telegram notification to client + operator on voicemail capture |
| S14d | S14 | **DONE** 2026-03-22 -- fallback/route.ts upgraded to attempt voicemail (client lookup + branded greeting) |
| S14-UI | S14 | **DONE** 2026-03-22 -- Voicemail Greeting section in dashboard settings (custom text, audio URL support) |

**GATE-3 status: PASS. DB: `voicemail_greeting_text` + `voicemail_greeting_audio_url` on clients, `ultravox_call_id` now nullable. call_status='VOICEMAIL' for fallback entries.**

### GATE-4 -- Dashboard Observability (core only)
| Item | Source | Status |
|------|--------|--------|
| S10a | S10 | **DONE** -- prompt version history with audit (who, role, char delta) in settings prompt-versions route |
| S10b | S10 | **DONE** 2026-03-22 -- "Last updated Xm ago" under regen button in AgentTab |
| S10c | S10 | **DONE** -- notifications tab with channel + status filters, paginated, multi-tenant scoped |
| S10d | S10 | **DONE** -- bookings tab (Calendar page) with upcoming/past split, status badges, calendar links |
| S10e | S10 | **DONE** -- call detail view with CallNotifications + CallBookings sub-panels per call_id |
| S10f | S10 | **DONE** -- failed notification red badge in sidebar, 24h window, realtime via postgres_changes |

**GATE-4 status: PASS. S10a-f verified + D1-D13 session discoveries fixed (voice_style save, injected_note, AgentTab extraction, realtime, pagination, server filters).**

### GATE-5 -- Guard Rails
| Item | Source | Status |
|------|--------|--------|
| S18a | S18 | DONE (verified 2026-03-22) |
| S18c | S18 | DONE (types generated, S18c-TRIAGE pending) |
| S18e | S18 | DONE (script written, S18e-VALIDATE pending) |
| S18o | S18 | DONE (pre-push runs full build) |

**GATE-5 status: PASS (core items done). Remaining: S18c-TRIAGE + S18e-VALIDATE are follow-ups, not blockers.**

---

## S12 Execution Slices (after P0 gates)

| Slice | Name | Scope | Status |
|-------|------|-------|--------|
| 1 | Prompt Variable Injection | PROMPT-TEST1+2 | NOT STARTED |
| 2 | Talk to Your Agent | TRIAL1 — phased below | **2a DONE** |
| 3 | Scrape Verify + Harden | SCRAPE6/7/8/10 | NOT STARTED |
| 4 | Empty States | TOUR3: 4 empty state variants | NOT STARTED |
| 5 | Guided Tour | TOUR2: driver.js, 4 steps | NOT STARTED (needs Slice 4) |
| 6 | Advanced Trial Extras | TRIAL1b-1d, TRIAL2-6 | DEFERRED (no research) |
| 7 | External Deps | Domain, email E2E, phone E2E | BLOCKED (domain purchase) |

### Slice 2 Sub-Phases — "Talk to Your Agent" + Agent Intelligence UX

| Phase | Name | What | Status |
|-------|------|------|--------|
| 2a | WebRTC Orb for All | AgentVoiceTest.tsx, TestCallCard rewrite, "Talk to Your Agent" copy, phone fallback | **DONE** 2026-03-22 |
| 2b | Post-Call Hints | After call ends: "Ways to improve" chips (Add FAQs, Set hours, Change voice). Dynamic based on capability gaps. Scroll-to-section via `id="section-*"` on cards. Pre-call "Try asking" prompts based on what's enabled. | **DONE** 2026-03-22 |
| 2c | Agent Knowledge Card | "What your agent knows" summary: business facts count, FAQ count, hours set?, booking on?, voice style, knowledge docs. Visible pre-call and post-call. | NOT STARTED |
| 2d | Try-Asking Prompts | Pre-call suggestions: "Try asking about your hours", "Ask to book an appointment", "Ask about [FAQ topic]". Generated from client config. | NOT STARTED |
| 2e | Inline Mini-Editors | Onboarding-specific: quick FAQ add, hours toggle, voice preview — all inline, no settings navigation needed. Uses same `usePatchSettings` hook. | NOT STARTED |
| 2f | Website Scrape Hint | Post-call + settings hint: "Add your website to teach your agent more". Triggers existing scrape flow (SCRAPE1-3). Shows scraped facts/QAs with approve/reject. User chooses: add to prompt (business_facts/extra_qa) OR add to knowledge base (RAG chunks). | NOT STARTED |

**Goal:** Users understand what their agent knows, get guided on what to improve, and can make changes without navigating the full settings page. Post-call is the highest-leverage moment — user just heard the agent and is most motivated to improve. Website scrape is the easiest "teach your agent" path — paste URL, approve facts, agent gets smarter.

### Slice 8 — Agent Intelligence Deep (from audit discoveries)

| Phase | Name | What | Priority | Status |
|-------|------|------|----------|--------|
| 8a | Agent Capability Dashboard | CapabilitiesCard upgraded: progress bar, ReadinessBadge, clickable scroll-to-section items, detail strings, knowledge layer legend. Visible to ALL users. | HIGH | **DONE** 2026-03-22 |
| 8b | Knowledge vs Memory Explainer | Blue "Always knows" banner in AdvancedContextCard, purple "Searched when needed" in KnowledgeEngineCard. Badge text "Persistent" → "Every call". | MEDIUM | **DONE** 2026-03-22 |
| 8c | Agent Name → Prompt Sync | D26: `patchAgentName()` in prompt-patcher.ts. Word-boundary regex, `validatePrompt()` gate, auto-syncs to Ultravox on save. | MEDIUM | **DONE** 2026-03-22 |
| 8d | Settings Page Reorganization | Group cards by purpose: (1) Identity & Voice, (2) What It Knows, (3) What It Can Do, (4) Talk to Your Agent. Collapsible sections. 6 SettingsSection groups. AgentTab 1502→534 lines. All 19 cards now standalone components. | MEDIUM | **DONE** 2026-03-22 |
| 8e | Prompt-Aware Suggestions | Read the prompt, extract what the agent actually says/does, surface as "Your agent will..." bullets. Helps users verify behavior without making a call. | LOW | NOT STARTED |
| 8f | Change Impact Preview | When user edits a field (FAQ, hours, voice), show "This change means your agent will now..." before saving. Reduces anxiety about breaking things. | LOW | NOT STARTED |
| 8g | Quick-Add from Calls Page | After reviewing a call transcript, suggest: "Your agent didn't know X — add it as a FAQ?" One-click adds to extra_qa. | MEDIUM | NOT STARTED |
| 8h | Onboarding Progress Ring | Visual progress indicator: "Your agent is 60% set up" based on which capabilities are configured. Motivates completion. | MEDIUM | NOT STARTED |
| 8i | Settings Search/Filter | Search box at top of settings to quickly find "hours", "voice", "booking" etc. Filters visible cards. For power users with many settings. | LOW | NOT STARTED |
| 8j | Intent Confidence / Containment Rate | Track per-capability success rate from call transcripts. Requires call analytics pipeline (transcript → intent classification → success/fail). Source: Sonar Pro research. | LOW | NOT STARTED |
| 8k | Cost-Per-Call Dashboard Widget | Usage cost breakdown per call: Ultravox minutes, Twilio, SMS, knowledge queries. Helps users understand ROI. Source: Sonar Pro research. | LOW | NOT STARTED |
| 8l | A/B Prompt Testing | Test two prompt variants side-by-side, route 50/50, compare metrics. Requires call volume + analytics pipeline. Source: Sonar Pro research. | LOW | NOT STARTED |
| 8m | Failure-to-Refine Pipeline | Auto-detect unanswered questions from transcripts → surface as "Add this as a FAQ?" notification. Extends 8g with automated detection. Source: Sonar Pro research. | MEDIUM | NOT STARTED |
| 8n | Conversation Flow Visualization | Visual decision tree of agent behavior: greeting → qualification → booking/transfer/FAQ. Non-technical users understand agent without reading prompt. Extends 8e. Source: Sonar Pro research. | LOW | NOT STARTED |
| 8o | Frustration/Interruption Metrics | Per-call frustration score (repeated questions, interruptions, silence gaps). Enriches `completed` webhook classification. Feeds into D35 AI suggestions + D36 weekly digest. Sonar Pro: industry-standard for voice AI observability. | MEDIUM | NOT STARTED |
| 8p | Prompt Coherence Guard | Track cumulative patch count per prompt. After 5+ surgical patches without full regen, surface warning: "Your agent's prompt has been patched many times — consider regenerating for best results." Prevents personality drift from incremental edits. | LOW | NOT STARTED |
| 8q | Live Call Duration Timer | Enhance LiveCallBanner with per-call duration counter (elapsed since `started_at`). Shows "2:34 and counting" for each active call. Sonar Pro: emerging standard for voice AI dashboards. | LOW | NOT STARTED |

---

## Session Discoveries (2026-03-22) — Bugs & Gaps Found During GATE-4

| # | Type | Description | Severity | Status |
|---|------|-------------|----------|--------|
| D1 | **BUG** | Booking→call links broken: `bookings.call_id` stores `call_logs.id` (UUID) but `/dashboard/calls/[id]` queries `.eq('ultravox_call_id', id)`. | HIGH | **DONE** 2026-03-22 -- call detail page tries `ultravox_call_id` then falls back to `call_logs.id` |
| D2 | UX | Sidebar nav says "Calendar" but page content was titled "Bookings" | LOW | **DONE** 2026-03-22 -- page title changed to "Calendar" |
| D3 | API | Bookings API lacked server-side filtering (no status/date params) | LOW | **DONE** 2026-03-22 -- added `status`, `date_from`, `date_to` query params |
| D4 | PRECISION | S10b "Last updated" fires on ANY client mutation, not just prompt regen | LOW | **DONE** 2026-03-22 -- label changed to "Agent last updated" |
| D5 | UX | Notifications page had basic list UI vs Calendar's timeline design | LOW | **DONE** 2026-03-22 -- full rewrite: stats, channel-colored icons, timeline cards, grouped by date, motion transitions |
| D6 | REALTIME | Sidebar notification badge subscribes to `call_logs` changes only, not `notification_logs`. Badge goes stale mid-session. | MEDIUM | **DONE** 2026-03-22 -- added `notification_logs` realtime subscription |
| D7 | UX | No "Load more" pagination — Calendar caps at 100, Notifications at 50. Heavy-volume clients see truncated view. | LOW | **DONE** 2026-03-22 -- added Load More button to both pages |
| D8 | WIRING | D3 API filters exist (`status`, `date_from`, `date_to`) but Calendar frontend doesn't use them — still fetches all and filters client-side. | LOW | **DONE** 2026-03-22 -- Calendar now uses server-side status/date filters |
| D9 | REALTIME | Calendar and Notifications pages have no realtime — new bookings/notifications require manual refresh. | LOW | **DONE** 2026-03-22 -- added `postgres_changes` subscriptions to both pages |
| D10 | PATTERN | `notification_logs.call_id` uses internal UUID (same pattern as bookings D1). Already handled by D1 dual-ID lookup in call detail page. | NOTE | N/A -- documented pattern, no code change needed |
| D11 | **BUG** | `voice_style_preset` save was a no-op — wrote to DB but never patched the prompt or synced to Ultravox. Preset selection had zero effect on calls. | HIGH | **DONE** 2026-03-22 -- `patchVoiceStyleSection()` in prompt-patcher.ts, wired into settings API |
| D12 | **BUG** | `injected_note` (Today's Update) had 3 distinct bugs: (1) prompt-patching at save time never persisted combined prompt, (2) next agent sync wiped it, (3) inbound webhook didn't SELECT it. | HIGH | **DONE** 2026-03-22 -- converted to call-time injection via `callerContextBlock` in agent-context.ts |
| D13 | REFACTOR | AgentTab.tsx was 2239-line monolith — extracted 5 settings cards + shared `usePatchSettings` hook. AgentTab now 1774 lines. | MEDIUM | **DONE** 2026-03-22 -- HoursCard, VoiceStyleCard, VoicemailGreetingCard, SectionEditorCard, AdvancedContextCard |
| D14 | TECH DEBT | Booking config card was last inline settings card in AgentTab.tsx. | LOW | **DONE** 2026-03-22 — Wave 1: BookingCard + WebhooksCard + AgentConfigCard + TestCallCard extracted. AgentTab 1774→1461 lines. |
| D15 | **GAP** | Voice style + calendar prompt patches skip `validatePrompt()` — if replacement pushes prompt over 8K chars, it won't be caught. Section editor DOES validate. | MEDIUM | **DONE** 2026-03-22 — both patches now run `validatePrompt()`, block save + return error if >8K |
| D16 | UX GAP | `usePatchSettings` hook doesn't surface errors to user. If PATCH fails (prompt validation, Ultravox sync), cards show no error. | MEDIUM | **DONE** 2026-03-22 — hook returns `error`/`clearError`, all 7 cards display errors. AgentOverviewCard also has `footerError`. |
| D17 | REALTIME | Calls page (`/dashboard/calls`) realtime subscription was unscoped — listened to ALL rows. Now filtered by `client_id` for non-admin users, matching D9 pattern. | LOW | **DONE** 2026-03-22 — `CallsList.tsx` filter + dep array fix |
| D18 | REALTIME | Leads page (`/dashboard/leads`) admin LeadQueue had no realtime. Added `postgres_changes` on `campaign_leads` with INSERT/UPDATE handlers. | LOW | **DONE** 2026-03-22 — `LeadQueue.tsx` realtime subscription |
| D19 | TECH DEBT | Settings PATCH route uses 30+ manual `typeof` field checks instead of a Zod schema. Not a bug (each field is individually validated) but a drift risk — new fields can be added without validation. | LOW | NOT STARTED |
| D20 | WIP | S12 Slice 4/5 partially started — uncommitted files exist: `TrialBadge.tsx`, `UpgradeCTA.tsx`, `empty-states/`, `useOnboarding.ts`, modified `AgentTestCard.tsx`, `OnboardingChecklist.tsx`. Need to decide: commit as WIP branch or discard. | INFO | NEEDS DECISION |
| D25 | UNIFICATION | All 7 extracted cards + AgentOverviewCard now support `mode` prop ('settings' \| 'onboarding'), `onSave` callback, and error display. `usePatchSettings` hook upgraded with `error`/`clearError`/`CardMode` type. Onboarding and settings share same components, same DB writes, same Ultravox sync. | DONE | **DONE** 2026-03-22 |
| D26 | **GAP** | `agent_name` save now patches `system_prompt` via `patchAgentName()` in prompt-patcher.ts. Word-boundary regex, `validatePrompt()` gate, auto-syncs to Ultravox. | MEDIUM | **DONE** 2026-03-22 — prompt-patcher.ts + settings route.ts |
| D27 | **GAP** | No feedback loop for call-time injection fields (hours, facts, Q&A). User saves but sees no confirmation the agent "knows" it — only a test call verifies. Consider a "preview what agent knows" panel. | LOW | NOT STARTED |
| D28 | **FIX** | `PROMPT_MAX_CHARS` was 8000 (hard block). User confirmed real limit is 12K. Changed to: warn at 8K, hard block at 12K. Updated 11 files: route.ts, AgentTab, RuntimeCard, AgentOverviewCard, knowledge-summary, inbound/transfer webhooks, CLAUDE.md, docs. | HIGH | **DONE** 2026-03-22 |
| D29 | **GAP** | WebRTC orb (in-browser voice test) only visible to admin in `/dashboard/lab` (`adminOnly: true`). Paid users and trial users have NO in-browser test option — only phone-based TestCallCard. Lab page also broken for admin (shows "select a client first" with no selection UI). | HIGH | **DONE** 2026-03-22 -- AgentVoiceTest.tsx + TestCallCard rewrite. WebRTC orb primary, phone secondary for all users. |
| D30 | OPTIMIZATION | Realtime re-render storms: high-volume clients (10+ calls/min) can cause rapid `setCalls` updates from `postgres_changes`. Should debounce/batch realtime events (collect in queue, flush every 100-250ms). Sonar Pro research confirms React 18+ `useDeferredValue`/`useTransition` or manual debounce. | LOW | NOT STARTED |
| D31 | OPTIMIZATION | Unbounded state arrays: `CallsList`, `LeadQueue`, Calendar, Notifications all prepend to arrays without caps. Long sessions could accumulate thousands of entries in memory. Should implement `.slice(0, MAX)` after prepend or virtual scrolling for 500+ rows. | LOW | NOT STARTED |
| D32 | SECURITY | RLS-based realtime filtering: current `postgres_changes` uses client-side `filter: 'client_id=eq.X'` which reduces noise but doesn't enforce security at the DB level. Supabase Realtime respects RLS policies — should verify RLS is enabled on `call_logs`, `campaign_leads`, `notification_logs`, `bookings` for realtime channels. If RLS is active, the client-side filter is redundant (belt-and-suspenders). | MEDIUM | NOT STARTED |
| D33 | **PATTERN** | Multi-field prompt patch ordering: when user changes name + voice + hours in single save, patches should apply in dependency order — (1) identity/name, (2) sensory/voice, (3) operational/calendar — with `validatePrompt()` after each step, not just the final result. Currently settings route applies patches independently which could compound over 12K limit. | LOW | NOT STARTED |
| D34 | FEATURE | Call sentiment deep metrics: beyond HOT/WARM/COLD classification, add frustration detection (repeated questions count), interruption rate, silence gaps, and per-call satisfaction score. Sonar Pro research shows these are becoming industry standard for voice AI observability. `call_logs` already has `sentiment` + `quality_score` columns — needs enrichment in `completed` webhook. | MEDIUM | NOT STARTED |
| D35 | FEATURE | AI-assisted prompt improvement suggestions: after N calls with similar failure patterns (e.g. agent couldn't answer same question 3x), surface automated suggestion: "Your agent didn't know X — add it as a FAQ?" Extends Slice 8g (Quick-Add from Calls) with pattern detection. | MEDIUM | NOT STARTED |
| D36 | FEATURE | Weekly failure digest: automated cron that analyzes escalated/missed/low-quality calls from past 7 days, groups recurring failure reasons, and sends summary to client via dashboard notification + optional email. Sonar Pro: "failure log analysis is a goldmine for improvement." | LOW | NOT STARTED |
| D37 | FEATURE | Agent personality coherence check: when cumulative prompt patches (name + voice + hours + calendar) drift the prompt far from the original template, detect and warn. Track patch count per prompt version — if >5 surgical patches without a full regen, suggest "Regenerate prompt to ensure consistency." | LOW | NOT STARTED |

---

## Pending Phases (details in archive)

| Phase | Summary | Status |
|-------|---------|--------|
| S10 | Dashboard observability -- surface notifications/bookings/audit data | **GATE-4 PASS** (S10a-f done). S10g-w deferred |
| S11 | Data retention -- purge old logs, recordings, stripe_events | NOT STARTED |
| S12 Ph2 | Setup wizards (Telegram, SMS, Calendar, Knowledge, Forwarding) | NOT STARTED |
| S12 Ph2b | Calendar & call routing UX overhaul | NOT STARTED |
| S12 Ph2c | IVR multi-route call handling | DEFERRED |
| S12 Ph3 | Agent quality gate, setup progress, intake UX | NOT STARTED |
| S12 Ph3b | Prompt variable injection testing system | Slice 1 |
| S12 Ph3c | Trial dashboard experience (tour + WebRTC + gating) | Slices 2/4/5 |
| S12 Ph3d | Website scrape transparency hardening | Slice 3 |
| S12 Ph4 | Post-signup communication (welcome email, first-login) | BLOCKED on domain |
| S12 Ph5 | Dashboard visual redesign | LAST |
| S13 remaining | c (log hygiene), d (deprecate deploy_prompt.py), j-l (timeouts), p (rate limit alerts), w (create-draft rate limit), s-1 (RLS column restriction) | Mixed |
| S14 | Ultravox outage resilience -- voicemail fallback | **DONE** (GATE-3 PASS) |
| S15 | Domain migration (unmissed.ai -> theboringphone.com) | GATE-1 |
| S16 | Compliance -- recording consent (S16a GATE-2), SMS consent (S16b), PIPEDA (S16c-d), prompt injection (S16e DONE) | S16e DONE, S16a GATE-2, rest NOT STARTED |
| S17 | Operational maturity -- staging, backups, logging, monitoring | NOT STARTED |
| S18 remaining | c-TRIAGE (type errors), d (CI types), e-VALIDATE (smoke test prod), f (deploy column), g (route checklist), h (import tests), i (webhook integration tests), j (cron execution log), l (fetch timeout sweep -- 80 naked fetches) | Mixed |
| S19 | Billing observability -- source-of-truth alignment, usage alerts | S19a DONE, rest NOT STARTED |
| S20 | Client deprovisioning -- number release, agent deactivation, session invalidation | NOT STARTED |

---

## Execution Order Summary

```
DONE  -> S0-S9.6, S12 Phase 1, S13 (security), S13.5 (call quality),
         S18 partial (guard rails), S19a (webhook liveness),
         GATE-2: S13-REC1 (recording privacy) + S16e (prompt injection defense),
         GATE-3: S14a-d (voicemail fallback + settings UI),
         GATE-4: S10a-f + D1-D29 (dashboard observability + session discoveries),
         D17/D18 (realtime scoping), D26/8c (agent name→prompt sync), 8a-8b (capability UX),
         8d (settings page reorg: 6 sections, 19 cards extracted, AgentTab 1502→534 lines)

NEXT (P0-LAUNCH-GATE):
  GATE-1 -> S15 domain + email (BLOCKED on domain purchase)
  GATE-2 -> S16a only remaining (call recording consent disclosure in prompts)
  GATE-3 -> PASS (S14a-d done)
  GATE-4 -> PASS (S10a-f done)
  GATE-5 -> PASS (S18a/c/e/o done)

THEN (S12 Slices 1-5):
  SLICE-1 -> Prompt injection harness
  SLICE-2 -> WebRTC orb (#1 conversion blocker)
  SLICE-3 -> Scrape hardening
  SLICE-4 -> Empty states
  SLICE-5 -> Guided tour

DEFERRED -> S11, S12 advanced, S13 LOW, S16b-d, S17-S20
```

---

## Coding Patterns (always follow)

- **Shared utilities:** `buildAgentTools()` for tools, `syncClientTools()` for tool DB writes, `insertPromptVersion()` for version inserts. Never inline these.
- **`toolOverrides` format:** `{ removeAll: true, add: tools }` -- NOT a raw array. Raw array = 400 error.
- **All DB writes awaited:** `.then()` banned except documented TwiML latency trade-off.
- **All external fetches need `AbortSignal.timeout()`:** 10s caller-facing, 15s admin, 30s background.
- **All Ultravox tool endpoints need `X-Tool-Secret` auth.**
- **Public billable endpoints need global budget:** `SlidingWindowRateLimiter` on top of per-IP limits.
- **Health endpoints must not leak IDs:** Aggregate status only, never slugs or agent IDs.
- **deploy_prompt.py drift risk:** Parallel TS implementation. Any tool/template change needs BOTH files.
- **Centralized URLs:** `APP_URL` + `SITE_URL` in `lib/app-url.ts`. Domain migration = 1 file + 1 env var.
- **Callback URL max 200 chars.** Short nonces (8 bytes), single-letter param names.
- **npm `prepare` must be Docker-safe:** Guard with `if [ -d .git ]; then ...; fi`.
- **Recordings are PRIVATE:** `recordings` bucket is private. Never use `getPublicUrl()`. Use `getSignedRecordingUrl()` from `lib/recording-url.ts`. Store paths (not URLs) in `call_logs.recording_url`.
- **"DONE" means deployed + verified,** not just committed.
- **Multi-tenant auth:** Every dashboard API route needs `client_users` gating after session auth.
- **Ultravox webhook `secrets[0]`** from API response = actual HMAC key. Omit secret field, use auto-generated.
- **Prompt injection defense required:** All agent prompts must include reveal/role-override/code-output defense rules. `validatePrompt()` enforces for generated prompts. Hand-crafted `SYSTEM_PROMPT.txt` files need manual addition matching each client's style (e.g. "Never X" vs numbered rules). Always dry-run `deploy_prompt.py --dry-run` before live deploy to verify tools aren't wiped.
- **Prompt section patching:** `lib/prompt-patcher.ts` for feature-toggle patches (calendar block, voice style, agent name). `lib/prompt-sections.ts` for marker-based section replacement (`<!-- unmissed:SECTION_ID -->`). Never edit prompt text inline in route handlers. Multi-field patch order: identity (name) → sensory (voice) → operational (calendar/hours).
- **Settings card extraction pattern:** All 19 settings cards are in `components/dashboard/settings/`. Use `usePatchSettings` hook for PATCH `/api/dashboard/settings`. AgentTab.tsx (534 lines) is a layout shell — all logic lives in individual card components. Cards grouped into 6 collapsible `SettingsSection` groups. See `memory/settings-card-architecture.md` for full section map.
- **Call-time injection (not prompt-time):** Ephemeral data (`injected_note`, returning caller context) is injected via `callerContextBlock()` in `lib/agent-context.ts` at call creation — NOT baked into `system_prompt` in DB. DB prompt = stable base. Call-time additions = dynamic overlay via `templateContext`.
