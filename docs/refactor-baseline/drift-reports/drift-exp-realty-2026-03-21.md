# DRIFT REPORT — exp-realty — 2026-03-21

## SOURCE STATES

```
DB slug:              exp-realty
DB updated_at:        2026-03-20 21:50:15 UTC
Ultravox agent ID:    c9019927-49a7-4676-b97b-5c6395e58a37
Ultravox revision:    b0362211-fd8d-4849-ba04-3b87a77e54b4
Ultravox callTemplate updated: 2026-03-20T16:52:59Z
Snapshot taken:       2026-03-21 08:58 (baseline freeze)
```

Note: The DB `updated_at` (21:50 UTC) is LATER than the Ultravox callTemplate `updated` (16:52 UTC) on
the same day. The DB was written after the last Ultravox deploy. This is the primary drift indicator.

---

## FIELD COMPARISON

| Field | DB Value | Ultravox Live | Expected (Generated) | Status | Severity | Failure Class |
|-------|----------|---------------|----------------------|--------|----------|---------------|
| voice | `441ec053` | `441ec053` | `441ec053` (from DB) | MATCH | — | — |
| model | (hardcoded) | `ultravox-v0.7` | `ultravox-v0.7` | MATCH | — | — |
| maxDuration | (hardcoded) | `600s` | `600s` | MATCH | — | — |
| recordingEnabled | (hardcoded true) | `true` | `true` | MATCH | — | — |
| timeExceededMessage | (hardcoded) | "I need to wrap up..." | "I need to wrap up..." | MATCH | — | — |
| inactivityMessages[0] | (hardcoded) | 30s "Hello? You still there?" | 30s "Hello? You still there?" | MATCH | — | — |
| inactivityMessages[1] | (hardcoded) | 15s hang up soft | 15s hang up soft | MATCH | — | — |
| vadSettings.turnEndpointDelay | (hardcoded 0.64s) | `0.640s` | `0.64s` | MATCH | — | — |
| vadSettings.minimumTurnDuration | (hardcoded 0.1s) | `0.100s` | `0.1s` | MATCH | — | — |
| vadSettings.minimumInterruptionDuration | (hardcoded 0.2s) | `0.400s` | `0.2s` | MISMATCH | WARNING | propagation bug |
| firstSpeakerSettings | (hardcoded w/ delay:'1s') | `{agent:{uninterruptible:true}}` | `{agent:{uninterruptible:true,delay:'1s'}}` | MISMATCH | WARNING | propagation bug |
| systemPrompt content | matches prompt-exp-realty.txt | matches prompt-exp-realty.txt | same (post-stripMarkers) | MATCH | — | — |
| systemPrompt — {{callerContext}} present | present in .txt | present in live | expected present | MATCH | — | — |
| systemPrompt — {{businessFacts}} present | present in .txt | NOT present in live | expected present | MISMATCH | CRITICAL | propagation bug |
| systemPrompt — {{extraQa}} present | present in .txt | NOT present in live | expected present | MISMATCH | CRITICAL | propagation bug |
| systemPrompt — {{contextData}} block present | present in .txt | NOT present in live | expected present | MISMATCH | CRITICAL | propagation bug |
| tool count | 7 (from flags) | 7 | 7 | MATCH | — | — |
| hangUp present | yes (always) | yes | yes | MATCH | — | — |
| bookAppointment present | yes (booking_enabled=true) | yes | yes | MATCH | — | — |
| checkCalendarAvailability present | yes (booking_enabled=true) | yes | yes | MATCH | — | — |
| transferCall present | yes (forwarding_number set) | yes | yes | MATCH | — | — |
| sendTextMessage present | yes (sms_enabled=true) | yes | yes | MATCH | — | — |
| queryKnowledge present | yes (pgvector, chunks unknown) | yes | yes | MATCH | — | — |
| checkForCoaching present | yes (always) | yes | yes | MATCH | — | — |
| checkCalendarAvailability — X-Call-Id autoParam | expected (code added it) | NOT present | expected present | MISMATCH | WARNING | propagation bug |
| contextSchema — additionalProperties | not emitted by code | `false` (live) | not set (permissive) | MISMATCH | WARNING | propagation bug |
| contextSchema — required | not emitted by code | `[]` (live) | not set | MISMATCH | INFO | propagation bug |
| booking_enabled flag | `true` | (bookAppointment present) | calendar tools expected | MATCH | — | — |
| sms_enabled flag | `true` | (sendTextMessage present) | SMS tool expected | MATCH | — | — |
| forwarding_number | `+13067163556` | (transferCall present) | transfer tool expected | MATCH | — | — |
| transfer_conditions | `null` | default description used | default expected | MATCH | — | — |
| knowledge_backend | `pgvector` | (queryKnowledge present) | knowledge tool expected | MATCH | — | — |

---

## SUMMARY

```
Total fields checked:  28
Matches:               21
Mismatches:             7  (3 critical, 3 warning, 1 info)
```

---

## CRITICAL MISMATCHES

