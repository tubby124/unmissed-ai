# Refactor Phase Tracker (Active)

> Completed phases + full DONE history: `docs/refactor-completed-phases.md`
> Master operator prompt: `docs/unmissed-master-operator-prompt.md`
> Last cleaned: 2026-03-31

## Cross-Phase Gates (apply to EVERY phase)
- **Sonar Pro Fact-Check:** Run 2-3 Perplexity Sonar Pro queries before and after implementation.
- **Research-First Rule:** Read existing research doc first. If none, run Sonar Pro BEFORE writing code.
- **Conflicting Research:** Flag conflicts to user before proceeding.

---

## P0-LAUNCH-GATE (remaining items only)

### GATE-1 — Auth + Email Deliverability (BLOCKED on domain purchase)
| Item | Status |
|------|--------|
| S15-PRE1-7 | NOT STARTED — domain purchase + DNS + external configs |
| S15-ENV1-4 | NOT STARTED — Railway env var updates after domain |
| S15-CODE1-11 | NOT STARTED — brand text + legal pages + SEO metadata |
| S12-V15 | NOT STARTED — email deliverability E2E |
| S12-LOGIN1 | BLOCKED on S15-PRE3 |
| S12-V22 | NOT STARTED — Supabase email template branding |

### GATE-2 — Remaining Items
| Item | Status |
|------|--------|
| S13-REC2 | NOT STARTED — backfill recording_url from full URLs to paths |
| S16a | NOT STARTED — call recording consent disclosure |

> GATE-3: PASS | GATE-4: PASS | GATE-5: PASS

---

## Execution Order

