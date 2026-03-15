# TEMPLATE HARDENING CHECKLIST
*Do once. Every future client inherits these fixes. Stop after each sub-phase and test.*

---

## SUB-PHASE 0A — PIPEDA Compliance (Blocks ALL Canadian Clients)
**Why first:** Every live client (Windshield Hub, Hasan) is non-compliant RIGHT NOW.

### Template Fix
**File:** `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md`

**Opening greeting — REPLACE:**
```
OLD: "hey there, {{BUSINESS_NAME}} — this is {{AGENT_NAME}}, how can i help ya?"
NEW: "{{BUSINESS_NAME}} — this is {{AGENT_NAME}}, an AI assistant. How can I help ya today?"
```

**"Are you a robot?" handler — REPLACE:**
```
OLD: "nah, i'm {{AGENT_NAME}} at the front desk!"
NEW: "yeah, I'm an AI assistant here at {{BUSINESS_NAME}} — how can I help ya?"
```

### Migrate Live Clients
| Client | Google Sheet ID | Tab | Cell | Status |
|--------|----------------|-----|------|--------|
| Windshield Hub | ___________ | System Prompt | A2 | ☐ Updated |
| Hasan Sharif | ___________ | System Prompt | A2 | ☐ Updated |

**⛔ STOP — Test:** Call each live client's Twilio number. Confirm agent identifies as AI in first sentence. Confirm "are you a robot?" response is honest. Then proceed.

---

## SUB-PHASE 0B — n8n Master Template Security + Reliability
**File:** Master n8n workflow (clone from `winhub_march4_post4fixes.json`, update via REST API)

### Fix R4 — Twilio HMAC Signature Validation
Add **Code node** immediately AFTER every Webhook trigger node. Name it `Validate Twilio Signature`.

```javascript
const crypto = require('crypto');
const sig = $input.first().headers['x-twilio-signature'];
const token = $env.TWILIO_AUTH_TOKEN;
const url = $env.N8N_WEBHOOK_URL;
const params = $input.first().body;
const str = url + Object.keys(params).sort().map(k => k + params[k]).join('');
const expected = crypto.createHmac('sha1', token).update(str, 'utf8').digest('base64');
if (sig !== expected) throw new Error('Invalid Twilio signature — blocked');
return $input.all();
```

**Required env vars:** `TWILIO_AUTH_TOKEN`, `N8N_WEBHOOK_URL` (exact URL Twilio POSTs to)

### Fix R7 — Prompt Cache (Eliminates 200-800ms Sheets Latency)
Add **Code node** BEFORE every Google Sheets read. Name it `Prompt Cache Check`.

```javascript
const staticData = $getWorkflowStaticData('global');
const CACHE_TTL_MS = 5 * 60 * 1000;
const now = Date.now();
if (staticData.cachedPrompt && (now - (staticData.promptCachedAt || 0)) < CACHE_TTL_MS) {
  return [{ json: { systemPrompt: staticData.cachedPrompt, fromCache: true } }];
}
return [{ json: { fromCache: false } }];
```

After Sheets read node, add **Code node** `Update Prompt Cache`:
```javascript
const staticData = $getWorkflowStaticData('global');
staticData.cachedPrompt = $input.first().json.systemPrompt;
staticData.promptCachedAt = Date.now();
return $input.all();
```

Route: Cache Check → IF fromCache=true → skip Sheets → continue. IF false → read Sheets → Update Cache → continue.

### Fix R3 — TwiML Audio Direction
Audit ALL TwiML Response nodes. Find-and-replace:
```
WRONG: <Start><Stream url="..."/></Start>
RIGHT: <Connect><Stream url="{{joinUrl}}"/></Connect>
```
If `<Start><Stream>` exists ANYWHERE, caller hears silence. This is binary — no partial fix.

### Fix R1 + R10 — Ultravox CreateCall Payload
In EVERY `createCall` HTTP Request node, confirm body contains:
```json
{
  "model": "ultravox-v0.7",
  "maxDuration": "600s"
}
```
Never rely on Ultravox defaults. `maxDuration` 600s = 10 min cap. Prevents $3 stuck-call waste.

