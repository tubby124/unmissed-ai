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
| 5 — Agent Knowledge UX | D283a/b/c + D286 + D288 + D290 + D300 + Sonar + contract audit | Variable registry, section regen, capabilities, knowledge surface, service KB reseed | **IN PROGRESS** (D283a ✅ D283c ✅ D300 ✅ — D283b/D286/D288/D290 deferred to UI wave) |
| 6 — North Star | D280 + D278 + D276 + D287 + D289 + Sonar | Full recomposePrompt, Agent Brain, niche onboarding (scope reduced — section regen done in Ph5) | NOT STARTED |

**Total D-items to close:** 24 (D235 ✅, D285 ✅, D274 ✅, D265 ✅, D269 ✅, D272 ✅, D268 ✅, D296 ✅, D260 ✅, D281 ✅, D282 ✅, D283a ✅, D283c ✅, D300 ✅, D283b, D286, D288, D290, D280, D278, D276, D287, D289, D291, D292, D293, D294)
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

## NEXT — Priority Order

### 🔴 ARCHITECTURAL: Minimal Prompt + Dynamic Knowledge
> The fundamental shift from monolithic hardcoded prompts to minimal base + dynamic sections + knowledge-base-first.
> Do before any new niche or marketing push.

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D268 | ARCH | **Minimal base prompt + dynamic sections** — ~4-5K char base (safety + identity + voice + flow skeleton). Everything else dynamic based on client config. | CRITICAL |
| D269 | ARCH | **Knowledge base as primary info source** — Move factual business info out of prompt → pgvector. 1-line instruction: "Use queryKnowledge." | CRITICAL |
| D272 | ARCH | **Remove business-logic constraints from prompts** — Only 5 true safety rules hardcoded. Everything else conditional on client config. | CRITICAL |
| D265 | PROMPT | **Remove hardcoded PRODUCT KNOWLEDGE BASE** — Duplicates extra_qa pgvector chunks, bloats prompt 1-2K chars. | CRITICAL |
| D273 | ONBOARD | **Collect what matters for prompt building** — "What questions do callers ask?", pricing sheet, escalation rules. D247 started this. | CRITICAL |
| D275 | BUG | **Voice preset → personality descriptors fake-control** — Preset change patches TONE but not IDENTITY personality line. Classic fake-control. | CRITICAL |
| D260 | GAP | ~~Service catalog → agent runtime disconnect~~ | ✅ DONE (Phase 4) — prompt patched + Ultravox sync. Knowledge reseed gap → D300. |
| D300 | GAP | **Service catalog knowledge reseed** — D260 patches prompt but doesn't reseed pgvector chunks. Service changes invisible to queryKnowledge. | HIGH |
| D278 | ARCH | **"Agent Brain" dashboard** — Centralized view of everything agent knows, organized by niche-relevant categories. Editable inline. | CRITICAL |
| D280 | ARCH | **UI-driven prompt composition** — Users never touch raw prompts. UI fields → prompt sections → Ultravox sync. End state of D268+D274+D278. | CRITICAL |
| D283 | ARCH | **All prompt variables visible + editable** — Every template variable on dashboard as labeled field. Auto-patches + syncs. | CRITICAL |
| D274 | ARCH | ~~System prompt = template with named slots~~ | ✅ DONE |
| D285 | ARCH | ~~Prompt sandwich framework~~ | ✅ DONE |
| D296 | BUG | **FORBIDDEN_EXTRA dead code** — niche intake modifications silently discarded (line 573 reads nicheDefaults not variables). Auto-fixed by slot builder. | CRITICAL |
| D291 | ONBOARD | **GBP auto-import onboarding** — business name → Apify Google Maps → auto-populate everything. First "2-minute agent." | CRITICAL |
| D270 | LOOP | **Frequent KB query → auto-suggest FAQ promotion** — 3+ same queries → suggest FAQ. Extends D252. | HIGH |
| D271 | FEATURE | **PDF/pricing sheet upload → knowledge base** — Upload CTA + extract + embed into pgvector. | HIGH |
| D276 | ARCH | **Calendar/booking auto-updates call flow** — `patchCalendarBlock()` appends section but TRIAGE/FLOW don't adapt. | HIGH |
| D279 | ARCH | **Niche-contextual knowledge editing** — Per-niche knowledge schema determines UI categories. | HIGH |
| D284 | ARCH | **Self-improving agent loop** — Calls teach the agent. Extends D252+D270+D257. | HIGH |
| D292 | ONBOARD | **Guided call forwarding wizard** — carrier-specific steps + test button. #1 friction point. | HIGH |
| D293 | ONBOARD | **"Paste URL → agent ready" streamlined flow** — single-step scrape + approve + build. | HIGH |
| D294 | ONBOARD | **Post-activation "Your Agent Is Live" summary** — capabilities, knowledge, test CTA. | HIGH |
| D295 | FEATURE | **Audio preview of knowledge in action** — edit FAQ, hear agent use it. Greenfield. | MEDIUM |

