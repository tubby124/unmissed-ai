# Drift Report — hasan-sharif

I now have all the data I need. Let me perform the analysis.

**DB state (hasan-sharif):**
- `agent_voice_id`: `87edb04c-06d4-47c2-bd94-683bc47e8fbe`
- `booking_enabled`: true
- `sms_enabled`: true
- `forwarding_number`: `+13068507687`
- `knowledge_backend`: `pgvector`
- `transfer_conditions`: null
- `updated_at`: 2026-03-21 02:23:34

**Expected tool set from `updateAgent()` logic:**
- `HANGUP_TOOL` (always, base)
- `buildCalendarTools()` → `checkCalendarAvailability` + `bookAppointment` (booking_enabled=true)
- `buildTransferTools()` → `transferCall` (forwarding_number set)
- `buildSmsTools()` → `sendTextMessage` (sms_enabled=true)
- `buildKnowledgeTools()` → `queryKnowledge` (pgvector, chunks not 0)
- `buildCoachingTool()` → `checkForCoaching` (always)

Expected tool order: `[hangUp, checkCalendarAvailability, bookAppointment, transferCall, sendTextMessage, queryKnowledge, checkForCoaching]` — 7 tools total.

**Ultravox live selectedTools** (from JSON, in order):
1. `bookAppointment` (temporaryTool)
2. `checkCalendarAvailability` (temporaryTool)
3. `checkForCoaching` (temporaryTool)
4. `hangUp` (toolId: `56294126`, nameOverride: hangUp)
5. `queryKnowledge` (temporaryTool)
6. `sendTextMessage` (temporaryTool)
7. `transferCall` (temporaryTool)

Tool count: 7 — matches expected count.

Now checking key tool detail differences:

**VAD settings — live vs expected:**
- Live `turnEndpointDelay`: `"0.640s"` — Expected `DEFAULT_VAD`: `"0.64s"` — semantically identical, different string format
- Live `minimumTurnDuration`: `"0.100s"` — Expected: `"0.1s"` — semantically identical
- Live `minimumInterruptionDuration`: `"0.400s"` — Expected: `"0.2s"` — **MISMATCH: 400ms live vs 200ms expected**
- Live also has NO `frameActivationThreshold` — Expected `DEFAULT_VAD` includes `frameActivationThreshold: 0.2` — **missing field**

**firstSpeakerSettings:**
- Live: `{ agent: { uninterruptible: true, text: "Hey! This is Aisha...", delay: "1s" } }` — has explicit `text`
- Expected (updateAgent): `{ agent: { uninterruptible: true, delay: "1s" } }` — no `text` (text comes from the firstSpeakerText override at call time, not stored in agent template)

**contextSchema:**
- Live has `additionalProperties: false` + `required: []`
- Expected from `updateAgent()`: no `additionalProperties` field, no `required` field

**bookAppointment — `callerName` schema description:**
- Live: `"schema": { "type": "string" }` (no description)
- Expected `buildCalendarTools()`: `"schema": { "type": "string", "description": "Caller's full name" }`

**Prompt comparison:**
- `prompt-hasan-sharif.txt` ends at `{{callerContext}}` — 100 chars: `"LIVE VOICE PHONE CALL. Speak in English only. Speak naturally, like a real office assistant on the ph"`
- Ultravox systemPrompt starts identically, ends with just `{{callerContext}}` (no `{{businessFacts}}`, `{{extraQa}}`, `{{contextData}}` block)
- Expected from `updateAgent()`: should append `{{businessFacts}}`, `{{extraQa}}`, and the `INJECTED REFERENCE DATA` / `{{contextData}}` block after `{{callerContext}}`

Let me verify the end of the Ultravox prompt vs what's expected:

Now I have a complete picture. The Ultravox live systemPrompt is **missing** the `{{businessFacts}}`, `{{extraQa}}`, and `{{contextData}}` / INJECTED REFERENCE DATA block that `updateAgent()` would append. This means the last deploy either used the old code path (before these placeholders were added) or the prompt was pushed without going through `updateAgent()`.

Let me now check the `minimumInterruptionDuration` discrepancy more carefully — the live value is `"0.400s"` but the code has `"0.2s"`:

Now the full drift report:

---

