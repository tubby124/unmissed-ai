# unmissed.ai Frontend Audit — 2026-03-19

> Produced by: Visual inspection (Playwright) + full source read (SettingsView.tsx, KnowledgeBaseTab.tsx) + live admin + client sessions.
> Credentials used: admin@unmissed.ai (admin) + fix@windshieldhub.ca (client — Windshield Hub).

---

## 1. Executive Summary

The app works and the core call-handling loop is solid. But the frontend has a set of deep architectural mismatches between what the UI implies and how the system actually works. The biggest risks are:

- **Hours live in three places** (DB columns, prompt markers, business_facts freetext) with two separate save buttons that look the same but write to different targets.
- **The raw system prompt is editable by clients** — a 14,495-char technical document — while section editors exist to prevent exactly that.
- **Quick Inject and "Right Now" inject are the same DB field**, duplicated in the same tab.
- **Booking, corpus, and transfer UI is shown to all clients**, but gated at the API layer invisibly — clients see the CTA, connect things, and have no idea the feature isn't enabled.
- **Admin and client settings live in the same monolithic component** (SettingsView.tsx, ~3,045 lines) differentiated only by `isAdmin` prop, making both views cluttered and confusing.

None of this is catastrophic, but together it creates a product that looks polished but is confusing to configure correctly, and fragile when clients or admins edit the wrong thing.

---

## 2. Route Map

### Client-Accessible Dashboard Routes

| Route | Nav Label | What It Does | Data Read | Data Write |
|-------|-----------|--------------|-----------|------------|
| `/dashboard/calls` | Overview | Call log + stats cards (AI handled, HOT leads, answer rate, hours saved, funnel, 7-day chart, outcomes donut) | `call_logs`, `clients` | `call_logs` (status via kanban) |
| `/dashboard/live` | Live | Live call monitoring (active calls in progress) | Real-time Ultravox events | None |
| `/dashboard/setup` | Agent | 3-step wizard: Phone Setup → Agent → Context (forwarding number, carrier codes, agent name, hours, context data) | `clients` | `clients` |
| `/dashboard/advisor` | Advisor | AI chat advisor (Llama 3.3 70B) with insight cards (lead follow-up, call volume, quality, busiest time, sentiment) | `call_logs`, `clients` | None (chat only) |
| `/dashboard/leads` | Leads | HOT+WARM lead queue with overdue timers, filtered by status, CSV export | `call_logs` (HOT+WARM only) | `call_logs` (mark done) |
| `/dashboard/calendar` | Calendar | Google Calendar booking view (only useful after OAuth connected) | GCal API | GCal API |
| `/dashboard/settings` | Settings | 6-tab settings panel | `clients`, corpus API, Ultravox voices | `clients`, corpus API |
| `/dashboard/voices` | (via Settings) | Full voice library browser with preview and selection | Ultravox voices API | `clients.agent_voice_id` |

### Admin-Only Routes

| Route | What It Does |
|-------|--------------|
| `/admin/calls` | All calls across all clients |
| `/admin/insights` | Platform-wide analytics |
| `/admin/costs` | Ultravox/Twilio cost tracking |
| `/admin/numbers` | Twilio number inventory |
| `/admin/test-lab` | Admin test panel (7 API endpoints) |
| `/admin/prompt` | Bulk prompt management |
| `/admin/clients` | Client management CRUD |
| `/admin/calendar` | Calendar management |

### Key Structural Note
Admin does NOT have a separate dashboard — they use the same `/dashboard/*` routes but with a client-switcher left panel. The left panel IS the client selector; the right panel shows whichever client is selected. If no client is selected, admin defaults to `hasan-sharif`.

---

## 3. Client Audit (Windshield Hub — fix@windshieldhub.ca)

### Sidebar
- 8 nav items: Overview, Live, Agent, Advisor, Leads, Calendar, Settings, Back to Site
- Top: business name ("Windshield Hub Auto Glass") + "Telegram connected" status badge
- Bottom: Theme toggle, Sign out, Collapse
- NO admin routes visible, NO client switcher

