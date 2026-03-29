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
| 3 | Scrape Verify + Harden (SCRAPE6/7/8/10) | SCRAPE6/7/8 DONE, SCRAPE10 NOT STARTED |
| 4 | Empty States (TOUR3) | **DONE** 2026-03-22 |
| 5 | Guided Tour (TOUR2, driver.js) | **DONE** 2026-03-22 |
| 6 | Advanced Trial Extras | DEFERRED |
| 7 | External Deps | BLOCKED (domain purchase) |

### Slice 2 — Remaining Sub-Phases

| Phase | Name | What | Status |
|-------|------|------|--------|
| 2c | Agent Knowledge Card | "What your agent knows" summary: facts, FAQs, hours, booking, voice, knowledge docs | **DONE** 2026-03-22 |
| 2d | Try-Asking Prompts | Pre-call suggestions generated from client config | **DONE** 2026-03-22 |
| 2e | Inline Mini-Editors | Quick FAQ add, hours toggle, voice preview — inline, no settings nav | **DONE** 2026-03-24 (voice preview: AgentCurrentVoiceCard; hours: SettingsPanel; FAQ add: AgentKnowledgeCard inline form) |
| 2f | Website Scrape Hint | "Add your website to teach your agent more" — triggers SCRAPE1-3 flow | **DONE** 2026-03-24 (amber nudge + inline URL input in AgentKnowledgeCard when no website set) |

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
| 8m | Failure-to-Refine Pipeline | MEDIUM | **DONE** 2026-03-28 |
| 8n | Conversation Flow Visualization | LOW | NOT STARTED |
| 8o | Frustration/Interruption Metrics | MEDIUM | **DONE** 2026-03-28 |
| 8p | Prompt Coherence Guard | LOW | NOT STARTED |
| 8q | Live Call Duration Timer | LOW | NOT STARTED |

---

## Session Discoveries — Pending Only

