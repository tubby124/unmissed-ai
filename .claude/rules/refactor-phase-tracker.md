# Refactor Phase Tracker (Active)

> Full history of completed phases: `docs/refactor-completed-phases.md`
> Master operator prompt: `docs/unmissed-master-operator-prompt.md`

## Cross-Phase Gates (apply to EVERY phase)

- **Sonar Pro Fact-Check:** Run 2-3 Perplexity Sonar Pro queries (via `$OPENROUTER_API_KEY`) before and after implementation.
- **Research-First Rule:** If a research doc exists, READ IT FIRST. If none exists, run Sonar Pro BEFORE writing code.
- **Conflicting Research:** Flag conflicts to the user before proceeding.

---

## Research & Plans Index

- **S12 Ph3c (Tour + Trial):** `docs/s12-audit/S12-PHASE3C-IMPLEMENTATION-PLAN.md` | Tour: driver.js decided (`docs/s12-audit/s12-tour-library-decision.md`) | WebRTC: `memory/ultravox-client-sdk-reference.md` + `memory/webrtc-component-architecture.md` | Conversion: `docs/s12-audit/s12-trial-conversion-research.md`
- **S12 Ph3d (Scrape):** `docs/s12-audit/scrape-architecture-findings.md` | Plan: `~/.claude/plans/twinkly-wibbling-fountain.md`
- **Settings Cards:** `docs/settings-card-tracker.md` + `memory/settings-card-architecture.md`
- **Phase 0:** `docs/research-notes/phase0-tooling-research.md` | `docs/refactor-baseline/PHASE-0D-TRUTH-MAP.md`
- **Sonar Pro (2026-03-22):** Realtime (RLS > client-side, debounce, cap arrays), Voice AI UX (sentiment, frustration, weekly digests), Prompt mgmt (surgical patching correct, identity→voice→operational order, coherence drift after 5+ patches)

---

## P0-LAUNCH-GATE (remaining items only)

### GATE-1 — Auth + Email Deliverability (BLOCKED on domain purchase)
| Item | Source | Status |
|------|--------|--------|
| S15-PRE1-7 | S15 | NOT STARTED — domain purchase + DNS + external configs |
| S15-ENV1-4 | S15 | NOT STARTED — Railway env var updates after domain |
| S15-CODE1-11 | S15 | NOT STARTED — brand text + legal pages + SEO metadata |
| S12-V15 | S12 | NOT STARTED — email deliverability E2E |
| S12-LOGIN1 | S12 | BLOCKED on S15-PRE3 |
| S12-V22 | S12 | NOT STARTED — Supabase email template branding |

### GATE-2 — Remaining Items
| Item | Source | Status |
|------|--------|--------|
| S13-REC2 | S13-REC1 | NOT STARTED — backfill recording_url values from full URLs to paths |
| S16a | S16 | NOT STARTED — call recording consent disclosure |

> GATE-3: PASS | GATE-4: PASS | GATE-5: PASS — see `docs/refactor-completed-phases.md`

---

## S12 Execution Slices

| Slice | Name | Status |
|-------|------|--------|
| 1 | Prompt Variable Injection (PROMPT-TEST1+2) | NOT STARTED |
| 2 | Talk to Your Agent (2a-2b DONE, 2c-2f below) | IN PROGRESS |
| 3 | Scrape Verify + Harden (SCRAPE6/7/8/10) | NOT STARTED |
| 4 | Empty States (TOUR3) | **DONE** 2026-03-22 |
| 5 | Guided Tour (TOUR2, driver.js) | **DONE** 2026-03-22 |
| 6 | Advanced Trial Extras | DEFERRED |
| 7 | External Deps | BLOCKED (domain purchase) |

### Slice 2 — Remaining Sub-Phases

| Phase | Name | What | Status |
|-------|------|------|--------|
| 2c | Agent Knowledge Card | "What your agent knows" summary: facts, FAQs, hours, booking, voice, knowledge docs | **DONE** 2026-03-22 |
| 2d | Try-Asking Prompts | Pre-call suggestions generated from client config | **DONE** 2026-03-22 |
| 2e | Inline Mini-Editors | Quick FAQ add, hours toggle, voice preview — inline, no settings nav | NOT STARTED |
| 2f | Website Scrape Hint | "Add your website to teach your agent more" — triggers SCRAPE1-3 flow | NOT STARTED |

