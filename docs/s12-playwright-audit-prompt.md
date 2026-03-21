# S12 Full System Audit — Parallel Agent Prompt

Paste this into a new Claude Code chat. It will spawn parallel agents to audit every layer of unmissed.ai simultaneously.

---

## Instructions for the Executing Chat

This audit has **4 independent tracks** that should run as **parallel agents** (use Agent tool with run_in_background where possible). After all 4 complete, synthesize findings into a single report.

**Production URL:** https://unmissed-ai-production.up.railway.app
**Codebase:** `/Users/owner/Downloads/CALLING AGENTs/agent-app`
**Supabase project:** `dczbgraekmzirxknjvwe` (use mcp__supabase__ tools)

Ask me for login credentials when needed. Do NOT guess passwords.

---

## TRACK A: Visual UI Audit (Playwright MCP)

Use Playwright MCP (`browser_navigate`, `browser_take_screenshot`, `browser_snapshot`). Capture at THREE widths: **1440px** (desktop), **768px** (tablet), **390px** (mobile).

### A1 — Public Pages
Screenshot at all 3 widths:
1. `/` — Landing page (full scroll — multiple screenshots)
2. `/pricing` — Pricing page
3. `/login` — Login page
4. `/onboard` — Onboarding start page
5. `/for-realtors`, `/for-auto-glass`, `/for-plumbing`, `/for-hvac`, `/for-dental`, `/for-legal` — All niche pages
6. `/demo` — Demo page
7. `/try` — Try page
8. `/privacy`, `/terms` — Legal pages

### A2 — Client Dashboard
Login as a client owner (ask me for credentials for `fix@windshieldhub.ca`):
1. `/dashboard` — Main calls list
2. `/dashboard/settings` — ALL tabs: Agent, Business Info, Notifications, Calendar, Knowledge, Billing
3. `/dashboard/leads` — Leads page
4. `/dashboard/live` — Live calls
5. `/dashboard/voices` — Voice selection
6. `/dashboard/setup` — Setup/onboarding status

For each settings tab, also capture:
- Click "Set up Telegram" — does it guide you or just show a form?
- Toggle SMS on — what happens?
- Click "Connect Calendar" — what happens?
- Knowledge section empty vs with data

### A3 — Admin Dashboard
Login as `admin@unmissed.ai` (ask me for credentials):
1. `/dashboard` — Admin view with client selector
2. `/dashboard/settings` for each client — all tabs
3. Admin-only controls (sync agents, command strip)
4. Switch between clients — does the UI update correctly?

### A4 — Onboarding Flow (end-to-end)
While logged in as admin:
1. Navigate to `/onboard`
2. Screenshot EVERY step of the intake form (step 1 through step 6)
3. On `/onboard/status` — screenshot the AdminTestPanel
4. Click "Test Activate — Skip Payment" (do NOT check "buy number" — use test data)
5. Screenshot every activation progress step
6. After activation: navigate to the new test client's dashboard
7. Screenshot the initial empty state — this is the customer's first impression

### A5 — Empty States & Edge Cases
1. Empty dashboard — zero calls, zero leads. Helpful or blank?
2. Empty knowledge tab — explains what to do?
3. Empty leads page — helpful or blank?
4. Settings before any setup — Telegram disconnected, calendar disconnected, SMS off
5. Error feedback — save a setting. Toast? Success message? Silence?
6. Invalid input — submit forms with missing fields. What validation?
7. `browser_console_messages` on every page — JS errors/warnings

### A6 — Stripe Checkout Path (visual only on prod)
1. `/pricing` → click a plan → screenshot Stripe checkout page
2. Do NOT enter card info (LIVE Stripe keys!)
3. Note the redirect URL structure

For full test: use local dev (`localhost:3000`) with test keys:
```bash
cd /Users/owner/Downloads/CALLING\ AGENTs/agent-app && npm run dev
```
Card: `4242 4242 4242 4242`, expiry: 12/30, CVC: 123

---

## TRACK B: Settings → Live Agent Sync Verification

This track verifies that what the dashboard SHOWS matches what's ACTUALLY LIVE. Use a combination of Playwright (to read the UI) and Supabase/Ultravox API queries (to read the truth).

### B1 — Per-Client Sync Matrix
For EACH active client, build this table:

| Field | Supabase `clients` table | Dashboard Settings Shows | Ultravox API Shows | All Match? |
|-------|-------------------------|------------------------|--------------------|------------|
| Agent name | `agent_name` | Agent tab | systemPrompt content | ? |
| Voice ID | `agent_voice_id` | Voices page "current" | `callTemplate.voice` | ? |
| System prompt | `system_prompt` (first 100 chars) | Agent tab preview | `callTemplate.systemPrompt` (first 100) | ? |
| Booking enabled | `booking_enabled` | Calendar tab toggle | has bookAppointment tool? | ? |
| SMS enabled | `sms_enabled` | Notifications tab | has sendTextMessage tool? | ? |
| Forwarding number | `forwarding_number` | Business Info tab | has transferCall tool? | ? |
| Knowledge backend | `knowledge_backend` | Knowledge tab | has queryKnowledge tool? | ? |
| Tools array | `clients.tools` (count) | — | agent tools (count) | ? |
| Niche | `niche` | shown anywhere? | — | ? |
| Subscription status | `subscription_status` | Billing tab | — | ? |