### Overview (Call Log)
Well-designed. Stats bar at top (minutes used with progress bar, reset date). 5 stat cards (AI handled, Hot leads with "View queue" CTA, Answer rate, Hours saved, Auto-screened). Outcomes donut + 7-day bar chart + funnel. Call log below with HOT/WARM/COLD/JUNK/UNKNOWN/MISSED filter tabs, date-grouped rows, tag chips on each call. "Dial" and "CSV" buttons in header. Alert banner for overdue HOT lead (105h — ~$400 at risk). **Good UX.**

### Agent Setup Wizard (`/dashboard/setup`)
3-step stepper (Phone Setup → Agent → Context). For an already-live client, Step 1 shows green "Forwarding active — agent is live" banner, then still shows the full forwarding code setup (carrier picker, iPhone/Android toggle, code display). **Problem: this is post-setup maintenance UI masquerading as an onboarding wizard.** A client who re-opens this to "check settings" will think they need to re-enter codes.

### Leads Page
Clean list UI. HOT/WARM filter tabs with counts. Each row: overdue timer (e.g. "Overdue 105h"), status badge, phone number, time since call, truncated summary, intent tags. CSV export. 15 leads shown for Windshield Hub, oldest at 235h overdue (9 days — Sabbir has not called back). **The overdue timer is the right UX call** — immediately surfaces business impact.

### Settings — Agent Tab
Long, vertically scrolled single column. Sections from top to bottom:

1. **AgentOverviewCard**: Setup complete banner → agent card (name, niche badge, plan badge, phone, on/off toggle with "Answering calls" indicator, agent name field, voice picker dropdown with "Loading…" state, AI phone (read-only), Last Updated timestamp) → Minutes usage bar → Connected services status pills (Telegram ●, SMS follow-up ●, Google Calendar ●, Call forwarding (soon)) → **Quick Inject** (Away/Holiday/Promo templates + freetext textarea)

2. **Context Data block**: Label + freetext textarea (max 32K chars) + CSV upload + Save button. Placeholder shows Windshield Hub pricing example. 0/32,000 chars.

3. **Booking section**: "Connect Google Calendar" CTA with OAuth link. *Shown to all clients regardless of niche or booking_enabled flag.*

4. **Agent Script accordion** (collapsed by default for clients): Full raw 14,495-char system prompt in a textarea. "Save Changes" button (disabled until edit). AI Improve (Beta) → "Generate Improvement" button. "Prompt History" accordion. "Right Now" live inject (textarea → "Push Live").

5. **Hours & After-Hours** block: Weekday hours text field, Weekend hours text field, After-hours behaviour dropdown (Take a message / Route emergencies / Custom message only). "Save" button.

6. **Agent Identity accordion** (collapsed): Edits `<!-- unmissed:identity -->` section in prompt.

7. **Business Hours accordion** (collapsed): Edits `<!-- unmissed:hours -->` section in prompt.

8. **Knowledge Base accordion** (collapsed): Edits `<!-- unmissed:knowledge -->` section in prompt.

9. **Advanced Context block**: Business facts textarea + Extra Q&A pairs (add button, max 10) + Context data label + Context data textarea (duplicate of item 2 above).

10. **Test Call**: Phone number input + "Call Me" button.

### Settings — SMS Tab
SMS follow-up toggle + SMS template text with `{{business}}` and `{{niche_*}}` variable support.

### Settings — Voice Tab
Current voice card (avatar/play button, voice name, provider badge, description). "Browse Voice Library" → `/dashboard/voices`. 3 voice tips (Match your brand, Test with callers, Switch anytime).

### Settings — Alerts Tab
Alert Channels card: Telegram (Active/Not configured status), SMS (Coming soon), Email (Coming soon). Message Style card (3 options: Compact/Standard/Action Card — only shown when Telegram connected). Notification preferences matrix (HOT lead, Missed call, Daily digest × Telegram/SMS/Email — visual toggles, none clickable).

