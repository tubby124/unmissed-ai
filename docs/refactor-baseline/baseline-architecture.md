# Baseline Architecture
_Frozen: 2026-03-18 — describes system state before any refactor_

## Stack

- **Runtime:** Next.js 15 on Railway (auto-deploy on push to main)
- **DB:** Supabase (qwhvblomlgeapzhnuwlb) — `clients`, `call_logs`, `intake_submissions`
- **Voice:** Ultravox v0.7 (GLM-4.6 model)
- **Telephony:** Twilio (inbound TwiML → Ultravox join URL)
- **Notifications:** Telegram bot per client
- **Deploy script:** Python (`agent-app/scripts/deploy_prompt.py`)

---

## 1. Inbound Call Runtime Assembly

**File:** `agent-app/src/app/api/webhook/[slug]/inbound/route.ts`

On every inbound call, the route assembles a full prompt by layering:

```
Layer 1: client.system_prompt          (from Supabase — base behavioral prompt)
Layer 2: callerContext                  (date/time, caller phone, returning caller data, after-hours flag)
Layer 3: businessFactsStr              (from client.business_facts — if set)
Layer 4: extraQaStr                    (from client.extra_qa — Q&A pairs, if set)
Layer 5: contextDataStr                (from client.context_data — freeform reference data, if set)
```

Assembly code (line ~213):
```ts
const promptWithContext = callerContext
  ? client.system_prompt + `\n\n[${callerContext}]`
  : client.system_prompt
let promptFull = promptWithContext
if (businessFactsStr) promptFull += `\n\n${businessFactsStr}`
if (extraQaStr)       promptFull += `\n\n${extraQaStr}`
if (contextDataStr)   promptFull += `\n\n${contextDataStr}`
```

If `client.ultravox_agent_id` exists → calls `callViaAgent()` (Agents API, injects context per-call).
Fallback → `createCall()` with full `promptFull` assembled above.

**callerContext** includes:
- `TODAY: YYYY-MM-DD (DayOfWeek)`
- `CURRENT TIME: H:MM AM/PM (timezone)`
- `CALLER PHONE: +1XXXXXXXXXX`
- `RETURNING CALLER` block if prior calls found (last 5 via `call_logs`)
- `AFTER HOURS:` block if call is outside `business_hours_weekday` / `business_hours_weekend`

---

## 2. Prompt Generation (Onboarding / CLI)

**File:** `agent-app/src/lib/prompt-builder.ts` (2,439 lines)

**Flow:**
1. `buildPromptFromIntake(intake, websiteContent?, knowledgeDocs?)` — entry point
2. Reads `NICHE_DEFAULTS[niche]` — per-niche variable defaults
3. Merges with `NICHE_DEFAULTS._common` — shared defaults
4. Maps intake fields → template variables (22 variables: `AGENT_NAME`, `BUSINESS_NAME`, `TRIAGE_SCRIPT`, etc.)
5. Calls `buildPrompt(variables)` — fills `{{VARIABLE}}` placeholders in `INBOUND_TEMPLATE_BODY`
6. Post-processes: transfers, capability guards, FAQ/restriction injection
7. Calls `validatePrompt()` — checks required patterns, returns warnings

**Key exports:**
- `buildPrompt(variables)` — raw template fill
- `buildPromptFromIntake(intake, ...)` — full pipeline
- `buildSmsTemplate(intake)` — SMS follow-up text
- `isNicheRegistered(niche)` — check before using
- `getRegisteredNiches()` — list all valid niches
- `validatePrompt(prompt)` — safety checks

**Registered niches (15):**
`auto_glass`, `hvac`, `plumbing`, `dental`, `legal`, `salon`, `real_estate`, `property_management`, `outbound_isa_realtor`, `voicemail`, `print_shop`, `barbershop`, `restaurant`, `other`

Plus internal: `_common` (shared defaults, not a standalone niche)

---

## 3. Deploy Path (SYSTEM_PROMPT.txt → Live)