### 🔴 Dashboard UX + Agent Quality

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D261 | UX | **Multi-column layout** — 2-3 columns for calls, contacts, readiness, FAQs, gaps. | HIGH |
| D262 | UX | **Capability badges → knowledge modal** — Click badge → popup showing what agent knows. | HIGH |
| D263 | UX | **Agent readiness → proper deep links** — Link to exact settings card needing attention. | HIGH |
| D264 | UX | **PDF upload / website / GBP connect CTAs** — Prominent on knowledge page + overview. | HIGH |
| D266 | UX | **Recent calls parity** — Overview vs Calls page use same component/query. | MEDIUM |
| D267 | UX | **Business hours click** — Inline edit or deep-link to Hours card, not generic redirect. | MEDIUM |

### Ops & Investigation

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D233 | OPS | **Verify `CRON_SECRET` in Railway** — All 10 cron jobs silently fail without it. Check manually. | CRITICAL |
| ~~D277~~ | ~~INVESTIGATE~~ | ~~Lag root cause for plumber-calgary-nw~~ — **REMOVED:** architecture fix (D268) solves this structurally. | ~~HIGH~~ |
| D235 | QUICK | **Reseed gate removal** — 3-line fix in `lib/embeddings.ts`: always delete `settings_edit` chunks before re-embedding. | MEDIUM |

### Purpose-Driven Agent (remaining)

| # | Type | Summary | Priority |
|---|------|---------|----------|
| ~~D240-DEPLOY~~ | ~~DEPLOY~~ | ~~Deploy TRIAGE_DEEP to 4 clients~~ — **REMOVED:** 4 working clients stay untouched. New architecture = new clients. | ~~CRITICAL~~ |
| D242 | ONBOARD | **"Top 3 reasons" question** — Feed into D247 intent mapping. | HIGH |
| D243 | DASHBOARD | **Intent coverage view** — Replace capability badges with intent readiness gaps. | HIGH |
| D244 | LOOP | **Knowledge gap → triage improvement** — 3+ unanswered → suggest FAQ or intent route. | MEDIUM |

### Post-Call Conversion (HIGH ROI)

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D193-PROMPT | PROMPT | **Callback preference question** — Add "morning or afternoon?" to CLOSING section. | HIGH |
| D219 | FEATURE | **Missed call auto-SMS** — Short call + no info → "we missed you" text. 1/phone/24h. | HIGH |
| D220 | FEATURE | **Lead queue / callback tracking** — HOT/WARM leads sorted, "Mark called back", count badge. | HIGH |
| D229 | FEATURE | **"Call back now" button** — HOT/WARM row → owner's phone rings → agent bridge. | HIGH |

### Dashboard UX

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D189 | UX | **Unify trial/paid dashboard** — Locked features show preview, not blank. | HIGH |
| D190 | UX | **Feature unlock CTAs** — Click → modal with configure/upgrade action. | HIGH |
| D218 | FEATURE | **Minutes usage warning** — Banner at 75%/90% of limit. | HIGH |
| D230 | FEATURE | **Activation smoke test** — Auto WebRTC test after upgrade, Telegram alert on fail. | CRITICAL |
| D213/D251 | FEATURE | **Per-section prompt editor UI** — Backend done. Need expandable edit blocks with Save + Reset. | HIGH |
| D186 | UX | **Mode capability preview** — 3-tier preview: AI Voicemail / Smart Receptionist / +Booking. | HIGH |
| D222 | UX | **Trial mid-point nudge** — Day 3-4, no Telegram → nudge banner. | MEDIUM |
| D223 | UX | **Agent health indicator** — `last_agent_sync_status='error'` → amber banner. | HIGH |
| D191 | UX | **Capabilities grid quick-actions** — Inactive → "Set up", Active → "Configure". | MEDIUM |
| D185 | UX | **Mode-first onboarding** — Skip irrelevant steps per mode. | MEDIUM |
| D187 | UX | **Mode-aware capability badges** — Labels change per mode. | MEDIUM |

