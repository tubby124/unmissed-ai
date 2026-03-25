# Webhook Security and Idempotency Audit

**Date:** 2026-03-25
**Scope:** All routes under `src/app/api/webhook/`

---

## 1. Route Map

| Route | Source | Events / Purpose | Auth Method |
|-------|--------|------------------|-------------|
| `POST /api/webhook/[slug]/inbound` | Twilio | Inbound phone call → create Ultravox call, return TwiML | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/completed` | Ultravox | Call ended → classify, notify, charge minutes | HMAC-SHA256 via `?sig=&n=&t=` query params |
| `POST /api/webhook/[slug]/transfer` | Ultravox tool | Agent-triggered transfer → Twilio redirect | `x-tool-secret` static shared secret |
| `POST /api/webhook/[slug]/transfer-status` | Twilio | Dial completed/failed → reconnect to AI | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/sms` | Ultravox tool | Agent-triggered outbound SMS | `x-tool-secret` static shared secret |
| `POST /api/webhook/[slug]/sms-inbound` | Twilio | Inbound SMS → opt-out handling, Telegram notify | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/sms-status` | Twilio | SMS delivery status update | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/voicemail` | Twilio | Recording ready callback → upload + notify | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/ivr-gather` | Twilio | IVR digit handler | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/[slug]/fallback` | Twilio | VoiceFallbackUrl when inbound times out | **NONE — unauthenticated** |
| `POST /api/webhook/[slug]/whisper` | Dashboard admin | Live call coaching inject | Supabase auth (admin role check) |
| `POST /api/webhook/ultravox` | Ultravox native | `call.ended` / `call.billed` account-level events | HMAC-SHA256 via `X-Ultravox-Webhook-Signature` + timestamp header |
| `POST /api/webhook/stripe` | Stripe | Checkout, subscription lifecycle, billing | Stripe SDK `constructEvent` (includes timestamp) |
| `POST /api/webhook/telegram` | Telegram | Bot registration deep link (`/start TOKEN`) | Token-in-body (UUID) — intentionally no secret |
| `POST /api/webhook/demo/inbound` | Twilio | Demo phone call IVR | Twilio signature (`X-Twilio-Signature`) |
| `POST /api/webhook/inventory-idle` | Twilio | Idle number fallback TwiML | **NONE — intentional, no side effects** |

---

## 2. Signature Verification

### Twilio routes (`X-Twilio-Signature`)

Uses `twilio.validateRequest(authToken, signature, url, params)` via `validateSignature()` in `src/lib/twilio.ts`.

**Verified on:** inbound, sms-inbound, sms-status, voicemail, ivr-gather, transfer-status, demo/inbound.

**Missing on:**
- `/fallback` — No call to `validateSignature`. Any HTTP client can POST arbitrary form data. The route creates a `call_logs` row and returns TwiML. Risk: log pollution, wasted DB writes. Not a data-corruption or billing risk because it doesn't create Ultravox calls or charge minutes.
- `/inventory-idle` — Intentionally unauthenticated. Returns static TwiML with no side effects. Acceptable.

**`validateSignature` fail-open behavior:** If `TWILIO_AUTH_TOKEN` is not set, the function returns `true` in non-production and `false` in production. This is correct.

### Ultravox per-call callback (`/completed`)

`verifyCallbackSig()` in `src/lib/ultravox.ts`. Covers two formats:
- **New (S13b):** HMAC-SHA256 over `slug:nonce:ts` with 30-minute replay window.
- **Legacy:** HMAC-SHA256 over `slug` only — accepted for in-flight calls signed before S13b deploy.

Guard logic: if `WEBHOOK_SIGNING_SECRET` is set, unsigned requests are rejected 403. If secret is not set (dev), all requests pass. Correct behavior.

### Ultravox native webhook (`/api/webhook/ultravox`)

HMAC-SHA256 over `rawBody + timestamp` (no separator), using `ULTRAVOX_WEBHOOK_SECRET`. Header: `X-Ultravox-Webhook-Signature`. Timestamp: `X-Ultravox-Webhook-Timestamp` (ISO 8601). Replay window: 60 seconds. Multi-sig comma-separated rotation supported. Uses `timingSafeEqual`. **Correct and complete.**