### Settings — Billing Tab
Your Plan (Pro · 500 min/mo), Usage This Cycle (23/500 min progress bar), Buy Minutes (3 reload options — 100/200/500 min), Account (joined date, cycle dates, setup fee $25 paid). Manage subscription → email support@unmissed.ai.

### Settings — Knowledge Tab
Enable/Disable toggle. When disabled: centered empty state with "Enable Knowledge Base" button. When enabled: drag-drop upload area, file list table (Name / Size / Status / Delete), admin-only Test Query panel. Accepted: PDF, DOC, DOCX, TXT, MD, PPT, PPTX, EPUB, max 10MB.

---

## 4. Admin Audit (admin@unmissed.ai)

### Additional Admin-Only Elements vs Client View

**Left Panel (Client Switcher):**
- All 14 clients listed as expandable items, grouped into "Active (6)" and "Unassigned (8)"
- Segmented by whether `twilio_number` is set
- Click to select a client; main content updates

**In Settings — Agent Tab (admin-only additions):**
- **Developer Settings** accordion: Inbound webhook URL + Completed webhook URL (read-only, copy buttons)
- **Agent Configuration** accordion: Voice ID field, Model ID field, Client ID field (admin override)
- **Advanced Config** accordion: Telegram Bot Token, Telegram Chat ID, Timezone, Twilio Number, Monthly Minute Limit
- **Re-generate from Template** button (fires `/api/dashboard/regenerate-prompt`)
- **Re-sync Agent** button (fires `/api/dashboard/settings/sync-agent`)

**In Settings — Knowledge Tab (admin-only):**
- Test Query panel: text input + "Test Query" button + results with relevance scores and document names

**In Settings — Billing Tab (admin-only):**
- Ultravox account-level usage summary

**In Admin Routes:**
- `/admin/test-lab`: 7 API endpoints (test call, test SMS, test Telegram, etc.)
- `/admin/clients`: Full client CRUD with intake review
- `/admin/numbers`: Twilio number inventory and assignment

---

## 5. Field-to-Architecture Mapping Table

| UI Field | DB Column | Architecture Layer | Where Injected |
|----------|-----------|-------------------|----------------|
| Agent Script textarea | `clients.system_prompt` | L1 — Base Prompt | Directly sent to Ultravox callTemplate |
| Agent Identity section editor | `clients.system_prompt` (section marker) | L1 — Base Prompt | Parsed from prompt, written back to prompt |
| Business Hours section editor | `clients.system_prompt` (section marker) | L1 — Base Prompt | Parsed from prompt, written back to prompt |
| Knowledge Base section editor | `clients.system_prompt` (section marker) | L1 — Base Prompt | Parsed from prompt, written back to prompt |
| Agent name | `clients.agent_name` | L2 — Structured Config | Prompt template variable |
| Voice picker | `clients.agent_voice_id` | L2 — Structured Config | Ultravox agent PATCH |
| Ultravox model | `clients.ultravox_model` | L2 — Structured Config | Ultravox agent PATCH |
| Weekday/Weekend hours | `clients.business_hours_weekday/weekend` | L2 — Structured Config | Webhook after-hours logic |
| After-hours behaviour | `clients.after_hours_behavior` | L2 — Structured Config | Webhook routing |
| After-hours emergency phone | `clients.after_hours_emergency_phone` | L2 — Structured Config | Webhook routing |
| Forwarding number | `clients.forwarding_number` | L2 — Structured Config | transferCall tool injection |
| Transfer conditions | `clients.transfer_conditions` | L2 — Structured Config | Prompt post-processing |
| Booking duration/buffer | `clients.booking_service_duration_minutes/buffer` | L2 — Structured Config | bookAppointment tool params |
| SMS enabled/template | `clients.sms_enabled/sms_template` | L2 — Structured Config | sendSMS tool injection |
| Corpus enabled | `clients.corpus_enabled` | L2 — Structured Config | queryCorpus tool injection gate |
| Quick Inject / Right Now | `clients.injected_note` | L5 — Runtime Override | Appended to active prompt at call time (no redeploy) |
| Business facts | `clients.business_facts` | L3 — Knowledge Summary | Injected via callerContext at webhook time |
| Extra Q&A pairs | `clients.extra_qa` | L3 — Knowledge Summary | Injected via callerContext at webhook time |
| Context Data textarea | `clients.context_data` + `context_data_label` | L3 — Knowledge Summary | Appended to callerContext at webhook time |
| Uploaded documents | corpus API (Ultravox) | L4 — Retrieval/RAG | queryCorpus tool retrieves on demand during call |
| Caller phone/context | `callerContext` webhook-injected | L5 — Runtime Caller Context | `{{callerContext}}` in prompt (not stored) |
| hangUp tool | built-in | L6 — Tools/Actions | Always enabled |
| bookAppointment | GCal OAuth | L6 — Tools/Actions | Enabled when `booking_enabled = true` |
| queryCorpus | Ultravox corpus | L6 — Tools/Actions | Enabled when `corpus_enabled = true` |
| transferCall | `clients.forwarding_number` | L6 — Tools/Actions | Enabled when forwarding_number set |
| sendSMS | Twilio | L6 — Tools/Actions | Enabled when `sms_enabled = true` |

