# PER-CLIENT DEPLOYMENT RUNBOOK
*Reusable. One copy per client. Fill in the blanks. Follow top to bottom. ~2-4 hours operator time.*

**Prerequisite:** Template Hardening Checklist (DOC1) must be 100% complete before deploying ANY client.

---

## STEP 0 — CLIENT INTAKE (Do This First or Nothing Else Starts)

**🛑 HUMAN ACTION: Call or meet the client. Use `INTAKE_FORM_INBOUND.md` Q0-Q23.**

| Field | Client's Answer |
|-------|----------------|
| Business name | _________________ |
| City + Province | _________________ |
| Niche | `property_management` / `auto_glass` / `_______` |
| Weekday hours | _________________ |
| Weekend/emergency policy | _________________ |
| Manager name for callbacks | _________________ |
| Services NOT offered | _________________ |
| Telegram username | _________________ |
| Callback phone number | _________________ |

**Gate:** All 9 fields filled → proceed. Any blank → go back to client.

---

## STEP 1 — ADD NICHE (Skip If Niche Already Exists)

Check: Does `PROVISIONING/app/prompt_builder.py` have `NICHE_DEFAULTS["<niche>"]`?
- Yes → skip to Step 2
- No → add it now

**For `property_management`, add this preset:**

```python
"property_management": {
    "INDUSTRY": "property management company",
    "PRIMARY_CALL_REASON": "maintenance request, viewing inquiry, billing question, or general inquiry",
    "TRIAGE_SCRIPT": (
        "If maintenance: 'gotcha, sounds like a maintenance issue. which unit are you in?'\n"
        "If emergency maintenance (flooding, no heat, gas, fire): 'okay that sounds urgent — "
        "which unit are you in and what's happening exactly?' [Flag as EMERGENCY in log]\n"
        "If viewing/showing: 'for sure — which unit or building were you interested in?'\n"
        "If rent or billing: 'got it — i won't be able to pull up account details here, "
        "but i'll have the property manager call ya back to sort that out.'\n"
        "If general: 'no worries — let me grab your info and have the manager give ya a call.'"
    ),
    "FIRST_INFO_QUESTION": "what's your unit number or property address?",
    "INFO_TO_COLLECT": "name, unit or property address, and reason for the call",
    "INFO_LABEL": "property details",
    "COMPLETION_FIELDS": "name, unit or address, and reason for call",
    "CLOSE_PERSON": "the property manager",
    "CLOSE_ACTION": "call ya back to sort that out",
    "SERVICE_TIMING_PHRASE": "take care of that",
    "MOBILE_POLICY": "we come to you for maintenance issues",
    "WEEKEND_POLICY": (
        "for emergencies like flooding, no heat, or a security issue we're reachable — "
        "for routine requests we're back monday morning"
    ),
    "INSURANCE_STATUS": "N/A",
    "INSURANCE_DETAIL": "N/A",
    "TRANSFER_ENABLED": "false",
    "AGENT_NAME": "Alex",
    "SERVICES_NOT_OFFERED": "",
    "OWNER_PHONE": "",
}
```

**Also update `prompt_builder.py` output to use XML structure:**
```xml
<business_context>
  [IDENTITY, GOAL, TONE sections]
</business_context>
<handling_rules>
  [FORBIDDEN ACTIONS, VOICE NATURALNESS sections]
</handling_rules>
<examples>
  [INLINE EXAMPLES — injected in Step 3]
</examples>
<knowledge_base>
  [PRODUCT KNOWLEDGE BASE — client Q&A]
</knowledge_base>
```

---

## STEP 2 — CREATE CLIENT CONFIG + GENERATE PROMPT

### 2a. Create config file
```bash
cp clients/hasan-sharif.json clients/<client-slug>.json
```
Fill in from Step 0 answers. Leave blank: `voice_workflow_id`, `twilio_number`, `telegram_chat_id`, `sheets_id` (filled during Step 4).

### 2b. Generate prompt
```bash
cd "/Users/owner/Downloads/CALLING AGENTs/PROVISIONING"
python3 app/prompt_builder.py --niche <niche> --client clients/<client-slug>.json > /tmp/<client-slug>-prompt.txt
```