| # | Type | Description | Severity | Status |
|---|------|-------------|----------|--------|
| D19 | TECH DEBT | Settings PATCH uses 30+ manual `typeof` checks — should be Zod schema | LOW | **DONE** 2026-03-29 (`lib/settings-schema.ts` has full `settingsBodySchema` Zod schema + `FIELD_REGISTRY`. Settings route already uses `settingsBodySchema.safeParse(rawBody)`. Nothing to implement.) |
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
| D38 | **BUG** | Guided tour breaks on mobile — Sidebar is `hidden lg:flex`, so `data-tour` nav elements invisible below 1024px. Fixed: tour suppressed below 1024px via `window.innerWidth` check. | MEDIUM | **DONE** 2026-03-22 |
| D39 | FEATURE | Demo GA4 events — fire `demo_start`, `demo_complete`, `demo_agent_selected` via `lib/analytics.ts` for funnel tracking | MEDIUM | NOT STARTED |
| D40 | FEATURE | Demo follow-up email — Brevo transactional email after demo with summary + signup link. Requires domain/Brevo setup (GATE-1) | MEDIUM | BLOCKED on domain |
| D41 | FEATURE | Demo-to-Brevo sync — add demo visitors with email to Brevo contacts for nurture list | LOW | NOT STARTED |
| D42 | UX | "Not {name}?" link for returning demo visitors — lets them edit saved localStorage info instead of auto-skipping form | LOW | NOT STARTED |
| D43 | FEATURE | Onboarding UX overhaul — multiple fields non-editable, poor flow. User flagged: "onboarding still sucks" | HIGH | **DONE** 2026-03-23 (all 6 phases complete: data pipe, bugs, inline edit, consolidation, scrape UX, demo placement, field mapping) |
| D44 | **GAP** | No login path for trial users if email not delivered (no domain yet). User closes browser = locked out. Sonar-confirmed fix: Google OAuth (works with Railway URL, no custom domain needed). Plan: Phase 5b in `lively-hopping-flurry.md`. | HIGH | NOT STARTED |
| D45 | **GAP** | Scraped data from Google Places + website goes into agent training without user seeing/approving it. User flagged this. Sonar confirms review gate reduces churn 25%. Plan: Phase 5c in `lively-hopping-flurry.md`. | MEDIUM | NOT STARTED |
| D46 | UX | TrialSuccessScreen CTA not personalized with agent name. Phase 5 plan: "Talk to [Mark] in your dashboard →". Needs `agentName` from activation response → page.tsx → TrialSuccessScreen prop. | MEDIUM | **DONE** (already implemented — provision/trial/route.ts → page.tsx → status/page.tsx → TrialSuccessScreen prop chain fully wired) |
| D47 | FEATURE | Plan selection in onboarding — 7-step flow with plan picker at step 4. `selectedPlan` type added to OnboardingData. Capabilities (booking/forwarding) gated to Pro plan. Summary card in step 7 shows plan name + price. DB: `selected_plan` column added to `clients` via migration. | HIGH | **DONE** 2026-03-24 |
| D48 | FEATURE | Stripe 3-tier products created (LIVE). Lite: prod_UCl8SbXQTqNhT6, Core: prod_UCl8nni05Nk9lB, Pro: prod_UCl8d1JTMthpf7. All 6 price IDs (monthly+annual) now in PLANS[]. Upgrade route: `/api/billing/upgrade`. | HIGH | **DONE** 2026-03-24 |
| D49 | UX | VoiceStyleCard is admin-only — client owners can't see voice/style controls in settings. Need to expose voice & personality settings to all users (simplified version or full card). Currently gated behind admin check in AgentTab.tsx ~line 405. | HIGH | **DONE** (Phase 0 audit confirmed VoiceStyleCard is NOT behind isAdmin guard in current code — renders for all users) |
| D50 | **BUG** | Mobile sidebar nav broken — Sidebar uses `hidden lg:flex`, no hamburger/bottom nav alternative. Mobile users cannot access Agent subsections (Overview, Knowledge, Actions, Voice Library). D38 only suppressed tour, didn't fix actual navigation. | HIGH | **DONE** (already implemented — MobileNav.tsx has hamburger drawer + Agent accordion, wired in layout.tsx:88. Tests in tests/mobile-nav.spec.ts. Confirmed by Phase 0 audit 2026-03-24) |
| D51 | **DEBT** | `public-snapshot-url-exposure` — `/api/public/agent-snapshot` trusts bare `clientId` UUID, and that UUID is in the `/onboard/status?clientId=` URL (browser history, referrer, analytics). Data exposed is public business info only (services, hours, scraped facts — no prompt, no caller data). UUID is non-guessable. **Not a blocker.** Future fix: short-lived scoped token or state-based handoff instead of URL param. Do not let this become an auth redesign. | LOW | NOT STARTED |
| D52 | **GAP — v2.1 REQUIRED** | Standard `regenerate-prompt/route.ts` path does NOT inject `client_services` rows. Only deep-mode rebuild (`agent-mode-rebuild.ts`) reads `client_services`. If a client edits their service catalog then hits standard Regenerate, the rebuilt prompt is stale. Decision required: (A) patch standard regen to query `client_services` and inject rows — ~10 lines, same as `agent-mode-rebuild.ts` lines 154–165; OR (B) gate the "Regenerate Prompt" UI to always use deep-mode rebuild when `service_catalog` rows exist, document the distinction. Option A is correct. Must resolve before any client is onboarded with a populated service catalog. See `docs/canary/service-catalog-v2-phase-close.md`. | HIGH | **DONE** 2026-03-28 (commit `40d10df` — standard regen now queries `client_services` + `rowsToCatalogItems`, mirrors agent-mode-rebuild.ts pattern) |
| D53 | **UX** | `agent_mode` ↔ `call_handling_mode` silent drift — both cards render on settings page showing different "current" states (observed: muffin-house-cafe has `agent_mode=voicemail_replacement` but `call_handling_mode=full_service`). No sync mechanism. Client sees two conflicting "active mode" labels. Fix: when AgentModeCard deep-rebuild completes, write a matching `call_handling_mode` value; or add a UI note explaining the two systems. | MEDIUM | **DONE** 2026-03-29 (`AgentModeCard.tsx`: added context note showing active call mode + "switching also updates it to match"; done state confirms both fields synced. Backend was already atomic — `regenerate-prompt/route.ts` writes both `agent_mode` + `call_handling_mode` on deep-rebuild.) |
| D54 | **UX** | Settings default tab is `billing` for ALL owners regardless of plan — even active paid clients land on billing first. `SettingsView.tsx:123`. Fix: default to `general` when `subscription_status !== 'trialing'`. | MEDIUM | **DONE** 2026-03-28 (active clients default to `general`; trialing owners still get `billing`) |
| D55 | **BUG** | `?tab=agent` URL param doesn't map to any valid `SettingsTab` — silently falls back to `billing` for owners. Valid tabs are `general/sms/voice/notifications/billing/knowledge`. Fix: normalize `agent` → `general` in tab resolution. | LOW | **DONE** 2026-03-28 (D55: `normalizedInitialTab` alias in `SettingsView.tsx`) |
| D56 | **VERIFY** | Transfer recovery path never live-tested with a real Twilio call — built and committed but unverified: AI reconnect after human drops, `parent_call_log_id` FK, Telegram alert. Needs manual smoke test with a real phone call to an unanswered forwarding number. | MEDIUM | NOT STARTED |
| D57 | **HOUSEKEEPING** | `MEMORY.md` is 222 lines, exceeding the 200-line load limit — 22 lines silently dropped every session. Topic pointers for later entries may not load. Fix: move stale/done entries to archive or compress multi-line entries. | LOW | NOT STARTED |
| D58 | **BUG** | Alerts tab in Settings was `adminOnly: true` — owners couldn't manage their own Telegram/email/digest preferences from `/dashboard/settings`. Fixed alongside SMS tab ungating. | MEDIUM | **DONE** 2026-03-28 |
| D59 | **UX** | Home notifications sheet "All notification settings →" linked to `/dashboard/settings` without a tab param — landed on default tab instead of notifications. Fixed to deep-link `?tab=notifications`. | LOW | **DONE** 2026-03-28 |
| D60 | **GAP** | No SMS confirmation to caller after agent books an appointment. `bookAppointment` tool fires + calendar event created, but no confirmation text sent. Implement via `sendTextMessage` in the tool response instruction block, only when `sms_enabled=true`. Booking confirmation is a distinct SMS from the post-call follow-up. | MEDIUM | **DONE** 2026-03-28 (`calendar/[slug]/book/route.ts` fires `sendSmsTracked` after successful booking, gated on sms_enabled + twilio_number + callerPhone, opt-out checked) |
| D61 | **GAP** | SMS opt-out list invisible to owners — only admins can see who's opted out via DB. Owners flying blind on why SMS isn't reaching certain callers. Add read-only opt-out list to the SMS settings tab (no removal — opt-out is permanent per compliance). | LOW | **DONE** 2026-03-28 (GET `/api/dashboard/sms-opt-outs` + collapsible read-only list in `SmsTab.tsx`) |
| D65 | **UX — HIGH** | Trial home page is too layered to be useful. A new user sees: floating label → TrialModeSwitcher card → post-call panel → test prompts → proof strip → checklist → insights → stats → bento (TestCallCard + 6 tiles) → upgrade nudge. Up to 11 sections. Nobody scrolls past the orb. The page needs a clear north star: one primary action, everything else secondary. Real fix: gut the return branch to: TestCallCard (full-width) → TrialModeSwitcher (inside bento as a tile) → bento tiles. Everything else conditional/collapsed. | HIGH | **DONE** 2026-03-28 |
| D66 | **UX** | Triple capability redundancy on home overview. TestCallCard "WHAT YOUR AGENT KNOWS" tiles + AgentKnowledgeTile + CallHandlingTile all show overlapping capability/knowledge status on the same screen. User sees the same info 3 times. Fix: TestCallCard tiles are the hero — drop one of the other two (AgentKnowledgeTile is weaker, consider replacing with something more actionable). | MEDIUM | **DONE** 2026-03-28 |
| D67 | **UX** | isFirstVisit branch in TrialActiveSection is a completely different UI from the return branch. First visit: custom welcome layout with its own knowledge pill rows. Every visit after: bento grid. Same user, same product, wildly different screen. Either unify them (show bento on first visit too) or make the first-visit screen clearly a one-time onboarding moment that feels intentional. | MEDIUM | **DONE** 2026-03-29 (removed `KnowledgeRow` component + custom "What callers experience" card; replaced with `CapabilitiesCard` — same component as return branch. Both branches now share the same capability vocabulary.) |
| D68 | **UX** | TrialModeSwitcher floats orphaned above the bento grid in the trial return branch — outside the visual system, disconnected from the TestCallCard it affects. Belongs either inside the bento grid as a tile, or merged into CallHandlingTile. | LOW | **DONE** 2026-03-28 |
| D69 | **GAP** | GBP fields (`gbp_place_id`, `gbp_summary`, `gbp_rating`, `gbp_review_count`, `gbp_photo_url`) were written to `clients` at provision time but never surfaced anywhere in the dashboard. Home API was not selecting them. Owners couldn't see the GBP data their agent was trained on. Fixed in Dashboard Control Center Phase 1 — `KnowledgeSourcesTile` surfaces GBP summary + star rating + photo, and `business_facts` is now editable per-line inline. | MEDIUM | **DONE** 2026-03-28 |
| D70 | **RESOLVED** | `call_handling_mode` is `DB_PLUS_PROMPT`, `triggersSync: true` (confirmed via `lib/settings-schema.ts` FIELD_REGISTRY + SYNC_TRIGGER_FIELDS). Mode label display is read-only — "Change mode" CTA links to `/dashboard/settings?tab=general` (no inline patch, no sync spinner in the tile). | MEDIUM | **DONE** 2026-03-28 |
| D62 | UX | IVR settings currently in Agent tab only. User suggested IVR could live in a "notifications / call handling" area. Deferred — IVR is more "call routing" than "notifications"; keep in Agent tab for now. Revisit during S12 Ph2c (IVR multi-route). | LOW | DEFERRED |
| D63 | **GAP** | Booking confirmation SMS (D60) is completely untracked — fires `sendSmsTracked` but never writes to `sms_logs`. Sid is dropped. No delivery status, no owner visibility, no record a confirmation was sent for a given booking. All other outbound SMS paths log to `sms_logs`. Use `direction: 'booking_confirmation'` to avoid unique constraint collision with post-call follow-up (`direction: 'outbound'`). | MEDIUM | **DONE** 2026-03-28 (`calendar/[slug]/book/route.ts` logs to `sms_logs` with `direction: 'booking_confirmation'` + `message_sid` after successful send) |
| D64 | **GAP** | No bookings dashboard view — `bookings` table has all appointment records but there is no `/dashboard/bookings` route, no bookings tab, no upcoming appointments widget. Owners only see bookings via Telegram notification. Flying blind on their own appointment schedule from inside the product. | HIGH | **DONE** 2026-03-28 (`/dashboard/bookings` route + `BookingsView.tsx`: stats strip, upcoming cards with status pills + calendar links, past table, empty state; nav item `calendar-check` in Group 3 `trialLocked`) |
| D71 | **BUG — fake-control** | `buildCapabilityFlags().hasTransfer` only checks `forwarding_number` (no plan gate), but `buildAgentTools()` also requires `plan.transferEnabled`. Core/Lite plan users with a forwarding number configured see "Transfer calls: ✅ Configured" in home CapabilitiesCard, but the tool never fires (Core/Lite have `transferEnabled: false`). Settings `CapabilitiesCard` was already correct (uses `getPlanEntitlements()`). Fix: post-process `capabilities.hasTransfer = false` in home route when plan doesn't include transfer, matching the existing `hasKnowledge` correction pattern. | MEDIUM | **DONE** 2026-03-28 (`home/route.ts` — import `getPlanEntitlements`, add plan check after `hasKnowledge` correction lines 207-208) |
| D72 | **UX — minor** | Settings `CapabilitiesCard` (`settings/CapabilitiesCard.tsx:58-60`) shows `knowledge` as `active` when `knowledge_backend='pgvector'` but zero approved chunks exist. The home route correctly post-processes this (lines 207-208), but settings card uses raw client object. Low impact — user would see accurate chunk count on the Knowledge tab. | LOW | NOT STARTED |
| D73 | **REFACTOR** | `buildCapabilityFlags()` now has plan-awareness (2026-03-29) — the D71 band-aid in `home/route.ts` has been removed. Tests updated in `build-capability-flags.test.ts`: `base()` now uses PRO plan, 12 new plan-gate tests added covering LITE/CORE/PRO/trial for all 4 gated capabilities. | MEDIUM | **DONE** 2026-03-29 (`src/lib/capability-flags.ts`, `home/route.ts`, `build-capability-flags.test.ts`) |
| D74 | **REFACTOR PLAN — next session** | `business_facts` column is stored as `text` (newline-joined string) but logically is `text[]`. Migration plan: (1) `ALTER TABLE clients ALTER COLUMN business_facts TYPE text[] USING string_to_array(trim(business_facts), E'\n')` via Supabase MCP, (2) regenerate `database.types.ts`, (3) update `ClientRow.business_facts`, `BusinessConfig.businessFacts`, `KnowledgeSummary.fullBusinessFacts` types to `string[] \| null`, (4) update `extractFactsFromText` in `knowledge-summary.ts` to accept array directly, (5) update `prepareFactChunks` in `embeddings.ts`, (6) update `settings-schema.ts` to `z.array(z.string())`, (7) update `KnowledgeSourcesTile.tsx` save path (remove `.join('\n')`), (8) update `provision/trial/route.ts` (remove `.join('\n')`, send array directly), (9) update 6 test files. **Do in a dedicated session. Run `npm run build` after each file group.** | MEDIUM | NOT STARTED |
| D75 | **FEATURE — AgentContextPreviewTile** | New home dashboard tile: "What your agent knows right now" — shows a live preview of what `buildAgentContext()` would inject on the next call. Fields to show: hours status (weekday/weekend formatted), business facts count + first 2 facts preview, FAQ count, today's note (`injected_note`) if set, knowledge base (chunk count). Read-only, no edits. Component: `src/components/dashboard/home/AgentContextPreviewTile.tsx`. Wire into `PaidReadySection` + `PaidAwaitingSection` after `CallHandlingTile`. Data already available via `HomeData`. No new API calls needed. | MEDIUM | NOT STARTED |