Fail-closed: if `ULTRAVOX_WEBHOOK_SECRET` is not configured, returns 500 (not 200). This is intentional — prevents silent silencing during misconfiguration.

### Stripe (`/api/webhook/stripe`)

`stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)`. The Stripe SDK validates signature and timestamp tolerance internally (default: 300s window). Returns 400 on failure. **Correct.**

### Tool routes (`/transfer`, `/sms`)

Static shared secret: `process.env.WEBHOOK_SIGNING_SECRET` compared against `x-tool-secret` header. Simple equality check (`!==`). Sufficient for Ultravox-to-server tool calls — these are not replay-sensitive because the agent can't replay them (it sends them once per call).

### Telegram (`/api/webhook/telegram`)

No webhook secret by design (documented in code comment). UUID `telegram_registration_token` in the message body is the security token. Idempotent by nature — the token is consumed (set to null) on first use. Replay of a used token is a no-op. Acceptable.

---

## 3. Replay / Timestamp Checks

| Route | Replay Protection |
|-------|-------------------|
| `/completed` | 30-minute window via timestamp in signed URL |
| `/ultravox` | 60-second window via `X-Ultravox-Webhook-Timestamp` header |
| `/stripe` | ~300s window via Stripe SDK `constructEvent` |
| Twilio routes | None beyond Twilio signature (Twilio does not include a timestamp in most callbacks) |
| `/transfer`, `/sms` | None — static secret only, no nonce/timestamp |

**Assessment:** The Twilio-signed routes (inbound, sms-inbound, etc.) have no timestamp check, but this is consistent with Twilio's webhook model — Twilio does not include a signed timestamp in standard webhooks, and the HMAC over the body + URL parameters is sufficient to prevent forgery. Replay of valid Twilio requests is mitigated by the per-call-SID/message-SID idempotency checks at the DB level.

---

## 4. Idempotency Analysis

### `/completed`

**Strong idempotency.**
1. Atomic `live → processing` state transition (CAS-style update). If it fails, stale-processing recovery re-acquires after 60s.
2. Notification guard: `notificationsAlreadySent()` checks `notification_logs` for rows keyed to `call_id`. If found, Telegram/SMS/email skipped.
3. Seconds counting: `seconds_counted` boolean flag prevents double-increment.
4. `call_insights` upsert on `call_id` — safe to replay.
5. `knowledge_query_log` insertion for gap bridge: normalizes against existing unresolved gaps before inserting. Not a perfect dedup (uses in-memory set), but `knowledge_query_log` does not have unique constraint on `query_text`, so duplicate gaps can appear on replay. **Low severity** — gaps are advisory only, not billing-sensitive.

**Gap:** If the webhook crashes after the `live → processing` CAS but before any `notification_logs` row is written, the stale-recovery path re-acquires and re-runs notifications. However, `notificationsAlreadySent` will return `false` because no notification was logged. This is the correct behavior — it ensures notifications are eventually delivered, not skipped.

### `/stripe`

**Strong idempotency.**
`stripe_events` table upsert with `onConflict: 'event_id', ignoreDuplicates: true`. If the same event arrives twice, the second upsert inserts 0 rows and the handler returns 200 immediately. Works correctly for all event types, including `checkout.session.completed`.

**Exception path:** If `idempErr` is set (DB failure on the idempotency check), the handler proceeds anyway ("fail open"). This is documented and intentional — missing an activation is worse than processing twice. Activation itself has a guard: `existingClient?.status === 'active' && existingClient?.stripe_subscription_id` → skip.

### `/sms-inbound`

**Correct idempotency.** Checks `sms_logs` for existing `message_sid` before processing. Returns TwiML immediately on duplicate. Opt-out upsert uses `onConflict: 'phone_number,client_id'`.

### `/voicemail`

**Partial idempotency gap.**
The route is guarded at the top by `recordingStatus !== 'completed'` and `recordingDuration === 0` checks. It then queries `call_logs` by `twilio_call_sid + call_status=VOICEMAIL`. If Twilio delivers the same `recordingStatusCallback` twice (which Twilio does on retry), the route will:
1. Re-download the recording from Twilio.
2. Re-upload to Supabase storage (`upsert: true` — safe, overwrites same file).
3. Re-update `call_logs` with the same data — safe but wasteful.
4. Re-send Telegram notification — **duplicate alert to the client.**

