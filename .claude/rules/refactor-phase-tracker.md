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
| S16e | Prompt Injection Defense | Rules 14-16 generic + 12-14 real_estate, `validatePrompt()` gate |

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
| S16e-LIVE | S16e | NOT STARTED -- deploy injection defense to 4 live agents (only new prompts have it, live prompts don't) |

### GATE-3 -- Outage Resilience (core only)
| Item | Source | Status |
|------|--------|--------|
| S14a-d | S14 | NOT STARTED -- voicemail fallback + logging + notification + storage |

### GATE-4 -- Dashboard Observability (core only)
| Item | Source | Status |
|------|--------|--------|
| S10a-f | S10 | NOT STARTED -- prompt history, notifications tab, bookings tab, call detail, badge |

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
| 2 | Trial WebRTC Orb | TRIAL1 only | NOT STARTED |
| 3 | Scrape Verify + Harden | SCRAPE6/7/8/10 | NOT STARTED |
| 4 | Empty States | TOUR3: 4 empty state variants | NOT STARTED |
| 5 | Guided Tour | TOUR2: driver.js, 4 steps | NOT STARTED (needs Slice 4) |
| 6 | Advanced Trial Extras | TRIAL1b-1d, TRIAL2-6 | DEFERRED (no research) |
| 7 | External Deps | Domain, email E2E, phone E2E | BLOCKED (domain purchase) |

---

## Pending Phases (details in archive)

| Phase | Summary | Status |
|-------|---------|--------|
| S10 | Dashboard observability -- surface notifications/bookings/audit data | GATE-4 items + S10g-w deferred |
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
| S14 | Ultravox outage resilience -- voicemail fallback | GATE-3 |
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
         GATE-2: S13-REC1 (recording privacy) + S16e (prompt injection defense)

NEXT (P0-LAUNCH-GATE):
  GATE-1 -> S15 domain + email (BLOCKED on domain purchase)
  GATE-2 -> S16a only remaining (call recording consent disclosure in prompts)
  GATE-3 -> S14a-d (voicemail fallback)
  GATE-4 -> S10a-f (dashboard observability)
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