---

## Dashboard Control Center Initiative (Paid Dashboard UX — 2026-03-28)

Spec: `.claude/commands/dashboard-control-build.md` | Audit: `.claude/commands/dashboard-control-audit.md`

| Phase | Name | What | Gate | Status |
|-------|------|------|------|--------|
| DCC-1 | GBP + Business Facts Surfacing | `KnowledgeSourcesTile` — GBP summary (star/photo/review), per-line `business_facts` editor, "what your agent says" preview. Home API selects GBP fields. Wired into PaidReadySection + PaidAwaitingSection. | Build ✅ green, 7 files | **DONE** 2026-03-28 (uncommitted — commit first next session) |
| DCC-2 | CallHandlingTile Mode Label | Add `call_handling_mode` pill at top of tile: `voicemail_replacement`→"Smart Voicemail", `receptionist`→"Receptionist", `full_service`→"Receptionist + Booking", `null`→"Basic Answering". Large pill badge (bg=primary/10, text=primary). MODE_MAP + modeLabel/modeDesc logic. "Change →" CTA links to `/dashboard/settings?tab=general`. | D70 resolved: DB_PLUS_PROMPT triggersSync — CTA links, no inline patch. Build ✅ green. | **DONE** 2026-03-28 |
| DCC-3 | NicheInsightsTile | Niche-aware config nudges per `clients.niche` (real_estate, auto_glass, restaurant, generic fallback). Check done-state from capabilities + knowledge. Tile returns null when all done. Wired into PaidReadySection (section 11) + PaidAwaitingSection (sm:col-span-2 full-width). | Build ✅ green after wiring. | **DONE** 2026-03-28 |