```
DONE through D221 — see docs/refactor-completed-phases.md
  Notable recent: D160 wow-first, D168 first_call_at, D178 gotcha ban,
  D180 mode section fix, D183/D184 PRIMARY GOAL + voicemail routing,
  D192/D196 SMS follow-ups, D207/D211 pricing names + copy, D221 drift-check cron.

NEXT (in priority order):

  [CRITICAL — verify before shipping anything]
  D231 → Commit all untracked files — drift-check, staff-roster, knowledge routes, shell components, 6 migrations NEVER committed → Railway has none of them (CRITICAL — prerequisite for D221/D114/D156/D225-D228 to work in prod)
  D216 → Verify 4 March 30 migrations applied to live DB (lead_status, conflicts, staff_roster)
  D232 → Verify `last_agent_sync_status` column exists on `clients` table — drift-check writes to it; no migration file; cron throws on every run if missing (CRITICAL)
  D233 → Verify `CRON_SECRET` env var set in Railway — all 10 cron jobs silently fail without it (CRITICAL — ops)
  D234 → Deploy unmissed-demo — SYSTEM_PROMPT.txt + domain-knowledge.md modified but never committed; Zara demo agent running stale prompt (HIGH)

  [Trial activation — do before marketing push]
  D171 → Wow-first template update — buildPromptFromIntake() + PROMPT_TEMPLATE + deploy_prompt.py (MEDIUM)
  D172 → Forwarding confirmation check — surface "still waiting" vs "confirmed" state (MEDIUM)
  D174 → Email notifications — wire immediately after domain purchase (HIGH — BLOCKED GATE-1)
  D175 → Calls page empty state CTA pointing to forwarding guide (LOW)

  [Post-call conversion — HIGH ROI]
  D193-PROMPT → Add callback preference question to agent prompt (HIGH — backend done, prompt pending)
  D219 → Missed call auto-SMS — short call + no info captured → "we missed you" SMS (HIGH)
  D220 → Lead queue / callback tracking view (HIGH)
  D229 → "Call back now" button on call rows (HIGH)

  [Dashboard UX]
  D189 → Unify trial/paid dashboard — locked features show preview not blank (HIGH)
  D190 → Feature unlock CTAs — click-to-configure, not buried (HIGH)
  D218 → Minutes usage warning banner at 75%/90% (HIGH)
  D230 → Activation smoke test after upgrade (HIGH)
  D213 → Per-section prompt editor UI (HIGH — backend already done)
  D186 → Mode capability preview in dashboard (HIGH)
  D222 → Trial mid-point nudge (day 3-4, no Telegram/forwarding yet) (MEDIUM)
  D223 → Agent health indicator on home (MEDIUM)
  D191 → Capabilities grid quick-actions (MEDIUM)
  D185 → Mode-first onboarding — skip irrelevant steps per mode (MEDIUM)
  D187 → Mode-aware capabilities grid badges (MEDIUM)

  [Untracked code — needs wiring]
  D225 → Wire /api/dashboard/telegram-link to Telegram setup card (MEDIUM)
  D226 → Wire /api/onboard/parse-services to onboarding service input (MEDIUM)
  D227 → Wire knowledge/conflicts + docs + preview-question to Knowledge page (MEDIUM)
  D228 → Wire AgentReadinessRow.tsx to UnifiedHomeSection (MEDIUM)

  [Pricing & messaging]
  D208 → Implement feature-to-tier messaging across all surfaces (HIGH)
  D212 → Upgrade CTA copy — use product tier names not plan names (MEDIUM)
  D209 → Minute allocation audit — 100 min Lite may be too low (MEDIUM)
  D210 → Post-call SMS plan assignment decision (MEDIUM)

  [Missing capabilities — HIGH value]
  D206 → Live quote lookup for Windshield Hub — price range toggle (HIGH)
  D200 → Appointment reminder outbound SMS — day-before cron (HIGH)

  [SECURITY]
  D124 → Fix QWERTY123 default password → magic link (DEFERRED — no email platform)

  [Lower priority / manual]
  D56  → Transfer recovery smoke test (manual) (MEDIUM)
  D198 → hasan-sharif local SYSTEM_PROMPT.txt drift — run /prompt-deploy to fix (MEDIUM)
  D194 → Structured Telegram lead card (MEDIUM)
  D195 → Knowledge gap action digest — weekly Telegram summary (MEDIUM)
  D199 → Real-time call monitoring / whisper (MEDIUM)
  D201 → CRM push webhook (MEDIUM)
  D203 → Agent performance analytics page (MEDIUM)
  D235 → D157 Phase 1 quick fix — 3-line reseed gate removal in reseedKnowledgeFromSettings() eliminates silent divergence between pgvector chunks and JSON column data (MEDIUM)
  D215 → windshield-hub promptfoo spam test fix (LOW)
  D224 → Call history CSV export (LOW)
  D98  → VIP contacts outbound path (LOW)
  STRIPE-PORTAL → Configure Stripe Customer Portal (manual — Stripe Dashboard)
  GATE-1 → Domain migration (BLOCKED on domain purchase)

  [PENDING DEPLOY]
  ⚠️  urban-vibe — DO NOT deploy until after test call confirms voicemail builder output.
      Will get COMPLETELY NEW prompt from buildVoicemailPrompt(). Verify first.
```

---

## Active Discovery Items (open only)

### Deployment & Git Hygiene — CRITICAL (discovered 2026-03-31)
> Root finding: ALL `??` untracked files in git status have NEVER been committed. They don't exist in Railway production. Multiple "DONE" items (D114, D156, D221, D225-D228) are locally implemented but silently not running.

