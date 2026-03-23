# Launch Verification Checklist — unmissed.ai

> Manual QA matrix for validating onboarding + dashboard + voice-agent flows before selling.
> 18 flows, 30+ checkpoints. Run against staging or production.

---

## 1. New User Onboarding (`/onboard`)

### 1a. Step 1 — Niche + Business Name + Location
- **Pre:** Fresh browser, no account
- **Steps:** Go to `/onboard`. Pick a niche (e.g. `plumbing`). Enter business name, city. Places autocomplete should fire.
- **Expected:** Niche grid renders all production-ready niches (`NICHE_PRODUCTION_READY` in `lib/niche-config.ts`). Agent name auto-populates from `defaultAgentNames`. Location autocomplete works.
- **Debug:** Browser console for Google Maps API errors. Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var.
- **Pass/Fail:** [ ]

### 1b. Step 2 — Voice Selection
- **Pre:** Step 1 complete
- **Steps:** Pick a voice. Play sample if available.
- **Expected:** Voice samples load. Selection persists when navigating back/forward.
- **Debug:** Network tab for Cartesia/Ultravox voice preview endpoints.
- **Pass/Fail:** [ ]

### 1c. Step 3 — Business Basics (hours, phone, description)
- **Pre:** Step 2 complete
- **Steps:** Fill business hours, phone number, short description.
- **Expected:** Fields save to `OnboardingData` state. Reasonable defaults shown.
- **Debug:** React devtools or `localStorage` key `unmissed_onboard_data`.
- **Pass/Fail:** [ ]

### 1d. Step 4 — FAQ + File Upload
- **Pre:** Step 3 complete
- **Steps:** See pre-populated FAQ stubs for niche. Fill 1-2 answers. Optionally upload a PDF (< 5MB, `.pdf`/`.txt`/`.docx`).
- **Expected:** Max 3 files, 5MB each. Accepted types enforced. FAQ answers persist.
- **Debug:** `step4.tsx` — `ACCEPTED_TYPES`, `MAX_FILE_SIZE`, `MAX_FILES` constants.
- **Pass/Fail:** [ ]

### 1e. Step 5 — Call Handling Preferences
- **Pre:** Step 4 complete
- **Steps:** Set call handling preferences (voicemail, transfer, etc.).
- **Expected:** Options render based on niche. Selections persist.
- **Debug:** `step5-handling.tsx`.
- **Pass/Fail:** [ ]

### 1f. Step 6 — Review + Submit
- **Pre:** Steps 1-5 complete
- **Steps:** Review summary. Click submit / start trial.
- **Expected:** Spinner then success. Redirects to `/onboard/status` or trial success screen.
- **Debug:** Network tab for `POST /api/provision/trial`. Check response body for errors. Rate limit: 3/hr/IP.
- **Pass/Fail:** [ ]

---

## 2. Website Scrape Preview (during onboarding)

- **Pre:** Onboarding step where website URL is entered. Have a real URL ready (e.g. a small business site).
- **Steps:** Enter URL. Wait for scrape preview to load.
- **Expected:** `POST /api/onboard/scrape-preview` returns normalized extraction (business facts, FAQ, service tags). Preview card shows extracted data. Rate limit: 5/IP/hr.
- **Debug:** Railway logs for `[scrape-preview]`. `lib/website-scraper.ts` (Sonar+Haiku). `lib/knowledge-extractor.ts` for normalization. HTTP 429 = rate limited.
- **Pass/Fail:** [ ]

---

## 3. Scrape Approval Submission

- **Pre:** Logged-in user with scraped website data pending (check `knowledge_chunks` where `status = 'pending'`).
- **Steps:** Dashboard > Settings > Website Knowledge card (or Knowledge Base tab). Review scraped facts/QA. Click approve.
- **Expected:** `POST /api/dashboard/approve-website-knowledge` fires. Chunks seeded via `seedKnowledgeFromScrape()` into `knowledge_chunks`. Status flips to `approved`. `business_facts` + `extra_qa` merged into client row for backward compat.
- **Debug:** Supabase: `SELECT * FROM knowledge_chunks WHERE client_id = '<id>' ORDER BY created_at DESC LIMIT 20`. Check `chunk_type`, `status`, `trust_tier`. Also check `clients.business_facts`, `clients.extra_qa` columns.
- **Pass/Fail:** [ ]

---