**Verification gates (run after each phase before committing):**
- `npm run build` — 0 errors, 0 warnings
- Visually confirm tile renders in PaidReadySection AND PaidAwaitingSection
- Confirm empty state renders correctly when no GBP data / no `call_handling_mode` set
- No new `console.log` in changed files

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
| S12 Ph3c | Trial dashboard experience (tour + WebRTC + gating) | Slices 2a-2d/4/5 DONE, 2e-2f remaining |
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
         D1-D18/D25-D29, FND, L5 (transcript→gap pipeline),
         Slice 2a-2d, 4, 5, 8a-8d, 8g, 8h,
         BILLING Ph1-6 (pricing model, entitlements, tool gating, minute enforcement,
           plan-aware UI, billing mgmt, Stripe webhook, cancel_at migration),
         D49 (already resolved in code — confirmed by Phase 0 audit),
         D50 (already resolved in code — MobileNav.tsx with hamburger + accordion, confirmed 2026-03-24),
         PHASE0-P0 (voices/assign plan gating bypass — 2026-03-24),
         PHASE0-P1c (CapabilitiesCard false-active badges — 2026-03-24),
         PHASE0-P2b (empty-tools wipe guard in inbound — 2026-03-24),
         PHASE0-P1a (GodModeCard serialization — 2026-03-24),
         PHASE0-P1b (SmsTab serialization — 2026-03-24),
         DB-MIG (weekly_digest_enabled migration — applied 2026-03-24),
         SLICE-2e (inline mini-editors: voice preview + hours panel + quick FAQ add — 2026-03-24),
         SLICE-2f (website scrape nudge in AgentKnowledgeCard — 2026-03-24),
         D52 (standard regen queries client_services — 2026-03-28),
         D54+D55 (settings default tab + ?tab=agent alias — 2026-03-28),
         D58+D59 (Alerts tab ungated + notifications deep-link — 2026-03-28),
         D60 (booking confirmation SMS — 2026-03-28),
         D61 (SMS opt-out list for owners — 2026-03-28),
         D63 (sms_logs tracking for booking confirmation — 2026-03-28),
         D64 (bookings dashboard /dashboard/bookings — 2026-03-28),
         SLICE-8m (failure-to-refine pipeline — 2026-03-28),
         SLICE-8o (frustration/interruption metrics — 2026-03-28),
         D71 (hasTransfer fake-control in home route — 2026-03-28),
         D67 (isFirstVisit branch unified with CapabilitiesCard — 2026-03-29),
         D53 (agent_mode ↔ call_handling_mode drift note in AgentModeCard — 2026-03-29)

NEXT:
  STRIPE-PORTAL -> Configure Stripe Customer Portal (manual — Dashboard step)
  D44           -> Google OAuth for trial users (no login path if email undelivered — no domain yet)
  GATE-1        -> Domain migration (BLOCKED on domain purchase)

DEFERRED -> S11, S12 advanced, S13 LOW, S16a-d (recording consent + SMS consent + PIPEDA — not a priority), S17-S20
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

### PROMPT 3 — Domain Migration (GATE-1 — S15)
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
