# Post-Audit Issue Tracker
**Created:** 2026-03-25 | **Source:** Wave 1–4 trust audit + UI/UX review

---

## DONE THIS SESSION (applied, committed)

| # | Fix | File | What |
|---|-----|------|------|
| ✅ | Trial sidebar no longer auto-collapsed | `src/app/dashboard/layout.tsx:102` | `initialCollapsed` was `true` for trial users — they landed with a collapsed icon-only nav. Now `false` for everyone. |
| ✅ | `key={gap.query}` on gaps list | `KnowledgeEngineCard.tsx` | Was `key={i}` — stable key prevents UI jump on remove |
| ✅ | Stable key on test results | `KnowledgeEngineCard.tsx:586` | Was `key={i}` on query result list — now uses source+type+similarity |
| ✅ | `text-[9px]` on "Add as FAQ" badge | `KnowledgeEngineCard.tsx:488` | Was `text-[8px]` — too small to read |
| ✅ | W1-A: Admin test call tenant isolation | `AgentTestCard.tsx` + `AgentPageView.tsx` | `client_id` now sent in POST body so admin tests the selected client |
| ✅ | W1-B: Trial email dedup dual guard | `provision/trial/route.ts` | Checks both intake_submissions AND Supabase auth for existing email |
| ✅ | W1-C: `daysRemaining` passed to AgentTestCard | `AgentPageView.tsx` | Trial expiry context in upgrade modal |
| ✅ | W2-A: Trial expiry in "Needs Attention" | `AgentPageView.tsx` | ≤7 days triggers attention item with urgency |
| ✅ | Nested `<button>` violation (KnowledgeEngineCard H2) | `KnowledgeEngineCard.tsx` | Outer button split into div + two sibling buttons; `aria-expanded` added |
| ✅ | `twilio_number` in `needsAgentSync` | `settings/route.ts:490` | Already present — confirmed not missing |
| ✅ | Voicemail fallback sig validation | `webhook/[slug]/fallback/route.ts` | Confirmed already fixed in prior session |

---

## P0 — Trust / UX Blockers (fix next session)

### P0-1: No logged-in user identity visible
**Impact:** User opens dashboard, no idea which account they're in. Sidebar shows business name but not the email address / personal account.
**Root cause:** `layout.tsx` fetches `user` from Supabase auth but never passes `user.email` to Sidebar. Sidebar has no email display.
**Fix:** Pass `userEmail={user?.email}` from layout → Sidebar; show `text-[10px] t3 truncate` near the sign-out button when sidebar is expanded. 2 files, ~6 lines.

### P0-2: Trial login recovery is broken ("cokey")
**Impact:** Trial users create an account with no explicit password. If they close the browser and email delivery fails (Resend sandbox), their only login path is Google OAuth. There's no OTP/magic link option on the login page.
**Root cause:**
- `/login` page has `signInWithPassword` (needs password they never set) + Google OAuth (needs matching Google account)
- No `signInWithOtp` / magic link
- `/auth/forgot-password` flow requires email delivery — broken in sandbox
**Fix options (pick one):**
- A. Add magic link / OTP tab to login page — `signInWithOtp({ email, options: { shouldCreateUser: false } })`
- B. Add "Email me a sign-in link" below the email/password form as secondary CTA
- Recommend B — minimum change, works without touching Google OAuth flow

### P0-3: Trial success screen has no "come back later" login link
**Impact:** Newly provisioned trial user closes the browser. They don't know to go to `/login`. No email arrived. They're locked out.
**Fix:** Add "Save this link to log back in →" with `/login` URL to the trial success screen (`src/app/onboard/status/page.tsx`). Also surface the Google OAuth button on that screen with "or continue with Google."

---

## P1 — High Priority / Conversion-Critical