### Slice 8 — Agent Intelligence Deep (remaining)

| Phase | Name | Priority | Status |
|-------|------|----------|--------|
| 8e | Prompt-Aware Suggestions | LOW | NOT STARTED |
| 8f | Change Impact Preview | LOW | NOT STARTED |
| 8g | Quick-Add FAQ from Calls | MEDIUM | **DONE** 2026-03-22 |
| 8h | Onboarding Progress Ring | MEDIUM | **DONE** 2026-03-22 |
| 8i | Settings Search/Filter | LOW | NOT STARTED |
| 8j | Intent Confidence / Containment Rate | LOW | NOT STARTED |
| 8k | Cost-Per-Call Dashboard Widget | LOW | NOT STARTED |
| 8l | A/B Prompt Testing | LOW | NOT STARTED |
| 8m | Failure-to-Refine Pipeline | MEDIUM | NOT STARTED |
| 8n | Conversation Flow Visualization | LOW | NOT STARTED |
| 8o | Frustration/Interruption Metrics | MEDIUM | NOT STARTED |
| 8p | Prompt Coherence Guard | LOW | NOT STARTED |
| 8q | Live Call Duration Timer | LOW | NOT STARTED |

---

## Session Discoveries — Pending Only

| # | Type | Description | Severity | Status |
|---|------|-------------|----------|--------|
| D19 | TECH DEBT | Settings PATCH uses 30+ manual `typeof` checks — should be Zod schema | LOW | NOT STARTED |
| D20 | WIP | Uncommitted S12 Slice 4/5 files — **resolved**: committed as part of CX-1 sprint | INFO | **DONE** 2026-03-22 |
| D27 | **GAP** | No feedback loop for call-time injection fields — consider "preview what agent knows" | LOW | NOT STARTED |
| D30 | OPTIMIZATION | Realtime re-render storms — debounce/batch 100-250ms for high-volume clients | LOW | NOT STARTED |
| D31 | OPTIMIZATION | Unbounded state arrays — `.slice(0, MAX)` after prepend or virtual scrolling | LOW | NOT STARTED |
| D32 | SECURITY | Verify RLS enabled on realtime tables (call_logs, campaign_leads, notification_logs, bookings) | MEDIUM | NOT STARTED |
| D33 | **PATTERN** | Multi-field prompt patch ordering — apply identity→voice→operational with validatePrompt() per step | LOW | NOT STARTED |
| D34 | FEATURE | Call sentiment deep metrics — frustration, interruption rate, silence gaps, satisfaction score | MEDIUM | NOT STARTED |
| D35 | FEATURE | AI-assisted prompt improvement suggestions from failure patterns | MEDIUM | NOT STARTED |
| D36 | FEATURE | Weekly failure digest cron — recurring failure analysis + client notification | LOW | NOT STARTED |
| D37 | FEATURE | Agent personality coherence check — warn after 5+ surgical patches without regen | LOW | NOT STARTED |

---

## Pending Phases

| Phase | Summary | Status |
|-------|---------|--------|
| S10 remaining | S10g-w deferred dashboard observability items | DEFERRED |
| S11 | Data retention — purge old logs, recordings, stripe_events | NOT STARTED |
| S12 Ph2 | Setup wizards (Telegram, SMS, Calendar, Knowledge, Forwarding) | NOT STARTED |
| S12 Ph2b | Calendar & call routing UX overhaul | NOT STARTED |
| S12 Ph2c | IVR multi-route call handling | DEFERRED |
| S12 Ph3b | Prompt variable injection testing system | Slice 1 |
| S12 Ph3c | Trial dashboard experience (tour + WebRTC + gating) | Slices 2/4/5 |
| S12 Ph3d | Website scrape transparency hardening | Slice 3 |
| S12 Ph4 | Post-signup communication (welcome email, first-login) | BLOCKED on domain |
| S12 Ph5 | Dashboard visual redesign | LAST |
| S13 remaining | c (log hygiene), d (deprecate deploy_prompt.py), j-l (timeouts), p (rate limit alerts) | Mixed |
| S15 | Domain migration | GATE-1 (BLOCKED) |
| S16 remaining | S16a (GATE-2), S16b (SMS consent), S16c-d (PIPEDA) | Mixed |
| S17 | Operational maturity — staging, backups, logging, monitoring | NOT STARTED |
| S18 remaining | c-TRIAGE, d (CI types), e-VALIDATE, f-l (various) | Mixed |
| S19 remaining | Billing observability — usage alerts | NOT STARTED |
| S20 | Client deprovisioning | NOT STARTED |

