# Demo Path Parity Matrix

Last updated: 2026-03-19

## Tool Availability by Entry Path

| Path | Route | Medium | hangUp | SMS | Transfer | Calendar | Coaching | Post-call webhook |
|------|-------|--------|--------|-----|----------|----------|----------|-------------------|
| Direct phone inbound | `/api/webhook/unmissed-demo/inbound` | Twilio | YES | YES | YES | YES | YES | YES (via signed callbackUrl) |
| Browser /try page | `/api/demo/start` | WebRTC | YES | NO (1) | NO (2) | YES | NO (3) | YES (via signed callbackUrl) |
| Call-me widget | `/api/demo/call-me` | Twilio | YES | YES | YES | YES | NO (3) | YES (via signed callbackUrl) |
| Onboarding preview | `/api/demo/start` (mode=preview) | WebRTC | YES | NO | NO | NO | NO | NO |

### Why certain tools are excluded

1. **SMS in browser mode:** No caller phone number exists. CALLER PHONE = "unknown". SMS tool excluded because the agent cannot send to an unknown number. If SMS tool were present, the agent would promise to text and fail.
2. **Transfer in WebRTC mode:** Transfer requires an active Twilio call SID (uses `redirectCall()` -> `twilio.calls(callSid).update()`). WebRTC calls have no Twilio SID. Physically impossible.
3. **Coaching in demos:** No live manager is monitoring demo calls. Tool would return empty every time.

## SMS Dedupe Behavior

| Scenario | in_call_sms_sent written to | Post-call SMS suppressed? |
|----------|----------------------------|---------------------------|
| Call-me: agent sends SMS during call | demo_calls (fallback from call_logs) | YES |
| Call-me: agent does NOT send SMS | neither | NO -- post-call SMS fires |
| Browser: no SMS tool available | n/a | n/a -- callerPhone=unknown skips SMS |
| Direct phone: agent sends SMS | call_logs | YES |

## DB tables involved

- `call_logs` -- production calls (inbound webhook creates 'live' row)
- `demo_calls` -- demo/widget calls (demo routes create rows)
- Both tables have `in_call_sms_sent` boolean (demo_calls column added 2026-03-19)
- Completed webhook inserts into `call_logs` even for demo calls (via callbackUrl)

## Verification Checklist

- [ ] Browser /try (existing niches): auto_glass demo still works with hangUp only
- [ ] Browser /try (Zara): calendar tools available, no SMS, no transfer
- [ ] Browser /try (Zara): ask for SMS -> agent truthfully declines (no phone number)
- [ ] Call-me widget (Zara): all tools work (SMS, transfer, calendar)
- [ ] Direct dial: zero regression
- [ ] SMS dedupe: call-me + in-call SMS -> no post-call duplicate
- [ ] Prompt stays under 8K chars (tools are in selectedTools, not prompt)