### Untracked Code — Needs Wiring

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D225 | WIRE | `/api/dashboard/telegram-link` → Telegram setup card. | MEDIUM |
| D226 | WIRE | `/api/onboard/parse-services` → onboarding service input. | MEDIUM |
| D227 | WIRE | `knowledge/conflicts` + `docs` + `preview-question` → Knowledge page. | MEDIUM |

### Prompt & Agent Gaps

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D281 | GAP | ~~CLOSE_PERSON not editable post-onboarding~~ | ✅ DONE (Phase 4) — owner_name → patchAgentName(oldFirst, newFirst) + Ultravox sync |
| D282 | GAP | ~~Business name change doesn't patch prompt~~ | ✅ DONE (Phase 4) — was already implemented, mutation contract updated |
| D171 | UX | **Wow-first template update** — OPENING + TRIAGE still passive. Keep deploy_prompt.py in sync. | MEDIUM |
| D198 | GAP | **hasan-sharif SYSTEM_PROMPT.txt drift** — Run `/prompt-deploy hasan-sharif`. | MEDIUM |

### Trial & Activation

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D174 | GAP | **Email notifications** — Wire after domain purchase. BLOCKED GATE-1. | HIGH |
| D172 | GAP | **Forwarding confirmation** — No in-app signal it worked. | MEDIUM |
| D170 | FEATURE | **Inbound SMS reply visibility** — Replies silently dropped. `sms_logs.direction` exists. | MEDIUM |
| D175 | UX | **Calls page empty state** — CTA to forwarding guide. | LOW |
| D124 | SECURITY | **QWERTY123 default password** — DEFERRED (no email platform). | HIGH |

### Pricing & Messaging

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D208 | STRATEGY | **Feature-to-tier messaging** — Pricing page, billing card, upgrade CTAs. | HIGH |
| D212 | STRATEGY | **Upgrade CTA copy** — Product tier names, not plan names. | MEDIUM |
| D209 | STRATEGY | **Minute allocation audit** — 100 min Lite may be too low. | MEDIUM |
| D210 | STRATEGY | **Post-call SMS plan assignment** — Which plans get auto-trigger. | MEDIUM |

### Missing Capabilities

| # | Type | Summary | Priority |
|---|------|---------|----------|
| D206 | GAP | **Live quote lookup — Windshield Hub** — Price range from KB. | HIGH |
| D200 | GAP | **Appointment reminder SMS** — Day-before cron. | HIGH |
| D199 | GAP | **Real-time call monitoring** — Twilio Conference. | MEDIUM |
| D201 | GAP | **CRM push webhook** — Structured lead data to HubSpot/Zapier. | MEDIUM |
| D203 | GAP | **Agent performance analytics** — Info capture %, hang-up rate, avg duration. | MEDIUM |
| D195 | FEATURE | **Knowledge gap digest** — Weekly Telegram summary of unanswered questions. | MEDIUM |
| D202 | GAP | **Cross-call transcript search** — Full-text on `call_logs.ai_summary`. | LOW |
| D224 | FEATURE | **Call history CSV export** — Low effort. | LOW |

### Low Priority / Deferred

| # | Summary | Priority |
|---|---------|----------|
| D56 | Transfer recovery smoke test (manual) | MEDIUM |
| D34 | Call sentiment deep metrics | MEDIUM |
| D39 | Demo GA4 events | MEDIUM |
| D40 | Demo follow-up email (BLOCKED on domain) | MEDIUM |
| D176 | GBP hours 24h→12h format conversion | LOW |
| D177 | GBP website URL strip UTM params | LOW |
| D179 | HomeSideSheet empty dialog a11y | LOW |
| D98 | VIP contacts outbound path | LOW |
| D215 | windshield-hub promptfoo spam test | LOW |
| D30 | Realtime re-render storms debounce | LOW |
| D31 | Unbounded state arrays slice | LOW |
| D41 | Demo-to-Brevo contact sync | LOW |
| D42 | "Not {name}?" returning demo visitors | LOW |
| D80 | restaurant mode empty context_data nudge | LOW |
| STRIPE-PORTAL | Configure Stripe Customer Portal (manual) | LOW |

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
