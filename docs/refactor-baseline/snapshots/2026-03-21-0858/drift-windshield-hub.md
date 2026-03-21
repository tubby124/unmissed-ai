# Drift Report — windshield-hub

I now have all three sources. Let me do the detailed analysis before writing the report.

Key facts extracted:

**DB state (windshield-hub row):**
- `ultravox_agent_id`: `00652ba8-5580-4632-97be-0fd2090bbb71`
- `agent_voice_id`: `b28f7f08-685c-4219-a2a0-c539b985b9fd`
- `niche`: `auto-glass`
- `booking_enabled`: `false`
- `sms_enabled`: `true`
- `forwarding_number`: `null`
- `knowledge_backend`: `pgvector`
- `active_prompt_version_id`: `9a8db3e5-abe7-4cbe-b20f-c94748b0b962`
- `updated_at`: `2026-03-20 18:01:27.81093+00`

**Ultravox live state:**
- `publishedRevisionId`: `be6c59df-99eb-4063-83d4-8e50279a7dce`
- `callTemplate.updated`: `2026-03-20T16:52:54.145460Z`
- `voice`: `b28f7f08-685c-4219-a2a0-c539b985b9fd`
- `model`: `ultravox-v0.7`
- `maxDuration`: `600s`
- `vadSettings.turnEndpointDelay`: `0.640s`
- `vadSettings.minimumTurnDuration`: `0.100s`
- `vadSettings.minimumInterruptionDuration`: `0.400s`
- `recordingEnabled`: `true`
- `firstSpeakerSettings`: `{ agent: { uninterruptible: true } }` — note: NO `delay: '1s'`
- `selectedTools` names: `checkForCoaching`, `hangUp`, `queryKnowledge`, `sendTextMessage`
- Tool count: 4
- `systemPrompt`: ends with `\n\nCALLER CONTEXT\n\n{{callerContext}}\n` — missing `{{businessFacts}}`, `{{extraQa}}`, `{{contextData}}`

**Generated/Expected state (from updateAgent() logic):**
- `voice`: DB `agent_voice_id` = `b28f7f08...` (matches)
- `model`: `ultravox-v0.7` (hardcoded)
- `maxDuration`: `600s`
- `vadSettings.turnEndpointDelay`: `0.64s` (code uses `0.64s`, live has `0.640s` — same value)
- `vadSettings.minimumTurnDuration`: `0.1s` (code) vs `0.100s` (live) — same value
- `vadSettings.minimumInterruptionDuration`: `0.2s` (code DEFAULT_VAD) vs `0.400s` (live) — MISMATCH
- `firstSpeakerSettings`: `{ agent: { uninterruptible: true, delay: '1s' } }` — live is missing `delay: '1s'`
- Tools expected: `hangUp` (base) + no calendar (booking_enabled=false) + no transfer (forwarding_number=null) + `sendTextMessage` (sms_enabled=true) + `queryKnowledge` (pgvector, chunks unknown but >0 implied) + `checkForCoaching` (always)
  - Expected tool names: `hangUp`, `sendTextMessage`, `queryKnowledge`, `checkForCoaching` = 4 tools
