# Ultravox API Reference — Verified Schemas

> Source: OpenAPI schema at `https://api.ultravox.ai/api/schema/` + docs.ultravox.ai
> Fetched: 2026-03-17
> Purpose: Ground truth for all worktree agents. Never hallucinate field names — reference this file.

---

## Auth

- **Header:** `X-API-Key: <ULTRAVOX_API_KEY>`
- **Base URL:** `https://api.ultravox.ai/api`
- **Pagination:** Cursor-based (`cursor`, `pageSize` query params)

---

## 1. Corpora API

### POST /api/corpora — Create Corpus

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)"
}
```

**Response (201):** `ultravox.v1.Corpus` object with `corpusId` (uuid).

### GET /api/corpora — List Corpora

**Query:** `cursor`, `pageSize`
**Response:** Paginated list of Corpus objects.

### GET /api/corpora/{corpus_id} — Get Corpus

**Path:** `corpus_id` (uuid)
**Response:** Corpus object with sources info.

### PATCH /api/corpora/{corpus_id} — Update Corpus

**Path:** `corpus_id` (uuid)
**Body:** Partial Corpus object.

### DELETE /api/corpora/{corpus_id} — Delete Corpus

**Path:** `corpus_id` (uuid)
**Response:** 204 No Content.

### POST /api/corpora/{corpus_id}/query — Query Corpus

**Path:** `corpus_id` (uuid)
**Request Body:** `ultravox.v1.QueryCorpusRequest`
```json
{
  "query": "string (required)",
  "maxResults": "integer (optional, default 5, max 20)",
  "minimumScore": "number (optional, 0-1)"
}
```

**Response:** Array of `ultravox.v1.CorpusQueryResult` objects.

### POST /api/corpora/{corpus_id}/uploads — Get Presigned Upload URL

**Path:** `corpus_id` (uuid)
**Request Body:**
```json
{
  "mimeType": "string (required — e.g. 'application/pdf')"
}
```

**Response (201):**
```json
{
  "uploadUrl": "string (presigned URL — expires in 5 minutes)",
  "documentId": "uuid"
}
```

**Upload flow:**
1. Call this endpoint to get presigned URL + documentId
2. PUT the file to the presigned URL (binary, Content-Type matching mimeType)
3. Create a source with the documentId(s)

### POST /api/corpora/{corpus_id}/sources — Create Source

**Path:** `corpus_id` (uuid)
**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "documentIds": ["uuid array — from uploads endpoint"],
  "startUrls": ["string array — for web crawling (optional)"],
  "maxDepth": "integer (optional — crawl depth)"
}
```
Note: Use `documentIds` for file uploads OR `startUrls` for web crawling. Not both.

**Response (201):** `ultravox.v1.CorpusSource` object with `sourceId`.

### GET /api/corpora/{corpus_id}/sources — List Sources

**Path:** `corpus_id` (uuid)
**Query:** `cursor`, `pageSize`
**Response:** Paginated list of CorpusSource objects.

### DELETE /api/corpora/{corpus_id}/sources/{source_id} — Delete Source

**Paths:** `corpus_id`, `source_id` (both uuid)
**Response:** 204 No Content.

### GET /api/corpora/{corpus_id}/sources/{source_id}/documents — List Documents

**Paths:** `corpus_id`, `source_id` (both uuid)
**Response:** Paginated list of CorpusDocument objects.

### Supported Upload Formats
`.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.ppt`, `.pptx`, `.epub`

### Corpus Limits
| Limit | Value |
|-------|-------|
| Max corpora per account | 2 (default, higher on paid plans) |
| Max sources per corpus | 20 |
| Max documents per source | 200 |
| Max document size | 10 MB |
| Max chunks per query | 20 (default 5) |
| Presigned URL expiry | 5 minutes |

---

## 2. Webhooks API

### POST /api/webhooks — Create Webhook

**Request Body:**
```json
{
  "url": "string (required — HTTPS endpoint)",
  "events": ["string array — event types to subscribe"],
  "agentId": "uuid (optional — filter to specific agent)",
  "secret": "string (optional — for HMAC verification)"
}
```

**Response (201):** Webhook object with `webhookId` (uuid).

### Event Types (confirmed from docs)
- `call.started`
- `call.ended`
- `call.billed`

### Webhook Payload Format
```json
{
  "event": "call.ended",
  "call": { /* full Call object */ }
}
```

### Webhook Signature Verification
- Header: `X-Ultravox-Webhook-Signature` — HMAC-SHA256 of payload body
- Header: `X-Ultravox-Webhook-Timestamp` — Unix timestamp
- Verify: `HMAC-SHA256(secret, timestamp + "." + body)` matches signature

### GET /api/webhooks — List Webhooks
**Query:** `agentId` (uuid, optional, nullable), `cursor`, `pageSize`

### PATCH /api/webhooks/{webhook_id} — Update Webhook
**Path:** `webhook_id` (uuid)

