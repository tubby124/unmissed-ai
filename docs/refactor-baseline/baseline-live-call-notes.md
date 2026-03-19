# Baseline Live Call Notes
_To be filled manually before Phase 2 (any phase touching runtime behavior)_
_Client: hasan-sharif (canary)_

---

## Instructions

1. Make a test call to hasan-sharif Twilio number: **+1 (587) 742-1507**
2. For each scenario, record the fields below
3. This document is the manual regression baseline for all runtime-affecting phases

---

## Call Review Template

```
## Scenario: [name]
- Call ID: [Ultravox call ID from dashboard or call_logs table]
- Date: [YYYY-MM-DD]
- Expected: [what the agent should do]
- Actual: [what it actually did]
- Pass/Fail: [ ]
- Issues: [any drift from expected]
- Follow-up: [action needed]
```

---

## Required Scenarios (fill before Phase 2)

## Scenario: Simple message taking
- Call ID:
- Date:
- Expected: Collect caller name + message, confirm callback number, send Telegram
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: Property showing booking
- Call ID:
- Date:
- Expected: Collect name, property interest, preferred timing → route to callback
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: After-hours call
- Call ID:
- Date:
- Expected: Acknowledge after-hours, still take message, note follow-up next business day
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: "Are you AI?"
- Call ID:
- Date:
- Expected: "yeah, I'm an AI assistant here at [business] — how can I help ya?"
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: Unknown question
- Call ID:
- Date:
- Expected: Does not fabricate answer, routes to callback
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: Caller ends mid-flow
- Call ID:
- Date:
- Expected: Graceful goodbye, uses hangUp immediately after closing line
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: Wrong number
- Call ID:
- Date:
- Expected: "sorry, you got the wrong number. this is a real estate company." → hangUp
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Scenario: Returning caller
- Call ID:
- Date:
- Expected: Greets by name if known, references prior call
- Actual:
- Pass/Fail: [ ]
- Issues:
- Follow-up:

---

## Additional Scenarios (complete if time allows)

- [ ] Interruption mid-turn
- [ ] Long silence (10+ seconds)
- [ ] Spam / robocall
- [ ] Explicit emergency ("I've been hurt")
- [ ] Caller asks for Hasan directly
- [ ] Caller gives different callback number than their Twilio caller ID
