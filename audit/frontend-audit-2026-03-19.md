# unmissed.ai — Full Frontend Audit & Redesign Plan

**Date:** 2026-03-19
**Audited by:** Claude (Playwright MCP + code review)
**Accounts tested:** admin@unmissed.ai (admin), fix@windshieldhub.ca (client — Windshield Hub)
**Repo:** tubby124/unmissed-ai | **Live:** unmissed-ai-production.up.railway.app

---

## 1. Executive Summary

The unmissed.ai dashboard is functional and visually polished (dark mode, ambient glows, card-based layout). Clients can see calls, leads, and manage their agent. However, the architecture has significant structural problems:

- **SettingsView.tsx is a 3,044-line monolith** handling 6 tabs, all business config, prompt editing, injection, hours, billing, knowledge, voice, alerts, and test calls. Every feature ships slower because of this file.
- **Clients see the raw 14,495-char system prompt** in a textarea. One bad edit breaks their agent. This is the single highest-risk UX problem.
- **Dual-write for hours**: saved to both structured DB columns AND prompt section markers via separate save buttons. This causes data desync.
- **No clear mapping between UI fields and the 6-layer architecture.** Business facts, context data, extra Q&A, section editors, and the raw prompt are all on the same tab with no hierarchy.
- **Booking, Knowledge Base, and Calendar show for all niches**, even when irrelevant (e.g., auto glass shop doesn't need bookings).
- **"Quick Inject" and "Right Now"** are the same feature (`injected_note`) presented with different labels in different sections.
- **Classification timeouts** ("UNKNOWN") leak into the client view with the message "Classification timed out — review manually" — confusing for non-technical users.

The app needs a layered redesign that separates "what your agent knows" (structured config) from "how your agent behaves" (prompt), and gates features by niche capability rather than showing everything with "Coming soon" badges.

---

## 2. Route Map

### Client Routes (Windshield Hub view)

| Route | Sidebar Label | Purpose | Data Read | Data Written |
|-------|--------------|---------|-----------|-------------|
| `/dashboard/calls` | Overview | Call stats + call log with filters | `call_logs`, `clients` (minutes) | None (read-only) |
| `/dashboard/live` | Live | Real-time active call monitor | `call_logs` (status=live) | None |
| `/dashboard/setup` | Agent | 3-step onboarding wizard (Phone/Agent/Context) | `clients` (full row) | `clients` fields via PATCH |
| `/dashboard/advisor` | Advisor | AI chat assistant (Llama 3.3 70B via OpenRouter) | `call_logs` (last N), `clients` | Advisor chat history |
| `/dashboard/leads` | Leads | HOT/WARM leads needing callback | `call_logs` (classified) | Lead status updates |
| `/dashboard/calendar` | Calendar | Bookings made by agent during calls | `bookings` table | None (read-only) |
| `/dashboard/settings` | Settings | 6-tab mega-page (Agent/SMS/Voice/Alerts/Billing/Knowledge) | `clients` (full row), Ultravox voices, corpus docs | `clients` fields via PATCH, corpus uploads |
| `/dashboard/voices` | (hidden) | Voice library browser | Ultravox voices API | `clients.agent_voice_id` |

### Admin-Only Routes

| Route | Sidebar Label | Group | Purpose |
|-------|--------------|-------|---------|
| `/dashboard/clients` | Clients | MANAGE | Client list, status overview, quick actions |
| `/dashboard/campaigns` | Performance | MANAGE | Cross-client analytics |
| `/dashboard/lab` | Lab | TOOLS | Test Lab (requires client selection from Clients page) |
| `/admin/costs` | Cost Intel | TOOLS | Ultravox/Twilio cost tracking |
| `/admin/numbers` | Numbers | TOOLS | Twilio number inventory |
| `/dashboard/voices` | Voices | TOOLS | Voice library management |

### Admin-Only Settings Sections (within shared SettingsView)

| Section | What It Does | DB Fields |
|---------|-------------|-----------|
| Client picker (left panel) | Switch between all 14 clients | N/A |
| Developer Settings | Webhook URLs (read-only display) | N/A |
| Agent Configuration | Voice picker, model, client ID override | `agent_voice_id`, `ultravox_model` |
| Advanced Config | Telegram bot token/chat ID, Twilio number, timezone, minute limit | `telegram_bot_token`, `telegram_chat_id`, `twilio_number`, `timezone`, `monthly_minute_limit` |
| Re-generate from template | Rebuilds prompt from niche template | `system_prompt` |
| Re-sync Agent | Force-pushes prompt to Ultravox | Ultravox API PATCH |
| Knowledge Test Query | Tests RAG retrieval | Ultravox corpus query |
| Billing: Usage Summary | Ultravox account-level minute usage | Ultravox API |

### Routes That Exist But Are Not in Client Sidebar

| Route | Who Can Access | Notes |
|-------|---------------|-------|
| `/admin/calls` | Admin | Separate admin calls view |
| `/admin/insights` | Admin | Cross-client insights |
| `/admin/test-lab` | Admin | Alternate test lab |
| `/admin/prompt` | Admin | Direct prompt editor |
| `/admin/clients` | Admin | Alternate client management |
| `/admin/calendar` | Admin | Cross-client calendar view |
| `/onboard` | Public (post-signup) | Multi-step onboarding wizard |
| `/onboard/status` | Public | Onboarding progress tracker |

---

## 3. Client Audit — What Clients See and Can Do

### Overview (Calls Dashboard)
- **Stats cards**: AI Handled, Hot Leads, Answer Rate, Hours Saved, Auto-Screened
- **Minutes Used**: bar showing X / 500 with reset date
- **Outcomes**: donut chart (Hot/Warm/Cold/Junk)
- **Last 7 Days**: bar chart
- **Funnel**: Total → Answered → Qualified → Hot
- **Hot lead alert banner**: "1 hot lead waiting 105h+ — ~$400 at risk"
- **Call Log**: filterable by status (All/HOT/WARM/COLD/JUNK/UNKNOWN/MISSED), searchable by number
- **Kanban vs List toggle**: two view modes for call log

**Issues found:**
- UNKNOWN calls show "Classification timed out — review manually" — meaningless to clients
- "$400 at risk" dollar estimate has no visible basis — confusing
- Overdue times shown in raw hours ("Overdue 235h") not human-friendly ("10 days overdue")
- No way to mark a lead as "contacted" or "resolved" from the overview — must go to Leads page

### Live
- Shows active calls in real-time
- Empty state when no calls active — just blank page
- Pulsing green dot in sidebar when calls are live

### Agent (Setup)
- 3-step wizard: Phone Setup → Agent → Context
- Shows forwarding number, carrier instructions
- Client pill selector at top (only visible to admin viewing client)
- Setup-status clients auto-redirect here

### Advisor
- AI chat panel (Llama 3.3 70B via OpenRouter)
- Floating bubble on every page (bottom-right)
- Quick insight cards: "Leads Need Follow-Up", "Call Volume", "Call Quality", "Busiest Time", "Busiest Day", "Caller Sentiment"
- Credit display ($0.79)
- Can open full page or use as panel overlay

**Issues found:**
- Floating bubble on every page may confuse clients who don't know what it is
- Model picker shows "Llama 3.3 70B Meta" — technical detail clients don't need
- Credit system not explained — "$0.79" with no context

### Leads
- Dedicated lead queue with overdue timers
- Filters: All / HOT / WARM
- CSV export
- Each lead shows: phone, classification, age, summary, tags

**Issues found:**
- No action buttons (mark contacted, dismiss, snooze)
- Same phone can appear multiple times (e.g., +13068507687 appears 6 times)
- No lead deduplication or grouping by caller

### Calendar
- Shows bookings made by agent during calls
- Empty state: "No bookings yet — connect your Google Calendar in Settings"
- Link to Settings for Google Calendar OAuth

**Issues found:**
- Page exists even for niches where booking isn't relevant (auto glass typically doesn't do self-serve booking)
- No way to hide this page for non-booking niches
- API returns 403 error (visible in console) — likely because booking isn't enabled