## 4. Trial/Dashboard First Login

- **Pre:** Trial provisioned (flow 1 complete). Email received with magic link or password set.
- **Steps:** Log in. Land on dashboard home.
- **Expected:**
  - `TrialBadge` shows "Paid plan" on gated features
  - `OnboardingChecklist` visible with 4 steps (meet agent, setup alerts, train agent, go live)
  - `GuidedTour` fires on first visit (desktop only, > 1024px width)
  - `subscription_status` = `'trial'` in `clients` table
- **Debug:** Supabase: `SELECT slug, subscription_status, status FROM clients WHERE slug = '<slug>'`. Check `client_users` table for user-client link. localStorage key for tour: `STORAGE_KEYS.TOUR_COMPLETED`.
- **Pass/Fail:** [ ]

---

## 5. Talk to Your Agent / Orb Test (WebRTC)

- **Pre:** Logged in, client has an Ultravox agent provisioned (`agent_id` not null).
- **Steps:** Dashboard home or Settings > Agent tab. Click "Talk to your Agent" orb/button.
- **Expected:** `POST /api/dashboard/agent-test` creates a WebRTC call. Orb animation starts. Agent speaks greeting. Transcript bubbles appear. Timer counts down (max 300s). End call button works.
- **Debug:**
  - Network: `POST /api/dashboard/agent-test` — check for `joinUrl` in response
  - Supabase: `SELECT agent_id FROM clients WHERE slug = '<slug>'` — must not be null
  - Browser console for WebRTC errors (mic permission denied, ICE failures)
  - `useUltravoxCall` hook in `hooks/useUltravoxCall.ts`
  - Railway logs for `[agent-test]`
- **Pass/Fail:** [ ]

---

## 6. Try-Asking Prompts (Suggestion Chips)

- **Pre:** Same as flow 5. Agent has at least 1 capability configured (hours, booking, FAQs, etc.).
- **Steps:** Look at the area below the voice orb on AgentTestCard / AgentVoiceTest.
- **Expected:** Up to 4 dynamic chips based on enabled capabilities:
  - Hours set: "What are your hours?"
  - Booking enabled: "Can I book an appointment?"
  - Transfer configured: "Can I speak to someone?"
  - FAQs exist: "Tell me about your services"
  - Knowledge enabled: "Ask a detailed question"
  - SMS enabled: "Can you text me the details?"
  - Fallback: "Hi, how can you help me?"
- **Debug:** `TryAskingChips` in `AgentVoiceTest.tsx:466`. `AgentKnowledge` type computed from client config.
- **Pass/Fail:** [ ]

---

## 7. Agent Knowledge Card + Setup Progress

### 7a. Agent Knowledge Card
- **Pre:** Logged in to dashboard.
- **Steps:** Settings > Agent tab. Find the "What your agent knows" card.
- **Expected:** Shows counts: Business Facts, Q&A Pairs, Hours (set/not set), Booking (connected/not), Voice style, Knowledge engine status. Zero states display "0" or "Not set" — not broken UI.
- **Debug:** `AgentKnowledgeCard.tsx`. Reads from `client` prop: `business_facts`, `extra_qa`, `business_hours_weekday`, `booking_enabled`, `calendar_auth_status`, `voice_style_preset`, `knowledge_backend`.
- **Pass/Fail:** [ ]

### 7b. Setup Progress Ring
- **Pre:** Logged in.
- **Steps:** Look for the progress ring / completion indicator.
- **Expected:** Ring shows % based on completed setup items. Updates dynamically as items are checked off.
- **Debug:** `SetupProgressRing.tsx`. Also `OnboardingChecklist.tsx` for step tracking via `useOnboarding` hook.
- **Pass/Fail:** [ ]

---

## 8. Quick-Add FAQ from Call/Gap Flow

- **Pre:** At least 1 completed call with transcript. Call had a topic the agent couldn't answer (knowledge gap detected).
- **Steps:** Dashboard > Calls > Click a call with gaps. Look for "Knowledge Gap" section. Click "Add FAQ" on a gap topic.
- **Expected:** `QuickAddFaq` component appears with pre-filled question (extracted from transcript). Enter answer. Submit. FAQ saved to `extra_qa` on client row. Toast confirmation.
- **Debug:**
  - `QuickAddFaq.tsx` — `findRelevantQuestion()` searches transcript
  - `CallDetail.tsx` — renders gap topics from `transcript-analysis.ts` output
  - Supabase: `SELECT extra_qa FROM clients WHERE id = '<id>'` to verify save
  - `call_logs.knowledge_gaps` or `call_logs.analysis_result` for gap data