---

## 6. Top UX Problems (Prioritized)

### UX-1 (Critical): Hours have two save paths that look identical
The "Hours & After-Hours" block has a **Save** button that writes to `clients.business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior` (DB columns used by the webhook for routing logic). The **Business Hours section editor** accordion further down has a separate **Save** button that parses + rewrites the `<!-- unmissed:hours -->` section inside `system_prompt` (what the agent actually *says*). These look identical to the user. Updating one does not update the other. A client who changes their hours via the top form won't update what the agent says. A client who uses the section editor won't update the after-hours routing logic. **Both will think they're done.**

### UX-2 (Critical): Raw prompt is editable by clients
The "Agent Script" accordion expands to reveal the full 14,495-char raw system prompt in a textarea. Clients can edit it directly. The section editors (Identity, Hours, Knowledge) exist specifically so clients *don't* have to touch the raw prompt. But both paths are presented at the same level, in the same tab, with no warning that editing the raw prompt can break section parsing. One bad edit could break the `<!-- unmissed:hours -->` markers and make the section editor silently corrupt the prompt on next save.

### UX-3 (High): Quick Inject and "Right Now" are the same field, duplicated
"Quick Inject" (in AgentOverviewCard, near the top) and "Right Now" (below the Agent Script, near the bottom of the Agent tab) both write to `clients.injected_note`. The Away/Holiday/Promo template buttons only appear on Quick Inject. A user who scrolls past Quick Inject and finds "Right Now" has no idea they're the same thing. There is also no persistent indicator anywhere that an injected note is currently active.

### UX-4 (High): Booking CTA shown to everyone, gated invisibly
"Connect Google Calendar" appears in the Agent tab for all clients. But `booking_enabled` is set by the admin per client. If it's false, connecting Google Calendar does nothing — the `bookAppointment` tool won't be injected. There's no message saying "booking isn't enabled for your plan" or "contact support to enable booking." Clients who connect GCal will expect it to work and be confused when it doesn't.

### UX-5 (High): Context Data appears twice in the same tab
"Context Data" with a label field and textarea appears twice: once inside the AgentOverviewCard section (under "Quick Inject"), and again in "Advanced Context" further down the page. Both appear to reference `clients.context_data` and `clients.context_data_label`. The user has no way to tell which is authoritative or why there are two.

### UX-6 (Medium): Notification preferences matrix has fake toggles
The Alerts tab shows a 3×3 matrix of toggle switches (HOT lead / Missed call / Daily digest × Telegram / SMS / Email). The SMS and Email columns are permanently disabled ("coming soon"). But the Telegram column toggles look interactive and aren't — they display the current state but clicking does nothing. Users will try to click them and get no feedback.

### UX-7 (Medium): Voice selection split across 3 surfaces
Voice can appear to be editable in: (1) AgentOverviewCard dropdown in Agent tab (voice picker shows "Loading..." in observed session), (2) Voice tab which is read-only showing current voice + "Browse Voice Library" button, (3) `/dashboard/voices` full library. Only the library actually writes. The other two surfaces create false affordance.