### Settings — Agent Tab (client view)
**Visible sections (top to bottom):**

1. **AgentOverviewCard**: business name, niche badge, plan tier, phone number, voice, last updated, minutes bar, connected services (Telegram, SMS, Google Calendar, Call Forwarding "soon")
2. **Quick Inject**: Away/Holiday/Promo presets with textarea (writes to `injected_note`)
3. **Context Data**: data label + textarea with CSV upload, max 32K chars (writes to `context_data` + `context_data_label`)
4. **Booking**: "Connect Google Calendar" CTA (writes `booking_enabled` via OAuth flow)
5. **Agent Script** (collapsed accordion): FULL raw system prompt in a textarea — 14,495 chars visible. Has "Save Changes" button. Shows char count.
6. **AI Improve** (Beta): "Generate Improvement" button — reads last 10 calls + current prompt
7. **Prompt History**: view and restore previous prompt versions
8. **Right Now**: inject time-sensitive note (DUPLICATE of Quick Inject — same `injected_note` field!)
9. **Hours & After-Hours**: weekday/weekend hours text fields + after-hours behavior dropdown
10. **Section Editors** (collapsed accordions): Agent Identity, Business Hours, Knowledge Base — these parse prompt section markers and write back into `system_prompt`
11. **Advanced Context**: Business Facts textarea + Extra Q&A pairs + Context Data (label + textarea) + expandable "Current system prompt" viewer
12. **Test Call**: phone number input + "Call Me" button

