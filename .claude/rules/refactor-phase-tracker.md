# Refactor Phase Tracker (Active)

> Completed phases + full DONE history: `docs/refactor-completed-phases.md`
> Master operator prompt: `docs/unmissed-master-operator-prompt.md`
> Last cleaned: 2026-03-31

## Cross-Phase Gates (apply to EVERY phase)
- **Sonar Pro Fact-Check:** Run 2-3 Perplexity Sonar Pro queries before and after implementation.
- **Research-First Rule:** Read existing research doc first. If none, run Sonar Pro BEFORE writing code.
- **Conflicting Research:** Flag conflicts to user before proceeding.
- **Handoff Before Compact:** Write handoff after ~15 tool calls. NEVER wait for compaction.
- **Obsidian Tracking:** Update D-item tracker notes on start (`in-progress`) and completion (`done`).
- **No Redeployment:** Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, urban-vibe. New architecture = new clients only.

---

## P0 — April 14 Pivot (Trust Fixes + Concierge $29/mo)
> **Do these before resuming Phase 7+.** Pivot context: `memory/project_april14_pivot.md` | Full audit: `CALLINGAGENTS/Product/April-14-Audit-Pivot.md`
> **Rule:** No new features until these are done or explicitly deferred. Manual concierge onboarding at $29/mo is the path to first revenue.
> **Note:** D291 (GBP auto-import) is superseded by D380 until concierge model is validated.