### UX-8 (Medium): Agent wizard stays open after setup is complete
`/dashboard/setup` (labeled "Agent" in nav) shows the 3-step setup wizard even after the agent is live. For a live client like Windshield Hub, Step 1 shows "Forwarding active — agent is live" then immediately shows the full carrier/code setup again. The wizard should collapse or redirect to a simplified "maintenance" mode after `setup_complete = true`.

### UX-9 (Low): Alerts tab shows Telegram credentials to clients
The Alerts tab's connection status card reads from `client.telegram_bot_token` and `client.telegram_chat_id`. These are admin-set fields (via the Advanced Config accordion). A client who sees "Telegram Not Connected" and wants to fix it has no way to do so — those fields aren't in any client-editable section. The tab should say "Contact support to connect Telegram" rather than showing a status the client can't change.

### UX-10 (Low): "Last updated" in AgentOverviewCard is ambiguous
The "Last Updated: 8h ago" field in the agent card likely refers to when the Ultravox agent was last patched (via `/prompt-deploy`). But clients who just saved a prompt change in the UI will wonder why "Last Updated" still shows 8h ago — because saving the textarea updates Supabase but doesn't auto-patch Ultravox.

---

## 7. Top Architecture-Mapping Problems

### ARCH-1 (Critical): Hours are stored in 3 separate places with no sync
- **DB columns**: `business_hours_weekday/weekend/after_hours_behavior/after_hours_emergency_phone` — used by the Railway webhook for **routing logic** (whether to apply after-hours behavior when a call comes in)
- **Prompt marker**: `<!-- unmissed:hours -->..<!-- /unmissed:hours -->` — used by the **agent's voice** (what it actually says about hours to callers)
- **business_facts textarea**: Freeform text the admin might add like "We close at 5 on Fridays" — also heard by the agent but unparsed
- None of these are automatically synced. A change in one doesn't propagate to the others.

### ARCH-2 (Critical): Prompt is both structured config and raw text blob
The system prompt is a 14,495-char compiled blob sent to Ultravox. But the UI treats it as both a structured document (parsed via `<!-- unmissed:section -->` markers into section editors) AND a raw editable text field. This dual-mode creates a fragile implicit contract: the section editors only work if the markers are intact. Any direct raw edit that corrupts a marker silently breaks section editing. There's no validation, no schema, no warning.

### ARCH-3 (High): booking_enabled gated at API but not at UI
`booking_enabled` in `clients` table controls whether `bookAppointment`/`checkAvailability` tools are injected into the Ultravox call. But the "Connect Google Calendar" CTA in the Settings Agent tab is visible to ALL clients regardless of `booking_enabled`. The gate is invisible, applied only at the API layer. Clients see the affordance without the capability.