**Critical Issues:**
- **Raw prompt exposed**: Client can see and edit the full 14K-char system prompt including `<!-- unmissed:identity -->` markers, `{{callerContext}}` template variables, `hangUp` tool references, and low-level voice behavior rules
- **Duplicate injection**: "Quick Inject" (top) and "Right Now" (middle) both write to `injected_note` — last save wins
- **Duplicate Context Data**: appears both in the standalone "Context Data" section (item 3) AND inside "Advanced Context" (item 11) — both write to the same DB fields
- **Section editors can corrupt prompt**: editing "Agent Identity" section parses the prompt text by `<!-- unmissed:identity -->` markers and writes back — if markers are accidentally deleted in the raw textarea, section editors break
- **Hours dual-write**: "Hours & After-Hours" saves to structured DB columns. "Business Hours" section editor writes to prompt section markers. Two save buttons, two data stores, easy desync.
- **No progressive disclosure**: everything from "change agent name" (easy) to "edit system prompt" (dangerous) is on the same page with no hierarchy

### Settings — SMS Tab
- Toggle: SMS follow-up enabled/disabled
- Template textarea with placeholder variables
- Save button

### Settings — Voice Tab
- Current voice card with avatar, name, provider badge, description
- Play preview button (inline audio)
- "Browse Voice Library" CTA → links to `/dashboard/voices`
- Voice Tips cards (Match your brand / Test with callers / Switch anytime)

### Settings — Alerts Tab
- Alert Channels: Telegram (active/not configured), SMS (Coming soon), Email (Coming soon)
- Telegram Message Style: Compact / Standard / Action Card (radio selection)
- Notification Preferences: matrix of events (HOT lead, Missed call, Daily digest) × channels (Telegram, SMS, Email)
- Only Telegram toggles are functional

### Settings — Billing Tab
- Your Plan: plan name, minute limit, bonus minutes
- Usage This Cycle: progress bar with remaining minutes
- Buy Minutes: 100/250/500 min reload options with Stripe checkout
- Account: joined date, current cycle, next renewal, setup fee
- Past-due warning banner when subscription is past_due

### Settings — Knowledge Tab
- Enable/disable toggle
- Document upload (drag-and-drop, 10MB max, PDF/DOC/TXT/MD/PPT/EPUB)
- Document list with status badges (Processing/Ready/Failed/Local Only)
- Delete confirmation per document

---

## 4. Admin Audit — What Admins See Beyond Client View