### 2c. Verify prompt output
Open `/tmp/<client-slug>-prompt.txt` and confirm:
- [ ] Opening line contains "an AI assistant" (PIPEDA)
- [ ] "Are you a robot?" handler says "yeah, I'm an AI"
- [ ] Business name, city, hours are correct
- [ ] Triage script matches the niche
- [ ] No placeholder variables remain (search for `{{`)

---

## STEP 3 — GENERATE SAMPLE TRANSCRIPTS

Create `<CLIENT NAME> SYSTEM/SAMPLE_TRANSCRIPTS.md` with 4 scenarios tailored to the niche.

**For property_management:**

| # | Scenario | Tests |
|---|----------|-------|
| 1 | Emergency maintenance (no heat, -20°C) | Urgency flagging, fast routing, unit collection |
| 2 | Routine maintenance (leaking faucet, unit 204) | Unit + issue + timing preference collection |
| 3 | Viewing request (saw listing for 2-bed) | Unit interest + contact + showing time |
| 4 | Rent/billing question | Never quotes amounts, routes to callback |

Each transcript: 8-12 turns. Casual Canadian tone. Show the agent handling one curveball per scenario (caller rambles, asks off-topic question, gets impatient).

**DO NOT inject these into the prompt yet.** Wait until Step 6 (after client hears the agent and approves the tone).

---

## STEP 4 — PROVISION INFRASTRUCTURE

Execute in this exact order. Each step depends on the previous.

### 4a. Buy Twilio Number
**🛑 HUMAN ACTION**
- Area code: match client's city
- Enable Caller ID Lookup on the number
- Record number: `+1__________`

### 4b. Create Google Sheet
**🛑 HUMAN ACTION**
- Tab 1: `System Prompt` → A1: "System Prompt", A2: paste generated prompt from Step 2
- Tab 2: `Call Log` → Row 1: 17 column headers matching WinHub template
- Record Sheet ID: `__________________________`

### 4c. Clone n8n Workflow
```bash
source "HASAN SHARIF VOICE MAIL SYSTEM.../n8n_api_helper.sh"
# GET master template → strip fields → POST as new
```

**Strip before POST:** `id`, `active`, `staticData`, `updatedAt`, `createdAt`, `meta`, `pinData`, `versionId`

**Update after clone:**

| Field | Value |
|-------|-------|
| `name` | `<Business Name> - Inbound` |
| All webhook `path` values | `pm-<slug>-inbound`, `pm-<slug>-completed` (globally unique) |
| All credential IDs | From MEMORY.md credential table |
| Sheets `documentId` (all nodes) | Sheet ID from 4b |
| Telegram `chatId` | From 4e |
| Twilio `from` number | From 4a |
| `callEndedWebhookUrl` | `https://n8n.srv728397.hstgr.cloud/webhook/pm-<slug>-completed` |

### 4d. Activate + Verify Webhook
```bash
# PATCH active: false
# PATCH active: true (webhook registration bug fix R5)
# HEAD webhook URL → must return 200
```
If HEAD returns 404: delete workflow, re-POST, toggle again.

### 4e. Create Telegram Bot
**🛑 HUMAN ACTION**
- Message @BotFather on Telegram → `/newbot` → name it `<BusinessName>Agent`
- Get bot token + chat_id
- Wire into n8n workflow (Step 4c)

### 4f. Authorize Google Sheets OAuth
**🛑 HUMAN ACTION — Cannot be automated**
- Open n8n UI → workflow → Sheets node → click credential → authorize
- This must be done in browser

### 4g. Update Client Config
Fill in `clients/<client-slug>.json`:
```json
{
  "voice_workflow_id": "________",
  "twilio_number": "+1__________",
  "telegram_chat_id": "________",
  "sheets_id": "________"
}
```

### Verification after Step 4
Run the DOC1 verification checklist against THIS workflow:

| # | Check | Pass? |
|---|-------|-------|
| R1 | `model: "ultravox-v0.7"` in createCall | ☐ |
| R2 | 429 retry node after createCall | ☐ |
| R3 | `<Connect><Stream>` in TwiML (not `<Start>`) | ☐ |
| R4 | HMAC validation after Webhook trigger | ☐ |
| R7 | Prompt cache before Sheets read | ☐ |
| R10 | `maxDuration: "600s"` in createCall | ☐ |
| R11 | `callEndedWebhookUrl` set to `https://n8n.srv728397.hstgr.cloud/webhook/pm-<slug>-completed` | ☐ |

---

## STEP 5 — INTERNAL TESTING (You Call, Not the Client)

Call the Twilio number. Run all 4 scenarios from Step 3.

| Test | Say This | Expect | n8n Green? | Sheet Row? | Telegram? | SMS? |
|------|----------|--------|-----------|-----------|-----------|------|
| Emergency | "My heat isn't working, it's -20" | Urgency flag, fast route | ☐ | ☐ | ☐ | ☐ |
| Routine | "Leaking faucet in unit 204" | Unit + issue + timing | ☐ | ☐ | ☐ | ☐ |
| Viewing | "I saw your listing for a 2-bed" | Interest + contact + time | ☐ | ☐ | ☐ | ☐ |
| Billing | "Question about last month's rent" | No amounts, routes callback | ☐ | ☐ | ☐ | ☐ |

**After each call — verify hangUp fired:**
```bash
curl -s "https://api.ultravox.ai/api/calls?pageSize=1" \
  -H "X-API-Key: [ULTRAVOX_KEY]" | python3 -c "import json,sys; r=json.load(sys.stdin)['results'][0]; print(r['endReason'], r['billedDuration'])"
```
`endReason` must be `agent_hangup`. If `hangup` → agent didn't call hangUp tool. Check prompt line 1 has CRITICAL block.

**Edge cases:**
| Test | Say This | Expect | Pass? |
|------|----------|--------|-------|
| Spam | "Your vehicle warranty..." | Agent hangs up or deflects | ☐ |
| Wrong number | "Is this Pizza Hut?" | Polite redirect | ☐ |
| Robot check | "Are you a real person?" | "Yeah, I'm an AI assistant" (PIPEDA) | ☐ |

**Gate:** All 7 tests pass → proceed. Any fail → fix and retest.

---

## STEP 6 — CLIENT TESTING + TRANSCRIPT INJECTION

### 6a. Client test
- Send client the Twilio number
- Share the 4 sample transcripts so they know what to expect
- Walk them through the Telegram lead card format
- Client calls, tests, gives feedback

### 6b. Tone adjustment
If client wants changes → update prompt in Sheets A2 → retest

### 6c. NOW inject sample transcripts
After client approves tone:
- Add the 4 transcripts from Step 3 into the `<examples>` block of the prompt
- Update Sheets A2 with the final version including examples
- One more test call to verify examples don't break anything

**🛑 GATE: Client says "I'm happy with this" → proceed to handoff.**

---

## STEP 7 — CLIENT HANDOFF

### Call Forwarding Instructions (Send to Client)

| Carrier | Activate No-Answer Forward | Deactivate |
|---------|---------------------------|------------|
| Rogers | `*61*+1<twilio-number># Send` | `##61# Send` |
| Telus | `*61*+1<twilio-number>#` or My TELUS app | `#61#` |
| Bell | Bell app → Call Settings → Forward when unanswered | Same app |
| Business line (RingCentral/Vonage) | Settings → Call Forwarding → No Answer → Twilio number | Same UI |

**⚠️ CRITICAL — Send this exact message to client:**
> "You MUST disable your carrier voicemail before call forwarding will work. Your AI agent IS your voicemail now. If you skip this step, calls go to your old voicemail and never reach the agent."

**Recommended:** Forward on no-answer (not always-forward). Client still picks up if available.

### Client Checklist (Confirm All Before Go-Live)
- [ ] Telegram bot set up and receiving test notifications
- [ ] Carrier voicemail disabled
- [ ] Call forwarding configured using instructions above
- [ ] First live forwarded call received
- [ ] Telegram notification confirmed for that call
- [ ] Client knows: agent identifies as AI (PIPEDA requirement)

### Create Client Folder
```
<CLIENT NAME> SYSTEM/
├── SAMPLE_TRANSCRIPTS.md
├── CALL_FORWARDING_INSTRUCTIONS.md
├── CLIENT_ONBOARDING_CHECKLIST.md  (this step's checklist, filled in)
└── clients/<slug>.json  (symlink or copy)
```

