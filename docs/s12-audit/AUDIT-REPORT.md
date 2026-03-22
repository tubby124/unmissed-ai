# S12 Full System Audit — 2026-03-21

**Auditor:** Claude Opus 4.6 (4 parallel agents, Playwright CLI + Supabase + Ultravox API)
**Production URL:** https://unmissed-ai-production.up.railway.app
**Screenshots:** 341+ captured across all tracks
**Individual reports:** `public-pages-report.md`, `client-dashboard-auth-report.md`, `admin-onboarding-report.md`, `data-verification-report.md`

---

## Executive Summary

1. **Trial onboarding is completely broken** — trial creates a bare DB row with NO Ultravox agent, NO system prompt, NO voice. Trial users see "You're live!" but have a non-functional agent. 3 broken trial clients exist in production.
2. **Billing counters are diverged** — `minutes_used` vs `seconds_used` mismatch on every active client (up to 43 min). The S9h double-count guard (`seconds_counted`) is never set to `true`.
3. **The live agents are healthy** — all 4 production Ultravox agents have correct voice, prompt, tools, and VAD. The issues are in the DB state layer, not the runtime.
4. **Security is solid with one exception** — RLS works, admin isolation works, but `/api/dashboard/system-pulse` is completely unauthenticated and exposes all client slugs.
5. **Dashboard is surprisingly feature-rich** — Insights analytics, AI Advisor, voice library, call forwarding wizard, SMS templates, and Telegram notifications all work well for existing clients.

---

## CRITICAL Issues (fix before selling)

| # | Issue | Source | Impact |
|---|-------|--------|--------|
| C1 | **Trial path creates NO agent** — no Ultravox agent, no prompt, no voice. 3 broken trial clients in prod. | Track E, Track B | Trial users see empty dashboard, cannot demo or receive calls. Blocks all self-serve onboarding. |
| C2 | **`system-pulse` unauthenticated** — `GET /api/dashboard/system-pulse` returns all 7 client slugs + health to anyone, zero auth. | Track D | Attacker can enumerate all clients. Already tracked as S13g, confirmed exploitable. |
| C3 | **Billing counters diverged** — `minutes_used_this_month` vs `seconds_used_this_month / 60` differ by -43 to +42 min across all clients. | Track B | Overage alerts and billing use wrong data. Some clients over-counted, some under-counted. |
| C4 | **`seconds_counted` flag never set** — all 210 calls in 7 days have `seconds_counted = false`. S9h idempotent guard is non-functional. | Track B | Webhook retries can double-count billing seconds. |
| C5 | **urban-vibe `clients.tools` = hangUp only** — DB has 1 tool, Ultravox has 4. Any deploy from DB would regress to hangUp-only. | Track B | Next `syncClientTools()` or deploy-from-DB would break SMS + knowledge + coaching for urban-vibe. |
| C6 | **All 13 bookings missing FKs** — `google_event_id` and `call_id` are NULL on every booking. All share same timestamp. | Track B | Booking-to-call correlation broken. `/review-call` cannot show booking context. |
| C7 | **No Stripe customers in DB** — `stripe_customer_id = null` for all clients. No revenue tracking. | Track B | Cannot enforce plan limits or track revenue through Stripe integration. |
| C8 | **Dashboard access via recovery token** — trial "Open your Dashboard" uses a one-time Supabase recovery token (expires 24h). If it fails, no fallback. | Track E | Users locked out if they don't click within 24h and email delivery is broken. |
| C9 | **Leads page leaks cross-client data** — trial client sees leads from Hasan + Windshield Hub in admin context. Needs RLS verification for owner-role. | Track E | Potential data isolation failure for owner-role users. |

---

## Trial Flow Assessment

| Question | Answer | Evidence |
|----------|--------|----------|
| Does trial create a working agent? | **NO** | `ultravox_agent_id = NULL`, `prompt_length = 0`, `agent_name = NULL` on all 3 trial clients |
| Can trial users access the dashboard? | **FRAGILE** | Depends on one-time recovery token URL. No welcome email sent. Google OAuth status unknown. |
| Can trial users make demo calls? | **NO** | Demo button on review screen fails with "Not supported". No agent exists to call. |
| Can trial users modify their agent? | **PARTIALLY** | Settings tabs load but agent is non-functional. Lab page correctly shows "No live prompt yet." |
| Trial-to-paid conversion UX? | **EXISTS** | "Upgrade to get a phone number" button on success screen. Stripe checkout redirect not tested (live keys). |

**What trial creates vs what paid creates:**

