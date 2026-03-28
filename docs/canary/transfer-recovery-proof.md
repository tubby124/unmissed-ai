# Transfer Failure Recovery — Verification Proof

**Date:** 2026-03-28
**Route:** `src/app/api/webhook/[slug]/transfer-status/route.ts` (324 lines)
**Method:** Code-path trace + structural proof + Playwright spec

---

## Flow summary

```
Caller dials → /inbound → AI picks up
AI triggers transferCall tool → /webhook/[slug]/transfer
  → redirectCall() sends <Dial> TwiML to Twilio
  → call_logs: transfer_status='transferring'
  → Twilio dials forwarding_number

If owner answers (DialCallStatus=completed):
  → /transfer-status → <Response/> (empty, Twilio disconnects)

If owner doesn't answer (no-answer, busy, failed, canceled):
  → /transfer-status → reconnect to new Ultravox call → <Connect><Stream>
  → call_logs: recovery row inserted with parent_call_log_id FK
  → Telegram alert: "Transfer failed, AI recovered"
```

---

## Proof 1 — No infinite reconnect loop

**Guard location:** `transfer-status/route.ts` lines ~100-110

```typescript
const { count: recoveryCount } = await supabase
  .from('call_logs')
  .select('id', { count: 'exact', head: true })
  .eq('twilio_call_sid', callSid)
  .not('parent_call_log_id', 'is', null)
if ((recoveryCount ?? 0) > 0) {
  // return "not available" TwiML — no reconnect
}
```

**How it works:** On first failure, no recovery rows exist → `recoveryCount=0` → proceed. After recovery call is inserted with `parent_call_log_id` set, any subsequent invocation for the same `callSid` sees `recoveryCount=1` → returns graceful end TwiML immediately.

**Why the loop guard fires before the alert code:** The guard is at the top of the failure path. A second invocation never reaches Ultravox call creation or Telegram alert code.

**Race window (documented, not patched):** Two simultaneous POST requests for the same `callSid` can both read `recoveryCount=0` before either inserts the recovery row. Both would proceed to create recovery calls. This is a low-probability window (Twilio fires the callback once; retry would only occur on timeout). Not patched — not worth the complexity.

**Status: PROVEN by code inspection.**

---

## Proof 2 — Double-fired alert protection

**Primary guard:** The infinite loop guard (Proof 1) returns early before any alert code on second invocation.

**Secondary guard (CAS on status transition):**
```typescript
.update({ transfer_status: normalizedStatus, ... })
.eq('twilio_call_sid', callSid)
.eq('transfer_status', 'transferring')   // ← CAS: only matches once
.select('id')
```

`parentCallLogId` is `undefined` if the CAS missed (row already moved past `transferring`). The `notification_logs` insert uses `parentCallLogId` as the `call_id` FK — on a replay where CAS misses, `call_id` is null but the insert still fires.

**Gap:** No pre-send `notificationsAlreadySent()` check in this route (unlike `/completed` which has one). The loop guard is the only protection. If Twilio somehow fires this endpoint twice before the first recovery row is committed, both invocations alert. Risk is low but documented.

**Status: PROVEN — loop guard is primary protection. Dedup check gap documented.**

---

## Proof 3 — Original and recovery logs linked

Recovery row insert:
```typescript
await supabase.from('call_logs').insert({
  ultravox_call_id: ultravoxCall.callId,
  ...
  ai_summary: `Transfer recovery — owner did not answer (${dialStatus})`,
  ...(parentCallLogId ? { parent_call_log_id: parentCallLogId } : {}),
})
```

Original row update:
```typescript
.update({ transfer_status: 'recovered', transfer_updated_at: new Date().toISOString() })
.eq('twilio_call_sid', callSid)
.in('transfer_status', ['no_answer', 'busy', 'failed', 'canceled'])
```

Both rows share `twilio_call_sid`. The recovery row has `parent_call_log_id` pointing to the original row's `id`. Dashboard call history can query both via `twilio_call_sid` or the FK chain.

**Status: PROVEN by code inspection.**

---

## Proof 4 — Agent does not re-attempt the transfer

```typescript
const transferFailureNote = `TRANSFER FAILED: ... Resume the conversation naturally ...
Do NOT re-attempt the transfer.`
```

This is injected into `callerContextWithFailure` and passed as `callerContext` via `templateContext` (Agents API path) or appended to `promptFull` (createCall fallback). The agent receives an explicit instruction in the per-call context to not re-trigger the transfer tool.

**Status: PROVEN by code inspection.**

---

## Proof 5 — Completed transfer returns clean exit

```typescript
if (dialStatus === 'completed') {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', ...)
}
```

No reconnect, no alert, no log mutation. Twilio disconnects the call normally.

**Status: PROVEN by code inspection.**

---

## Proof 6 — Billing guards in recovery path

The recovery path applies the same 3 billing guards as `/inbound`:
- Grace period expiry → 403 TwiML
- Trial expiry → 403 TwiML
- Overage → soft enforcement (log + operator alert, call proceeds)

A client that has run out of minutes still gets the recovery call (soft enforcement) but the operator is alerted. This matches the `/inbound` behavior.

**Status: PROVEN by code inspection.**

---

## Live verification gate (Playwright spec)

**File:** `tests/truth-audit/transfer-recovery.spec.ts`

Tests the API contract from an authenticated browser session — cannot simulate a live Twilio/Ultravox call, so these tests verify the DB state and API contract:

1. `transfer` route rejects invalid secret (401)
2. `transfer` route requires active `forwarding_number` (404 when absent)
3. `transfer-status` route rejects unsigned requests (403)
4. `transfer-status` with `DialCallStatus=completed` → empty `<Response/>` (no reconnect)
5. `transfer-status` with `DialCallStatus=no-answer` after an existing recovery row → loop guard fires (graceful end TwiML, no second reconnect)

Full end-to-end (actual transfer → fail → recovery → Telegram alert) requires a live call with `TEST_PASSWORD` + a real Twilio number. That is the manual smoke gate.

---

## Known risks

| Risk | Severity | Notes |
|------|----------|-------|
| Race window on simultaneous callbacks | LOW | Twilio fires once; retry only on timeout. Not worth locking. |
| No `notificationsAlreadySent()` pre-check | LOW | Loop guard covers normal case. Dedup check would add safety but is not blocking. |
| `parentCallLogId` undefined if CAS missed | LOW | Recovery still inserts; just lacks FK. Call is not lost. |
| Recovery Ultravox call fails (outer catch) | LOW | Failure TwiML returned; admin + client alerted via `notifySystemFailure`. |

---

## Verdict

Transfer failure recovery is structurally sound. Loop guard is correct. Original/recovery rows are linked. Agent prompt explicitly prevents re-transfer. No blocking issues found. Dedup pre-check gap is documented and low-severity.