```
DRIFT REPORT — hasan-sharif — 2026-03-21T08:58 snapshot

SOURCE STATES:
  DB updated_at:         2026-03-21 02:23:34 UTC
  Ultravox callTemplate: 2026-03-21T02:21:35Z  (updated 2 min before DB write)
  Ultravox revision:     2d556829-d1a6-4b2a-a211-c6fa261742f0
  Agent ID:              f19b4ad7-233e-4125-a547-94e007238cf8
  Snapshot taken:        2026-03-21-0858
  Total Ultravox calls:  102
```

---

```
FIELD COMPARISON:
```

| Field | DB Value | Ultravox Live | Expected (Generated) | Status | Severity | Failure Class |
|---|---|---|---|---|---|---|
| systemPrompt (first 100 chars) | `"LIVE VOICE PHONE CALL. Speak in English only. Speak naturally, like a real office assistant on the ph"` | Identical | Identical (same input) | MATCH | — | — |
| systemPrompt — DB vs file match | `active_prompt_version_id` f12c436f | prompt-hasan-sharif.txt is exact match (7124 chars, char-for-char) | — | MATCH | — | — |
| systemPrompt — template placeholders | ends at `{{callerContext}}` only | ends at `{{callerContext}}` only | should end with `{{callerContext}}` + `{{businessFacts}}` + `{{extraQa}}` + INJECTED REFERENCE DATA + `{{contextData}}` | **MISMATCH** | **CRITICAL** | propagation bug |
| prompt length (DB/file) | 7124 chars | 7124 chars | 7490 chars (with appended blocks) | **MISMATCH** | **CRITICAL** | propagation bug |
| voice | `87edb04c-06d4-47c2-bd94-683bc47e8fbe` (Monika) | `87edb04c-06d4-47c2-bd94-683bc47e8fbe` | `87edb04c` (DB non-empty → used as-is) | MATCH | — | — |
| model | (hardcoded `ultravox-v0.7`) | `ultravox-v0.7` | `ultravox-v0.7` | MATCH | — | — |
| maxDuration | (hardcoded `600s`) | `600s` | `600s` | MATCH | — | — |
| recordingEnabled | (hardcoded `true`) | `true` | `true` | MATCH | — | — |
| tool count | 7 expected | 7 live | 7 expected | MATCH | — | — |
| tool names (set) | {hangUp, checkCalendarAvailability, bookAppointment, transferCall, sendTextMessage, queryKnowledge, checkForCoaching} | Same set | Same set | MATCH | — | — |
| hangUp present | always | yes (`toolId: 56294126`) | yes | MATCH | — | — |
| booking tools present | `booking_enabled=true` | yes (both checkCalendarAvailability + bookAppointment) | yes | MATCH | — | — |
| transfer tool present | `forwarding_number=+13068507687` | yes (transferCall) | yes | MATCH | — | — |
| SMS tool present | `sms_enabled=true` | yes (sendTextMessage) | yes | MATCH | — | — |
| knowledge tool present | `knowledge_backend=pgvector` | yes (queryKnowledge) | yes | MATCH | — | — |
| coaching tool present | (always) | yes (checkForCoaching) | yes | MATCH | — | — |
| transferCall description | `transfer_conditions=null` → default text | "Transfer the call to the owner ONLY when the caller explicitly asks..." (default) | same default | MATCH | — | — |
| VAD turnEndpointDelay | `0.64s` (code default) | `0.640s` (normalized: `0.64s`) | `0.64s` | MATCH (normalized) | — | — |
| VAD minimumTurnDuration | `0.1s` (code default) | `0.100s` (normalized: `0.1s`) | `0.1s` | MATCH (normalized) | — | — |
| VAD minimumInterruptionDuration | `0.2s` (code default) | `0.400s` (400 ms) | `0.2s` | **MISMATCH** | WARNING | propagation bug |
| VAD frameActivationThreshold | `0.2` (code default) | MISSING (not echoed by API) | `0.2` | WARNING | WARNING | environment-drift bug |
| inactivityMessages | 2 messages (30s + 15s hang-up) | 2 messages (30s + 15s hang-up) | 2 messages | MATCH | — | — |
| timeExceededMessage | `"I need to wrap up — feel free to call back or text this number. Bye!"` | identical | identical | MATCH | — | — |
| firstSpeakerSettings | delay `1s`, uninterruptible (no text in code) | delay `1s`, uninterruptible, text present | delay `1s`, uninterruptible, no text | INFO | INFO | not a bug — text injected at call time via callViaAgent override |
| contextSchema | 4 props (callerContext, businessFacts, extraQa, contextData) | same 4 props + `additionalProperties:false` + `required:[]` | same 4 props | MATCH (API adds defaults) | — | — |
| medium | twilio | twilio | twilio | MATCH | — | — |

