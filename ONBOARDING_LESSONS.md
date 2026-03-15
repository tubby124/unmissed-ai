# ONBOARDING LESSONS — unmissed.ai
*Captured from real deployments. Update after every new client.*

---

## What This File Is

Every time we deploy a new client and hit something unexpected, we add it here. This feeds into:
1. `DEPLOYMENT_GOTCHAS.md` — technical traps to avoid
2. `DOC2 Appendix A` — the streamlined deploy process
3. Eventually: the automated `/provision` web form flow

---

## Clients Deployed (Chronological)

| Client | Niche | Date | Gotchas Hit | New Gotchas Added |
|--------|-------|------|-------------|-------------------|
| Windshield Hub (Mark) | auto_glass | Dec 2025 | #1-33 | #1-33 |
| Hasan Sharif (Aisha) | voicemail | Dec 2025 | various | — |
| Urban Vibe Properties (Ayana) | property_management | Mar 7-8, 2026 | #39,#40,#41,#42,#43,#44,#45,#46 | #39-46 |

---

## Lessons by Category

### 1. Webhook Paths

**Problem:** Cloned workflows inherit the same paths as the base (e.g. `inbound-call-o`). Two active workflows on the same n8n = silent conflict.

**Rule:** Rename webhook paths to `<slug>-inbound` / `<slug>-completed` IN THE CLONE SCRIPT before the first PUT. Never deploy without doing this.

**Verification:** POST (not HEAD) to `https://n8n.srv728397.hstgr.cloud/webhook/<slug>-inbound` — expect 200.

---

### 2. n8n REST API PUT Payload

**Problem:** GET /workflows returns ~15 top-level keys. PUT only accepts 4. Extra keys = 400.

**Rule — always strip to:**
```
name, nodes, connections, settings
```
**Settings — only these keys survive:**
```
executionOrder, timezone, errorWorkflow, saveManualExecutions, callerPolicy
```

---

### 3. Google Sheets Tab Reference

**Problem:** The System Prompt node references tabs by numeric GID, not by name. WinHub's GID is hardcoded in the base template. New sheet = different GID = silent empty read.

**Rule:**
- Create sheet before cloning → rename Sheet1 to "System Prompt" (gets gid=0)
- Create Call Log tab second (gets a random GID — get it from `sheets_get_metadata`)
- Patch BOTH nodes: `documentId` AND `sheetName.value` (the GID integer)

---

### 4. Call Log Column Names

**Problem:** Save to Sheets writes by column name. WinHub template writes vehicle fields. PM sheet needs PM fields. Mismatch = silent data loss.

**Rule:** When setting up the Call Log tab, define headers that match what the workflow actually writes. Update both the sheet AND the workflow node in the same step.

**Property Management Call Log columns:**
```
Call Date | Call Time | Caller Name | Duration | Caller Phone |
Unit / Address | Call Type | Issue / Message | Call Notes |
Callback Confirmed | Urgency | Appointment | Quality |
Call Summary | Full Transcript | Telegram Sent | Status
```

---

### 5. PIPEDA Prompt Verification

**Problem:** prompt_builder.py may have a stale embedded template. Generated prompt can have: wrong greeting (no "AI assistant"), wrong robot handler (says "nah, I'm Jade"), insurance block (wrong niche), duplicate phrases.

**5-point checklist after every prompt generation:**
1. `"an AI assistant"` in the greeting line
2. `"I'm an AI assistant here at [Business]"` in robot handler
3. No `{{` variables — search the file
4. Insurance block removed if niche ≠ auto_glass
5. No duplicate phrases in closing section

---

### 6. Twilio Webhook Configuration

**Problem:** Twilio sends POST to whatever URL is configured. The webhook URL is not the same as the n8n webhook path.

**URL format:** `https://n8n.srv728397.hstgr.cloud/webhook/<slug>-inbound`
**Method:** HTTP POST
**Where:** Twilio console → Phone Numbers → Active Numbers → `+1 (587) 329-6845` → Voice → "A call comes in"

**Can be scripted via Twilio API** (see DOC2 Appendix A3) — add to the automated provision flow.

---

### 7. Google Sheets OAuth Authorization

**Problem:** Every new n8n workflow that reads/writes Sheets must have an active OAuth session. Even if the credential exists in n8n, it may need re-auth.

**Rule:** After deploying any new workflow, open n8n UI → Credentials → confirm "Google Sheets account" shows green. If it shows "reconnect" — click it. This cannot be scripted.

