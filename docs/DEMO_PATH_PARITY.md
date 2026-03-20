# Demo Path Parity Matrix

Last updated: 2026-03-19 (Phase A-C of merry-stirring-pebble plan)

---

## SECTION 1 — CURRENT VERIFIED STATE

Confirmed by code audit on 2026-03-19. This is what each path actually does RIGHT NOW.

| | Path 1: Browser /try | Path 2: Call-me | Path 3: IVR phone | Path 4: Direct inbound |
|---|---|---|---|---|
| **Route** | `/api/demo/start` | `/api/demo/call-me` | `/api/webhook/demo/inbound` | `/api/webhook/unmissed-demo/inbound` |
| **Medium** | WebRTC | Twilio outbound | Twilio inbound | Twilio inbound |
| **Runtime** | Ephemeral (`createDemoCall`) | Ephemeral (`createDemoCall`) | Ephemeral (`createDemoCall`) | Persistent (`callViaAgent`) |
| **maxDuration** | 600s | 600s | 600s | 600s |
| **callerPhone** | unknown | known (validated E.164) | known (Twilio body.From) | known (Twilio body.From) |
| **hangUp** | YES | YES | YES (only tool) | YES |
| **Calendar** | YES (2 tools) | YES (2 tools) | NO | YES |
| **SMS** | NO (no phone) | YES | NO | YES |
| **Transfer** | NO (no Twilio SID) | YES | NO | YES |
| **Corpus/RAG** | NO | NO | NO | YES (if env + enabled) |
| **Coaching** | NO | NO | NO | YES |
| **callbackUrl** | YES (signed) | YES (signed) | NO | YES (signed) |
| **Post-call processing** | YES | YES | NO | YES |
| **demo_calls insert** | YES | YES | YES | NO (uses call_logs) |
| **Context injection** | `[DEMO MODE — BROWSER. Tools: hangUp, calendar. ...]` | `[DEMO MODE — PHONE. Tools: hangUp, calendar, SMS, transfer. ...]` | `[DEMO MODE — IVR PHONE. Tools: hangUp only. ...]` | Full (callerContext+businessFacts+extraQa+contextData) |
| **Path logging** | `[demo:browser]` | `[demo:call-me]` | `[demo:ivr]` | `[inbound]` (standard) |

### Why certain tools are excluded

1. **SMS in browser mode:** No caller phone number. CALLER PHONE = "unknown". Agent cannot send to an unknown number.
2. **Transfer in WebRTC mode:** Transfer requires active Twilio call SID (`redirectCall()` → `twilio.calls(callSid).update()`). WebRTC calls have no Twilio SID.
3. **Calendar on IVR:** Not wired yet (Phase B1b). IVR path currently passes no tools to `createDemoCall`.
4. **Coaching in demos:** No live manager monitoring demo calls. Tool would return empty.

### SMS Dedupe (verified working)

| Scenario | in_call_sms_sent written to | Post-call SMS suppressed? |
|----------|----------------------------|---------------------------|
| Call-me: agent sends SMS during call | demo_calls | YES |
| Call-me: agent does NOT send SMS | neither | NO — post-call SMS fires |
| Browser: no SMS tool available | n/a | n/a — callerPhone=unknown skips SMS |
| Direct phone: agent sends SMS | call_logs | YES |

Dedupe logging added: `[completed] SMS dedupe: in_call=... demo=... → skip=...`

---

## SECTION 2 — TARGET STATE

What each path SHOULD do after the full plan is complete. Items marked (DONE) are already implemented. Items marked (PENDING) require B1b/B1c/D phases.

| | Path 1: Browser /try | Path 2: Call-me | Path 3: IVR phone | Path 4: Direct inbound |
|---|---|---|---|---|
| **maxDuration** | 600s (DONE) | 600s (DONE) | 600s (DONE) | 600s (DONE) |
| **hangUp** | YES (DONE) | YES (DONE) | YES (DONE) | YES (DONE) |
| **Calendar** | YES (DONE) | YES (DONE) | YES (PENDING B1b) | YES (DONE) |
| **SMS** | NO — never (no phone) | YES (DONE) | YES (PENDING B1b) | YES (DONE) |
| **Transfer** | NO — never (no SID) | YES (DONE) | YES (PENDING B1b) | YES (DONE) |
| **Corpus/RAG** | PENDING D | PENDING D | PENDING D | YES (if configured) |
| **callbackUrl** | YES (DONE) | YES (DONE) | YES (PENDING B1c) | YES (DONE) |
| **Context injection** | Capability-truth (DONE) | Capability-truth (DONE) | Capability-truth (DONE for B1a) | Full context (DONE) |

### Staged IVR restoration plan

- **B1a (DONE):** Context injection labels hangUp as only tool. Logging added. No new tools.
- **B1b (PENDING):** Add `buildDemoTools()` with conservative caps. Update context to match.
- **B1c (PENDING):** Add signed callbackUrl + demo_calls insert. Enable calendar/transfer after B1b verified.

### Corpus wiring (Phase D — SKIPPABLE)

- Dual-gated: env var (`ULTRAVOX_CORPUS_ID`) AND client-level readiness (`corpus_enabled=true` + docs uploaded)
- Context injection must use same dual-gated truth — NOT just env var check
- Skip entirely if corpus docs not uploaded

---

## DB State (unmissed-demo client)

```
twilio_number: +15878014602
sms_enabled: true
booking_enabled: true
corpus_enabled: false
corpus_id: null
ultravox_corpus_status: idle
```

## Verification Checklist

- [ ] Browser /try (Zara): calendar tools available, no SMS, no transfer
- [ ] Browser /try (Zara): ask for SMS → agent truthfully declines (no phone number)
- [ ] Call-me widget (Zara): all tools work (SMS, transfer, calendar)
- [ ] IVR phone: hangUp only, no false tool promises
- [ ] Direct dial: zero regression
- [ ] SMS dedupe: call-me + in-call SMS → no post-call duplicate
- [ ] maxDuration: call lasts past 2 minutes without forced termination
- [ ] Path logging: Railway logs show correct `[demo:browser]` / `[demo:call-me]` / `[demo:ivr]` prefixes