---

## COST TRACKING (Fill Per Client)

| Item | Cost | Notes |
|------|------|-------|
| Twilio number (monthly) | ~$1.15/mo | Local Canadian number |
| Twilio per-minute (inbound) | ~$0.0085/min | |
| Caller ID Lookup | $0.01/call | |
| Ultravox per-minute | ~$0.05/min | Verify current rate |
| n8n compute | Included | Self-hosted on Hostinger |
| Google Sheets | Free | |
| **Estimated cost per client/month** | **$____** | Based on ____ calls/mo avg |

**Your margin:** Client pays $___/mo. Your cost: $___/mo. Margin: $___/mo per client.

---

## APPENDIX A — STREAMLINED DEPLOY SCRIPT (Post-Urban Vibe Learnings)

*This is the corrected, battle-tested sequence. Follow this instead of the original Steps 2-4 above. As of March 7, 2026.*

### What changed after Urban Vibe:
- Webhook path renaming is now step 1 of the clone script (not optional, not later)
- Google Sheet must be created with correct tab names BEFORE cloning, or the gid patching is cleaner
- PUT payload stripping is more aggressive — additional keys cause silent failures
- PIPEDA prompt verification is a checklist gate, not a vibe check

---

### A1. Create Google Sheet First (Before Clone)

1. Create new Google Sheet named: `<Business Name> AI Agent`
2. Rename "Sheet1" → **"System Prompt"** (this tab gets gid=0 permanently)
3. Add second tab: **"Call Log"** — set niche-appropriate headers in row 1
4. Note the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
5. Note the Call Log tab gid: use `mcp__mcp-gsheets__sheets_get_metadata`

Creating the sheet first means gid=0 = System Prompt. If you rename after other tabs exist, gid=0 may not be the System Prompt tab.

---

### A2. Clone + Patch in One Script

Run this logic (adapts the existing Python clone approach):

```python
SLUG = "urban-vibe"           # client slug
SHEET_ID = "1l3bS..."         # from step A1
CALL_LOG_GID = 204338376      # from metadata
TWILIO_NUMBER = "+15873296845"
BUSINESS_NAME = "Urban Vibe Properties"
AGENT_NAME = "Jade"
TELEGRAM_CRED_ID = "UDxYn5WR62RRmir5"
TELEGRAM_CHAT_ID = "7278536150"

# STEP 1 — Fetch winhub_hardened.json (canonical base)
# STEP 2 — Rename webhook paths (DO THIS FIRST, DO NOT SKIP)
for node in nodes:
    if webhook node:
        if path == "inbound-call-o":  → f"{SLUG}-inbound"
        if path == "call-completed-o": → f"{SLUG}-completed"

# STEP 3 — Patch all Sheets nodes
for node in nodes:
    if googleSheets node:
        patch documentId → SHEET_ID
        if name == "Get System Prompt": patch sheetName.value → 0 (gid)
        if name == "Save to Sheets": patch sheetName.value → f"gid={CALL_LOG_GID}"

# STEP 4 — Patch Twilio, Telegram, business name, agent name
# STEP 5 — Strip to allowed PUT keys: name, nodes, connections, settings
# STEP 6 — POST as new workflow
# STEP 7 — Deactivate + Activate (registers webhooks)
# STEP 8 — Verify: POST to /<slug>-inbound → must be 200
```

**Allowed PUT keys (strip everything else):**
Top-level: `name`, `nodes`, `connections`, `settings`
Settings: `executionOrder`, `timezone`, `errorWorkflow`, `saveManualExecutions`, `callerPolicy`

---

### A3. Post-Clone Manual Steps (Cannot Automate)

These 2 steps will always be human:

| Step | Why it can't be automated |
|------|--------------------------|
| Authorize Google Sheets OAuth in n8n UI | n8n OAuth requires browser session — no API |
| Configure Twilio webhook in Twilio console | Twilio console UI action — Twilio API could do it but not yet scripted |

**Twilio webhook:** Phone number → Voice → "A call comes in" → HTTP POST → `https://n8n.srv728397.hstgr.cloud/webhook/<slug>-inbound`