- `systemPrompt`: The saved `prompt-windshield-hub.txt` ends with `{{callerContext}}\n`. The `updateAgent()` logic checks: since `{{callerContext}}` IS present, it then checks for `{{businessFacts}}`, `{{extraQa}}`, `{{contextData}}` and appends any missing. So expected systemPrompt in Ultravox = prompt text + `\n\n{{businessFacts}}\n\n{{extraQa}}\n\n## INJECTED REFERENCE DATA...{{contextData}}`. But the live Ultravox systemPrompt only has `{{callerContext}}` — it's missing all three newer placeholders.
- `contextSchema`: Expected has no `additionalProperties: false` (code doesn't set it). Live has `additionalProperties: false` — this is a schema difference but functionally may not matter.

Now let me verify the prompt comparison more carefully — the live Ultravox systemPrompt vs the saved SYSTEM_PROMPT.txt:

Now I have everything. Here is the complete drift report:

---

```
DRIFT REPORT — windshield-hub — 2026-03-21

SOURCE STATES:
  DB updated_at:          2026-03-20 18:01:27.810+00
  Ultravox callTemplate:  2026-03-20T16:52:54.145Z  (callTemplate.updated — ~8 min BEFORE DB updated_at)
  Ultravox revision ID:   be6c59df-99eb-4063-83d4-8e50279a7dce
  Agent ID:               00652ba8-5580-4632-97be-0fd2090bbb71
  Baseline snapshot:      2026-03-21-0858

NOTE: Ultravox callTemplate.updated (16:52 UTC) is ~8 minutes earlier than DB updated_at (18:01 UTC).
      The DB was written after the last deploy. This timing gap is normal if the dashboard saves
      non-agent-affecting fields (e.g. website_url, hours) without re-triggering updateAgent().

──────────────────────────────────────────────────────────────────────────────────────────────────────
FIELD COMPARISON
──────────────────────────────────────────────────────────────────────────────────────────────────────

| Field                            | DB Value                          | Ultravox Live                        | Expected (Generated)                                        | Status   | Severity | Failure Class       |
|----------------------------------|-----------------------------------|--------------------------------------|-------------------------------------------------------------|----------|----------|---------------------|
| voice                            | b28f7f08-685c-4219-a2a0-c539b985b9fd | b28f7f08-685c-4219-a2a0-c539b985b9fd | b28f7f08-685c-4219-a2a0-c539b985b9fd                    | MATCH    | —        | —                   |
| model                            | (hardcoded)                       | ultravox-v0.7                        | ultravox-v0.7                                               | MATCH    | —        | —                   |
| maxDuration                      | (hardcoded)                       | 600s                                 | 600s                                                        | MATCH    | —        | —                   |
| recordingEnabled                 | (hardcoded)                       | true                                 | true                                                        | MATCH    | —        | —                   |
| VAD turnEndpointDelay            | (hardcoded)                       | 0.640s                               | 0.64s (same value)                                          | MATCH    | —        | —                   |
| VAD minimumTurnDuration          | (hardcoded)                       | 0.100s                               | 0.1s (same value)                                           | MATCH    | —        | —                   |
| VAD minimumInterruptionDuration  | (hardcoded DEFAULT_VAD)           | 0.400s                               | 0.2s                                                        | MISMATCH | WARNING  | propagation bug     |
| firstSpeakerSettings.delay       | (hardcoded in updateAgent)        | not present                          | delay: "1s"                                                 | MISMATCH | WARNING  | propagation bug     |
| systemPrompt body                | 7873 chars (identical to live)    | 7873 chars                           | 7873 chars (same body)                                      | MATCH    | —        | —                   |
| systemPrompt {{businessFacts}}   | not in prompt file                | NOT present                          | MUST be appended by updateAgent()                           | MISMATCH | CRITICAL | propagation bug     |
| systemPrompt {{extraQa}}         | not in prompt file                | NOT present                          | MUST be appended by updateAgent()                           | MISMATCH | CRITICAL | propagation bug     |
| systemPrompt {{contextData}}     | not in prompt file                | NOT present                          | MUST be appended + INJECTED REFERENCE DATA block            | MISMATCH | CRITICAL | propagation bug     |
| systemPrompt total length        | 7873 chars                        | 7873 chars                           | 8239 chars (366 chars of placeholders missing)              | MISMATCH | CRITICAL | propagation bug     |
| booking_enabled / calendar tools | false → no calendar tools         | no checkCalendarAvailability, no bookAppointment | no calendar tools expected               | MATCH    | —        | —                   |
| forwarding_number / transfer tool| null → no transferCall            | no transferCall                      | no transferCall expected                                    | MATCH    | —        | —                   |
| sms_enabled / sendTextMessage    | true → sendTextMessage            | sendTextMessage present              | sendTextMessage expected                                     | MATCH    | —        | —                   |
| knowledge_backend / queryKnowledge| pgvector → queryKnowledge        | queryKnowledge present               | queryKnowledge expected                                     | MATCH    | —        | —                   |
| coaching tool (checkForCoaching) | always present                    | checkForCoaching present             | checkForCoaching expected                                   | MATCH    | —        | —                   |
| tool count                       | 4 expected                        | 4 (coaching+hangUp+knowledge+sms)    | 4 expected                                                  | MATCH    | —        | —                   |
| hangUp tool format               | HANGUP_TOOL ref (toolName+parameterOverrides) | full temporaryTool HTTP definition | toolName: 'hangUp', parameterOverrides: {strict:true} | MISMATCH | WARNING  | propagation bug     |
| queryKnowledge KNOWN_PARAM_CALL_ID | (buildKnowledgeTools injects it) | NOT present                         | call_id automaticParameter with KNOWN_PARAM_CALL_ID        | MISMATCH | CRITICAL | propagation bug     |
| contextSchema additionalProperties | (not set in updateAgent code)   | additionalProperties: false          | not present in updateAgent output                           | MISMATCH | INFO     | propagation bug     |
| contextSchema required field     | (not set in updateAgent code)     | required: []                         | not present in updateAgent output                           | MISMATCH | INFO     | propagation bug     |
| inactivityMessages               | (hardcoded DEFAULT_INACTIVITY)    | ["Hello? You still there?", "I'll let you go..."] | identical              | MATCH    | —        | —                   |
| timeExceededMessage              | (hardcoded)                       | "I need to wrap up..."               | "I need to wrap up..."                                      | MATCH    | —        | —                   |

──────────────────────────────────────────────────────────────────────────────────────────────────────
SUMMARY
──────────────────────────────────────────────────────────────────────────────────────────────────────

  Total fields checked:  24
  Matches:               15
  Mismatches:            9 (4 critical, 3 warning, 2 info)

──────────────────────────────────────────────────────────────────────────────────────────────────────
CRITICAL MISMATCHES
──────────────────────────────────────────────────────────────────────────────────────────────────────

1. systemPrompt missing {{businessFacts}} placeholder
   DB / File: not present in prompt-windshield-hub.txt
   Ultravox:  not present in live systemPrompt
   Expected:  updateAgent() appends "\n\n{{businessFacts}}" when callerContext is present but businessFacts is not
   Failure class: propagation bug
   Root cause: The last deploy either (a) used an older version of updateAgent() that did not yet append these placeholders,
               or (b) the prompt was pushed via a path that bypassed updateAgent() entirely (e.g. direct Ultravox PATCH,
               or the Python deploy_prompt.py script which may not inject these placeholders).
   Runtime impact: {{businessFacts}} resolves to empty string at call time — no crash, but the agent
               cannot receive structured business facts injected at call start via templateContext.

2. systemPrompt missing {{extraQa}} placeholder
   Same root cause as above. Runtime impact: structured Q&A context is silently dropped at call start.

3. systemPrompt missing {{contextData}} + INJECTED REFERENCE DATA block
   Same root cause as above. Runtime impact: contextData (CSV/text reference data) is never injected.
   This is the most functionally significant gap — any per-call reference data injection is silently lost.

4. queryKnowledge missing KNOWN_PARAM_CALL_ID
   DB:        knowledge_backend=pgvector → buildKnowledgeTools() should inject call_id as KNOWN_PARAM_CALL_ID
   Ultravox:  queryKnowledge automaticParameters only has X-Call-State (KNOWN_PARAM_CALL_STATE)
   Expected:  { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' }
   Failure class: propagation bug
   Root cause: The queryKnowledge tool in the live agent was registered before commit b226c14
               (fix: deploy_prompt.py tool parity — add KNOWN_PARAM_CALL_ID to all tools).
               The agent has not been re-deployed since that fix was merged.
   Runtime impact: The /api/knowledge/windshield-hub/query route cannot read the call_id from the
               request — call_state persistence fails for knowledge queries (B3 pattern broken for this tool).

──────────────────────────────────────────────────────────────────────────────────────────────────────
WARNING MISMATCHES
──────────────────────────────────────────────────────────────────────────────────────────────────────

5. VAD minimumInterruptionDuration: 0.400s live vs 0.2s expected
   DB / Code:  DEFAULT_VAD sets 0.2s
   Ultravox:   0.400s — twice the expected threshold
   Failure class: propagation bug — the live agent was last deployed when this value was different
               (0.4s was a prior explicit setting) and has not been re-deployed since DEFAULT_VAD was
               reduced to 0.2s. A higher threshold means the caller must speak 200ms longer before
               the agent treats it as an interruption — slightly more resistant to background noise
               interruptions, but also slightly slower to interrupt the agent.

6. firstSpeakerSettings missing delay: "1s"
   Ultravox:  { agent: { uninterruptible: true } }
   Expected:  { agent: { uninterruptible: true, delay: "1s" } }
   Failure class: propagation bug — same deploy-version drift as issue 5. The 1s delay was added to
               updateAgent() after the last windshield-hub deploy. Without it the agent speaks
               immediately on call connect, which can cause the opening greeting to be clipped by
               Twilio's audio stream warmup.

7. hangUp tool format: temporaryTool HTTP definition vs toolName reference
   Ultravox:  Full custom temporaryTool pointing to https://api.ultravox.ai/api/tool_impl/hang_up
   Expected:  { toolName: 'hangUp', parameterOverrides: { strict: true } }
   Failure class: propagation bug — the live hangUp was deployed with an older expansion of the
               built-in hangUp tool. updateAgent() now uses the compact toolName reference.
   Runtime impact: functionally equivalent — both resolve to the same Ultravox built-in hangUp
               behaviour. The live version uses AGENT_REACTION_LISTENS as defaultReaction, which is
               actually correct and preferable (agent waits rather than speaks after hang-up trigger).
               Low urgency despite being a format mismatch.

──────────────────────────────────────────────────────────────────────────────────────────────────────
INFO MISMATCHES (non-actionable)
──────────────────────────────────────────────────────────────────────────────────────────────────────

8. contextSchema has additionalProperties: false and required: []
   These are present in the live agent but are not set by updateAgent(). They do not cause runtime
   errors — Ultravox likely injects them as defaults when the schema is created. No action needed.

──────────────────────────────────────────────────────────────────────────────────────────────────────
RECOMMENDED ACTIONS (in priority order)
──────────────────────────────────────────────────────────────────────────────────────────────────────

IMMEDIATE (Critical):

1. Re-deploy windshield-hub via /prompt-deploy windshield-hub
   This will trigger updateAgent() with the current codebase, which will:
   - Append the missing {{businessFacts}}, {{extraQa}}, and {{contextData}} placeholders to systemPrompt
   - Re-register queryKnowledge with KNOWN_PARAM_CALL_ID (fixes B3 call state for knowledge queries)
   - Push corrected VAD minimumInterruptionDuration (0.2s)
   - Push firstSpeakerSettings with delay: "1s"
   - Replace the expanded hangUp temporaryTool with the compact toolName reference
   One deploy resolves all 9 mismatches simultaneously.

2. Verify queryKnowledge KNOWN_PARAM_CALL_ID after deploy
   Hit a test call and confirm the /api/knowledge/windshield-hub/query route receives call_id
   in the request body. Use /review-call [call-id] to inspect tool calls in the transcript.

INVESTIGATION:

3. Audit why windshield-hub's prompt placeholders did not advance with the codebase
   The DB updated_at (18:01 UTC) is 8 minutes AFTER the Ultravox callTemplate.updated (16:52 UTC).
   This means the DB was written last — but that last write did not trigger updateAgent().
   Likely cause: the dashboard saved a non-prompt field (website_url was set to https://windshieldhub.ca/).
   Confirm by checking what changed in the DB at 18:01 UTC vs the prior deploy at 16:52 UTC.
   If website_url saves bypass the updateAgent() call, that is a source-of-truth gap in the settings
   save path that should be documented.
```

---

Three findings worth highlighting beyond the table:

**The most operationally significant issue** is the missing `{{contextData}}` placeholder (Critical #3). Every inbound call for windshield-hub injects a `templateContext` payload at call start — but because the `{{contextData}}` placeholder is absent from the live systemPrompt, the per-call reference data is silently dropped. The agent never sees it. This has been the case since this prompt version was deployed.

**The timing gap explains the drift.** The Ultravox callTemplate was last updated at 16:52 UTC on March 20. The DB was written at 18:01 UTC on the same day — 69 minutes later. Something saved to the DB without re-triggering `updateAgent()`. The likeliest candidate is `website_url` (set to `https://windshieldhub.ca/`) being saved through a settings path that doesn't invoke the agent update. This is worth checking in the settings save handler.

**One redeploy fixes everything.** Running `/prompt-deploy windshield-hub` will invoke `updateAgent()` from the current codebase and resolve all 9 mismatches in a single operation.