**File:** `agent-app/scripts/deploy_prompt.py` (also at `scripts/deploy_prompt.py`)

**Steps:**
1. Reads `clients/{slug}/SYSTEM_PROMPT.txt`
2. `sb_patch()` → UPDATE `clients.system_prompt` in Supabase
3. Inserts version row into prompt versions table (`supabase_synced=True`)
4. `uv_get(agent_id)` → reads current live Ultravox agent
5. `uv_patch(agent_id, call_template)` → PATCHes Ultravox agent with FULL callTemplate (never partial — partial PATCH silently wipes fields)
6. `uv_get(agent_id)` again → post-PATCH verification (checks required fields)

**Critical invariant:** Always send ALL callTemplate fields in the PATCH. Missing fields are silently wiped by Ultravox.

**Note:** `archive/PROVISIONING/app/prompt_builder.py` exists but is archived. The CLAUDE.md reference to `PROVISIONING/app/prompt_builder.py` points to a path that no longer exists at that location.

---

## 4. Onboarding / Provisioning Path

**Entry:** `/onboard` wizard → step 1 (business info) → step 2 (niche + voice) → step 4 (payment)

**Key API routes:**
- `POST /api/generate-prompt` — calls `buildPromptFromIntake()`
- `POST /api/webhook/stripe` — Stripe activation webhook: buys Twilio number, creates Ultravox agent, writes `clients` row, sends welcome email
- Ultravox agent create: `createAgent()` in `agent-app/src/lib/ultravox.ts`

**Onboarding state:** stored in `intake_submissions` table (Supabase)

---

## 5. Completed Call Webhook

**File:** `agent-app/src/app/api/webhook/[slug]/completed/route.ts`

**Steps:**
1. Verify HMAC signature (`verifyCallbackSig`)
2. Parse call duration from `callData.joined` / `callData.ended`
3. `getTranscript(callId)` — fetch Ultravox transcript
4. `classifyCall(transcript)` — OpenRouter (claude-haiku-4.5) → HOT/WARM/COLD/JUNK/MISSED/UNKNOWN
5. Upsert `call_logs` row (status, summary, classification, duration)
6. Update `clients.seconds_used_this_month`
7. `sendAlert()` + `formatTelegramMessage()` → Telegram notification to client
8. Returns 200 immediately; all processing runs in `after()` (Next.js background task)

---

## 6. Context Data Fields (Supabase `clients` table — runtime-relevant columns)

| Column | Used In | Purpose |
|--------|---------|---------|
| `system_prompt` | inbound | base behavioral prompt |
| `agent_voice_id` | inbound | Ultravox voice for this client |
| `ultravox_agent_id` | inbound | Agents API profile (if set) |
| `tools` | inbound | JSON array of tool definitions |
| `context_data` | inbound | freeform reference block injected per-call |
| `context_data_label` | inbound | label for context_data block |
| `business_facts` | inbound | short business facts block |
| `extra_qa` | inbound | Q&A pairs injected per-call |
| `timezone` | inbound | for after-hours calculation |
| `business_hours_weekday` | inbound | after-hours detection |
| `business_hours_weekend` | inbound | after-hours detection |
| `after_hours_behavior` | inbound | `take_message` / `route_emergency` / custom |
| `after_hours_emergency_phone` | inbound | emergency transfer number |
| `seconds_used_this_month` | inbound + completed | usage tracking |
| `monthly_minute_limit` | inbound | overage detection |
| `grace_period_end` | inbound | billing grace period |
| `trial_expires_at` | inbound | trial expiry guard |

---

## 7. What Does NOT Exist Yet

- No `AgentContext` type or `buildAgentContext()` function
- No capability flags per niche (booking, transfer, etc. assumed globally, guarded by template string `TRANSFER_ENABLED`)
- No `KnowledgeSummary` artifact
- No snapshot tests for generated prompt output
- No structured property management data model (ops handled via prompt text + FAQ)
- `PROVISIONING/app/prompt_builder.py` path in CLAUDE.md is stale (file moved to `archive/`)