### Sidebar Differences
- "Admin" badge next to "unmissed.ai" logo
- "All clients" subtitle instead of business name
- Additional nav groups: MANAGE (Clients, Performance) and TOOLS (Lab, Cost Intel, Numbers, Voices)
- Group dividers with labels

### Settings — Admin Additions
- **Left panel**: all 14 clients listed, segmented "Active (6)" / "Unassigned (8)"
- **Developer Settings**: Inbound/Completed/Fallback webhook URLs (read-only)
- **Agent Configuration**: Voice picker dropdown, Model selector, Client ID field
- **Advanced Config**: Telegram bot token, Telegram chat ID, Twilio number, Timezone, Monthly minute limit
- **Re-generate from template**: rebuilds prompt from niche defaults
- **Re-sync Agent**: force-pushes current DB prompt to Ultravox via PATCH
- **Knowledge Tab**: "Test Query" panel (query RAG, see relevance scores)
- **Billing Tab**: Ultravox account-level usage summary
- **All PATCH requests**: include `client_id` in body (admin can edit any client)

### Clients Page
- All 14 clients listed as cards
- Status badges, phone numbers, niche labels
- Quick links to Lab, Settings for each client

### Lab
- Requires client context (selected via Clients page link)
- "Select a client first" empty state when accessed directly

---

## 5. Field-to-Architecture Mapping Table

### Target 6-Layer Architecture

| Layer | Name | Description | Storage |
|-------|------|-------------|---------|
| L1 | Base Prompt | Core agent behavior, conversation flow, rules | `clients.system_prompt` |
| L2 | Structured Business Config | Name, hours, niche, voice, phone, forwarding | `clients.*` structured columns |
| L3 | Knowledge Summary | Business facts, Q&A, identity, hours (injected) | `clients.business_facts`, `clients.extra_qa`, prompt section markers |
| L4 | Retrieval / Long-Form Knowledge | Uploaded docs, CSV data, menus | `clients.context_data`, Ultravox corpus |
| L5 | Runtime Caller Context | Caller phone, injected note, time-of-day | `{{callerContext}}` (webhook), `clients.injected_note` |
| L6 | Tools / Actions | hangUp, bookAppointment, transferCall, queryCorpus, sendSMS | Ultravox tool registration |

### Current UI Field → Layer Mapping

| UI Section | UI Field | DB Column(s) | Layer | Problem |
|------------|---------|-------------|-------|---------|
| AgentOverviewCard | Agent name | `agent_name` | L2 | OK |
| AgentOverviewCard | Voice | `agent_voice_id` | L2 | OK — but shows raw Ultravox voice name |
| AgentOverviewCard | Phone | `twilio_number` | L2 | OK (read-only for client) |
| AgentOverviewCard | Minutes | `monthly_minute_limit` | L2 | OK |
| Quick Inject | Textarea | `injected_note` | L5 | DUPLICATED — also appears as "Right Now" |
| Context Data (standalone) | Label + data | `context_data_label`, `context_data` | L4 | DUPLICATED — also in Advanced Context |
| Booking | Google Calendar CTA | `booking_enabled` | L6 | Visible for all niches — should be gated |
| Agent Script | Raw prompt textarea | `system_prompt` | L1 | DANGEROUS — clients can break prompt |
| AI Improve | Generate button | `system_prompt` (proposes changes) | L1 | Client may not understand prompt diffs |
| Prompt History | Version list | `prompt_versions` table | L1 | Exposes raw prompt history to clients |
| Right Now | Textarea | `injected_note` | L5 | DUPLICATE of Quick Inject |
| Hours & After-Hours | Weekday/Weekend/Behavior | `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone` | L2 | DUAL-WRITE — also writes to prompt section markers |
| Section: Agent Identity | Parsed text editor | `system_prompt` (marker-parsed) | L1+L2 | Fragile — depends on `<!-- unmissed:identity -->` markers in prompt |
| Section: Business Hours | Parsed text editor | `system_prompt` (marker-parsed) | L1+L2 | DUAL-WRITE with structured hours fields |
| Section: Knowledge Base | Parsed text editor | `system_prompt` (marker-parsed) | L1+L3 | Mixes prompt text with knowledge |
| Advanced: Business Facts | Textarea | `business_facts` | L3 | OK — but buried deep in page |
| Advanced: Extra Q&A | Q&A pairs | `extra_qa` | L3 | OK — but no limit guidance for clients |
| Advanced: Context Data | Label + textarea | `context_data`, `context_data_label` | L4 | DUPLICATE of standalone Context Data |
| SMS | Toggle + template | `sms_enabled`, `sms_template` | L6 | OK |
| Voice | Voice picker | `agent_voice_id` | L2 | OK |
| Alerts | Telegram config | `telegram_bot_token`, `telegram_chat_id`, `telegram_style` | L2 | Bot token visible to admin only — OK |
| Billing | Plan/usage/reload | `monthly_minute_limit`, `bonus_minutes`, `subscription_*` | L2 | OK |
| Knowledge | File upload | Ultravox corpus | L4 | OK |
| Test Call | Phone input | Triggers `POST /api/dashboard/test-call` | N/A | OK but buried at bottom |
| (INVISIBLE) | hangUp tool | Registered at call creation | L6 | Client has zero visibility |
| (INVISIBLE) | transferCall tool | Registered if `forwarding_number` set | L6 | Client has zero visibility |
| (INVISIBLE) | bookAppointment tool | Registered if `booking_enabled` | L6 | Client has zero visibility |
| (INVISIBLE) | queryCorpus tool | Registered if `corpus_enabled` | L6 | Client has zero visibility |
| (INVISIBLE) | callerContext | Injected by webhook at call time | L5 | Client has zero visibility |