---

## Execution Order

```
DONE  -> S0-S9.6, S12 Ph1, S13, S13.5, S18 partial, S19a,
         GATE-2 partial, GATE-3 PASS, GATE-4 PASS, GATE-5 PASS,
         D1-D18/D25-D29, FND, Slice 2a-2d, 4, 5, 8a-8d, 8g, 8h

NEXT:
  DB-MIG  -> weekly_digest_enabled migration (30s)
  S16a    -> Call recording consent disclosure (GATE-2)
  SLICE-2c -> Agent Knowledge Card
  SLICE-8h -> Onboarding Progress Ring
  SLICE-8g -> Quick-Add FAQ from Calls
  SLICE-2d -> Try-Asking Prompts
  SLICE-4  -> Empty states
  SLICE-5  -> Guided tour (needs Slice 4)
  GATE-1   -> Domain migration (BLOCKED on domain purchase)

DEFERRED -> S11, S12 advanced, S13 LOW, S16b-d, S17-S20
```

---

## Ready-to-Execute Prompts

Self-contained prompts. Paste one per Claude Code session. Each is independent unless noted.

### PROMPT 1 — Supabase Migration: weekly_digest_enabled (do first, 30s)
**Tracker ref:** FND Phase 6C | **Priority:** Do before any weekly digest work
```
Apply the pending migration to add weekly_digest_enabled column to the clients table.
File: supabase/migrations/20260322000000_add_weekly_digest.sql
Use the Supabase MCP to run this migration against project qwhvblomlgeapzhnuwlb (unmissed-ai).
After applying, verify the column exists: SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'weekly_digest_enabled';
```

### PROMPT 2 — Call Recording Consent Disclosure (GATE-2 — S16a)
**Tracker ref:** GATE-2 S16a | **Priority:** HIGH — last remaining GATE-2 item
```
Add call recording consent disclosure to all voice agent system prompts.
1. Read memory/glm46-prompting-rules.md (MANDATORY before any prompt edit)
2. Read current system_prompt for each active client from Supabase
3. Add natural disclosure line in GREETING/OPENING section — one sentence, conversational, adapted to each agent's personality
4. Run validatePrompt() check — no prompt exceeds 12K chars
5. Deploy each with /prompt-deploy [client]
6. Do NOT change any other part of the prompts
```

### PROMPT 3 — Agent Knowledge Card (Slice 2c)
**Tracker ref:** Slice 2c | **Priority:** MEDIUM
```
Build AgentKnowledgeCard.tsx — summary of what agent knows (facts count, FAQs, hours, booking, voice, knowledge docs).
Read memory/settings-card-architecture.md for pattern. Add to "Talk to Your Agent" section in AgentTab.tsx.
NO new API routes — reuse existing client config data. Run npm run build.
```

### PROMPT 4 — Onboarding Progress Ring (Slice 8h)
**Tracker ref:** Slice 8h | **Priority:** MEDIUM
```
Create SetupProgressRing.tsx — SVG circle progress ring showing agent setup completeness.
Reuse CapabilitiesCard capability flags. Place at top of settings for non-admin users.
100% = green checkmark. Run npm run build.
```

### PROMPT 5 — Quick-Add FAQ from Calls (Slice 8g)
**Tracker ref:** Slice 8g | **Priority:** MEDIUM
```
Add "Add as FAQ?" button on call detail page for unanswered topics.
Inline form (question + answer), PATCH settings with extra_qa append.
Uses existing usePatchSettings pattern. Run npm run build.
```