There is no guard on `RecordingSid` to detect a duplicate delivery.

### `/fallback`

**No idempotency** — creates a new `call_logs` row on every invocation. If Twilio retries the fallback (e.g., because the response was slow), this creates duplicate VOICEMAIL rows for the same `CallSid`. The `voicemail` callback route looks up by `twilio_call_sid + call_status=VOICEMAIL`, so it would update one of the rows but the other remains orphaned.

Also has no Twilio signature validation (see Section 2).

### `/transfer-status`

**Good idempotency.** The CAS update on `transfer_status = 'transferring'` ensures only one invocation creates the recovery call. The reconnect-loop guard uses `parent_call_log_id` FK count. The `notification_logs` insert is not guarded, but it's low-risk.

### `/ultravox` native

No explicit idempotency beyond event routing.
- `call.ended`: Orphan check only — writes no rows.
- `call.billed`: Updates `billed_duration_seconds` on the existing `call_logs` row by `ultravox_call_id`. Not idempotent — if delivered twice, the update fires twice with the same value (net result same, no corruption). Safe.

### `/sms-status`

Updates `sms_logs.delivery_status` by `message_sid`. Safe to replay — same value overwrites same value.

### `/transfer` (tool)

No idempotency — if Ultravox retries the tool call, it could initiate two Twilio redirects. Mitigated by the `transfer_status='transferred'` check in `/completed` which skips post-call processing for the original call. The redirect itself would fail gracefully if the call was already redirected.

---

## 5. Inline Long-Running Work

| Route | Long-running work inline? | Notes |
|-------|--------------------------|-------|
| `/completed` | No — all work in `after()` | Returns 200 immediately. `after()` runs post-response. Ultravox has up to 10 retries. |
| `/inbound` | Partial — DB inserts are fire-and-forget `.then()` | TwiML must return fast. Documented trade-off (S10m). |
| `/voicemail` | Yes — downloads recording from Twilio (30s timeout), uploads to storage, sends Telegram | All synchronous. Risk: slow Twilio recording download could cause timeout. Twilio will retry. See Section 6. |
| `/transfer-status` | Yes — creates new Ultravox call, returns TwiML | `maxDuration=15`. Creating an Ultravox call is typically <2s. |
| `/stripe` | Yes — `activateClient()` runs inline (~3-5s) | Returns 200 always. Stripe retries on non-200. idempotency guard prevents double activation. |
| `/sms` | No — Twilio send is fast | 10s budget. |
| `/transfer` | No — Twilio redirect is fast | 10s budget. |

---

## 6. Duplicate Delivery Risks

### Critical

**None identified.**

### Medium

1. **`/voicemail` — duplicate Telegram alert on Twilio retry.**
   Twilio retries `recordingStatusCallback` if the response is slow or returns non-200. The route has no `RecordingSid` guard. Each retry triggers: re-download, re-upload (safe), `call_log` re-update (safe), Telegram re-alert (duplicate notification to client).

2. **`/fallback` — duplicate `call_logs` rows on Twilio retry.**
   If the fallback response is slow, Twilio may fire it again. Each invocation inserts a new `call_logs` row with `call_status=VOICEMAIL`. The downstream `/voicemail` route queries `call_logs` by `twilio_call_sid + VOICEMAIL`, and `.single()` would return an error if two rows exist for the same SID, causing the recording to fail to be linked.

### Low

3. **`/completed` gap-bridge duplicate inserts.**
   If the webhook is replayed after a crash before the stale-recovery threshold (60s), the gap-bridge deduplicate step uses an in-memory set of existing queries, but the `knowledge_query_log` insert is not protected by a unique constraint. Duplicate gaps appear in the log. Advisory only.

4. **`/transfer` tool duplicate invocation.**
   If Ultravox retries the `transferCall` tool, a second Twilio redirect fires. First redirect typically wins; second fails gracefully. No data corruption.

---

## 7. Fast-Ack Analysis

| Route | Returns before expensive work? | How? |
|-------|-------------------------------|------|
| `/completed` | Yes | `after()` from Next.js — returns 200 before async block runs |
| `/inbound` | Yes | Ultravox call creation is awaited, but DB insert is fire-and-forget `.then()` |
| `/stripe` | No | `activateClient()` runs synchronously, but always returns 200 |
| `/voicemail` | No | Recording download + storage upload is synchronous |
| `/ultravox` native | Yes | DB updates are fast; returns 200 at end |
| Twilio simple routes | Yes | All I/O completes within `maxDuration` budget |