---

## 6. Top UX Problems (ranked by impact)

### P0 — Critical (blocks client trust or causes data corruption)

1. **Raw prompt exposed to clients** — 14,495 chars of technical prompt text in an editable textarea. One accidental deletion of `<!-- unmissed:identity -->` markers breaks section editors. One removal of `{{callerContext}}` breaks caller phone injection. One edit to hangUp instructions breaks call closure. This is the #1 risk.

2. **Dual-write hours desync** — "Hours & After-Hours" saves weekday/weekend to DB columns. "Business Hours" section editor saves hours to prompt markers. Two separate save buttons. If client saves one but not the other, the agent says different hours than what the structured data shows.

3. **Duplicate injected_note** — "Quick Inject" (top of page) and "Right Now" (middle of page) both write to `clients.injected_note`. Last save wins silently. Client may set an away message via Quick Inject, then accidentally clear it via Right Now.

4. **Duplicate Context Data sections** — standalone "Context Data" near the top AND "Context Data" inside "Advanced Context" — both write to the same `context_data` and `context_data_label` columns.

### P1 — High (confuses clients or creates false expectations)

5. **UNKNOWN calls shown to clients** — "Classification timed out — review manually" is meaningless to a windshield shop owner. Should show "Unclassified" with a subtle indicator.

6. **Booking/Calendar visible for non-booking niches** — Windshield Hub sees "Connect Google Calendar" and a Calendar nav item, but their auto glass workflow doesn't use self-serve booking. Creates false expectation.

7. **No progressive disclosure** — Agent name edit (safe) and system prompt edit (dangerous) are on the same page with equal visual weight. New clients are overwhelmed.

8. **Lead overdue times in raw hours** — "Overdue 235h" should be "10 days overdue" or "overdue since Mar 9".

9. **No lead actions** — Leads page is read-only. No way to mark as contacted, dismiss, snooze, or add a note. The lead queue is informational but not actionable.

### P2 — Medium (friction or confusion)

10. **Advisor credit system unexplained** — "$0.79" badge with no context about what credits are, how they're consumed, or how to add more.

11. **Section editors are fragile** — They parse `system_prompt` by `<!-- unmissed:-->` markers. If markers are malformed (e.g., client edits raw prompt), section editors silently fail or show empty content.

12. **Agent Script defaults collapsed for admin but expanded for clients** — Inconsistent. For clients it should be hidden entirely or replaced with guided editors.