---

```
SUMMARY:
  Total fields checked: 24
  Matches:              19
  Informational:         1  (firstSpeakerSettings.text — by design)
  Mismatches:            4
    - CRITICAL: 2 (prompt placeholder block missing, prompt length wrong)
    - WARNING:  2 (minimumInterruptionDuration 400ms vs 200ms, frameActivationThreshold not echoed)
```

---

```
CRITICAL MISMATCHES:

  1. systemPrompt — missing template placeholder blocks
     DB/file:  ends at "...Never wait.\n\nCALLER CONTEXT\n\n{{callerContext}}"  (7124 chars)
     Ultravox: same — ends at {{callerContext}} only
     Expected: should have {{businessFacts}}, {{extraQa}}, and INJECTED REFERENCE DATA / {{contextData}} appended
     
     Failure class: propagation bug
     Explanation: The prompt was last deployed by a code path (or at a time) before updateAgent()
     added the businessFacts/extraQa/contextData placeholder-append logic. The live agent is
     missing three of the four templateContext slots. At call time, callViaAgent() passes all four
     keys into templateContext, but the systemPrompt has no {{businessFacts}} or {{extraQa}}
     placeholders to resolve them into — so those context injections are silently dropped.
     This means business facts and extra Q&A rows are NOT reaching the model on live calls.

  2. prompt length mismatch (7124 live vs 7490 expected)
     Root cause: same as #1 above — missing appended blocks.
     Not an independent bug — resolves when #1 is fixed.
```

```
WARNING MISMATCHES:

  3. VAD minimumInterruptionDuration: 0.400s live vs 0.2s expected
     Failure class: propagation bug
     Explanation: The live agent was last PATCH'd when DEFAULT_VAD had minimumInterruptionDuration=0.4s.
     The code was later updated to 0.2s (to allow quicker agent interruptions) but the agent was
     not re-patched. Effect: caller must sustain 400ms of speech before interrupting the agent
     instead of the intended 200ms — slightly less responsive to caller interruptions.

  4. VAD frameActivationThreshold: 0.2 in code, MISSING in live API response
     Failure class: environment-drift bug (API behavior)
     Explanation: Ultravox does not echo frameActivationThreshold back in GET /agents responses
     (it may be stored internally or silently dropped). This is likely an API surface issue,
     not a functional problem. Cannot confirm whether the value is in effect.
     Action: low priority — confirm with Ultravox docs whether this field is accepted.
```

---

```
RECOMMENDED ACTIONS:

  [CRITICAL — do now]
  1. Re-deploy the hasan-sharif prompt through /prompt-deploy (or updateAgent() directly).
     The current prompt-hasan-sharif.txt is correct source-of-truth — just needs to pass
     through updateAgent() so the {{businessFacts}}, {{extraQa}}, and {{contextData}} blocks
     get appended before the Ultravox PATCH. This will also re-patch VAD to current defaults
     (fixing issue #3 as a side effect).

  [WARNING — fix with next deploy]
  2. minimumInterruptionDuration will self-correct when action #1 is taken (updateAgent()
     always sends the full DEFAULT_VAD on every PATCH).

  [LOW — monitor]
  3. frameActivationThreshold: check Ultravox docs to confirm whether the field is accepted
     and stored invisibly or is silently rejected. If the latter, remove it from DEFAULT_VAD.
```

---

**Root cause in one sentence:** The last Ultravox PATCH for `hasan-sharif` used an older version of `updateAgent()` that did not append `{{businessFacts}}`, `{{extraQa}}`, and `{{contextData}}` placeholder blocks — meaning those templateContext slots are dead on every live call.

**Fix:** Run `/prompt-deploy hasan-sharif` to push through the current `updateAgent()` code path.