| # | Summary | Priority | Status |
|---|---------|----------|--------|
| D375 | **Fix Zara WebRTC context** — Zara says "I called you" instead of knowing she's a browser widget. Hard-baked callback number. Read `memory/zara-demo-agent.md` first. | CRITICAL | ✅ 2026-04-15 — DEMO MODE injected into {{callerContext}}; synthetic +15555550100 replaced with 'unknown'; Zara opens correctly as browser widget |
| D376 | **Hide broken config buttons** — Telegram/IVR/Booking/Transfer buttons on dashboard are broken/blank. Dead buttons = trust loss. Remove from DOM until functional. | CRITICAL | ✅ 2026-04-15 — Telegram pill hidden when not connected; IVR/Booking/Transfer pills removed from client nav until functional |
| D377 | **Expose triage box to client dashboard** — Agent Intelligence triage box (urgent/pricing/hours/booking tags) exists but hidden from client view. Just remove the admin-only gate. D243 is the full redesign (Phase 9). | HIGH | ✅ 2026-04-15 — AgentIntelligenceSection was orphaned (never imported); wired into SettingsView for client view |
| D378 | **Fix live call "End" button** — End button on live call monitor does nothing. Wire to Ultravox call termination. | MEDIUM | ✅ 2026-04-15 — End button wired to Ultravox call termination in LiveCallBanner |
| D379 | **Strip landing page to 2-tier pricing** — Remove 3rd tier (it doesn't exist). Solo ($29/mo) + AI Receptionist ($40-50/mo) only. D208 (feature messaging) stays BLOCKED on domain. | HIGH | ✅ 2026-04-15 — Front Desk Pro tier removed; 2-tier pricing live |
| D380 | **Manual concierge onboarding SOP** — Step-by-step doc: collect info → provision Twilio → create client → build prompt → collect $29/mo via Wave/Stripe. Save to `CALLINGAGENTS/Product/Concierge-Onboarding-SOP.md`. | CRITICAL | ✅ 2026-04-15 — SOP + client tracker doc created |

---

## ACTIVE: Prompt Architecture Refactor (6 gated phases)
> **Execution plan:** `docs/architecture/prompt-architecture-execution-plan.md`
> **Revised:** 2026-03-31 — Sonar research + Obsidian tracking + handoff discipline baked in.
> **Updated post-Phase 1:** 19 slots (not 18), outbound_isa_realtor excluded, UI alignment added to Phase 5.
> **D277 REMOVED** — plumber-calgary-nw was built with old system; fixing architecture fixes it.
> **D240-DEPLOY REMOVED** — 4 working clients stay untouched.

| Phase | Items | Gate | Status |
|-------|-------|------|--------|
| 1 — Foundation | D235 + D285 + golden tests + Sonar | Spec exists, 70 tests, D235 + D285 done | **DONE ✅** |
| 2 — Named Slots | D274 + golden expansion to 100+ + Sonar + UI audit | Shadow tests pass, 19 slots, 191 tests, UI audit | **DONE ✅** |
| 3 — Shrink+Clean | D265 + D269 + D272 + D268 + D296 + Sonar | Slot composition live, pgvector-first KB, conditional pricing, 406 tests pass | **DONE ✅** |
| 4 — Gap Wiring | D260 + D281 + D282 + Sonar + FILTER_EXTRA fix | Service/name edits sync to agent, mutation contract updated, 448 tests pass | **DONE ✅** |
| 5 — Agent Knowledge UX | D283a/b/c + D300 + Sonar + contract audit + gap fixes | Variable registry, section regen WIRED, service KB reseed, niche_custom_variables fixed, old-prompt guard, 456 tests | **DONE ✅** (backend complete; D283b/D286/D288/D290 UI deferred) |
| 6 — North Star | D280 + D278 + D303 + D305 + D276 + Sonar | recomposePrompt, Agent Brain, variable edit API, preview mode, booking flow update (D302 prereq ✅) | **Wave 1 DONE ✅** (D280 ✅ D303 ✅ D305-backend ✅ D276 ✅) |

### Phase 6 Execution Order

**Wave 1 — Backend** (no UI skill needed) — **ALL DONE ✅**:
1. ~~**D302**~~ — ✅ DONE. Preserve niche intake fields (provision route).
2. ~~**D280**~~ — ✅ DONE. `recomposePrompt()` + dryRun + shared helpers. 1387 tests pass.
3. ~~**D303**~~ — ✅ DONE. Variable edit API (`PATCH /api/dashboard/variables`).
4. ~~**D305 backend**~~ — ✅ DONE. Dry-run/preview mode + `POST /api/dashboard/variables/preview`.
5. ~~**D276**~~ — ✅ DONE. Booking toggle → regenerate conversation_flow + goal slots.

**Wave 2 — UI Design Wave** (run through `/ui-ux-pro-max`):

*Overview page (5-tier layout — Sonar-validated 2026-03-31):*
- ~~**D278**~~ — ✅ DONE. Overview page redesign: CONFIG-first layout, 3-col hero, call log + bookings 2-col, 8-pill QuickConfigStrip (Telegram/Email/IVR/Voicemail/Auto-text/Booking/Transfer/Routing)
- **D308** — Tab stays "Overview" (not "Agent Brain"). Decision: `CALLINGAGENTS/Decisions/Dashboard-Tab-Naming.md`
- **D306** — Empty states for every card (trial vs paid same layout, data replaces empty states)
- **D266** — Rich call log on Overview (call log + bookings now side-by-side in 2-col grid)
- **D288** — Capability preview (CapabilitiesCard now on Settings overview section; partial)
- **D290** — "What Your Agent Knows" condensed to KB source list on Overview (KnowledgeInlineTile; partial)

*Knowledge page (full redesign — Sonar-validated 2026-03-31):*
- ~~**D309**~~ — ✅ DONE. Knowledge page redesign: 3-col layout, TestCallCard orb in center, health score + drawer pattern + inline edit/delete + bulk AI answers
- ~~**D310**~~ — ✅ DONE. Knowledge Health Score: weighted formula with niche-specific targets

*Calls & Leads page (2026-04-01):*
- ✅ DONE. 3-col grid: AgentConfigCard (2-col) + TestCallCard orb (1-col). Full-width layout.

*Settings page (2026-04-01):*
- ✅ DONE. Non-admin overview section: Capabilities (2-col) + Orb + Prompt Editor + Notifications (1-col) above tab bar. Agent tab kept for all users.
- **D283b** — PromptVariablesCard (read-only variable display)
- **D305 frontend** — Diff preview UI (current vs proposed)
- **D307** — Recompose warning UX (confirmation + diff before nuke — ships WITH recompose button)
- **D286** — Dashboard settings reorganization

**Rule:** All Wave 2 items must go through `/ui-ux-pro-max` before marking done (per `memory/feedback_ui_ux_pro_max_gate.md`). Design them as a batch against working Wave 1 APIs — no mocking endpoints.

**Key architecture docs (read before building):**
- Overview layout matrix: `CALLINGAGENTS/Architecture/Phase6-Wave2-Dashboard-Matrix.md`
- Knowledge page spec: `CALLINGAGENTS/Architecture/Phase6-Wave2-Knowledge-Page.md`
- Overview 5-tier decision: `CALLINGAGENTS/Decisions/Overview-5-Tier-Layout.md`
- Tab naming decision: `CALLINGAGENTS/Decisions/Dashboard-Tab-Naming.md`

**Also Phase 6:** D287 (niche-adaptive onboarding), D289 (services chips), D301 (locked vars)
**Deferred to post-Phase 6:** D304 (old-client migration) — do AFTER Phase 6 proven on new clients.

### Onboarding UX Overhaul (2026-04-01 audit)
> Full audit: `CALLINGAGENTS/Product/Onboarding Audit 2026-04-01.md`

| # | Summary | Priority | Status |
|---|---------|----------|--------|
| D315 | Niche badge on confirmed GBP card | HIGH | NOT STARTED |
| D316 | Voice preview cards are fake controls | HIGH | NOT STARTED |
| D317 | Placeholder examples hardcoded to auto_glass | HIGH | ✅ 2026-04-03 — REASON_PLACEHOLDERS in step1-gbp.tsx:145, niche-adaptive for all niches |
| D318 | Step 3 bloat — trim to mode selection only | CRITICAL | ✅ 2026-04-01 — Phase 7 collapsed to 3 steps; mode via plan card in step-plan.tsx |
| D319 | Simplify voice picker to Male/Female first | MEDIUM | NOT STARTED |
| D320 | urgencyWords not stored independently | MEDIUM | NOT STARTED |
| D321 | Step 3 + Step 5 duplicate FAQ collection | HIGH | NOT STARTED |
| D322 | Loading orb during GBP lookup | MEDIUM | NOT STARTED |

**Total D-items closed:** 35+ (D235 ✅ D285 ✅ D274 ✅ D265 ✅ D269 ✅ D272 ✅ D268 ✅ D296 ✅ D260 ✅ D281 ✅ D282 ✅ D283a ✅ D283c ✅ D300 ✅ D302 ✅ D280 ✅ D303 ✅ D305-be ✅ D276 ✅ D233 ✅ D241 ✅ D245 ✅ D247 ✅ D249 ✅ D251 ✅ D252 ✅ D254 ✅ D257 ✅ D275 ✅ D283b/D358 ✅ D317 ✅ D318 ✅ D368 ✅ D180 ✅ + D283 partial-done + removed: D240 D277 D228)
**Completed phases archived:** `docs/architecture/prompt-architecture-completed-phases.md`
**Carry-forward findings:** see execution plan Phase 1+2 summary section

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

## Recently Completed (2026-03-31) — moved to docs/refactor-completed-phases.md

D246-D253 (Root Fix wave), D254, D257-D259, D240 partial, D241, D245, D248, D231-D232, D234, D216.
See `memory/project_purpose_driven_agents.md` and `memory/working-agent-patterns.md` for context.

---

## POST-PHASE 6 ROADMAP

> Phase 6 completes the architecture. Everything below plugs into it.
> No waiting required — these unlock the moment Phase 6 ships.

---

### Phase 7 — "2-Minute Agent" (Onboarding Excellence)
> **Goal:** New client → working agent in 2 minutes. Phase 6 built the compose pipeline. Phase 7 makes onboarding leverage it.
> **When:** Immediately after Phase 6. This is the growth unlock.
> **Dependency:** Phase 6 (recomposePrompt, variable API, Agent Brain)

| # | Summary | Priority |
|---|---------|----------|
| D291 | **GBP auto-import** — business name → Apify → auto-populate everything. Flagship "2-minute agent." | CRITICAL |
| D293 | **Paste URL → agent ready** — single-step scrape + compose. UX streamlining of existing pipeline. | HIGH |
| D273 | **Pre-populate from best source** — GBP, website scrape, or manual entry → variable system | HIGH |
| D255 | **Guided context data entry** — fallback form when no website. Prices, policies, urgency words. | HIGH |
| D294 | **Post-activation summary** — "Your Agent Is Live" page. Capabilities, knowledge, test CTA. | HIGH |
| D292 | **Guided call forwarding wizard** — carrier-specific steps + test button. #1 friction point. | HIGH |
| D242 | **Haiku intent inference for niche='other'** — auto-suggest closest niche + PRIMARY GOAL | MEDIUM |
| D185 | **Mode-first onboarding** — skip irrelevant steps per mode (voicemail vs receptionist vs booking) | MEDIUM |
| D304 | **Old-client prompt migration** — add section markers to 4 live clients. Do after Phase 6 proven. | MEDIUM |

---

### Phase 8 — Dashboard Polish + Post-Call ROI
> **Goal:** Make the product feel complete. Convert calls into callbacks.
> **When:** Can run in parallel with Phase 7 — no dependencies between them.
> **Dependency:** None (independent features)

| # | Summary | Priority |
|---|---------|----------|
| D230 | **Activation smoke test** — Auto WebRTC test after upgrade, Telegram alert on fail | CRITICAL |
| D219 | **Missed call auto-SMS** — short call + no info → "we missed you" text. 1/phone/24h | HIGH |
| D220 | **Lead queue / callback tracking** — HOT/WARM sorted, "Mark called back", count badge | HIGH |
| D229 | **"Call back now" button** — HOT/WARM row → owner's phone rings → agent bridge | HIGH |
| D189 | **Unify trial/paid dashboard** — locked features show preview, not blank | HIGH |
| D190 | **Feature unlock CTAs** — click → modal with configure/upgrade action | HIGH |
| D218 | **Minutes usage warning** — banner at 75%/90% of limit | HIGH |
| D213 | **Per-section prompt editor UI** — full multi-section (D251 shipped triage only) | HIGH |
| D186 | **Mode capability preview** — 3-tier preview per mode | HIGH |
| D223 | **Agent health indicator** — `last_agent_sync_status='error'` → amber banner | HIGH |
| D261 | **Multi-column layout** — 2-3 columns for calls, contacts, readiness, FAQs | HIGH |
| D262 | **Capability badges → knowledge modal** — click badge → popup showing what agent knows | HIGH |
| D263 | **Agent readiness → proper deep links** — link to exact settings card | HIGH |
| D264 | **PDF upload / website / GBP connect CTAs** — prominent on knowledge + overview | HIGH |
| D193 | **Callback preference question** — "morning or afternoon?" in CLOSING section | HIGH |
| D266 | **Recent calls parity** — Overview vs Calls page use same component/query | MEDIUM |
| D267 | **Business hours click** — inline edit or deep-link to Hours card | MEDIUM |
| D222 | **Trial mid-point nudge** — Day 3-4, no Telegram → nudge banner | MEDIUM |
| D191 | **Capabilities grid quick-actions** — Inactive → "Set up", Active → "Configure" | MEDIUM |
| D187 | **Mode-aware capability badges** — labels change per mode | MEDIUM |

---

### Phase 9 — Agent Intelligence Loop
> **Goal:** Agents get smarter from calls. Close the learning loop.
> **When:** After Phase 7. Needs call data accumulation from real clients.
> **Dependency:** Phase 6 (knowledge surface) + real call volume

| # | Summary | Priority |
|---|---------|----------|
| D243 | **Intent coverage view** — replace badges with intent readiness gaps | HIGH |
| D244 | **Knowledge gap → triage improvement** — 3+ unanswered → suggest FAQ or intent route | HIGH |
| D270 | **Frequent KB query → auto-suggest FAQ** — 3+ same queries → promote to FAQ. Extends D252. | HIGH |
| D279 | **Niche-contextual knowledge editing** — per-niche knowledge schema determines UI categories | HIGH |
| D284 | **Self-improving agent loop** — calls teach the agent. Extends D252+D270+D257. | HIGH |
| D297 | **Agent learning loop UX** — "your agent learned X this week" approve/edit/dismiss | HIGH |
| D195 | **Knowledge gap digest** — weekly Telegram summary of unanswered questions | MEDIUM |
| D203 | **Agent performance analytics** — info capture %, hang-up rate, avg duration | MEDIUM |

---

### Phase 10 — Platform Moat
> **Goal:** System-level intelligence. Each client makes every other client better.
> **When:** After 10+ clients per niche.

| # | Summary | Priority |
|---|---------|----------|
| D298 | **AI Compiler as universal knowledge refinery** — single gateway for all 7 input sources | CRITICAL |
| D299 | **Collective niche intelligence** — 5th dentist gets battle-tested defaults from first 4 | HIGH |
| D295 | **Multi-source knowledge ingestion** — multiple websites, PDF upload, GBP connect from dashboard | HIGH |
| D271 | **PDF/pricing sheet upload → KB** — upload CTA + extract + embed into pgvector | HIGH |
| D206 | **Live quote lookup (Windshield Hub)** — price range from knowledge base | HIGH |
| D201 | **CRM push webhook** — structured lead data to HubSpot/Zapier | MEDIUM |
| D200 | **Appointment reminder SMS** — day-before cron | MEDIUM |
| D202 | **Cross-call transcript search** — full-text on `call_logs.ai_summary` | LOW |
| D224 | **Call history CSV export** — low effort | LOW |

---

### Wiring + Gaps (do alongside any phase)

| # | Summary | Priority |
|---|---------|----------|
| D368 | **Retrieval instruction fails with zero inline facts** — ✅ 2026-04-03 — `hasInlineFacts` param added; empty-facts path now reads "use queryKnowledge for ALL questions" | HIGH |
| D180 | **message_only TRIAGE override** — ✅ 2026-04-03 — guard in `buildConversationFlow()` skips TRIAGE entirely for message_only/voicemail_replacement modes | HIGH |
| D373 | **Onboarding quality floor** — new agents don't sound like Windshield Hub/Hasan/Urban Vibe. NICHE_DEFAULTS need to be bootstrapped from real working-agent patterns, not Haiku guesses | CRITICAL |
| D374 | **Calendar connect → auto-upgrade prompt** — connecting Google Calendar should trigger recomposePrompt() with appointment_booking mode automatically | HIGH |
| D369 | **Legacy prompt banner on dashboard** — amber warning for old-style prompts without section markers. Banner added in SettingsView.tsx (2026-04-01). Full migration = D304. | HIGH |
| D225 | `/api/dashboard/telegram-link` → Telegram setup card | MEDIUM |
| D226 | `/api/onboard/parse-services` → onboarding service input | MEDIUM |
| D227 | `knowledge/conflicts` + `docs` + `preview-question` → Knowledge page | MEDIUM |
| D171 | Wow-first template update — OPENING + TRIAGE still passive | MEDIUM |
| D170 | Inbound SMS reply visibility — replies silently dropped | MEDIUM |
| D172 | Forwarding confirmation — no in-app signal it worked | MEDIUM |
| D175 | Calls page empty state — CTA to forwarding guide | LOW |

### BLOCKED on domain purchase (GATE-1)

| # | Summary |
|---|---------|
| D174 | Email notifications — wire after domain |
| D124 | QWERTY123 default password — needs email platform |
| D40 | Demo follow-up email |
| D208 | Feature-to-tier messaging — pricing page, billing card |
| D212 | Upgrade CTA copy — product tier names |

### Low Priority / Deferred

| # | Summary |
|---|---------|
| D56 | Transfer recovery smoke test (manual) |
| D34 | Call sentiment deep metrics |
| D39 | Demo GA4 events |
| D176/D177 | GBP format fixes (hours 24h→12h, UTM strip) |
| D179 | HomeSideSheet empty dialog a11y |
| D98 | VIP contacts outbound path |
| D215 | windshield-hub promptfoo spam test |
| D30/D31 | Realtime re-render storms + unbounded state arrays |
| D41/D42 | Demo-to-Brevo sync + "Not {name}?" |
| D80 | Restaurant mode empty context_data nudge |
| D199 | Real-time call monitoring — Twilio Conference |
| D209/D210 | Minute allocation audit + post-call SMS plan assignment |
| STRIPE-PORTAL | Configure Stripe Customer Portal (manual) |

### Slice 8 Intelligence UX (all LOW, not started)
8e Prompt-Aware Suggestions · 8f Change Impact Preview · 8i Settings Search/Filter · 8j Intent Confidence · 8k Cost-Per-Call Widget · 8l A/B Prompt Testing · 8n Conversation Flow Viz · 8p Prompt Coherence Guard · 8q Live Call Duration Timer

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

### PENDING DEPLOY
⚠️ urban-vibe — DO NOT deploy until after test call confirms voicemail builder output.