13. **"AI Improve" generates raw prompt diffs** — Client clicks "Generate Improvement" and gets technical prompt changes they can't evaluate.

14. **Test Call buried at page bottom** — The most important validation action is below 12+ sections of configuration. Should be prominent.

15. **Live page is empty 99% of the time** — Only useful during active calls. Empty state is just blank.

### P3 — Low (polish)

16. **Floating Advisor bubble on every page** — Takes up screen real estate and may confuse first-time users.
17. **Voice picker shows technical provider badges** — "Cartesia" / "Eleven Labs" / "Ultravox" means nothing to clients.
18. **"$400 at risk" in hot lead banner** — Dollar estimate with no visible basis.
19. **Prompt History accessible to clients** — Shows raw prompt version diffs.
20. **Same phone number appears multiple times in leads** — No deduplication or grouping.

---

## 7. Top Architecture-Mapping Problems

### A1. Layer 1 (Base Prompt) is directly client-editable
The system prompt contains low-level voice behavior rules, tool invocation instructions, section markers, and template variables. Exposing this as a textarea is like giving a car buyer access to the ECU firmware. Clients should interact with Layers 2-4 through structured forms. Layer 1 should be admin-only or locked.

### A2. Layer 2 and Layer 1 are entangled via section markers
Agent Identity, Business Hours, and Knowledge sections exist both as structured DB columns (Layer 2) AND as marker-delimited text blocks within `system_prompt` (Layer 1). This creates:
- Two sources of truth for the same data
- Two save buttons that must both be clicked
- Marker parsing that breaks if the prompt is manually edited

### A3. Layer 3 is scattered across the UI
Business facts, extra Q&A, and section editor content all serve the same purpose (knowledge the agent should have) but are in 3 different UI locations with different save flows.

### A4. Layer 5 has two identical UI surfaces
`injected_note` appears as "Quick Inject" (with presets) and "Right Now" (with plain textarea). Same DB field, different UI, no coordination.

### A5. Layer 6 (Tools) is invisible to clients
Clients have zero visibility into what actions their agent can take. They don't know if their agent can hang up, transfer calls, book appointments, or query documents. These capabilities should be visible as toggles or status indicators.

### A6. Niche capabilities not gated in UI
Booking, Knowledge Base, Calendar, and Transfer are shown to all niches regardless of relevance. The system knows the niche (`auto_glass`) but the UI doesn't use this to gate features.

### A7. No separation between "what agent knows" and "how agent behaves"
The Agent tab mixes:
- Agent identity (name, greeting) — "what"
- Conversation flow rules — "how"
- Business facts — "what"
- Context data — "what"
- Raw prompt with voice behavior rules — "how"
- Hours config — "what"

These should be in separate, clearly labeled sections.

---

## 8. Redesign Recommendations

### 8.1 Settings Page Restructure

**Replace the current 6-tab monolith with a layered approach:**

**For Clients — 4 clean sections:**

| Section | Contents | Maps to Layers |
|---------|----------|---------------|
| **Your Agent** | Name, greeting, personality, voice, photo/avatar | L2 |
| **Your Business** | Hours, business facts, Q&A, services, context data/CSV | L2 + L3 + L4 |
| **Capabilities** | Toggle cards: SMS follow-up, Google Calendar booking, Call forwarding, Knowledge Base | L6 (visible) |
| **Account** | Billing, minutes, alerts, Telegram connection | L2 |

- **Agent Script**: REMOVE from client view entirely. Replace with guided section editors that write to structured fields, which are then assembled into the prompt server-side.
- **Quick Inject + Right Now**: MERGE into a single "Override" card at the top of the page with a clear "active/inactive" indicator.
- **Context Data**: ONE location only, in "Your Business" section.
- **Test Call**: PROMOTE to a floating action button or sticky header element, not buried at bottom.

**For Admin — same 4 sections PLUS:**
- **Developer** tab: webhook URLs, raw prompt editor, re-sync, re-generate
- **Infrastructure** tab: Telegram tokens, Twilio number, timezone, minute limit
- Client picker remains in left panel