### DELETE /api/webhooks/{webhook_id} — Delete Webhook
**Path:** `webhook_id` (uuid)
**Response:** 204 No Content.

---

## 3. Call Events API

### GET /api/calls/{call_id}/events — List Call Events

**Path:** `call_id` (uuid)
**Query:**
- `cursor`, `pageSize` (pagination)
- `minimum_severity` (enum: `debug` | `info` | `warning` | `error`, default: `info`)
- `type` (string — filter by event type)

**Response:** Paginated list of CallEvent objects:
```json
{
  "callId": "uuid",
  "callStageId": "uuid",
  "callTimestamp": "string (relative to call start)",
  "wallClockTimestamp": "string (nullable — absolute time)",
  "severity": "debug|info|warning|error",
  "type": "string",
  "text": "string (human-readable description)",
  "extras": {}
}
```

---

## 4. Call Stages API

### GET /api/calls/{call_id}/stages — List Call Stages

**Path:** `call_id` (uuid)
**Query:** `cursor`, `pageSize`
**Response:** Paginated list of CallStage objects.

### GET /api/calls/{call_id}/stages/{call_stage_id} — Get Stage

### GET /api/calls/{call_id}/stages/{call_stage_id}/messages — Stage Messages

### GET /api/calls/{call_id}/stages/{call_stage_id}/tools — Stage Tools

### Stage Transition — Tool Response Format

A tool triggers a stage transition by returning:
```
HTTP Header: X-Ultravox-Response-Type: new-stage
HTTP Body (JSON):
{
  "systemPrompt": "string (new system prompt for this stage)",
  "temperature": 0.7,
  "voice": "voice-uuid",
  "languageHint": "en",
  "initialMessages": [],
  "selectedTools": [],
  "toolResultText": "string (defaults to 'OK' — what agent says about tool result)"
}
```

**Changeable per stage:** systemPrompt, temperature, voice, languageHint, initialMessages, selectedTools, toolResultText
**Inherited (cannot change):** firstSpeaker, model, joinTimeout, maxDuration, timeExceededMessage, inactivityMessages, medium, recordingEnabled

New stages inherit ALL properties from previous stage unless explicitly overridden.

For client-side tools: use `responseType: "new-stage"` on `ClientToolResult` object.

---

## 5. Built-in Tools

### Format in selectedTools
```json
{ "toolName": "hangUp" }
```
With parameter overrides:
```json
{
  "toolName": "queryCorpus",
  "parameterOverrides": {
    "corpus_id": "uuid-string",
    "max_results": 5,
    "minimum_score": 0.85
  }
}
```

### queryCorpus
Retrieve information from knowledge bases.
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `corpus_id` | string | YES (via parameterOverrides) | UUID of the corpus |
| `query` | string | YES (model provides) | Search query |
| `max_results` | integer | No (default 5, max 20) | Number of results |
| `minimum_score` | number | No | 0-1 threshold |

### hangUp
End calls programmatically.
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `reason` | string | No | Reason for hanging up |
| `strict` | boolean | No | — |

### coldTransfer
Blind/unattended SIP transfer. **WARNING: invoking immediately ends the Ultravox call regardless of transfer success.**
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `target` | string | YES | — | SIP URI or E.164 number |
| `sipVerb` | string | No | `REFER` | `REFER` or `INVITE` (bridge). **Use INVITE for Twilio.** |
| `from` | string | No | user's SIP addr | Caller ID override |
| `username` | string | No | — | SIP auth |
| `password` | string | No | — | SIP auth |
| `holdMusicUrl` | string | No | null | Hold music URL |
| `inviteHeaders` | object | No | — | Additional INVITE headers |
| `referHeaders` | object | No | — | Additional REFER headers |

### warmTransfer
Attended SIP transfer with operator briefing. Creates conference, places caller on hold, agent briefs operator.
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `target` | string | YES | — | SIP URI or E.164 number |
| `transferType` | string | No | `TRY_REFER` | `TRY_REFER`, `REFER`, or `BRIDGE` |
| `transferSystemPromptTemplate` | string | No | — | Prompt for agent when speaking to operator |
| `from` | string | No | user's SIP addr | Caller ID override |
| `username` | string | No | — | SIP auth |
| `password` | string | No | — | SIP auth |
| `holdMusicUrl` | string | No | null | Hold music URL |
| `inviteHeaders` | object | No | — | Additional INVITE headers |
| `referHeaders` | object | No | — | Additional REFER headers |

### leaveVoicemail
Leave voicemail message and end call.
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `message` | string | YES | Voicemail text |
| `strict` | boolean | No | — |
| `result` | string | No | — |

### playDtmfSounds
Play keypad tones for telephony applications.
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `digits` | string | YES | DTMF digits to play |
| `toneDuration` | number | No | Duration per tone |
| `spaceDuration` | number | No | Gap between tones |

---

## 6. Durable Tools API

### POST /api/tools — Create Durable Tool