### Fix R2 — 429 Retry on Concurrent Call Limit
Add **Code node** AFTER every `createCall` HTTP Request. Name it `Handle 429 Retry`.

```javascript
const statusCode = $input.first().json.statusCode || $input.first().statusCode;
if (statusCode === 429) {
  // PAYGO limit: 5 concurrent calls
  await new Promise(r => setTimeout(r, 2000));
  // Route back to createCall node (use n8n error workflow or loop)
  throw new Error('429 — concurrent call limit hit, retrying');
}
return $input.all();
```

**⛔ STOP — Test all 5 fixes together:**
1. Call the Windshield Hub number → all nodes green → Sheets row created → Telegram fires
2. Forge a fake HTTP POST to webhook URL (no Twilio sig) → blocked by HMAC node
3. Call twice within 5 min → second call should skip Sheets read (check n8n execution log for `fromCache: true`)
4. Verify TwiML output in n8n execution → must show `<Connect><Stream>`, NOT `<Start><Stream>`

---

## SUB-PHASE 0C — Deployment Process Fixes
These are process fixes, not code fixes. Update documentation only.

### Fix R5 — Webhook Registration Bug
**File:** `WINDSHIELD HUB AUTO GLASS SYSTEM/DEPLOYMENT_GOTCHAS.md` — add as Gotcha #34:
```
After ANY REST API deploy: PATCH active: false → PATCH active: true.
Then HEAD the webhook URL — must return 200.
If 404: delete workflow, re-POST, toggle again.
This is n8n bug #21614. Not fixed as of March 2026.
```

### Fix R9 — Workflow Clone Field Stripping
**Same file** — add as Gotcha #35:
```
STRIP before POST: id, active, staticData, updatedAt, createdAt, meta, pinData, versionId
UPDATE after clone: name, all webhook paths (must be globally unique), all credential IDs,
  Sheets documentId, Telegram chatId, Twilio fromNumber
```

### Fix R6 — Carrier Voicemail Warning
**Same file** — add as Gotcha #36:
```
Canadian carriers (Rogers/Bell/Telus): voicemail and no-answer forwarding are MUTUALLY EXCLUSIVE.
Client MUST disable carrier voicemail BEFORE enabling call forwarding.
Build voicemail fallback into agent prompt for when forwarding silently fails.
```

### Fix R11 — Idempotency
**Same file** — add as Gotcha #37:
```
Generate UUID at intake form load. Store in Supabase with status=pending BEFORE
any provisioning step. Check UUID exists before each step. Prevents duplicate
Twilio numbers, duplicate workflows, duplicate billing on double-submit.
```

### Retention Cron (PIPEDA)
**Same file** — add as Gotcha #38:
```
PIPEDA requires: transcripts deleted after 60 days. Data residency disclosed.
Add monthly n8n cron workflow: query Sheets for rows >60 days old → delete rows.
Disclose to clients: data stored on Google Sheets (US servers) + Ultravox (US).
```

**✅ Phase 0 complete when:** All 3 sub-phases done. All ⛔ test gates passed. Master template updated. Live clients migrated. Gotchas #34-38 documented.

---

## VERIFICATION (Run Before Any New Client Deployment)

| # | Check | Pass? |
|---|-------|-------|
| R1 | `model: "ultravox-v0.7"` in every createCall payload | ☐ |
| R2 | 429 retry Code node exists after every createCall | ☐ |
| R3 | ALL TwiML uses `<Connect><Stream>`, zero `<Start><Stream>` | ☐ |
| R4 | HMAC validation Code node after every Webhook trigger | ☐ |
| R5 | Deploy script includes toggle active off/on + HEAD check | ☐ |
| R6 | Carrier voicemail warning in client handoff docs | ☐ |
| R7 | Prompt cache Code node before every Sheets read | ☐ |
| R8 | Opening greeting identifies as AI | ☐ |
| R9 | Clone script strips 9 fields, updates 6+ fields | ☐ |
| R10 | `maxDuration: "600s"` in every createCall payload | ☐ |
| R11 | Idempotency key generated before provisioning | ☐ |