Known truth reference:

| Client | Slug | Agent ID | Expected Voice | Expected Name |
|--------|------|----------|---------------|---------------|
| Hasan Sharif | hasan-sharif | `f19b4ad7` | Monika `87edb04c` | Aisha |
| Omar Sharif | exp-realty | `c9019927` | `441ec053` | Fatema |
| Windshield Hub | windshield-hub | `00652ba8` | Blake `b28f7f08` | Mark |
| Urban Vibe | urban-vibe | `5f88f03b` | Ashley `df0b14d7` | Alisha |

Query Supabase:
```sql
SELECT id, slug, agent_name, agent_voice_id, ultravox_agent_id,
       booking_enabled, sms_enabled, forwarding_number, knowledge_backend,
       niche, subscription_status, jsonb_array_length(tools::jsonb) as tool_count
FROM clients
WHERE status = 'active' OR subscription_status IN ('active', 'trialing');
```

Query each Ultravox agent:
```bash
curl -s -H "X-API-Key: $ULTRAVOX_API_KEY" \
  https://api.ultravox.ai/api/agents/{AGENT_ID} | jq '{
    voice: .callTemplate.voice,
    promptStart: (.callTemplate.systemPrompt | .[0:100]),
    toolCount: (.callTemplate.selectedTools | length),
    toolNames: [.callTemplate.selectedTools[].toolName]
  }'
```

### B2 — Voice Change Test (on test client only!)
1. Navigate to voices page for the test client (e2e-test-plumbing-co or newly created test)
2. Note current voice
3. Change to a different voice (e.g., male if currently female)
4. Refresh page — does it persist?
5. Query Supabase `clients.agent_voice_id` — updated?
6. Query Ultravox agent — voice updated?
7. Change back to original

### B3 — Agent Name Change Test
1. Change agent name in settings for test client
2. Save
3. Refresh — persisted?
4. Check system prompt — does it contain the new name?
5. Check Ultravox agent systemPrompt — new name there too?

### B4 — Toggle Tests (SMS, Booking, Knowledge)
For each toggle on the test client:
1. Toggle ON → save → verify DB field updated → verify tool appears in `clients.tools` → verify Ultravox agent has the tool
2. Toggle OFF → save → verify DB cleared → verify tool removed from `clients.tools` → verify Ultravox agent no longer has tool

---

## TRACK C: Integration Health Checks

These verify that external integrations actually work, not just that the UI says they're connected.

### C1 — Twilio Routing Verification
For each active client, verify the Twilio number routes to the correct webhook:

```bash
# List all numbers and their webhook URLs
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  | jq '.incoming_phone_numbers[] | {phone: .phone_number, voiceUrl: .voice_url, friendlyName: .friendly_name}'
```

Expected: each client's number should point to `https://unmissed-ai-production.up.railway.app/api/webhook/{slug}/inbound`

### C2 — Telegram Bot Health
For each client with Telegram configured, verify:
```sql
SELECT slug, telegram_bot_token IS NOT NULL as has_token,
       telegram_chat_id IS NOT NULL as has_chat_id
FROM clients WHERE telegram_bot_token IS NOT NULL;
```
Then test each bot:
```bash
curl -s "https://api.telegram.org/bot{TOKEN}/getMe" | jq '.ok'
curl -s "https://api.telegram.org/bot{TOKEN}/getChat?chat_id={CHAT_ID}" | jq '.ok'
```

### C3 — Calendar OAuth Health
For each client with Google Calendar connected:
```sql
SELECT slug, google_refresh_token IS NOT NULL as has_token,
       google_calendar_id, calendar_auth_status
FROM clients WHERE google_refresh_token IS NOT NULL;
```
Test token validity — attempt a calendar list API call with each refresh token.

### C4 — SMS Delivery Check
```sql
-- Recent SMS success/failure rate
SELECT client_id, status, COUNT(*)
FROM sms_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY client_id, status;

-- Any opt-outs?
SELECT COUNT(*) FROM sms_opt_outs;
```