### 8.2 Niche-Gated Features

Use `clients.niche` to show/hide features:

| Feature | Show for niches |
|---------|----------------|
| Booking / Calendar | `property_mgmt`, `real_estate`, `dental`, `legal`, `hvac`, `plumbing` |
| Knowledge Base | All (opt-in) |
| Call Forwarding | All |
| SMS Follow-up | All |
| Context Data CSV | `property_mgmt` (tenant list), `auto_glass` (price list) |

### 8.3 Kill Dual-Writes

- Hours: ONLY save to structured DB columns. Prompt assembly reads from DB at call time.
- Identity: ONLY save to structured fields. Prompt assembly injects at call time.
- Knowledge section: ONLY save to `business_facts` + `extra_qa`. Prompt assembly injects.
- Remove section marker parsing entirely. Prompt is generated server-side from structured data.

### 8.4 Classification Cleanup

- Replace "UNKNOWN" label with "Unclassified"
- Replace "Classification timed out — review manually" with "This call hasn't been classified yet"
- Add manual classification dropdown for unclassified calls
- Show overdue times as "X days" not "Xh"

### 8.5 Lead Actions

Add to Leads page:
- "Mark as contacted" button
- "Snooze 24h" button
- "Dismiss" button
- Optional note field
- Group multiple calls from same number

---

## 9. Safe Phased Implementation Plan

### Phase 0 — Zero-Risk Quick Wins (1-2 days)
**No architecture changes. UI-only.**

| Change | File(s) | Risk |
|--------|---------|------|
| Rename "UNKNOWN" to "Unclassified" in call log | `CallsList.tsx`, `CallDetail.tsx` | None |
| Show overdue as "X days" not "Xh" in leads | `LeadQueue.tsx` | None |
| Hide "Prompt History" from clients (`!isAdmin &&` guard) | `SettingsView.tsx` ~line 249 | None |
| Hide "AI Improve" from clients | `SettingsView.tsx` ~line 240-246 | None |
| Hide "Right Now" section (keep Quick Inject only) | `SettingsView.tsx` ~line 256-265 | None |
| Remove duplicate Context Data (keep only Advanced Context version) | `SettingsView.tsx` ~line 190-206 | None |
| Move Test Call to top of Agent tab (above Agent Script) | `SettingsView.tsx` | None |
| Gate Calendar nav link by `booking_enabled` | `Sidebar.tsx` line 99-111 | Low |
| Gate Booking section by niche capability | `SettingsView.tsx` ~line 207-212 | Low |

### Phase 1 — Protect the Prompt (3-5 days)
**Collapse Agent Script for clients. Make it read-only or admin-only.**

| Change | File(s) | Risk |
|--------|---------|------|
| Make Agent Script textarea read-only for clients (`!isAdmin && readOnly`) | `SettingsView.tsx` ~line 237 | Low — clients can still see but not break |
| Add "Contact support to edit your agent script" message for clients | `SettingsView.tsx` | None |
| OR: Hide Agent Script entirely for clients (stronger) | `SettingsView.tsx` | Medium — clients lose direct editing |
| Replace section editors with structured form fields that save to DB columns only | New component `AgentConfigForm.tsx` | Medium — requires prompt assembly refactor |

### Phase 2 — Kill Dual-Writes (5-7 days)
**Hours, identity, and knowledge become structured-only.**

| Change | File(s) | Risk |
|--------|---------|------|
| Refactor prompt assembly to read hours from DB columns, not markers | `prompt-builder.ts`, `inbound/route.ts` | Medium — test all 3 clients |
| Refactor prompt assembly to read identity from DB columns | `prompt-builder.ts` | Medium |
| Remove section marker parsing from SettingsView | `SettingsView.tsx` | Medium — remove ~70 lines |
| Add structured identity fields: `agent_greeting`, `agent_personality` | Supabase migration + `SettingsView.tsx` | Low |
| Remove `<!-- unmissed:identity -->` markers from all prompts | All `SYSTEM_PROMPT.txt` files | Medium — requires /prompt-deploy for each |