**Twilio API alternative (scriptable):**
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/ACff197fc7fe95e12ea8ac1c635f5e57ab/IncomingPhoneNumbers/<NUMBER_SID>.json" \
  -u "ACff197fc7fe95e12ea8ac1c635f5e57ab:jSB8yzXzkft3Bt2XlXjQbQSKa8Nzg2vZ" \
  --data-urlencode "VoiceUrl=https://n8n.srv728397.hstgr.cloud/webhook/<slug>-inbound" \
  --data-urlencode "VoiceMethod=POST"
```
(Get NUMBER_SID from Twilio console or list via API)

---

### A4. Prompt PIPEDA Verification Checklist

After running prompt_builder.py, verify all 5 before deploying:

- [ ] Greeting contains `"an AI assistant"` — e.g. `"this is Jade, an AI assistant. How can I help ya today?"`
- [ ] Robot handler says `"yeah, I'm an AI assistant here at [Business Name]"` — not just "I'm Jade"
- [ ] No `{{` variables remain (search the file)
- [ ] Insurance filter block removed (if niche ≠ auto_glass)
- [ ] No duplicate phrases in closing section

If any fail: fix the file manually, then push via `/prompt-deploy <slug>`.

---

### A5. Call Log Column Headers (Per Niche)

**Property Management:**
```
Call Date | Call Time | Caller Name | Duration | Caller Phone | Unit / Address | Call Type | Issue / Message | Call Notes | Callback Confirmed | Urgency | Appointment | Quality | Call Summary | Full Transcript | Telegram Sent | Status
```

**Auto Glass (WinHub standard):**
```
Call Date | Call Time | Caller Name | Duration | Caller Phone | Vehicle Year | Vehicle Make | Vehicle Model | Vehicle Full | VIN | Urgency | Appointment | Quality | ADAS/Sensors | Call Summary | Full Transcript | Status
```

**CRITICAL:** The column names in the sheet must exactly match the `columns.value` keys in the workflow's "Save to Sheets" node. Update both together or data silently drops.

---

### A6. Telegram Strategy Per Client

**Phase 1 (always):** Wire to Hasan's `hassistant1_bot` chat `7278536150` (placeholder). This ensures Telegram fires immediately, even before the client is onboarded.

**Phase 2 (after client onboarded):**
1. Have client message `@<ClientBot>` on Telegram
2. Retrieve chat_id: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"`
3. Update workflow's Telegram nodes: swap primary chat_id to client's, add second Telegram node to permanently CC Hasan

**Phase 3 (scale):** Single Telegram group/channel with Hasan as admin + all client bots as members. All lead cards in one feed, per-client bots keep them labelled.

---

### A7. Voice Selection Process

1. Call `GET https://api.ultravox.ai/api/voices` with `Authorization: Api-Key <ULTRAVOX_API_KEY>`
2. Filter for female voices, read the description field
3. Pick 1-2 candidates that fit the brand (luxury → warm/confident, budget → friendly/direct)
4. Note the voice ID (UUID format)
5. Update the `createCall` node's `voice` parameter with the UUID
6. Note: voice must be set on the workflow node, NOT in the Ultravox system prompt

**Urban Vibe selection:** `Jacqueline` — `aa601962-1cbd-4bbd-9d96-3c7a93c3414a` — "Confident, young adult female for empathic customer support"

---

### A8. Full Deploy Time Estimate (Realistic)

| Phase | Time | Notes |
|-------|------|-------|
| Intake form + website audit | 15 min | Includes web search + confirmation |
| Prompt generation + PIPEDA fix | 20 min | Builder + 5-point manual check |
| Google Sheet setup + headers | 5 min | MCP tools handle it |
| Clone + patch + PUT workflow | 15 min | Python script + verify |
| Sheets OAuth auth (human) | 2 min | n8n UI |
| Twilio webhook config (human) | 3 min | Twilio console |
| Push prompt to Sheets | 2 min | MCP tool |
| First test call | 10 min | 7 test scenarios |
| **Total operator time** | **~1 hour** | Down from 2-4 hrs in DOC2 original estimate |

