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

### ✅ P0-1: No logged-in user identity visible
Pass `userEmail={user?.email}` from `layout.tsx` → `Sidebar.tsx`. Email shown in `text-[10px]` above sign-out when sidebar is expanded.

### ✅ P0-2: Trial login recovery is broken
Added "Email me a sign-in link instead" button below the sign-in form in `src/app/login/page.tsx`. Uses `signInWithOtp({ email, options: { shouldCreateUser: false } })`. Shows confirmation message on success.

### ✅ P0-3: Trial success screen login link
Already implemented — `TrialSuccessScreen` had Google OAuth + "Sign in with email →" link to `/login` in the "Access your dashboard" card. Confirmed done.

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

### ✅ P1-2: Module-level rate limiter resets on Railway deploy
Swapped `Map<string, number[]>` + manual helpers → `SlidingWindowRateLimiter(3, 60*60*1000)` in `src/app/api/provision/trial/route.ts`. Now uses the same class as all other routes.

### ✅ P1-3: Admin login observability — "who's logged in"
`src/app/dashboard/clients/page.tsx` now fetches `last_sign_in_at` from `auth.users` via service client admin API. Shown in each client card as "Last login Mar 25, 2026". Zero schema migration — reads directly from Supabase auth.

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

## P-NEXT — Documented Gaps (next sprint)

### HIGH: `patchServicesOffered` silent fail
**File:** `src/lib/prompt-patcher.ts`
**Root cause:** If the client prompt was hand-crafted (no `**What services do you offer?**` Q&A format), updating services saves to DB but the patcher finds no match and silently skips. No warning returned to user or logged.
**Fix:** Return `patched: false` + a warning string from `patchServicesOffered()`. In settings PATCH, include `warnings: ['services_not_patched_in_prompt']` in the response when the patcher skips. Show inline toast in ServicesCard: "Saved to DB — but your prompt may need manual update."

### HIGH: `business_name` post-provision silent fail
**File:** `src/lib/prompt-patcher.ts` — `patchBusinessName()`
**Root cause:** Uses word-boundary regex to find old name. If the prompt was manually edited and the old name no longer appears verbatim (or appears inside a larger word), the patch silently skips.
**Fix:** Same pattern as above — return `patched: false` + warning when `replacements === 0`. Show warning in settings: "Name saved — run /prompt-deploy to update your agent's prompt."

### MEDIUM: Knowledge reseed timing
**File:** `src/app/api/dashboard/settings/route.ts`
**Root cause:** `reseedKnowledgeFromSettings()` is now awaited (good), but embedding 30+ chunks can take 2–8 seconds. First big facts save → noticeably slow API response.
**Fix:** Return `knowledge_reseeding: true` in settings PATCH response when reseed was triggered. Card can show a brief "Updating knowledge…" indicator.

### MEDIUM: `router.refresh()` unreliability in Next.js 15
**Root cause:** Sonar-confirmed — `router.refresh()` sometimes doesn't trigger re-renders in v15 server components. Cards that read from `useState` initialized from props won't see the refresh.
**Fix (long-term):** Migrate per-card state to SWR or a shared context. Short-term workaround: `window.location.reload()` after critical saves if cards don't reflect new state. Not urgent — only visible after first save in a session.

---

## Execution Order

```
✅ P0-1 → user email in sidebar footer — DONE
✅ P0-2 → magic link on login page — DONE
✅ P0-3 → trial success login link — already existed, confirmed
✅ P1-2 → SlidingWindowRateLimiter swap — DONE
✅ P1-3 → last_sign_in_at in admin clients table — DONE

Remaining:
  P1-1 → validate trial welcome end-to-end with fresh signup test (manual)
  P2-1 → voicemail duplicate Telegram alert (RecordingSid guard)
  P2-2 → RLS verification on realtime tables
  P2-3 → knowledge_query_log dedup constraint (low urgency)
```
