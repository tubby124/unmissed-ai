# S12 Full System Audit -- Tracks A3, A4, E

**Date:** 2026-03-21
**Auditor:** Claude Opus 4.6 (automated Playwright)
**Production URL:** https://unmissed-ai-production.up.railway.app
**Admin account:** admin@unmissed.ai
**Supabase project:** qwhvblomlgeapzhnuwlb (unmissed-ai)

---

## Table of Contents

1. [Track A3 -- Admin Dashboard](#track-a3----admin-dashboard)
2. [Track A4 -- Onboarding Flow](#track-a4----onboarding-flow)
3. [Track E -- Trial & Onboarding E2E Verification](#track-e----trial--onboarding-e2e-verification)
4. [Critical Bugs Found](#critical-bugs-found)
5. [UX Issues](#ux-issues)
6. [Communication Chain](#communication-chain)
7. [Screenshot Index](#screenshot-index)

---

## Track A3 -- Admin Dashboard

### A3.1 Dashboard Home (Command Center)

**Screenshots:** `01-dashboard-home-{desktop,tablet,mobile}.png`

The admin Command Center displays across all 3 viewports:

- **Status bar:** "All systems operational" with timestamp
- **Action items:** 5 actionable alerts (HOT leads unactioned, booking without calendar, transfer without successful transfers)
- **Client health grid:** All 9+ clients listed with minute usage bars, hot lead counts, last hot lead time
- **Live Activity sidebar (desktop only):** Real-time call feed with phone numbers, client names, classification (WARM/JUNK/COLD), and time

**Responsive behavior:**
- Desktop (1440px): Full 3-column layout -- sidebar, main content, live activity panel
- Tablet (768px): Sidebar hidden behind hamburger menu, live activity panel hidden, main content fills width
- Mobile (390px): Same as tablet, content stacks vertically, text truncates appropriately

**Observations:**
- No `<select>` dropdown or `<combobox>` for client switching -- clients are listed in the health grid with inline action buttons
- Sidebar shows "Admin" badge + "All clients" below the logo
- On mobile/tablet, the sidebar is hidden behind a hamburger -- the "Admin" badge is not visible without opening it

### A3.2 Client List (`/dashboard/clients`)

**Screenshots:** `setup-02-clients-list.png`, `06-admin-page-dashboard-clients-{desktop,tablet,mobile}.png`

The Clients page shows all 12 clients in a card layout:

- Each card shows: business name, phone number (or "No number"), niche tag
- Inline action buttons per client: **Settings**, **Lab**, **Live**, **Calls**, **Delete** (for non-production clients)
- Tabs at top: All (12), Real (11), Test (1)
- Delete button NOT shown for production clients (Hasan, Omar, Urban Vibe, Windshield Hub) -- good safety measure

**Client switching:** Clicking "Settings" or "Calls" on a specific client card navigates to that page with `?client_id=UUID` in the URL. This IS the client context switcher -- there is no separate dropdown.

### A3.3 Settings Pages

**Screenshots:** `settings-hasan-sharif-*.png`, `settings-windshield-hub-*.png`, `admin-settings-no-client.png`

Settings page has 6 tabs: **Agent**, **SMS**, **Voice**, **Alerts**, **Billing**, **Knowledge**

When navigating to `/dashboard/settings` without a `client_id`, it defaults to the first client (Crystal Clear Auto Glass Demo).

**Agent tab (for Hasan Sharif):**
- Shows agent name, voice selection, phone number
- System prompt visible in expandable section
- Agent capabilities toggles (Telegram, Calendar, SMS follow-up, Knowledge, Forwarding)
- Voice & style settings with 4 personality presets (Casual & Friendly, Professional & Warm, Direct & Efficient, Empathetic & Patient)
- Advanced controls: Hang Up, Transfers, Send Text Message, Smart Booking, Proactive Scheduling, Customer Extensions
- Agent voice ID and Call ID visible
- Re-sync button available

**Billing tab (for trial client):**
- Shows plan: "Starter" with 100 minutes badge
- "Free trial -- $20/mo starts on --"
- Usage: 0/100 min, Mar 1 2026 - Apr 1 2026
- Buy minutes cards: 50 min/$10, 100 min/$20, 150 min/$50
- Account details: Joined, Current cycle, Next renewal, Setup fee ($25 paid)
- "Manage Subscription" link
- Ultravox account usage: shows total minutes across all clients

**Alerts tab (for trial client):**
- Telegram: "Not connected" with red badge
- Notification Preferences grid: HOT lead, Missed call, Daily digest -- channels Telegram, SMS (soon), Email (soon)

**Knowledge tab (for trial client):**
- "Knowledge base not enabled" with Enable button
- Clean empty state

### A3.4 Agent/Setup Page (`/dashboard/setup`)

**Screenshots:** `setup-01-agent-page.png`, `setup-hasan-sharif-step*.png`, `setup-windshield-hub-step*.png`

The setup page has a 3-step wizard: **1 Phone Setup**, **2 Agent**, **3 Context**

- Client selector: horizontal pill buttons showing all client names -- click to switch context
- Step 1 (Phone Setup): Shows AI agent number, forwarding instructions with carrier-specific codes
- Step 2 (Agent): Agent configuration (not fully explored -- requires client context)
- Step 3 (Context): Business context information

**Phone Setup step** is well-designed:
- Clear instructions: "Your phone rings first -- AI answers only when you're unavailable"
- Phone type selection: Mobile / Landline / VoIP
- Carrier dropdown with Canadian carriers (Rogers, Bell, Telus, Chatr, Fido, Freedom, Koodo, etc.)
- Device toggle: iPhone / Android
- Forwarding codes auto-generated based on carrier selection

### A3.5 Navigation Pages

All admin-only pages return 200 and render correctly:

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Command Center | `/dashboard` | 200 | Main admin dashboard |
| Overview (Calls) | `/dashboard/calls` | 200 | Call list with filters |
| Insights | `/dashboard/insights` | 200 | Analytics |
| Live | `/dashboard/live` | 200 | Real-time call monitoring |
| Agent (Setup) | `/dashboard/setup` | 200 | 3-step wizard |
| Advisor | `/dashboard/advisor` | 200 | AI advisor chat |
| Clients | `/dashboard/clients` | 200 | Client list |
| Performance | `/dashboard/campaigns` | 200 | Campaign metrics |
| Outbound Queue | `/dashboard/leads` | 200 | Lead management |
| Intake | `/dashboard/intake` | 200 | Intake pipeline |
| Calendar | `/dashboard/calendar` | 200 | Calendar view |
| Demos | `/dashboard/demos` | 200 | Demo analytics (18 total, 0% conversion) |
| Lab | `/dashboard/lab` | 200 | Prompt testing |
| Cost Intel | `/admin/costs` | 200 | Admin cost analytics |
| Numbers | `/dashboard/numbers` | **404** | Page not found |
| Voices | `/dashboard/voices` | 200 | Voice library (71 voices) |
| Settings | `/dashboard/settings` | 200 | Client settings |

**BUG:** `/dashboard/numbers` returns 404 despite being listed in the sidebar navigation.

### A3.6 Admin-Specific UI Elements

- **Admin badge:** Shown next to "unmissed.ai" logo in sidebar header
- **"All clients" label:** Below admin badge, indicates aggregate view
- **Client context bar:** When viewing a specific client, shows client name + niche tag + quick nav (Calls, Live, Lab, Settings)
- **Delete button:** Only shown on non-production client cards
- **Advisor widget:** Floating chat bubble (bottom-right) with "Llama 3.3 70B Meta" badge -- provides quick insights
- **Live Activity panel:** Right sidebar on desktop showing real-time call stream across all clients

---

## Track A4 -- Onboarding Flow

### A4.1 Intake Form (6 steps)

**Path:** `/onboard`

**Step 1/6 -- YOUR INDUSTRY** (`onboard-step1-industry.png`)
- Header: "Set up your AI agent -- ~5 min" with step indicator (1/6)
- Business name search: text input with Google Places autocomplete (`/api/onboard/places-autocomplete`)
- Industry selection: 12 niche buttons (Auto Glass, HVAC, Plumbing, Dental, Law Firm, Salon, Real Estate, Property Management, Voicemail, Restaurant, Print Shop, Other)
- Website URL: optional field ("we'll use it to train your agent")
- Continue button: disabled until niche selected
- **Autofill API:** After Places autocomplete, calls `/api/onboard/autofill` to pre-populate business details from Google

**Step 2/6 -- YOUR AGENT'S VOICE** (`trial-step2-voice.png`)
- 6 voice options: 3 female (Jacqueline, Monika, Ashley) + 3 male (Mark, Nour, Terrence)
- Each with personality description + Preview button
- Agent name field: editable, auto-suggested based on niche (e.g., "Dave" for plumbing)
- Preview text: "Callers will hear: Hi, you've reached Dave from [your business]"
- Default selection: Jacqueline (first option)

**Step 3/6 -- BUSINESS BASICS** (`trial-step3-business.png`)
- Business name (required, pre-filled from step 1)
- Business phone (required) -- "The number callers will be told to call back on"
- Contact email (required) -- "Used for your dashboard login and notifications"
- City (required)
- Business hours (required) -- "Your agent will tell callers when you're open"
- Services offered (optional)
- Pre-populated with data from Google Places autocomplete when available

**Step 4/6 -- KNOWLEDGE & FAQ** (`trial-step4-knowledge.png`)
- "Website content loaded" banner (if website URL provided in step 1)
- File upload: drag-and-drop, PDF/TXT/DOCX, max 5MB per file, up to 3 files
- FAQ pairs: 3 pre-generated questions based on niche (e.g., "Do you handle emergency calls?", "Do you give free estimates?")
- Answer textareas for each question
- "+ Add another question" button
- Entirely optional -- Continue works without filling anything

**Step 5/6 -- CALL HANDLING** (`trial-step5-handling.png`)
- SMS follow-up toggle: "Send follow-up SMS to callers" (default: ON)
- Preview of SMS text
- Call handling mode: "Take a message" vs "Smart receptionist" (Recommended)
- After-hours handling section (below fold)

**Step 6/6 -- REVIEW & ACTIVATE** (`onboard-review-before-trial.png`, `trial-step6-review.png`)
- "Your agent is ready to activate" success banner
- Agent preview card with demo call button ("Talk to Dave -- Free 2-min demo")
- Summary table: Industry, Voice, Agent name, Business, Location, Callback #, Services, Hours, After hours, SMS follow-up, Call handling, Knowledge docs, FAQ pairs
- Each row has "Edit" button to go back to that step
- "Preview Agent Prompt" button
- **Pricing card:** $20/mo Beta Pricing, 100 min/mo, + $25 one-time setup
- "What you're getting" checklist
- "What happens next" 3-step guide
- **Two action buttons:**
  - "Start 7-day free trial" (green/teal) -- 7 days, No credit card, Demo call included
  - "Activate now" (white) -- $20/mo, 100 min, Real number, Full SMS, Live today
- Post-activation note: 2 manual steps (Telegram setup, phone forwarding)

### A4.2 Trial Activation

**API call:** `POST /api/provision/trial` -> 201

**Response:**
```json
{
  "success": true,
  "clientId": "229af8c4-4f79-4d50-8448-7e1490f5c66e",
  "trialExpiresAt": "2026-03-28T21:23:19.702Z",
  "setupUrl": "https://unmissed-ai-production.up.railway.app/auth/confirm?token_hash=...&type=recovery&next=/dashboard",
  "telegramLink": "https://t.me/hassitant_1bot?start=..."
}
```

**Trial Success Screen** (`trial-success-screen.png`)
- "You're live!" heading
- Checklist:
  - [x] Agent configured
  - [x] Trial activated -- 7 days free
  - [ ] Set up Telegram to receive call notifications (with "Set up" link)
  - [ ] Forward your business phone to your new AI number (with "Set up" link)
- "Open your Dashboard" button (purple, prominent)
- "Upgrade to get a phone number" button (outline)
- "Questions? support@unmissed.ai"

### A4.3 "Open your Dashboard" Click -- BROKEN

Clicking "Open your Dashboard" navigates to `auth/confirm?token_hash=...&type=recovery&next=/dashboard`

**Result:** Browser shows `chrome-error://chromewebdata/` -- the page fails to load in headless Playwright. This is because the auth/confirm URL is a Supabase password recovery link that:
1. Requires a fresh browser session (not the onboarding session)
2. Sets a session cookie via redirect
3. The one-time token may have already been consumed or is not designed for immediate redirect

This confirms **S12-BUG3** -- the dashboard access path depends entirely on this recovery token URL working correctly. If it fails, the user has no way to access their dashboard.

### A4.4 AdminTestPanel (`/onboard/status?id=INTAKE_ID`)

**Screenshot:** `e3-admin-test-panel.png`

The AdminTestPanel page shows:
- "One last step" heading
- Agent Preview card (Agent name: Dave, Business: S12 Audit Trial Test, Voice: Auto, Industry: Plumbing)
- Sample greeting in blue card
- "What's included" checklist
- Phone number picker: 3 available numbers (587, 639 area codes) + "Get a fresh local number $25 CAD"
- **ADMIN TESTING section** (yellow bordered):
  - "Skip Stripe" badge
  - Checkbox: "Buy a real Twilio number (costs ~$1.15/mo)" -- unchecked by default
  - "Test Activate -- Skip Payment" button
- "Activate my agent -- $25 setup + subscription" button (for real payment)

### A4.5 API Errors During Onboarding

| API Call | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/onboard/places-autocomplete` | GET | 200 | Google Places working |
| `/api/onboard/autofill` | POST | 200 | Business autofill working (empty response) |
| `/api/onboard/create-draft` | POST | **500** | "Failed to create draft" -- broken |
| `/api/provision/trial` | POST | 201 | Trial provisioning works |

**BUG:** `/api/onboard/create-draft` returns 500. This appears to be called during the onboarding flow but the flow still proceeds. Unclear what this draft is supposed to create -- may be related to saving partial form state.

---

## Track E -- Trial & Onboarding E2E Verification

### E1 -- Trial Provisioning Gap Analysis

**SQL Query Results for trial clients:**

| Field | S12 Audit Trial Test | Extreme fade | jane |
|-------|---------------------|--------------|------|
| slug | s12-audit-trial-test | extreme-fade | jane |
| status | active | active | active |
| subscription_status | trialing | trialing | trialing |
| trial_expires_at | 2026-03-28 | 2026-03-24 | 2026-03-25 |
| **ultravox_agent_id** | **NULL** | **NULL** | **NULL** |
| has_prompt | true | true | true |
| **prompt_length** | **0** | **0** | **0** |
| **agent_name** | **NULL** | **NULL** | **NULL** |
| agent_voice_id | aa601962 (default) | aa601962 (default) | aa601962 (default) |
| sms_enabled | true | true | false |
| booking_enabled | false | false | false |
| knowledge_backend | NULL | NULL | NULL |
| tool_count | 3 | 0 | 0 |
| intake_submissions | 1 (status: activated) | ? | ? |
| prompt_versions | **0** | ? | ? |
| notification_logs | **0** | ? | ? |
| client_users | 1 (role: owner) | ? | ? |

### CRITICAL FINDING: S12-BUG1 CONFIRMED

**All 3 trial clients have:**
- `ultravox_agent_id = NULL` -- NO Ultravox agent was created
- `prompt_length = 0` -- system_prompt column is empty string, not a real prompt
- `agent_name = NULL` -- no agent name stored despite user entering "Dave" in the form
- `agent_voice_id = aa601962` -- default voice ID, not the user's selected voice (Jacqueline)

**What the trial path DOES create:**
- clients row (slug, business_name, niche, contact_email, status=active, subscription_status=trialing)
- intake_submissions row (status=activated, with intake_json)
- client_users row (user_id linked to a Supabase auth user, role=owner)
- tools array (3 tools for S12: hangUp, sendTextMessage, checkForCoaching -- because sms_enabled=true)

**What the trial path does NOT create:**
- Ultravox agent (createAgent never called)
- System prompt (buildPromptFromIntake never called)
- Agent name in clients table
- Correct voice ID from user selection
- prompt_versions row
- Welcome email (no notification_logs)
- Telegram admin notification

**Compare to paid path** (`create-public-checkout`): The paid path calls website scraping, prompt generation, agent creation, voice selection, and produces a fully functional agent.

### E3 -- Post-Activation Dashboard Experience

Viewed as admin for trial client `s12-audit-trial-test`:

| Section | Route | State | Notes |
|---------|-------|-------|-------|
| Calls | `/dashboard/calls` | Shows stats UI | "12 Total, 0 HOT, 0 WARM" -- but these appear to be global stats, not client-scoped |
| Settings > Agent | `/dashboard/settings` (Agent tab) | Shows empty agent | No agent name, default voice, capabilities toggles visible but agent is not real |
| Settings > SMS | SMS tab | Shows SMS settings | SMS enabled toggle is ON |
| Settings > Voice | Voice tab | Shows voice selector | Current voice shown as default |
| Settings > Alerts | Alerts tab | Telegram "Not connected" | Setup instructions visible |
| Settings > Billing | Billing tab | Shows trial plan | "Starter 100 minutes", "Free trial -- $20/mo starts on --", usage 0/100 |
| Settings > Knowledge | Knowledge tab | "Knowledge base not enabled" | Clean empty state with Enable button |
| Lab | `/dashboard/lab` | **"No live prompt yet"** | Shows message: "Complete onboarding setup to generate your agent's prompt, then return here to test it." |
| Live | `/dashboard/live` | "No active calls" | Correct empty state |
| Leads | `/dashboard/leads` | Shows lead queue | **BUG: Shows leads from OTHER clients** (Hasan, Windshield Hub) -- not scoped to trial client |
| Voices | `/dashboard/voices` | Voice library | 71 voices available, working correctly |
| Setup | `/dashboard/setup` | Phone setup wizard | Shows "Not configured yet" for phone number |

**KEY ISSUES:**

1. **Lab page correctly detects no prompt** -- shows "No live prompt yet. Complete onboarding setup to generate your agent's prompt." This is the RIGHT error message but the user was told "You're live!" on the success screen.

2. **Leads page data leak** -- The leads/outbound queue shows leads from other clients (Hasan, Windshield Hub) when viewing the trial client context. This is a data isolation issue.

3. **Calls page shows global stats** -- The operator activity section shows "12 Total" calls but the trial client has 0 calls. The minute usage counter correctly shows 0/100.

4. **Settings Agent tab loads** -- But the agent has no real prompt, no real Ultravox agent, no agent name. The UI looks populated because it has toggles and fields, but the agent is non-functional.

5. **Billing tab shows incorrect "Setup fee: $25 (paid)"** -- The trial user did not pay $25. This is misleading.

---

## Critical Bugs Found

### BUG-1: Trial path does NOT create Ultravox agent or system prompt (CRITICAL)

**Severity:** CRITICAL -- trial users get a completely non-functional agent
**Evidence:** 3 trial clients in production, all with `ultravox_agent_id=NULL`, `prompt_length=0`
**Impact:** Trial users see "You're live!" but cannot receive any calls. The dashboard Lab page correctly says "No live prompt yet" which contradicts the success screen.
**Root cause:** `/api/provision/trial` creates a bare `clients` row but never calls `buildPromptFromIntake()`, `createAgent()`, or sets `system_prompt`/`ultravox_agent_id`/`agent_voice_id`.

### BUG-2: Dashboard access via recovery token is fragile (HIGH)

**Severity:** HIGH -- users may not be able to reach their dashboard
**Evidence:** "Open your Dashboard" button navigates to `auth/confirm?token_hash=...&type=recovery&next=/dashboard`. This is a one-time Supabase recovery token that expires in 24h. If it fails or is consumed, there is no self-serve way to get a new one.
**Impact:** Users who don't click the button within 24h, or whose browser doesn't handle the redirect, are locked out unless they can use Google OAuth (status unknown).

### BUG-3: `/api/onboard/create-draft` returns 500 (MEDIUM)

**Severity:** MEDIUM -- the flow proceeds despite the error, but draft saving is broken
**Evidence:** `POST /api/onboard/create-draft` -> 500 `{"error":"Failed to create draft"}`
**Impact:** Partial form state may not be saved, meaning users who abandon and return lose their progress.

### BUG-4: Leads page shows cross-client data (MEDIUM)

**Severity:** MEDIUM -- data isolation failure
**Evidence:** When viewing leads for trial client `s12-audit-trial-test`, leads from Hasan Sharif and Windshield Hub are visible.
**Impact:** If an owner (non-admin) sees this, they would see other clients' lead data. Needs investigation whether RLS prevents this for owner-role users or if it only happens in admin view.

### BUG-5: `/dashboard/numbers` returns 404 (LOW)

**Severity:** LOW -- sidebar link to non-existent page
**Evidence:** The "Numbers" link in the admin sidebar navigates to `/dashboard/numbers` which returns 404.
**Impact:** Admin cannot manage phone numbers from this page.

### BUG-6: Trial billing shows "$25 (paid)" when user paid nothing (LOW)

**Severity:** LOW -- misleading but not blocking
**Evidence:** Billing tab for trial client shows "Setup fee: $25 (paid)"
**Impact:** Confusing for trial users.

### BUG-7: Agent name and voice selection not persisted from onboarding (MEDIUM)

**Severity:** MEDIUM -- user's choices from the onboarding form are lost
**Evidence:** User selected voice "Jacqueline" and agent name "Dave" but DB has `agent_name=NULL` and `agent_voice_id=aa601962` (the system default, not Jacqueline's ID).
**Impact:** Even if the agent creation bug is fixed, the user's onboarding selections would not be applied.

---

## UX Issues

### Onboarding Flow UX

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| U1 | Success screen says "You're live!" but agent is not functional | HIGH | Misleading -- creates false expectation |
| U2 | No demo call available in trial flow | MEDIUM | "Talk to Dave -- Free 2-min demo" button failed with "Could not start demo / Not supported" |
| U3 | Step 3 pre-fills with Google Places data (good) | -- | Positive finding |
| U4 | Step 4 (Knowledge) auto-generates FAQ questions from niche (good) | -- | Positive finding |
| U5 | "Upgrade to get a phone number" on success screen is unclear | LOW | Does this mean the trial doesn't include a phone number? Needs clarification |
| U6 | No progress save -- if user closes browser mid-form, data is lost | MEDIUM | `create-draft` API is 500ing, so no save |

### Admin Dashboard UX

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| U7 | Client switching requires going to Clients page -- no global dropdown | LOW | Current pill-button pattern on Setup page works but is non-standard |
| U8 | Settings page defaults to first client (alphabetical) when no client_id | LOW | Could confuse admin if they expect "all clients" view |
| U9 | Sidebar has duplicate "CLIENTS" section label | LOW | "CLIENTS: Clients" and "CLIENTS: Outbound Queue" |

---

## Communication Chain (E6)

| Step | Channel | Content | Working? |
|------|---------|---------|----------|
| Trial activation | Email (Resend) | Welcome + dashboard link | **NOT SENT** -- 0 notification_logs rows for trial client |
| Trial activation | SMS (Twilio) | "Your AI agent is live" | **SKIPPED** -- trial path does not send SMS |
| Trial activation | Telegram (admin) | Admin notification | **NOT SENT** -- 0 notification_logs rows |
| Dashboard access | Recovery URL | One-time auth token | **FRAGILE** -- expires 24h, single-use |
| Telegram setup | Link | t.me/hassitant_1bot?start=UUID | **PROVIDED** -- in API response + success screen |

**Summary:** The trial activation sends ZERO communications to the user or admin. The only way the user can access their dashboard is via the recovery token URL provided on the success screen. If they close that page, they have no way to recover access unless:
1. They bookmarked the URL (unlikely)
2. They received a welcome email (not sent)
3. They can use Google OAuth (status unknown)

---

## Screenshot Index

### Track A3 -- Admin Dashboard

| Screenshot | Description |
|-----------|-------------|
| `01-dashboard-home-desktop.png` | Command Center at 1440px |
| `01-dashboard-home-tablet.png` | Command Center at 768px |
| `01-dashboard-home-mobile.png` | Command Center at 390px |
| `setup-02-clients-list.png` | All Clients list page |
| `setup-01-agent-page.png` | Agent/Setup page with client pills |
| `settings-hasan-sharif-overview.png` | Hasan Sharif full settings (Agent tab) |
| `settings-hasan-sharif-voice.png` | Hasan Sharif Voice tab |
| `settings-windshield-hub-overview.png` | Windshield Hub full settings |
| `settings-trial-extreme-fade.png` | Trial client (Extreme fade) settings |
| `settings-trial-jane.png` | Trial client (jane) settings |
| `setup-hasan-sharif-step1.png` | Phone Setup for Hasan |
| `setup-hasan-sharif-step2.png` | Agent step for Hasan |
| `setup-hasan-sharif-step3.png` | Context step for Hasan |
| `nav-demos.png` | Demos analytics page |
| `nav-insights.png` | Insights analytics page |
| `nav-admin-costs.png` | Admin Cost Intel page |
| `admin-numbers.png` | Numbers page (404 error) |

### Track A4 -- Onboarding Flow

| Screenshot | Description |
|-----------|-------------|
| `onboard-step1-industry.png` | Step 1: Industry selection |
| `onboard-step1-filled.png` | Step 1: After selecting Plumbing |
| `trial-step2-voice.png` | Step 2: Voice selection |
| `trial-step3-business.png` | Step 3: Business basics (pre-filled) |
| `trial-step4-knowledge.png` | Step 4: Knowledge & FAQ |
| `trial-step5-handling.png` | Step 5: Call handling |
| `trial-step6-review.png` | Step 6: Review & Activate (top) |
| `trial-step6-review-bottom.png` | Step 6: Review (bottom with buttons) |
| `onboard-review-before-trial.png` | Full review page |
| `trial-after-click.png` | After clicking trial button |
| `trial-success-screen.png` | Trial success screen ("You're live!") |
| `trial-dashboard-landing.png` | Dashboard redirect failure |

### Track E -- Post-Activation

| Screenshot | Description |
|-----------|-------------|
| `e3-calls.png` | Trial client calls page |
| `e3-settings-agent.png` | Trial client Agent settings |
| `e3-settings-sms.png` | Trial client SMS settings |
| `e3-settings-voice.png` | Trial client Voice settings |
| `e3-settings-alerts.png` | Trial client Alerts settings |
| `e3-settings-billing.png` | Trial client Billing tab |
| `e3-settings-knowledge.png` | Trial client Knowledge tab |
| `e3-lab.png` | Trial client Lab ("No live prompt yet") |
| `e3-live.png` | Trial client Live calls |
| `e3-leads.png` | Trial client Leads (shows cross-client data) |
| `e3-setup.png` | Trial client Setup page |
| `e3-admin-test-panel.png` | AdminTestPanel for intake |
| `e3-intake-page.png` | Intake Pipeline page |

---

## Test Data Created

| Item | Value | Notes |
|------|-------|-------|
| Client ID | `229af8c4-4f79-4d50-8448-7e1490f5c66e` | Trial client |
| Slug | `s12-audit-trial-test` | |
| Business name | S12 Audit Trial Test | |
| Niche | plumbing | |
| Contact email | s12-trial-test@example.com | Fake email |
| Intake ID | `de5f4f7e-30b7-4cbb-9aa4-8e543e7a7367` | |
| User ID | `71e12dac-2502-465c-b072-b493f9acaf13` | Supabase auth user |
| Trial expires | 2026-03-28 | 7 days from creation |

**Cleanup:** This client should be deleted after the audit. Run:
```sql
DELETE FROM client_users WHERE client_id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
DELETE FROM intake_submissions WHERE client_id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
DELETE FROM clients WHERE id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
```

---

## Summary of Findings

**CRITICAL (must fix before any trial/marketing):**
1. Trial path creates a non-functional agent (no Ultravox agent, no prompt, no voice)
2. Dashboard access depends on fragile one-time recovery token

**HIGH:**
3. Demo call button fails ("Not supported") on the review screen
4. No communications sent on trial activation (no email, no admin notification)

**MEDIUM:**
5. `/api/onboard/create-draft` returns 500 (form progress not saved)
6. Leads page leaks cross-client data
7. Agent name and voice selection from onboarding not persisted

**LOW:**
8. `/dashboard/numbers` returns 404 despite sidebar link
9. Billing tab shows "$25 (paid)" for trial users
10. Sidebar has duplicate "CLIENTS" section labels