### PROMPT 6 — Try-Asking Prompts (Slice 2d)
**Tracker ref:** Slice 2d | **Priority:** LOW
```
Add pre-call "Try asking..." chips to AgentVoiceTest/TestCallCard.
Dynamic from client config: hours → "Try asking about your hours", booking → "Ask to book", etc.
Max 4 chips, hidden during/after call. Run npm run build.
```

### PROMPT 7 — Empty States (Slice 4)
**Tracker ref:** Slice 4 / TOUR3 | **Priority:** LOW | **Depends on:** Nothing
```
Add empty state variants for calls, calendar, notifications, insights pages.
Icon + heading + subtext + CTA where appropriate. Check D20 for prior uncommitted files.
Run npm run build.
```

### PROMPT 8 — Guided Tour (Slice 5)
**Tracker ref:** Slice 5 / TOUR2 | **Depends on:** Slice 4
```
npm install driver.js. Create GuidedTour.tsx with 4 steps.
Read docs/s12-audit/s12-tour-library-decision.md first.
Add to dashboard layout for non-admin. localStorage flag to prevent repeat. Run npm run build.
```

### PROMPT 9 — Domain Migration (GATE-1 — S15)
**Tracker ref:** GATE-1 | **BLOCKED on domain purchase**
```
Update lib/app-url.ts (centralized URL), Railway env vars, Supabase settings, Resend domain,
Twilio webhook URLs, Ultravox webhook URL, all brand text references. Full E2E test after.
```

---

## Coding Patterns (always follow)

- **Shared utilities:** `buildAgentTools()` for tools, `syncClientTools()` for tool DB writes, `insertPromptVersion()` for version inserts. Never inline these.
- **`toolOverrides` format:** `{ removeAll: true, add: tools }` — NOT a raw array. Raw array = 400 error.
- **All DB writes awaited:** `.then()` banned except documented TwiML latency trade-off.
- **All external fetches need `AbortSignal.timeout()`:** 10s caller-facing, 15s admin, 30s background.
- **All Ultravox tool endpoints need `X-Tool-Secret` auth.**
- **Public billable endpoints need global budget:** `SlidingWindowRateLimiter` on top of per-IP limits.
- **Health endpoints must not leak IDs:** Aggregate status only, never slugs or agent IDs.
- **deploy_prompt.py drift risk:** Parallel TS implementation. Any tool/template change needs BOTH files.
- **Centralized URLs:** `APP_URL` + `SITE_URL` in `lib/app-url.ts`. Domain migration = 1 file + 1 env var.
- **Callback URL max 200 chars.** Short nonces (8 bytes), single-letter param names.
- **npm `prepare` must be Docker-safe:** Guard with `if [ -d .git ]; then ...; fi`.
- **Recordings are PRIVATE:** Use `getSignedRecordingUrl()` from `lib/recording-url.ts`. Store paths (not URLs).
- **"DONE" means deployed + verified,** not just committed.
- **Multi-tenant auth:** Every dashboard API route needs `client_users` gating after session auth.
- **Ultravox webhook `secrets[0]`** from API response = actual HMAC key. Omit secret field, use auto-generated.
- **Prompt injection defense required:** `validatePrompt()` enforces for generated prompts. Hand-crafted prompts need manual defense rules.
- **Prompt section patching:** `lib/prompt-patcher.ts` for feature-toggle patches (calendar, voice style, agent name). `lib/prompt-sections.ts` for marker-based replacement. Multi-field patch order: identity (name) → sensory (voice) → operational (calendar/hours).
- **Settings card pattern:** All 19 cards in `components/dashboard/settings/`. `usePatchSettings` hook for PATCH. AgentTab.tsx (534 lines) is layout shell — logic in card components. 6 collapsible `SettingsSection` groups. Ref: `memory/settings-card-architecture.md`.
- **Call-time injection (not prompt-time):** Ephemeral data injected via `callerContextBlock()` in `lib/agent-context.ts` at call creation. DB prompt = stable base. Call-time = dynamic overlay via `templateContext`.