| # | Type | Fix | Priority |
|---|------|-----|----------|
| D231 | CRITICAL | **Commit all untracked working files** — Files never committed = not in Railway. Untracked list: `/api/cron/drift-check/` (D221 "done" but 404 on every cron run), `lib/staff-roster.ts` + `StaffRosterCard.tsx` (D114 "done" but never deployed), `/api/dashboard/knowledge/suggest-from-summary/` (D156), `/api/dashboard/knowledge/conflicts/`, `/api/dashboard/knowledge/docs/`, `/api/dashboard/knowledge/top-queries/`, `/api/dashboard/preview-question/` (D133), `/api/dashboard/telegram-link/` (D225), `/api/onboard/parse-services/` (D226), `AgentReadinessRow.tsx` + `ShareNumberCard.tsx` + `SoftTestGateCard.tsx` + `DocumentList.tsx` (D227/D228), all 6 migration SQL files, `docs/architecture/knowledge-three-store-consolidation.md`. Commit all in one pass. | CRITICAL |
| D232 | CRITICAL | **Verify `last_agent_sync_status` column on `clients`** — `drift-check/route.ts` writes `last_agent_sync_status` on every run. No migration file exists for this column. If missing, the cron throws on every execution. Check: `SELECT column_name FROM information_schema.columns WHERE table_name='clients' AND column_name='last_agent_sync_status'`. Create migration if absent. | CRITICAL |
| D233 | OPS | **Verify `CRON_SECRET` env var in Railway** — All 10 scheduled cron jobs auth with `Bearer $CRON_SECRET`. If unset, every cron (drift-check, analyze-calls, daily-digest, reset-minutes, trial-expiry, follow-up-reminders, etc.) silently returns 401 on every schedule. Check Railway dashboard env vars. | CRITICAL |
| D234 | DEPLOY | **Deploy unmissed-demo prompt** — `clients/unmissed-demo/SYSTEM_PROMPT.txt` + `domain-knowledge.md` modified but never committed. Zara demo agent is running the stale version. Run `/prompt-deploy unmissed-demo` after D231 commit. | HIGH |
| D235 | QUICK | **D157 Phase 1 reseed gate removal** — `reseedKnowledgeFromSettings()` has a guard that skips reseeding when knowledge_chunks already exist (to avoid duplication). But this means updated `business_facts`/`extra_qa` don't propagate to pgvector until next full wipe. 3-line change in `lib/embeddings.ts`: always delete `settings_edit` source chunks before re-embedding, not just on first seed. Architecture doc at `docs/architecture/knowledge-three-store-consolidation.md`. | MEDIUM |