**Mitigation for automation:** Use a service account credential instead of OAuth (service accounts don't expire). Already working in the Python provisioning scripts — use `sheets_client.py` with the service account at `~/.claude/google-credentials/service-account.json`.

---

### 8. Telegram Client Chat ID

**Problem:** We create the bot, but the client must message it first to generate their chat_id. Until they do, Hasan's placeholder fires.

**Workflow:**
1. Deploy with Hasan's `7278536150` as placeholder
2. Client (or Hasan on their behalf) messages `@<ClientBot>`
3. Run: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"` → grab `chat.id`
4. Swap in workflow's Telegram nodes + update `clients/<slug>.json`

**Note:** Add second Telegram node to CC Hasan permanently after client swap (two recipients, one call).

---

### 9. Voice Selection

**Problem:** Ultravox voices are not publicly documented. Have to hit the API.

**Command:**
```bash
curl -s -H "Authorization: Api-Key 4FowyUSm.ZEkda8oOwMgWl8HUGMBnSegpOGjU3acw" \
  "https://api.ultravox.ai/api/voices" | python3 -c "
import json,sys
voices = json.load(sys.stdin)['results']
for v in voices:
    if 'female' in v.get('description','').lower():
        print(v['voiceId'], '|', v['name'], '|', v['description'][:60])
"
```

**Saved selections:**
| Client | Voice Name | Voice ID |
|--------|-----------|---------|
| WinHub (Mark) | Default | — |
| Urban Vibe (Ayana) | Jacqueline | `aa601962-1cbd-4bbd-9d96-3c7a93c3414a` |

---

## Toward Full Automation — What's Left

The goal is: client fills one web form → everything below runs automatically.

| Step | Automated? | Blocker |
|------|-----------|---------|
| Intake form → `clients/<slug>.json` | ✅ Web form wired | Already in agent-app |
| Prompt generation | ✅ prompt_builder.py | Works, needs PIPEDA patch |
| Google Sheet creation + headers | 🔶 Partial | MCP can do it; needs to be called from provision.py |
| n8n workflow clone + patch | 🔶 Partial | Python script exists; needs webhook rename step added |
| Push prompt to Sheets A2 | ✅ Works | MCP or sheets_client.py |
| Twilio number purchase | ✅ twilio_client.py | Already in PROVISIONING/ |
| Twilio webhook configuration | 🔶 Needs script | Twilio REST API (see DOC2 A3) — 1 curl command |
| Telegram bot creation | ❌ Manual | BotFather API has no public REST API — human only |
| Telegram chat_id retrieval | 🔶 Partial | Client must message bot first; then getUpdates is scriptable |
| Sheets OAuth authorization | ❌ Manual forever | Browser-only OAuth flow — replace with service account |
| Voice selection | 🔶 Partial | Can auto-default to "Jacqueline" per niche; custom = manual |

**Biggest wins to automate next:**
1. Add webhook path rename to clone script (5 min fix, eliminates gotcha #39 forever)
2. Add Twilio webhook config to provision.py (1 API call, eliminates a manual step)
3. Switch Sheets nodes from OAuth to service account (eliminates auth step entirely)

---

### 10. Pre-Activate Agent Name Contamination Check

**Problem:** Cloned workflows inherit the original agent's name and business in 7 places that survive the prompt/sheet swap. The greeting (`firstSpeakerSettings.agent.text`) is most critical — callers hear it on pickup. Urban Vibe (Ayana) launched with Mark's WinHub greeting because this check wasn't run.

**Mandatory before every activate — grep the full workflow JSON:**
```bash
python3 -c "
import json
wf = json.load(open('workflow.json'))
js = json.dumps(wf)
for kw in ['windshield','mark','winhub','jade','Jade','Jadedown']:
    n = js.count(kw)
    if n: print(f'WARNING: \"{kw}\" appears {n} times')
"
```
Zero hits required before activating. See Gotcha #45 for full list of affected locations.

---

### 11. Telegram Bot Credential Swap Protocol

**Problem:** Cloned workflows send Telegram notifications via the BASE client's bot — silently. Notifications appear to work (Hasan still gets them) masking that the wrong bot is active. Discovered when Urban Vibe notifications arrived in hassistant1 instead of @urbanvibepptmgmt_bot.

**Deploy process for every new client:**
1. Get bot token (BotFather — manual step)
2. Create n8n credential:
   ```bash
   curl -s -X POST "https://n8n.srv728397.hstgr.cloud/api/v1/credentials" \
     -H "X-N8N-API-KEY: $API_KEY" -H "Content-Type: application/json" \
     -d '{"name": "<slug>_bot", "type": "telegramApi", "data": {"accessToken": "<TOKEN>"}}'
   # → capture "id" → NEW_CRED_ID
   ```
3. Grep workflow JSON for OLD_CRED_ID and replace ALL occurrences with NEW_CRED_ID
4. Deploy with Hasan's placeholder chatId `7278536150`
5. When client is ready: have them message their bot, then:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   # → result[0].message.chat.id = client chat_id
   ```
6. Swap chatId + add Hasan as second recipient (CC both)
7. Update `clients/<slug>.json` with both chat IDs

See Gotcha #46 for detail.

---

*Last updated: March 8, 2026 — Urban Vibe fix session (Ayana rename + Gotcha #45/#46)*