### Phase 3 — Settings Restructure (5-7 days)
**Break the monolith into focused components.**

| Change | File(s) | Risk |
|--------|---------|------|
| Extract "Your Agent" section into `AgentSection.tsx` | New file | Low |
| Extract "Your Business" section into `BusinessSection.tsx` | New file | Low |
| Extract "Capabilities" section into `CapabilitiesSection.tsx` | New file | Low |
| Refactor SettingsView to compose from sub-components | `SettingsView.tsx` (becomes ~500 lines) | Medium |
| Add niche-based feature gating to Capabilities | `CapabilitiesSection.tsx` + `niche-config.ts` | Low |
| Add tool visibility cards (shows what actions agent can take) | `CapabilitiesSection.tsx` | Low |

### Phase 4 — Lead Actions + Classification (3-5 days)

| Change | File(s) | Risk |
|--------|---------|------|
| Add "Mark contacted" / "Snooze" / "Dismiss" buttons to LeadQueue | `LeadQueue.tsx` + new API route | Low |
| Add `lead_status` column to `call_logs` or new `lead_actions` table | Supabase migration | Low |
| Group leads by phone number | `LeadQueue.tsx` | Low |
| Add manual classification dropdown for UNKNOWN calls | `CallDetail.tsx` + API route | Low |

### Phase 5 — Advisor Polish (2-3 days)

| Change | File(s) | Risk |
|--------|---------|------|
| Hide model picker from clients (use default) | `ModelPicker.tsx` | None |
| Add credit explainer tooltip | `CreditDisplay.tsx` | None |
| Make floating bubble dismissable with preference | `FloatingAdvisorBubble.tsx` | Low |

---

## Appendix A: Key Files to Change

| File | Lines | What Lives Here |
|------|-------|----------------|
| `agent-app/src/app/dashboard/settings/SettingsView.tsx` | 3,044 | THE monolith — all 6 tabs, all settings |
| `agent-app/src/components/dashboard/Sidebar.tsx` | 431 | Navigation, admin gating, group labels |
| `agent-app/src/components/dashboard/KnowledgeBaseTab.tsx` | 495 | Corpus upload/list/test |
| `agent-app/src/app/dashboard/layout.tsx` | 79 | Auth, role detection, sidebar props |
| `agent-app/src/app/dashboard/settings/page.tsx` | ~50 | Server component, data fetch, passes to SettingsView |
| `agent-app/src/components/dashboard/settings/AgentOverviewCard.tsx` | ~300 | Agent card at top of settings |
| `agent-app/src/lib/prompt-builder.ts` | ~800 | Niche defaults, prompt assembly |
| `agent-app/src/app/api/dashboard/settings/route.ts` | ~200 | PATCH handler for all settings |

## Appendix B: Screenshots Captured

| File | View | Notes |
|------|------|-------|
| `client-calls-overview.png` | Client: Overview/Calls | Full dashboard with stats, charts, call log |
| `client-leads-page.png` | Client: Leads | 15 leads, 1 HOT, 14 WARM, all overdue |
| `client-settings-agent-tab.png` | Client: Settings (Agent tab, full page) | Shows the entire monolith |
| `client-calendar-page.png` | Client: Calendar | Empty state with "connect Google Calendar" CTA |

## Appendix C: Database Columns Referenced

All on `clients` table (Supabase project `qwhvblomlgeapzhnuwlb`):

```
system_prompt, injected_note, agent_name, agent_voice_id,
business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone,
business_facts, extra_qa, context_data, context_data_label,
sms_enabled, sms_template,
booking_enabled, booking_service_duration_minutes, booking_buffer_minutes,
forwarding_number, transfer_conditions,
corpus_enabled, corpus_id,
telegram_bot_token, telegram_chat_id, telegram_style,
twilio_number, timezone, monthly_minute_limit, bonus_minutes,
subscription_status, subscription_current_period_end, grace_period_end,
setup_complete, status, niche, ultravox_agent_id, ultravox_model
```