- **Pass/Fail:** [ ]

---

## 9. Guided Tour + Empty States

### 9a. Guided Tour (driver.js)
- **Pre:** Fresh trial user, first login, desktop (> 1024px), `TOUR_COMPLETED` not in localStorage.
- **Steps:** Log in. Tour should auto-start.
- **Expected:** 4-step overlay tour:
  1. `data-tour="agent-hero"` — hero card
  2. `data-tour="nav-settings"` — Settings sidebar link
  3. `data-tour="nav-agent"` — Agent setup link
  4. `data-tour="nav-calls"` — Calls link
  Tour sets `localStorage[TOUR_KEY]` on completion. Does NOT run on mobile (< 1024px).
- **Debug:** `GuidedTour.tsx`. Check `localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED)`. Check `data-tour` attributes exist on DOM elements.
- **Pass/Fail:** [ ]

### 9b. Empty States
- **Pre:** New client with no calls, no knowledge, no bookings, no notifications.
- **Steps:** Visit each dashboard tab: Calls, Knowledge Base, Bookings, Notifications, Insights.
- **Expected:** Each shows a styled empty state (not blank white):
  - `NoCalls.tsx`, `NoKnowledge.tsx`, `NoBookings.tsx`, `NoNotifications.tsx`, `NoInsights.tsx`
  - Each has an icon, message, and optional CTA.
- **Debug:** `components/dashboard/empty-states/` directory. `EmptyStateBase.tsx` is the shared wrapper.
- **Pass/Fail:** [ ]

---

## 10. Knowledge Base Visibility After Onboarding

- **Pre:** Completed onboarding with FAQs entered + website scraped + approval done.
- **Steps:** Dashboard > Knowledge Base tab.
- **Expected:**
  - `ChunkBrowser` shows seeded chunks (from FAQ + scrape)
  - `PendingSuggestions` shows any unapproved chunks
  - `KnowledgeGaps` shows gaps from recent calls (if any)
  - Test query box: enter a question, get hybrid search results with similarity scores
  - Chunk types visible: `fact`, `qa`, `manual`, `scraped`
- **Debug:**
  - Supabase: `SELECT chunk_type, status, trust_tier, content FROM knowledge_chunks WHERE client_id = '<id>' ORDER BY created_at DESC`
  - `KnowledgeBaseTab.tsx` — test query hits knowledge search endpoint
  - `lib/embeddings.ts` for vector generation
  - `hybrid_match_knowledge()` Supabase function for search
- **Pass/Fail:** [ ]

---

## 11. Trial vs Paid Gating Behavior

- **Pre:** Two test accounts: one trial (`subscription_status = 'trial'`), one paid (`subscription_status = 'active'`).
- **Steps:**
  - **Trial:** Check that `TrialBadge` appears on gated features. `UpgradeCTA` appears when accessing paid features. WebRTC test calls work. No Twilio number assigned.
  - **Paid:** All features unlocked. No TrialBadge. Twilio number assigned. Full call history visible.
- **Expected:** Trial users can: test agent (WebRTC), view settings, see knowledge. Trial users cannot: make live phone calls, get a real number, access advanced features.
- **Debug:**
  - `TrialBadge.tsx` — renders "Paid plan" badge
  - `UpgradeCTA.tsx` — renders upgrade prompt
  - `OnboardingChecklist.tsx` line 49: `liveDone = hasPhoneNumber && !isTrial`
  - Supabase: `SELECT subscription_status, twilio_phone_number FROM clients WHERE slug = '<slug>'`
  - Stripe: check `api/cron/trial-expiry/route.ts` for expiry logic
- **Pass/Fail:** [ ]

---

## 12. Real Phone Call E2E (if environment supports Twilio)

- **Pre:** Active (paid) client with: Twilio number, Ultravox agent, system_prompt deployed. Know the Twilio number.
- **Steps:**
  1. Call the Twilio number from a real phone
  2. Agent should answer with its greeting
  3. Ask a question the agent should know (based on FAQ/knowledge)
  4. Ask for an SMS (if SMS enabled)
  5. Ask to book (if booking enabled)
  6. Hang up
  7. Wait 30s for completed webhook