**Request Body (JSON):**
```json
{
  "definition": {
    "modelToolName": "string",
    "description": "string",
    "dynamicParameters": [...],
    "staticParameters": [...],
    "automaticParameters": [...],
    "http": {
      "baseUrlPattern": "string",
      "httpMethod": "string"
    },
    "timeout": "string (e.g. '10s')",
    "precomputable": false
  }
}
```

OR **multipart** with `file` (OpenAPI schema in JSON/YAML).

**Response (201):** Tool object with `toolId` (uuid).

### Reference in selectedTools
```json
{ "toolId": "uuid-of-durable-tool" }
```

### Other Endpoints
- `GET /api/tools` — List tools (`ownership`: `private` | `public`)
- `GET /api/tools/{tool_id}` — Get tool details
- `PUT /api/tools/{tool_id}` — Replace tool
- `DELETE /api/tools/{tool_id}` — Delete tool
- `GET /api/tools/{tool_id}/history` — Version history
- `POST /api/tools/{tool_id}/test` — Test tool execution

---

## 7. Calls API — Key Fields

### POST /api/calls — Create Call

**Query params:**
- `priorCallId` (uuid, optional) — reuse conversation history from prior call
- `enableGreetingPrompt` (boolean, default true)

### Call Object — Key Fields
```json
{
  "callId": "uuid",
  "created": "datetime",
  "joined": "datetime (nullable)",
  "ended": "datetime (nullable)",
  "endReason": "string (enum)",
  "billedDuration": "string (nullable — e.g. '120s')",
  "billingStatus": "PENDING|FREE_CONSOLE|FREE_ZERO_EFFECTIVE_DURATION|FREE_MINUTES|FREE_SYSTEM_ERROR|FREE_OTHER|BILLED|REFUNDED|UNSPECIFIED",
  "model": "string",
  "voice": "uuid",
  "systemPrompt": "string",
  "temperature": "number",
  "metadata": {},
  "agentId": "uuid (nullable)",
  "summary": "string (nullable — auto-generated)",
  "shortSummary": "string (nullable)"
}
```

### priorCallId Behavior
- Pass as query param: `POST /api/calls?priorCallId={callId}`
- Prior call's message history becomes the new call's `initialMessages`
- All properties inherited unless explicitly overridden
- **Only works with POST /api/calls — NOT with POST /api/agents/{id}/calls**

---

## 8. selectedTools Format Reference

Three ways to include tools:

```json
// Built-in tool (by name)
{ "toolName": "hangUp" }

// Built-in tool with parameter overrides
{
  "toolName": "queryCorpus",
  "parameterOverrides": {
    "corpus_id": "...",
    "max_results": 5
  }
}

// Temporary tool (inline HTTP definition)
{
  "temporaryTool": {
    "modelToolName": "checkCalendarAvailability",
    "description": "...",
    "precomputable": true,
    "timeout": "10s",
    "dynamicParameters": [...],
    "http": {
      "baseUrlPattern": "https://...",
      "httpMethod": "GET"
    }
  }
}

// Durable tool (by ID)
{ "toolId": "uuid-of-durable-tool" }
```

**CRITICAL:** Never mix formats. Each entry in selectedTools must be EXACTLY ONE of: `toolName`, `temporaryTool`, or `toolId`.

---

## 9. Automatic Parameters (Available in Tools)

| Parameter | Value |
|-----------|-------|
| `KNOWN_PARAM_CALL_ID` | Current call UUID |
| `KNOWN_PARAM_CONVERSATION_HISTORY` | Full transcript |
| `KNOWN_PARAM_CALL_STATE` | Current state object |
| `KNOWN_PARAM_CALL_METADATA` | Metadata key-values |
| `KNOWN_PARAM_CALL_STAGE_ID` | Current stage UUID |

---

## 10. Voices API

### GET /api/voices — List Voices

**Query:**
- `billingStyle`: `VOICE_BILLING_STYLE_INCLUDED` | `VOICE_BILLING_STYLE_EXTERNAL`
- `provider` (array): `lmnt` | `cartesia` | `google` | `respeecher` | `eleven_labs` | `inworld`
- `primaryLanguage`, `search`, `ownership` (`private` | `public`)
- `cursor`, `pageSize`

### GET /api/voices/{voice_id}/preview — Voice Sample
Returns audio/wav binary or 302 redirect.

### POST /api/voices — Clone Voice
Multipart: `file` (binary, required), `name` (required), `description`, `language` (default: en).

---

## 11. Usage/Billing API

### GET /api/accounts/me — Account Info
### GET /api/accounts/me/billing — Billing Info
### GET /api/accounts/me/billing/usage — Usage Data
### GET /api/accounts/me/usage/calls — Aggregated Call Stats

---

## 12. Rate Limits

| Scope | Limit |
|-------|-------|
| Per account | 500 req/s |
| Per API key | 200 req/s |
| Call creation (PAYGO) | 5/s, 30/min |
| Call creation (Pro) | 10/s, 120/min |
| Concurrent calls (PAYGO) | 5 hard cap |
| Concurrent calls (Pro) | Unbounded |