### ARCH-4 (High): Context Data (L3) and Knowledge Base (L4) not differentiated
`context_data` (Layer 3 — always-on structured text, max 32K chars, appended to every call's callerContext) and the corpus/RAG system (Layer 4 — semantic search on uploaded documents, only queried when agent calls `queryCorpus`) serve fundamentally different purposes, but both appear under "Knowledge" framing in the UI without explaining the distinction. Clients will:
- Put a 5-page FAQ into context_data (bloating every call's context by 32K chars)
- Not use the corpus for long documents because they don't understand what it's for
- Or put the same content in both

### ARCH-5 (High): injected_note has no visibility or expiry
`clients.injected_note` is appended to the live prompt at every call — no redeploy needed. But there is no persistent UI indicator that a note is active. No timestamp. No expiry. An admin who sets "We're closed Christmas Day" and forgets it will have the agent saying that for weeks. The note is cleared only when the admin explicitly goes back and empties the field.

### ARCH-6 (Medium): "Last Updated" (Ultravox patch) vs "Saved" (Supabase) are different events
Saving a prompt change in the SettingsView Agent tab updates `clients.system_prompt` in Supabase. But the Ultravox agent only gets the new prompt when either: (a) `/prompt-deploy` is run, or (b) the next call fires the inbound webhook (which reads from Supabase then patches Ultravox). The UI shows "Save Changes" but the implied meaning is "save to Supabase" not "push to live agent." For clients, this distinction is completely invisible — they save, assume the agent is updated, and make a test call that still uses the old prompt.

### ARCH-7 (Medium): Knowledge Base enable/disable has unclear scope
`corpus_enabled` gates the `queryCorpus` tool injection in the Ultravox call. But the Knowledge tab is always visible (just shows the "disabled" empty state). And the corpus is a **shared global corpus** across all clients — documents are separated by naming convention, not by client isolation. This is not visible in the UI. A client who uploads docs to their "Knowledge Base" doesn't know they're in a shared pool, and might be concerned about document privacy.

### ARCH-8 (Low): niche-specific capabilities not reflected in any UI gating
The niche (auto_glass, property_mgmt, real_estate, etc.) determines what capabilities make sense (booking for property_mgmt, no booking for auto_glass quote-flow, corpus for property_mgmt/real_estate, etc.). But the UI treats all niches identically. There's no niche-specific section visibility, no "this feature isn't available for auto glass businesses" message, no capability-first design.

---

## 8. Redesign Recommendations

### REC-1: Make hours a single-save operation
Combine `saveHoursConfig` (writes to DB columns) and `saveSection('hours', ...)` (writes to prompt marker) into a single button press. One save action, one source of truth, no divergence. Display the hours in human-readable form alongside the raw text inputs so clients can see what the agent will say.

### REC-2: Hide raw prompt from clients by default
- Default: section editors (Identity, Hours, Knowledge) are the ONLY editing interface for clients
- "Agent Script" accordion: admin-only. Or require an "Advanced / Developer" toggle to unlock, with a warning: "Editing the raw script directly may break section editors."
- Add validation: when section editors parse the prompt, detect missing or malformed markers and warn before allowing edits.

### REC-3: Merge Quick Inject and "Right Now" into one surface
Remove the duplication. One "Active Override" card in the AgentOverviewCard. When the field is non-empty: show persistent "Override active" badge in the sidebar header. Include a timestamp and one-click clear button. Template buttons (Away/Holiday/Promo) stay.

### REC-4: Gate booking CTA behind booking_enabled flag
In the Agent tab: show the Booking section only if `client.booking_enabled === true`. If false, omit entirely or show a locked/coming-soon state: "Booking is available on higher plans — contact support to enable."

### REC-5: Explain Layer 3 vs Layer 4 distinction clearly
Rename and explain:
- "Context Data" → "Always-On Data (max 32,000 chars)" — explain: "This text is attached to every call, every time."
- "Knowledge Base" → "Searchable Documents" — explain: "Your agent only searches these when a caller asks something specific."
Add a tooltip or callout: "Use Context Data for short structured content (price lists, menus). Use the Knowledge Base for longer documents."

### REC-6: Add persistent override indicator
Add a DB column `injected_note_set_at` (timestamptz). When `injected_note` is non-empty, show a sidebar/header chip: "Override active 3h ago" with a [Clear] button. This surfaces forgotten overrides immediately.

### REC-7: Replace setup wizard with a maintenance view post-go-live
After `setup_complete = true`: The "Agent" nav link should show a simplified "Agent Status" page (not the onboarding wizard). Wizard steps available under "Re-do setup" accordion for edge cases only. Forwarding number shown as read-only with a "Copy" button, not as an editable field.

### REC-8: Split SettingsView into role-specific components (long-term)
- `ClientSettingsView.tsx` — Agent tab (section editors only, no raw prompt), SMS, Voice, Alerts, Billing, Knowledge
- `AdminSettingsView.tsx` — full current view + developer sections
This is a Phase 4 refactor. Phase 1–3 can be done in-place within SettingsView.tsx.

---

## 9. Safe Phased Implementation Plan

### Phase 1 — Zero-Risk Cleanup (SettingsView.tsx changes only)

**Target: All done in 1-2 sessions, no architectural changes, safe to merge immediately.**

| Fix | File | What to change |
|-----|------|----------------|
| Deduplicate Quick Inject + Right Now | SettingsView.tsx ~L1390 + ~L2190 | Remove the "Right Now" block, consolidate into Quick Inject in AgentOverviewCard. Both use `injectedNote[clientId]` state. |
| Add injected_note active indicator | SettingsView.tsx AgentOverviewCard area | If `injectedNote[clientId]` is non-empty, show inline badge: "Override active" + clear button |
| Gate Booking CTA behind booking_enabled | SettingsView.tsx ~L1412 | Wrap Booking section in `{client.booking_enabled && (...)}`. If false, omit entirely. |
| Fix Alerts matrix fake toggles | SettingsView.tsx ~L2809 | Replace `<span>` toggles that look interactive with read-only status dots. Remove cursor affordance. |
| Hide raw Agent Script by default from clients | SettingsView.tsx ~L1560 | Wrap Agent Script accordion in `{(isAdmin || showAdvanced) && (...)}`. Add "Show advanced settings" toggle. |

### Phase 2 — Hours Consolidation (moderate risk, requires testing)

| Fix | File | What to change |
|-----|------|----------------|
| Single-save for hours | SettingsView.tsx | Combine `saveHoursConfig` and `saveSection('hours', ...)` into one handler. One Save button. |
| Remove duplicate Context Data | SettingsView.tsx | Keep one instance (in Advanced Context), remove the one in AgentOverviewCard area. Use the same state. |
| Add "Last Updated" clarification | SettingsView.tsx | Change label to "Prompt last synced to agent" or add tooltip explaining Supabase vs Ultravox. |

### Phase 3 — Section Editor Hardening (higher risk)

| Fix | File | What to change |
|-----|------|----------------|
| Marker validation | SettingsView.tsx + lib/prompt-sections.ts | Before section edit, check markers exist. If missing, warn: "Section markers not found — editing will add them. Raw edits may have removed them." |
| Section preview | SettingsView.tsx | After editing a section, show a preview of agent's text for that section (just the content between markers). |

### Phase 4 — Role Separation (breaking, plan separately)

| Fix | Files | What to change |
|-----|-------|----------------|
| Split SettingsView | New `ClientSettingsView.tsx` + `AdminSettingsView.tsx` | Extract shared UI into sub-components. Route via `isAdmin` prop in `settings/page.tsx`. |
| Post-live agent page | `dashboard/setup/page.tsx` | Detect `setup_complete && twilio_number` → render `AgentStatusView` instead of `SetupWizard`. |

### Exact Files to Change First (Phase 1)

1. **`agent-app/src/app/dashboard/settings/SettingsView.tsx`**
   - Line ~1390: Remove "Quick Inject" duplicate from AgentOverviewCard area OR keep it and remove the "Right Now" block below Agent Script (~L2190)
   - Line ~1412: Add `{client.booking_enabled && (...)}` around Booking section
   - Line ~1560: Add `{(isAdmin || showAdvanced) && (...)}` around Agent Script accordion, add toggle button
   - Line ~2809: Replace interactive-looking notification matrix toggles with static status indicators

2. **`agent-app/src/components/dashboard/AgentOverviewCard.tsx`**
   - If injected_note is surfaced as a prop: add "Override active" badge + clear button

3. **DB migration (optional for Phase 1, required for ARCH-5 fix)**
   ```sql
   ALTER TABLE clients ADD COLUMN injected_note_set_at timestamptz;
   ```
   Update the PATCH /api/dashboard/settings handler to set this column when injected_note is written.

---

## Screenshots

All screenshots captured 2026-03-19 from production app:
- `client-calls-overview.png` — Windshield Hub call dashboard (client view)
- `client-settings-agent-tab.png` — Settings > Agent tab top fold
- `client-agent-setup.png` — Agent setup wizard Step 1
- `client-leads-page.png` — Leads queue with overdue timers