### Infrastructure & Ops
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D216 | CRITICAL | **Verify 4 March 30 migrations applied to live DB** — `add_lead_status_to_call_logs`, `add_lead_status_to_campaign_leads`, `add_conflicts_to_compiler_runs`, `add_staff_roster` were never committed (untracked in git). Status in Supabase unknown. Any code referencing `lead_status`, `conflicts` on `compiler_runs`, or `staff_roster` column may fail at runtime. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='call_logs' AND column_name='lead_status'`. Apply if missing. | CRITICAL |
| D218 | FEATURE | **Minutes usage warning banner** — At 75%+ of monthly minute limit, show dashboard banner: "You've used X% of your [limit] monthly minutes. [Upgrade or buy more]." At 90%+ urgent variant. Data already in home API (`secondsUsedThisMonth`, `effectiveMinuteLimit`). | HIGH |
| D230 | FEATURE | **Activation smoke test** — When `activateClient()` runs after upgrade, auto-trigger a 10-second WebRTC test call to verify agent answers. If fails, send Telegram alert to operator. Zero automated verification today. | HIGH |
| D222 | UX | **Trial mid-point nudge** — Day 3-4 of 7 trial, no Telegram/forwarding set up → nudge banner: "Day 3 of your trial — connect Telegram to get live call alerts." Condition: `isTrial && daysRemaining < 5 && daysRemaining > 2 && !hasTelegramAlerts`. | MEDIUM |
| D223 | UX | **Agent health indicator on home** — `last_agent_sync_status='error'` → amber "Agent config needs sync" with settings link. Already stored by drift-check cron (D221). Just needs surfacing in home API + UI. | MEDIUM |

### Untracked Code — Needs Wiring
> These routes/components are fully implemented but not connected to any UI surface.

| # | Type | Fix | Priority |
|---|------|-----|----------|
| D225 | WIRE | **Wire `/api/dashboard/telegram-link`** — Route creates/refreshes token + deep link. Not called from any frontend. Replace hardcoded deep-link in Telegram setup card. | MEDIUM |
| D226 | WIRE | **Wire `/api/onboard/parse-services`** — Haiku parses freeform service description → structured array. Not wired. Wire in `step3-capabilities.tsx` or `step4.tsx`. | MEDIUM |
| D227 | WIRE | **Wire knowledge/conflicts + docs + preview-question** — (1) `knowledge/conflicts` → ConflictsPanel in KnowledgePageView. (2) `knowledge/docs` → DocumentList.tsx (untracked shell). (3) `preview-question` → "Test a question" input on Knowledge page. All 3 routes fully implemented. | MEDIUM |
| D228 | WIRE | **Wire AgentReadinessRow.tsx** — 5-dimension readiness strip (Hours, Services, FAQs, Calendar, Knowledge) exists at `src/components/dashboard/home/AgentReadinessRow.tsx`, not rendered anywhere. Place in `UnifiedHomeSection.tsx` after banners. Also verify + wire `ShareNumberCard.tsx` and `SoftTestGateCard.tsx`. | MEDIUM |
| D229 | FEATURE | **"Call back now" button on call rows** — HOT/WARM lead row → "Call back →" → POST `/api/dashboard/test-call` with caller's `toPhone`. Owner clicks → their phone rings → connected via agent bridge. Route already supports `toPhone` param. | HIGH |

### Lead Management & Callback Tracking
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D220 | FEATURE | **Lead queue / callback tracking view** — Dedicated "To-do" tab or card: HOT/WARM leads sorted by recency, grouped by callback preference. "Mark called back" sets `lead_status='called_back'`. Count badge on home: "3 leads to follow up." Requires D216 migration verified. | HIGH |
| D219 | FEATURE | **Missed call auto-SMS** — Call completes with `classification='JUNK'` or <10s duration + phone known → auto-send "We missed your call — call us back." Rate-limit: 1/phone/24h. Different from D192 (fires on info-captured calls). | HIGH |
| D224 | FEATURE | **Call history CSV export** — `GET /api/dashboard/calls/export?format=csv`. Low effort — data already fetched for calls list. | LOW |

### Trial & Activation UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D171 | UX | **Prompt template wow-first update** — `buildPromptFromIntake()` + `PROMPT_TEMPLATE_INBOUND.md` + `PROVISIONING/app/prompt_builder.py` still generate old passive "how can I help?" openings. Update OPENING + TRIAGE sections. Keep `deploy_prompt.py` in sync per `memory/feedback-deploy-tool-parity.md`. | MEDIUM |
| D172 | GAP | **No forwarding confirmation** — After client sets up call forwarding, zero in-app signal it worked. Query recent `call_logs` for calls to `twilio_number` → surface green confirmation or "still waiting." | MEDIUM |
| D174 | GAP | **Zero email notifications without Telegram** — `email_notifications_enabled` exists in DB but Resend is sandbox-only. First thing to wire after domain purchase (GATE-1). | HIGH (BLOCKED GATE-1) |
| D175 | UX | **Calls page empty state** — `/dashboard/calls` shows blank table at 0 calls. Add empty state CTA pointing to forwarding guide. | LOW |
| D170 | FEATURE | **Inbound SMS reply thread visibility** — Replies to agent SMS silently dropped. `sms_logs` already has `direction` field. | MEDIUM |

### Dashboard UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D189 | UX | **Unify trial/paid dashboard** — Trial hides IVR, SMS toggle, Telegram, etc. One view for both — locked features show "Locked — upgrade to activate" preview. Free-to-configure features (Telegram, IVR) accessible immediately for trial. | HIGH |
| D190 | UX | **Feature unlock CTAs** — Locked feature click → modal: what it does + one button (configure immediately if free, upgrade if paid). No buried settings menus. | HIGH |
| D191 | UX | **Capabilities grid quick-actions** — 🔴 Inactive → "Set up" or "Upgrade" modal. 🟢 Active → "Configure" or "Test it." Inactive → active in under 30 seconds. | MEDIUM |
| D179 | A11Y | **HomeSideSheet empty dialog in DOM** — `role="dialog"` renders with empty `<h2>` on every load. Add `aria-hidden="true"` when closed or conditionally render. | LOW |
| D27 | GAP | No feedback loop for call-time injection fields — consider "preview what agent knows" tile. | LOW |
| D56 | VERIFY | Transfer recovery never live-tested. Smoke test: real call to unanswered forwarding number. | MEDIUM |
| D80 | UX | `info_hub` / restaurant mode onboards with empty `context_data`. Add menu input nudge. | LOW |
| D84 | GAP | No UI visibility of call stage transitions. | LOW |

### Agent Goal Architecture
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D185 | UX | **Mode-first onboarding** — `message_only` → skip FAQ, knowledge scrape, service catalog steps. See `memory/agent-goal-architecture.md`. | MEDIUM |
| D186 | UX | **Mode capability preview in dashboard** — Mode selector shows what agent WILL/WON'T do in each mode. Live preview as mode changes. Three tiers: AI Voicemail / Smart Receptionist / Receptionist + Booking. | HIGH |
| D187 | UX | **Mode-aware capabilities grid** — Badge labels + tooltips change per mode. "In AI Voicemail mode: SMS sends confirmation text when message captured." | MEDIUM |

### Per-Section Prompt Editor
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D213 | FEATURE | **Per-section prompt editor UI** — Backend done: `replacePromptSection()` + `PATCH /api/dashboard/settings` with `section_id + content`. Missing: UI that renders each section (OPENING, TRIAGE, CALL HANDLING MODE, INFO COLLECTION, AFTER HOURS, ESCALATION, EDGE CASES) as expandable edit blocks with Save + Reset to default. | HIGH |

### Post-Call Automation & Conversion
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D193-PROMPT | UX | **Callback time preference — prompt update** — DB column + completed webhook handling done. Prompt still doesn't ask "morning or afternoon?" Add to CLOSING section + `/prompt-deploy` each client. | HIGH |
| D194 | FEATURE | **Structured Telegram lead card** — Replace text-heavy alert with: Lead tier → Service → Key info → Callback preference → Reply buttons (✅ Called back / ❌ No answer). | MEDIUM |
| D195 | FEATURE | **Knowledge gap action digest** — Weekly Telegram/email: "Your agent couldn't answer X questions last week: [list]." Pulls from `knowledge_query_log` where `result_count=0`. | MEDIUM |

### Onboarding UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D124 | SECURITY | `QWERTY123` hardcoded as default password — DEFERRED (no email platform yet). | HIGH |
| D176 | BUG | **GBP hours 24h format** — Google Places API returns `8am–17pm`. Convert to 12h at import in `step1-gbp.tsx`. | LOW |
| D177 | UX | **GBP website URL UTM params** — Strip to base URL (`new URL(url).origin + pathname`) at import. | LOW |

### Missing Capabilities
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D206 | GAP | **Live quote lookup — Windshield Hub** — Price range from knowledge base ("$250-400 for most sedans"). Owner toggle: "Allow price ranges." Converts "I'll have Sabbir call you" → "here's a ballpark, want to book?" | HIGH |
| D200 | GAP | **Appointment reminder outbound SMS** — Day-before cron reminder. Requires `bookings` table + cron. #1 no-show reducer. | HIGH |
| D198 | GAP | **hasan-sharif local SYSTEM_PROMPT.txt drift** — `.txt` missing CALENDAR BOOKING FLOW but DB has `booking_enabled=true`. Run `/prompt-deploy hasan-sharif` to fix. | MEDIUM |
| D199 | GAP | **Real-time call monitoring** — Owner can't listen live. Twilio `<Conference>` monitoring. Route: `/api/dashboard/monitor-call`. | MEDIUM |
| D201 | GAP | **CRM push webhook** — After every call, push structured lead data to configurable webhook URL (HubSpot, Zapier, etc.). | MEDIUM |
| D203 | GAP | **Agent performance analytics** — % calls with info captured, hang-up rate, avg duration. `/dashboard/analytics` page. | MEDIUM |
| D202 | GAP | **Cross-call transcript search** — Full-text search on `call_logs.ai_summary`. Search box on calls page. | LOW |
| D204 | GAP | **A/B prompt testing** — Toggle variant A/B per call. Track `prompt_variant` in `call_logs`. | LOW |
| D205 | GAP | **Multi-language detection** — Detect non-English opening → transfer or SMS. `languageHint` hardcoded `'en'`. | LOW |

### Pricing & Messaging Alignment
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D208 | STRATEGY | **Implement feature-to-tier messaging across all surfaces** — Canonical doc done in `memory/pricing-strategy.md`. Remaining: pricing page, onboarding mode selector, dashboard billing card, upgrade CTA components. Lead with: "Your agent gets smarter every week. Automatically." | HIGH |
| D212 | STRATEGY | **Upgrade CTA copy alignment** — Use product tier names everywhere: "Upgrade to Smart Receptionist" not "Upgrade to Core Plan." One-line change per upgrade CTA component. | MEDIUM |
| D209 | STRATEGY | **Minute allocation audit** — 100 min Lite = ~6-7 calls/month. Consider: Lite → 200 min, Core → 600 min, Pro → 1500 min. Decision needed before marketing push. | MEDIUM |
| D210 | STRATEGY | **Post-call SMS plan assignment** — Decide which plans get auto-trigger (recommend: all plans). | MEDIUM |

### Features (deferred, low priority)
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D98 | GAP | VIP contacts siloed from outbound dialing — no "dial this VIP" button. | LOW |
| D215 | BUG | windshield-hub promptfoo spam/solicitor test — add explicit solicitor rejection line to EDGE CASES. | LOW |
| D33 | PATTERN | Multi-field prompt patch order: identity→voice→operational with validatePrompt() per step. | LOW |
| D34 | FEATURE | Call sentiment deep metrics — frustration/interruption/silence/satisfaction. | MEDIUM |
| D35 | FEATURE | AI-assisted prompt improvement from failure patterns. | MEDIUM |
| D36 | FEATURE | Weekly failure digest cron. | LOW |
| D37 | FEATURE | Agent personality coherence warning after 5+ patches. | LOW |
| D39 | FEATURE | Demo GA4 events (`demo_start`, `demo_complete`, `demo_agent_selected`). | MEDIUM |
| D40 | FEATURE | Demo follow-up email via Brevo. BLOCKED on domain. | MEDIUM |
| D41 | FEATURE | Demo-to-Brevo contact sync for nurture list. | LOW |
| D42 | UX | "Not {name}?" link for returning demo visitors. | LOW |
| D30 | OPT | Realtime re-render storms — debounce/batch 100-250ms for high-volume clients. | LOW |
| D31 | OPT | Unbounded state arrays — `.slice(0, MAX)` after prepend or virtual scroll. | LOW |

### Slice 8 Intelligence UX (all LOW, not started)
| # | Name |
|---|------|
| 8e | Prompt-Aware Suggestions |
| 8f | Change Impact Preview |
| 8i | Settings Search/Filter |
| 8j | Intent Confidence / Containment Rate |
| 8k | Cost-Per-Call Dashboard Widget |
| 8l | A/B Prompt Testing |
| 8n | Conversation Flow Visualization |
| 8p | Prompt Coherence Guard |
| 8q | Live Call Duration Timer |

---

## Pending Phases

| Phase | Summary | Status |
|-------|---------|--------|
| S12 Slice 1 | Prompt Variable Injection (PROMPT-TEST1+2) | NOT STARTED |
| S12 Slice 3 | Scrape Verify + Harden (SCRAPE10 remaining) | NOT STARTED |
| S12 Ph2 | Setup wizards (Telegram, SMS, Calendar, Knowledge, Forwarding) | NOT STARTED |
| S12 Ph2b | Calendar & call routing UX overhaul | NOT STARTED |
| S12 Ph2c | IVR multi-route call handling | DEFERRED |
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

## Ready-to-Execute Prompts

### PROMPT — Call Recording Consent Disclosure (GATE-2 — S16a)
**Priority:** HIGH — last remaining GATE-2 item
```
Add call recording consent disclosure to all voice agent system prompts.
1. Read memory/glm46-prompting-rules.md (MANDATORY before any prompt edit)
2. Read current system_prompt for each active client from Supabase
3. Add natural disclosure line in GREETING/OPENING section — one sentence, conversational
4. Run validatePrompt() check — no prompt exceeds 12K chars
5. Deploy each with /prompt-deploy [client]
6. Do NOT change any other part of the prompts
```

### PROMPT — Domain Migration (GATE-1 — S15) — BLOCKED
```
Update lib/app-url.ts, Railway env vars, Supabase settings, Resend domain,
Twilio webhook URLs, Ultravox webhook URL, all brand text references. Full E2E test after.
```