| Asset | Trial (`/api/provision/trial`) | Paid (`create-public-checkout`) |
|-------|-------------------------------|--------------------------------|
| clients row | Yes | Yes |
| intake_submissions | Yes | Yes |
| client_users | Yes | Yes |
| Ultravox agent | **NO** | Yes |
| System prompt | **NO** | Yes |
| Agent name | **NO** (NULL) | Yes |
| Voice selection | **NO** (default) | Yes (user's choice) |
| Website scrape | **NO** | Yes |
| prompt_versions | **NO** | Yes |
| Welcome email | **NO** | Yes |
| Admin Telegram alert | **NO** | Yes |

---

## Email & Communication

| Check | Status | Detail |
|-------|--------|--------|
| Resend domain status | **UNKNOWN/LIKELY SANDBOX** | `RESEND_FROM_EMAIL` may be `onboarding@resend.dev` (sandbox). Not verified in Railway env vars during audit. |
| Welcome emails delivering? | **NO** (trial path) | 0 `notification_logs` rows for trial client. No email sent on trial activation. |
| Recovery links working? | **FRAGILE** | Recovery token URL works once, expires 24h. Failed in headless Playwright. |
| Post-call notifications? | Telegram: **YES** (4/week), SMS: **YES** (1/week), Email: **0/week** | Volume surprisingly low — 5 notifications for 210 calls |

**Communication chain for new trial customer:**

| Step | Channel | Content | Working? |
|------|---------|---------|----------|
| Activation | Email (Resend) | Welcome + dashboard link | **NOT SENT** |
| Activation | SMS (Twilio) | "Your AI agent is live" | **SKIPPED** (trial) |
| Activation | Telegram (admin) | Admin notification | **NOT SENT** |
| Dashboard access | Recovery URL | One-time auth token | **FRAGILE** |
| Telegram setup | Link in success screen | t.me/hassitant_1bot | **PROVIDED** |

---

## Auth & Login

| Method | Status | Notes |
|--------|--------|-------|
| Password login | **WORKING** | Tested with windshield-hub client. Redirects correctly to `/dashboard`. |
| Google OAuth login | **BUTTON PRESENT** | "Continue with Google" visible on login page. End-to-end not tested. |
| Magic link | **BUTTON PRESENT** | "Email me a sign-in link" visible. Depends on Resend domain verification. |
| Password recovery | **LINK PRESENT** | "Forgot password?" visible. Depends on Resend email delivery. |
| Trial user first login | **FRAGILE** | One-time recovery token, 24h expiry, no fallback if email fails. |
| Unauthenticated access blocked | **PASS** | All 4 tested dashboard routes redirect to `/login`. |
| Admin routes blocked for clients | **PASS** | Admin API routes return 405. No admin UI visible. |
| RLS isolation | **PASS** (calls/settings) | No cross-client data in call or settings queries. |
| RLS isolation | **WARNING** (leads) | Cross-client leads visible in admin context for trial client. |

---

## Settings Sync Matrix (Track B — Supabase vs Ultravox)

### hasan-sharif

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice ID | `87edb04c` | `87edb04c` | PASS |
| Prompt start | "LIVE VOICE PHONE CALL..." | "LIVE VOICE PHONE CALL..." | PASS |
| Tool count | 7 | 7 | PASS |
| booking_enabled → tools | true → has bookAppointment | Yes | PASS |
| sms_enabled → tools | true → has sendTextMessage | Yes | PASS |
| forwarding_number → tools | +13068507687 → has transferCall | Yes | PASS |
| knowledge_backend → tools | pgvector → has queryKnowledge | Yes | PASS |
| **clients.tools params** | **Missing X-Call-State** | **Has X-Call-State** | **WARNING** |

### exp-realty

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice/Prompt/Tools | All match | All match | PASS |
| clients.tools params | Has X-Call-State | Has X-Call-State | PASS |

### windshield-hub

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice/Prompt/Tool count | All match (4 tools) | All match | PASS |
| **clients.tools params** | **Missing X-Tool-Secret + X-Call-State** | **Has both** | **WARNING** |

### urban-vibe (CRITICAL)

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice/Prompt | Match | Match | PASS |
| **Tool count** | **1 (hangUp only)** | **4** | **FAIL** |
| sms_enabled=true | **Not in clients.tools** | Has sendTextMessage | **FAIL** |
| knowledge_backend=pgvector | **Not in clients.tools** | Has queryKnowledge | **FAIL** |

---

## Feature Toggle → Agent Update Chain

| Feature | DB Updated | tools Rebuilt | Ultravox Updated | Prompt Reflects |
|---------|-----------|--------------|-----------------|-----------------|
| Calendar (booking) | Yes | Yes (S1a) | Yes | Yes |
| SMS | Yes | Yes (S1a) | Yes | Yes |
| Knowledge | Yes | Yes (S5) | Yes | Yes |
| Transfer | Yes | Yes (S1a) | Yes | Yes |

**Code paths are correct post-S1a/S5.** The stale `clients.tools` on hasan-sharif, windshield-hub, and urban-vibe are artifacts from before S1a — they were never re-synced. Running `syncClientTools()` on each would fix them.

---

## Integration Health

| Integration | Status | Issues |
|-------------|--------|--------|
| Twilio routing (4 prod) | **OK** | All 4 prod numbers route to correct Railway webhook |
| Twilio routing (test) | **WARNING** | e2e-test number routes to slug `e2e-test-business` but DB slug is `e2e-test-plumbing-co` |
| Twilio (legacy) | **WARNING** | +16397393885 still routes to retired n8n webhook. Paying monthly fees for dead endpoint. |
| number_inventory | **BROKEN** | 3 numbers in inventory, all `status=available`, `assigned_client_id=null` — but 2 are actively in use |
| Telegram bots (3) | **OK** | All 3 bots respond to `getMe`. All 6 configured clients have token + chat_id. |
| Calendar OAuth (2) | **OK** | hasan-sharif + exp-realty connected. windshield-hub + urban-vibe correctly have no calendar. |
| SMS delivery | **OK** | 20 delivered, 1 undelivered (windshield-hub), 1 opt-out total |
| Knowledge/RAG (4) | **OK** | 133 approved chunks across 4 clients. 0 pending. All have queryKnowledge tool. |
| Notifications (7 days) | **LOW VOLUME** | 5 total (4 Telegram, 1 SMS) for 210 calls. 0 email notifications. |
| Recordings | **OK** | 418 files, 214 MB, all accessible. ~500 MB/month growth. No retention policy. |
| Resend email | **UNKNOWN** | Needs Railway env var verification. Likely sandbox domain. |

---

## Security

### CRITICAL
- **system-pulse unauthenticated** — `GET /api/dashboard/system-pulse` returns all client slugs + health to anyone on the internet. Zero cookies required. Fix: add `Bearer CRON_SECRET` or session auth.

### PASS
- Dashboard pages redirect to `/login` when unauthenticated (all 4 tested)
- No client UUIDs exposed in URLs
- No multi-client selector visible to owner-role users
- Admin API routes return 405/redirect for client users
- AdminTestPanel and AdminCommandStrip not rendered for client users
- Call and settings data properly isolated by RLS
- Admin routes properly gated

### WARNING
- Leads page may leak cross-client data (seen in admin context for trial client — needs owner-role verification)

---

## Screen Inventory

### Public Pages (14 pages × 3 widths = 42 screenshots)
All pages return HTTP 200. Zero console errors.

| Page | Desktop | Tablet | Mobile | Issues |
|------|---------|--------|--------|--------|
| Landing `/` | OK | OK | OK | — |
| Pricing `/pricing` | **BUG** (black hero) | **BUG** (navbar overflow) | **BUG** (black hero) | Verify in real browser — may be headless rendering artifact |
| Login `/login` | **BUG** (no form) | **BUG** | **BUG** | Agent 2 confirmed login works with direct Playwright interaction — likely headless rendering issue with Supabase Auth UI |
| Onboard `/onboard` | OK | OK | OK | Clean wizard |
| 6 niche pages | OK | OK | OK | Best pages on the site — well-designed |
| Demo `/demo` | OK (faint heading) | OK | OK | Heading contrast — verify in browser |
| Try `/try` | OK | OK | OK | 3 agent cards, clean |
| Privacy `/privacy` | OK (faint heading) | OK | OK | — |
| Terms `/terms` | OK (faint heading) | OK | OK | — |

### Client Dashboard (129 screenshots — windshield-hub login)

| Page | Description |
|------|-------------|
| Overview/Calls | 48 calls, donut chart, bar chart, call list with classification badges |
| Insights | Full analytics: KPIs, trends, peak hours, sentiment, top callers, trending topics |
| Live | Clean empty state: "No active calls" |
| Agent/Setup | 3-step wizard with carrier-specific forwarding codes. Excellent mobile UX. |
| Advisor | AI chat (Llama 3.3 70B), quick insight cards, conversation history |
| Leads | 13 leads with HOT/WARM badges, CSV export |
| Voices | 71-voice library with provider badges, filters, play preview |
| Settings (6 tabs) | Agent, SMS, Voice, Alerts, Billing, Knowledge — all functional |

### Admin Dashboard (168 screenshots — admin login)

| Page | Description |
|------|-------------|
| Command Center | System health, 5 action items, client health grid, live activity feed |
| Clients | 12 client cards with inline actions, Real/Test tabs, delete protection on prod |
| Settings (per client) | All 6 tabs accessible for each client |
| Setup | 3-step wizard with client pill selector |
| Demos | 18 demos, 0% conversion analytics |
| Lab | Prompt testing interface |
| Cost Intel | Admin cost analytics |
| Numbers | **404** — sidebar link to non-existent page |

### Onboarding Flow (12+ screenshots)
Complete 6-step wizard captured: Industry → Voice → Business → Knowledge → Call Handling → Review

---

## Onboarding Flow Map

### Trial Path (tested end-to-end)
1. `/onboard` — Select industry (12 options), enter business name, website URL
2. Step 2 — Choose voice (6 options), name agent
3. Step 3 — Business basics (pre-filled from Google Places autocomplete)
4. Step 4 — Knowledge upload + auto-generated FAQ questions
5. Step 5 — Call handling mode, SMS follow-up toggle
6. Step 6 — Review with "Talk to [Agent]" demo + pricing ($20/mo, 100 min)
7. Click "Start 7-day free trial" → API returns 201
8. Success screen — "You're live!" checklist with Telegram + forwarding setup links
9. "Open your Dashboard" → **Recovery token URL (fragile, 24h expiry)**
10. Dashboard — **Agent is non-functional** (no prompt, no Ultravox agent)

**Confusion points:**
- Success screen says "You're live!" but agent doesn't exist
- Demo call button fails ("Not supported")
- Lab page correctly says "No live prompt yet" — contradicts success screen
- Agent name "Dave" and voice "Jacqueline" from form are NOT persisted to DB

### Paid Path (not tested — live Stripe keys)
- Stripe checkout redirect exists from pricing page
- `create-public-checkout` creates full agent (prompt, voice, tools, website scrape)
- AdminTestPanel exists for skip-payment testing

### AdminTestPanel Path (observed)
- `/onboard/status?id=INTAKE_ID` — shows agent preview, phone number picker
- "Test Activate — Skip Payment" button (yellow admin section)
- "Buy a real Twilio number" checkbox (unchecked by default)

---

## Setup Wizard Gaps

| Feature | Current State | What's Missing |
|---------|--------------|----------------|
| **Telegram** | Shows "Active"/"Not connected" badge + notification preferences | No step-by-step setup wizard. No "test notification" button. New users see no guidance on HOW to connect. |
| **SMS** | Toggle + template + preview + test SMS + opt-out compliance | Good — this is the best-designed settings tab. |
| **Calendar** | "Connect Calendar" with Google OAuth | No post-connection confirmation. No availability hours config. No test booking flow. |
| **Knowledge** | Website scrape + CSV upload + chunk list | No search/filter for chunks. Long scroll through dozens of items. |
| **Call Forwarding** | Excellent 3-step wizard with carrier codes | Best setup flow in the product. Phone type → carrier → device → codes. |

---

## Empty States

| Page | With Zero Data | Quality |
|------|---------------|---------|
| Live Calls | "No active calls — Calls in progress will appear here in real time" | **GOOD** |
| Lab (trial) | "No live prompt yet. Complete onboarding setup to generate your agent's prompt." | **GOOD** (accurate) |
| Knowledge (trial) | "Knowledge base not enabled" + Enable button | **GOOD** |
| Calls/Overview (trial) | Shows stats UI with zeros + call list (empty) | **ADEQUATE** |
| Leads (trial) | **BUG** — shows other clients' leads instead of empty state | **BROKEN** |
| Alerts (not connected) | "Not connected" badge, no setup wizard | **POOR** |

---

## Mobile Issues

12 of 14 public pages pass mobile at 390px. Dashboard pages are generally well-responsive.

| Issue | Page | Severity |
|-------|------|----------|
| Pricing hero renders as black | `/pricing` | May be headless-only — verify |
| Pricing navbar doesn't collapse at 768px | `/pricing` | **REAL BUG** — nav items crammed |
| Agent settings tab extremely long scroll | `/dashboard/settings` Agent tab | **UX issue** — needs collapsible sections |
| Stats cards cramped at tablet | `/dashboard` Overview | Minor |

---

## Console Errors

| Context | Errors | Source |
|---------|--------|--------|
| All 14 public pages | **0** | Clean |
| Client dashboard (normal use) | **0** | Clean |
| Admin dashboard | **0** | Clean |
| Login flow | 4 | Self-inflicted by admin route tests (404/405) — not real bugs |
| `/api/onboard/create-draft` | **500** | Server error — draft saving broken |

---

## Google OAuth Consent Screen

Not tested (would require completing OAuth flow). Login page shows "Continue with Google" button. Needs manual verification of:
- App name shown to users
- Verification status (verified vs unverified)
- Scopes requested
- User trust impression

---

## Call Processing Health

| Metric | Value | Status |
|--------|-------|--------|
| Stuck calls (processing > 5 min) | **0** | PASS |
| Total calls (7 days) | 210 | — |
| COLD | 96 (46%) | Normal |
| JUNK | 67 (32%) | Normal overall |
| WARM | 24 (11%) | Normal |
| UNKNOWN | 22 (10%) | Slightly high |
| HOT | 1 (0.5%) | Low |
| exp-realty JUNK rate | **58%** | WARNING — investigate |

---

## Priority Fixes (ranked)

### Must Fix Before Any Marketing/Sales

1. **Fix trial provisioning** — Port agent/prompt/voice creation from `create-public-checkout` into `provision/trial`. This is the single highest-impact fix.
2. **Fix system-pulse auth** — Add `Bearer CRON_SECRET` or session auth check. 5-minute fix, closes S13g.
3. **Rebuild stale `clients.tools`** — Run `syncClientTools()` for urban-vibe (critical), hasan-sharif, and windshield-hub.
4. **Fix billing counter divergence** — Determine authoritative counter, reconcile, add sync mechanism.
5. **Fix `seconds_counted` flag** — Debug why S9h guard never sets it to `true`.

### Should Fix Before First Paying Customer

6. **Verify Resend domain** — Check if `RESEND_FROM_EMAIL` is sandbox. Set up `notifications@unmissed.ai` domain.
7. **Fix recovery token access** — Add "Resend setup link" to admin dashboard. Ensure Google OAuth works as fallback.
8. **Fix leads page RLS** — Verify owner-role isolation. May only affect admin view.
9. **Fix onboarding form persistence** — Agent name and voice selection from onboarding must save to DB.
10. **Fix `/api/onboard/create-draft` 500** — Form progress not saved.

### Should Fix Soon

11. **Fix `number_inventory` table** — Sync with Twilio reality.
12. **Fix e2e-test Twilio slug mismatch** — Update webhook URL.
13. **Release legacy n8n Twilio number** — Stop paying for dead endpoint.
14. **Fix pricing page tablet navbar** — Increase hamburger breakpoint.
15. **Add Telegram setup wizard** — Step-by-step for users who haven't connected.
16. **Fix billing tab showing "$25 paid" for trial** — Misleading.
17. **Investigate exp-realty 58% JUNK rate** — Over-classification or spam?
18. **Fix `/dashboard/numbers` 404** — Remove sidebar link or create the page.

---

## Test Data Created (cleanup needed)

| Item | Value |
|------|-------|
| Client ID | `229af8c4-4f79-4d50-8448-7e1490f5c66e` |
| Slug | `s12-audit-trial-test` |
| Business | S12 Audit Trial Test (plumbing) |
| Email | s12-trial-test@example.com |
| Trial expires | 2026-03-28 |

```sql
-- Cleanup SQL
DELETE FROM client_users WHERE client_id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
DELETE FROM intake_submissions WHERE client_id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
DELETE FROM clients WHERE id = '229af8c4-4f79-4d50-8448-7e1490f5c66e';
```

---

## Recommended S12 Implementation Order

Based on findings, the priority order for S12 work:

1. **S12-BUG1 (CRITICAL):** Trial provisioning — port agent creation from paid path
2. **S13g (CRITICAL):** system-pulse auth — 5-minute fix
3. **Billing fix (CRITICAL):** minutes/seconds reconciliation + seconds_counted guard
4. **clients.tools rebuild (CRITICAL):** syncClientTools for 3 clients
5. **S12-BUG2 (HIGH):** Resend domain verification
6. **S12-BUG3 (HIGH):** Dashboard access fallback (resend setup link, Google OAuth verification)
7. **S12e (MEDIUM):** Call forwarding setup wizard (already excellent — just needs niche-specific defaults)
8. **S12a (MEDIUM):** Telegram setup wizard (currently no guidance for disconnected users)
9. **S12h (MEDIUM):** Intake form UX (agent name + voice persistence)
10. **S12g (LOW):** Setup progress checklist (visual progress bar)
11. **S12d (LOW):** Knowledge setup wizard (add search/filter to chunk list)
12. **S12i (LOW):** Dashboard visual redesign (functional but dense — do last)