- **Expected:**
  - Call shows in `call_logs` with `status = 'completed'`
  - Transcript saved in `call_logs.transcript`
  - Recording URL saved (if recording enabled)
  - Notification sent (check `notification_logs`)
  - SMS sent (check `sms_logs` if SMS was requested)
  - Knowledge gaps detected (check `call_logs.analysis_result`)
- **Debug path when it fails:**
  - **No ring/busy:** Twilio console > call logs > check webhook URL matches `/api/webhook/{slug}/inbound`. Check Railway is up.
  - **Ring but no agent:** Railway logs for `[inbound]`. Check `clients.agent_id` is set. Check Ultravox API key valid.
  - **Agent answers but hangs up:** Check `maxDuration` on agent. Check for errors in Railway logs.
  - **No transcript after call:** Check `/api/webhook/{slug}/completed` or `/api/webhook/ultravox` (native webhook). Railway logs for `[completed]`.
  - **No notification:** Check `notification_logs` table. Check Telegram bot token, chat ID. Check `clients.telegram_chat_id`.
  - **Supabase queries:**
    ```sql
    SELECT id, status, caller_number, duration_seconds, created_at
    FROM call_logs WHERE client_id = '<id>' ORDER BY created_at DESC LIMIT 5;

    SELECT * FROM notification_logs WHERE client_id = '<id>' ORDER BY created_at DESC LIMIT 5;

    SELECT * FROM sms_logs WHERE client_id = '<id>' ORDER BY created_at DESC LIMIT 5;
    ```
- **Pass/Fail:** [ ]

---

## 13. Settings Save + Sync to Ultravox

- **Pre:** Logged-in client owner or admin.
- **Steps:** Settings > Agent tab. Change agent name, voice style, hours, or a capability toggle (SMS, booking, transfer). Click save.
- **Expected:** `PATCH /api/dashboard/settings` fires. Toast confirms save. Changes persist on refresh. If field syncs to Ultravox (voice, prompt, tools), verify via Railway logs for `[updateAgent]`.
- **Debug:**
  - `usePatchSettings.ts` — hook that sends PATCH
  - Settings cards: `AgentOverviewCard`, `HoursCard`, `VoiceStyleCard`, `BookingCard`, `SetupCard`, etc.
  - Supabase: verify column updated on `clients` row
  - If Ultravox sync expected: Railway logs for `updateAgent` call, check for 4xx errors
- **Pass/Fail:** [ ]

---

## 14. Stripe Checkout + Trial Upgrade

- **Pre:** Trial user logged in. Stripe in TEST mode (`sk_test_`).
- **Steps:** Click upgrade CTA (from `UpgradeCTA.tsx` or billing tab). Complete Stripe checkout with test card `4242 4242 4242 4242`.
- **Expected:** Redirect back to dashboard. `subscription_status` flips from `'trial'` to `'active'`. `TrialBadge` disappears. Twilio number assigned (if provisioning is automatic).
- **Debug:**
  - `POST /api/stripe/create-public-checkout` or `/api/stripe/create-checkout`
  - Stripe webhook: `/api/webhook/stripe` — handles `checkout.session.completed`, `customer.subscription.*`
  - Supabase: `SELECT subscription_status, stripe_customer_id, stripe_subscription_id FROM clients WHERE slug = '<slug>'`
  - Stripe dashboard: check test mode events
- **Pass/Fail:** [ ]

---

## 15. Prompt Regeneration Safety

- **Pre:** Client with manual prompt patches (custom FAQ, voice style edits, etc.).
- **Steps:** Trigger prompt regeneration (Settings > regenerate, or `/api/dashboard/regenerate-prompt`).
- **Expected:** New prompt generated. Manual patches preserved (not wiped). Prompt version incremented in `prompt_versions` table.
- **Debug:**
  - `POST /api/dashboard/regenerate-prompt`
  - `lib/prompt-builder.ts` — `buildPromptFromIntake()` + `validatePrompt()`
  - Supabase: `SELECT version, created_at FROM prompt_versions WHERE client_id = '<id>' ORDER BY version DESC LIMIT 3`
  - Compare before/after system_prompt for lost sections
- **Pass/Fail:** [ ]

---

## 16. File Upload to Knowledge Base (Dashboard)