### C5 — Knowledge/RAG Health
For each client with `knowledge_backend = 'pgvector'`:
```sql
SELECT c.slug,
       COUNT(*) FILTER (WHERE k.status = 'approved') as approved_chunks,
       COUNT(*) FILTER (WHERE k.status = 'pending') as pending_chunks,
       COUNT(*) FILTER (WHERE k.status = 'rejected') as rejected_chunks
FROM clients c
LEFT JOIN knowledge_chunks k ON k.client_id = c.id
WHERE c.knowledge_backend = 'pgvector'
GROUP BY c.slug;
```
Test search works:
```sql
SELECT * FROM hybrid_match_knowledge('test query', '{CLIENT_ID}', 3, 0.5);
```

### C6 — Notification Delivery Health
```sql
-- Notification success rate last 7 days
SELECT channel, status, COUNT(*)
FROM notification_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY channel, status
ORDER BY channel, status;

-- Any failed notifications?
SELECT * FROM notification_logs
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC LIMIT 10;
```

### C7 — Call Processing Health
```sql
-- Any stuck calls (processing for > 5 minutes)?
SELECT id, client_id, call_status, updated_at,
       NOW() - updated_at as stuck_duration
FROM call_logs
WHERE call_status = 'processing'
  AND updated_at < NOW() - INTERVAL '5 minutes';

-- Recent call classification distribution
SELECT classification, COUNT(*)
FROM call_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY classification;
```

---

## TRACK D: Auth & Security Audit

### D1 — RLS Isolation Test
Login as client owner (e.g., `fix@windshieldhub.ca`). Attempt to:
1. Access another client's data via API (manually craft fetch to `/api/dashboard/settings?client_id=OTHER_CLIENT_ID`)
2. Verify 403/404 — not 200 with someone else's data
3. Try query params that might leak: `?client_id=`, direct UUIDs in URLs

### D2 — Auth Flow
1. Login page → enter credentials → verify redirect to dashboard
2. Logout → verify session cleared → verify dashboard redirect to login
3. Try accessing `/dashboard` without auth → verify redirect to `/login`
4. Try accessing `/api/dashboard/settings` without auth → verify 401

### D3 — Admin Scope Check
Login as client owner. Verify you CANNOT:
1. See other clients in the client selector
2. Access admin-only routes (`/api/admin/*`)
3. See the AdminTestPanel on `/onboard/status`
4. Use the command strip or admin tools

### D4 — Billing State Consistency
```sql
SELECT c.slug, c.subscription_status, c.stripe_customer_id, c.stripe_subscription_id,
       c.status, c.seconds_used, c.seconds_limit
FROM clients c
WHERE c.status = 'active' OR c.subscription_status IN ('active', 'trialing');
```
Cross-reference with Stripe:
- Use `mcp__stripe__list_subscriptions` to verify each subscription is actually active
- Check if any clients show "active" in DB but cancelled in Stripe (or vice versa)

---

## SYNTHESIS: Final Report

After all 4 tracks complete, create:

```
docs/s12-audit/AUDIT-REPORT.md
docs/s12-audit/screenshots/        (all Playwright screenshots)
docs/s12-audit/sync-matrix.md      (Track B results)
docs/s12-audit/integration-health.md (Track C results)
docs/s12-audit/security-audit.md   (Track D results)
```

### Report Structure

```markdown
# S12 Full System Audit — [date]

## Executive Summary
[3-5 bullet points: what's broken, what's surprisingly good, what blocks sales]

## CRITICAL Issues (fix before selling)
[Anything that would cause a customer to see wrong data, lose functionality, or hit an error]

## Settings Sync Mismatches
[Full sync matrix table from Track B]

## Integration Health
| Integration | Status | Issues |
|-------------|--------|--------|
| Twilio routing | OK/BROKEN | [details] |
| Telegram bots | OK/BROKEN | [details] |
| Calendar OAuth | OK/BROKEN | [details] |
| SMS delivery | OK/BROKEN | [details] |
| Knowledge/RAG | OK/BROKEN | [details] |
| Notifications | OK/BROKEN | [details] |

## Security
[RLS isolation results, auth flow results, admin scope results]

## Screen Inventory
[Every screen with screenshot path, organized by role]

## Onboarding Flow Map
[Step-by-step with screenshots, noting confusion points]

## Setup Wizard Gaps
[For each: Telegram, SMS, Calendar, Knowledge, Call Forwarding]
- Current state: [what exists]
- What's missing: [guided setup? test confirmation?]

## Empty States
[What new customers see with zero data]

## Mobile Issues
[Broken/unusable at 390px and 768px]

## Console Errors
[JS errors per page]

## Priority Fixes (ranked)
1. [Highest impact fix]
2. ...

## Recommended S12 Implementation Order
[Based on findings: which wizards/fixes matter most]
```

### Execution Strategy
- **Tracks A + B** can run in parallel (A uses Playwright, B uses Supabase + API queries)
- **Track C** can run in parallel with A + B (pure API/DB queries)
- **Track D** needs Playwright (shares browser with Track A — run sequentially after A, or use a second browser)
- **Synthesis** runs after all 4 complete