### 1. {{businessFacts}} placeholder missing from live systemPrompt

- DB / .txt source: the placeholder `{{businessFacts}}` is present in `prompt-exp-realty.txt`
- Ultravox live: the live `systemPrompt` does NOT contain `{{businessFacts}}`
- Expected: `updateAgent()` ensures `{{businessFacts}}` is appended when callerContext is present
- Failure class: propagation bug
- Explanation: The live agent was last deployed at 16:52 UTC on 2026-03-20. The DB was written at 21:50 UTC the same day (after `{{businessFacts}}` / `{{extraQa}}` / `{{contextData}}` placeholders were added to the prompt template). The agent was NOT re-pushed after that DB write. All three templateContext placeholders are absent from the live agent, meaning `callViaAgent()` injects `businessFacts`, `extraQa`, and `contextData` into the template but they resolve to nothing — the business facts block never reaches the agent during calls.

### 2. {{extraQa}} placeholder missing from live systemPrompt

- Same root cause as #1 — the live prompt predates the placeholder additions.

### 3. {{contextData}} / INJECTED REFERENCE DATA block missing from live systemPrompt

- Same root cause as #1 — the entire INJECTED REFERENCE DATA block is absent from live.

---

## WARNING MISMATCHES

### 4. vadSettings.minimumInterruptionDuration — 0.400s live vs 0.2s expected

- Ultravox live: `0.400s`
- Expected (DEFAULT_VAD in ultravox.ts): `0.2s`
- Failure class: propagation bug
- Explanation: The code's `DEFAULT_VAD` was changed to `0.2s` but the agent has not been re-deployed since. The 0.4s value makes the agent slightly less interruptible than intended — callers must speak 400ms before interrupting vs the intended 200ms.

### 5. firstSpeakerSettings missing `delay: '1s'`

- Ultravox live: `{ agent: { uninterruptible: true } }` (no delay)
- Expected: `{ agent: { uninterruptible: true, delay: '1s' } }`
- Failure class: propagation bug
- Explanation: `delay: '1s'` was added to `updateAgent()` to give Twilio time to connect audio before the agent speaks its opening. Without it, some calls have the agent's first word cut off. The live agent predates this addition.

### 6. checkCalendarAvailability missing X-Call-Id automatic parameter

- Ultravox live: automaticParameters = `[X-Call-State]` only
- Expected: `[X-Call-State, X-Call-Id]`
- Failure class: propagation bug
- Explanation: The `buildCalendarTools()` function was updated to inject `X-Call-Id` (KNOWN_PARAM_CALL_ID) into the slots endpoint header for call state tracking. The live agent's checkCalendarAvailability was not re-deployed after this change. The slots route may not be writing call state correctly for this client.

### 7. contextSchema has `additionalProperties: false` in live

- Ultravox live: `contextSchema` includes `additionalProperties: false` and `required: []`
- Expected (updateAgent code): contextSchema does NOT emit `additionalProperties` or `required`
- Failure class: propagation bug
- Explanation: An older deploy wrote a stricter schema. The live schema rejects unknown template context keys. The current code emits a permissive schema. This is low-risk since the templateContext keys (callerContext, businessFacts, extraQa, contextData) are all declared in both schemas, but any future key addition would be blocked by the live schema until re-deployed.

---

## ROOT CAUSE SUMMARY

All 7 mismatches share a single root cause: **the agent was last deployed at 2026-03-20 16:52 UTC, but the DB (and prompt file) were written at 2026-03-20 21:50 UTC**. That 5-hour gap corresponds to a prompt/template update session that added the `{{businessFacts}}`, `{{extraQa}}`, and `{{contextData}}` placeholders, updated `DEFAULT_VAD.minimumInterruptionDuration`, and added `delay:'1s'` to `firstSpeakerSettings` — but `updateAgent()` was not called for exp-realty after those changes landed.

The critical impact is that **businessFacts, extraQa, and contextData are silently dropped on every live call** — the templateContext is injected but has no matching placeholders in the live prompt to resolve against.

---

## RECOMMENDED ACTIONS

1. **Immediate (Critical):** Run `/prompt-deploy exp-realty` to push the current `prompt-exp-realty.txt` through `updateAgent()`. This will:
   - Append all three missing placeholders (`{{businessFacts}}`, `{{extraQa}}`, `{{contextData}}`)
   - Fix `minimumInterruptionDuration` to `0.2s`
   - Add `delay:'1s'` to `firstSpeakerSettings`
   - Update `checkCalendarAvailability` to include `X-Call-Id`
   - Reset `contextSchema` to the current permissive definition

2. **Verify after deploy:** Fetch the agent again and confirm `{{businessFacts}}` appears in the live `systemPrompt`. All 7 mismatches should clear in one deploy.

3. **Process note:** The 5-hour window between DB write and agent deploy is a recurring risk pattern. Consider adding a post-save deploy trigger or a visual "agent out of sync" indicator in the dashboard whenever `clients.updated_at` is newer than `callTemplate.updated`.