### P1-1: Trial experience feels limited (conversion killer)
**What the user said:** "Trial users you gotta really rethink that — how you gonna get them to convert if they can't do a lot of shit which they can't do."
**What's currently locked for trial users:**
- `/dashboard/live` — Live call monitoring (requires phone number, makes sense)
- `/dashboard/leads` — Leads/Outbound Queue (requires phone, makes sense)
- `/dashboard/calendar` — Calendar (requires booking setup, makes sense)
- All billing detail (redirected to plan picker — makes sense)
**What's NOT locked (trial users CAN do):**
- Overview, Agent config, Knowledge, Call Handling, Calls history, Notifications, Advisor, Setup/Go Live
**Actual problems:**
- Trial sidebar was collapsed → felt like everything was locked even though most is accessible (**fixed in this session**)
- Welcome page (`/dashboard/welcome`) redirects trialing users — need to check if it's a good landing
- Trial users see "Go Live" in nav but when clicked, it may feel blocked because they have no Twilio number yet
**Fix:** After removing collapsed sidebar, validate trial welcome flow end-to-end. Consider adding a "Your trial includes:" feature checklist to orientation.

### P1-2: Module-level rate limiter resets on Railway deploy
**File:** `src/app/api/provision/trial/route.ts` — uses `Map<string, ...>` at module level
**Impact:** Rate limit resets on every Railway deploy. During a deploy, burst signups bypass the IP rate limit.
**Fix:** Replace with `SlidingWindowRateLimiter` from `src/lib/rate-limiter.ts`. Already used in other routes. ~5 line change.

### P1-3: Admin login observability — "who's logged in"
**What the user said:** "we should be able to know which users logged in"
**Current state:** No last-login tracking. Admin has no view of which client accounts have active sessions.
**Fix options:**
- A. Add `last_login_at` column to `clients` + update on dashboard page load
- B. Supabase Auth admin API — query `auth.users` for `last_sign_in_at` (no schema change)
- C. Simple: show `last_sign_in_at` from `auth.users` in the admin clients table
- Recommend B/C — zero migration, reads from auth.users directly. Admin `/dashboard/clients` table can show last login time per client email.

---

## P2 — Medium Priority / Ops Hardening

### P2-1: Voicemail duplicate Telegram alert
**File:** `src/app/api/webhook/[slug]/voicemail/route.ts`
**Root cause:** No `RecordingSid` guard. Twilio retries on slow download → duplicate Telegram alert to client.
**Fix:** Check `call_logs.recording_url` for existing `RecordingSid` filename before re-processing. ~3 lines.

### P2-2: RLS verification on realtime tables
**Tables:** `call_logs`, `campaign_leads`, `notification_logs`, `bookings`
**Status:** D32 from session discoveries — unverified.
**Fix:** Run Supabase MCP to check RLS policies on each table, confirm cross-tenant query is blocked.

### P2-3: Knowledge query log — no dedup constraint
**Table:** `knowledge_query_log`
**Impact:** Duplicate gap entries on webhook replay. Advisory only — doesn't affect billing or notifications.
**Fix:** Add partial unique index `(client_id, query_text)` where `resolved = false`. Low urgency.

---

## P3 — Deferred / Low Priority

| # | Item | Notes |
|---|------|-------|
| P3-1 | Playwright truth-audit specs | 5 specs written in `tests/truth-audit/` — need live app with test client to run green |
| P3-2 | `business_name` not re-patched post-provision | System prompt bakes name at provision time; post-provision rename = manual `/prompt-deploy` |
| P3-3 | `injected_note` staleness | Per-call "today's update" field stays forever if owner forgets to clear it |
| P3-4 | Demo SMS tool injected without `twilio_number` guard | `buildDemoTools()` injects SMS tool when `hasCallerPhone=true` regardless of client `twilio_number` |
| P3-5 | Settings PATCH `needsAgentSync` coupling is untyped | Adding a new DB_PLUS_TOOLS field silently misses agent sync if not manually added to `needsAgentSync` expression |
| P3-6 | Retake tour button only in expanded sidebar | Collapsed sidebar → tour button invisible |
| P3-7 | `text-[8px]` remaining instances | Run `grep -rn 'text-\[8px\]'` — may have more in other cards |

---

## Execution Order

```
Next session:
  P0-1 → show user email in sidebar footer (2 files, 6 lines)
  P0-2 → add magic link option to login page
  P0-3 → add login link to trial success screen
  P1-1 → validate trial welcome end-to-end with fresh signup test
  P1-2 → swap module-level Map → SlidingWindowRateLimiter (5 lines)
  P1-3 → show last_sign_in_at in admin clients table

  Later:
  P2-1, P2-2, P2-3 → in one ops-hardening session
```