- **Pre:** Logged-in user. Prepare a small test PDF (< 5MB).
- **Steps:** Dashboard > Knowledge Base tab (or settings). Upload a file.
- **Expected:** File accepted. Chunks extracted and seeded into `knowledge_chunks`. Chunks show in ChunkBrowser.
- **Debug:**
  - `POST /api/client/knowledge/upload` — upload endpoint
  - Supabase: `SELECT * FROM knowledge_chunks WHERE client_id = '<id>' AND source LIKE '%upload%' ORDER BY created_at DESC`
  - Check embedding not null (vector generated)
- **Pass/Fail:** [ ]

---

## 17. Mobile Responsiveness Smoke

- **Pre:** Any logged-in account.
- **Steps:** Test on 375px width (iPhone SE) and 768px width (iPad):
  - Onboarding form: all steps navigable, no horizontal overflow
  - Dashboard: sidebar hidden, mobile nav (`MobileNav.tsx`) works
  - Settings: cards stack vertically, save buttons reachable
  - Guided tour: does NOT run below 1024px (confirmed suppressed)
- **Expected:** No layout breaks, no unreachable buttons, no horizontal scroll.
- **Debug:** Chrome DevTools responsive mode. Check `MobileNav.tsx`, sidebar `hidden lg:flex`.
- **Pass/Fail:** [ ]

---

## 18. Auth Edge Cases

### 18a. Wrong Password
- **Steps:** Login with valid email + wrong password.
- **Expected:** Error message in red. No redirect. No crash.
- **Pass/Fail:** [ ]

### 18b. Magic Link / Passwordless
- **Steps:** Click "Email me a sign-in link" on login page. Enter email.
- **Expected:** Success toast. Email arrives (check Supabase auth logs if not).
- **Pass/Fail:** [ ]

### 18c. Expired Session
- **Steps:** Log in, clear cookies (or wait for session timeout), refresh dashboard.
- **Expected:** Redirect to `/login`. No white screen or 500 error.
- **Pass/Fail:** [ ]

### 18d. Unauthorized Route Access
- **Steps:** While logged out, navigate directly to `/dashboard`, `/dashboard/settings`, `/admin/clients`.
- **Expected:** Redirect to `/login` for all. Admin routes reject non-admin users.
- **Pass/Fail:** [ ]

---

## Quick Reference — Key Tables

| Table | What to check |
|-------|--------------|
| `clients` | `status`, `subscription_status`, `agent_id`, `system_prompt` (not null), `twilio_phone_number` |
| `client_users` | User-client link exists, `role` correct |
| `call_logs` | `status`, `transcript`, `recording_url`, `analysis_result`, `knowledge_gaps` |
| `knowledge_chunks` | `chunk_type`, `status`, `trust_tier`, `content`, `embedding` (not null) |
| `notification_logs` | `channel`, `status`, `error` |
| `sms_logs` | `direction`, `status`, `body` |
| `bookings` | `status`, `start_time`, `calendar_event_id` |

## Quick Reference — Key API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/provision/trial` | Trial onboarding submit |
| `POST /api/onboard/scrape-preview` | Website scrape during onboarding |
| `POST /api/dashboard/approve-website-knowledge` | Approve scraped chunks |
| `POST /api/dashboard/agent-test` | WebRTC test call |
| `PATCH /api/dashboard/settings` | Save settings changes |
| `POST /api/dashboard/regenerate-prompt` | Regenerate system prompt |
| `POST /api/client/knowledge/upload` | Upload knowledge file |
| `POST /api/stripe/create-public-checkout` | Stripe checkout session |
| `POST /api/webhook/[slug]/inbound` | Twilio inbound call handler |
| `POST /api/webhook/[slug]/completed` | Call completed handler |
| `POST /api/webhook/ultravox` | Native Ultravox webhook |
| `POST /api/webhook/stripe` | Stripe webhook |

## Environment Prereqs

| Item | Check |
|------|-------|
| Railway deploy | `APP_URL` env var set, build green |
| Stripe mode | `sk_test_` vs `sk_live_` — know which you're testing |
| Twilio webhooks | Twilio console URLs match Railway URL |
| Ultravox agents | `clients.agent_id` matches Ultravox dashboard |
| Supabase auth redirect | `https://unmissed-ai-production.up.railway.app/**` in Supabase auth config |
| Test accounts | `e2etest@unmissed.ai` (trial), paid client account, `admin@unmissed.ai` (admin) |