**Risk:** `/voicemail` downloads a recording from Twilio synchronously. If the Twilio recording endpoint is slow, this route can approach or exceed the 15-second window. Twilio will retry, creating duplicate processing (see Section 6, item 1). Not worth moving inline today — the `upsert: true` on storage and the existing `call_log` update are both safe to replay, but Telegram will double-notify.

---

## 8. Minimal Patch Plan (ranked by risk)

### P1 — Add Twilio signature validation to `/fallback` (HIGH)

**File:** `src/app/api/webhook/[slug]/fallback/route.ts`
**Risk without patch:** Any HTTP client can POST to `/api/webhook/[slug]/fallback` with arbitrary `CallSid`, `From`, and trigger DB row creation + voicemail TwiML. This pollutes `call_logs` and can trigger legitimate-looking orphan alerts.
**Fix:** Add `validateSignature` call after parsing `formData`, matching the pattern in `/inbound`.

### P2 — Add RecordingSid idempotency guard to `/voicemail` (MEDIUM)

**File:** `src/app/api/webhook/[slug]/voicemail/route.ts`
**Risk without patch:** Twilio retries on slow recording downloads cause duplicate Telegram notifications to clients. This is the primary observable symptom.
**Fix:** After the `call_log` lookup, check `recording_url` on the row. If already non-null and ends with the `recordingSid`, skip re-processing and return 200. Alternatively, check `call_logs.recording_url` for the `recordingSid` filename before the download.

### P3 — Consider unique constraint on `knowledge_query_log(client_id, query_text)` (LOW)

**File:** Supabase migration
**Risk:** Duplicate gap entries. Advisory only — no billing or notification impact.
**Fix:** Add partial unique index or deduplicate at read time. Out of scope for this patch set.

---

## 9. Residual Risks after Patches

After P1 and P2 are applied:

1. **`/telegram` has no signature verification.** Intentional — UUID token is the auth mechanism. A brute-force of the token requires enumerating random UUIDs. Low risk.

2. **`/transfer` tool route has no replay protection.** Ultravox tools are called once per tool invocation. If the Ultravox platform ever retries, a double-redirect fires. Mitigated by graceful Twilio failure on already-redirected calls.

3. **`/completed` uses `after()` which has a Railway timeout.** If Railway kills the process before `after()` completes, the webhook payload is lost. Mitigation: the native Ultravox webhook `/api/webhook/ultravox` fires `call.ended` and logs orphans. This is already implemented (S13b-T2c).

4. **Stripe `invoice.payment_succeeded` and `invoice.payment_failed` handlers** do not have the explicit status update guard that `checkout.session.completed` has. On Stripe retry, the same grace-period `update` fires twice, with the same values. Net effect is identical — no corruption.

5. **`/fallback` creates a `call_logs` insert fire-and-forget**. After adding Twilio sig validation (P1), the insert is protected from external abuse, but if Twilio itself retries the fallback, two rows can still appear for the same `CallSid`. This is a low-volume scenario (fallback only fires when primary inbound fails) and the voicemail route's `.single()` lookup handles the ambiguous case gracefully by logging an error.

---

## 10. Verification Steps

### Test P1 (fallback signature)
```bash
# Should return 403 — no valid Twilio sig
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://<RAILWAY_URL>/api/webhook/windshield-hub/fallback \
  -d "From=%2B16045550000&CallSid=CAtest123"
# Expected: 403

# Twilio test: set VoiceFallbackUrl on a number and trigger a 500 from /inbound
# Confirm the fallback route handles it and does NOT create a log row without valid sig
```

### Test P2 (voicemail idempotency)
```bash
# Simulate duplicate Twilio recordingStatusCallback delivery
# 1. POST the same recordingSid twice to /api/webhook/[slug]/voicemail with valid Twilio sig
# 2. Confirm only one Telegram alert is sent (check notification_logs or Telegram history)
# 3. Confirm call_logs.recording_url is set correctly after first delivery
# 4. Confirm second delivery returns 200 and does not re-trigger Telegram
```

### Regression check for all routes
```bash
cd agent-app && npm run build
npx playwright test tests/
```
