# ARCHITECTURE_STATE.md — unmissed.ai / CALLING AGENTs

*Single-source architecture snapshot. Last updated: 2026-03-10. Update after any structural change.*

---

## 1. Directory Tree

```
CALLING AGENTs/
├── AGENT_APP_ARCHITECTURE.md          ← Master reference (full system context, keep in sync)
├── AGENT_HOOKS_AND_ARCHITECTURE.md
├── AUDIT_LOG.md
├── CALLING_AGENT_COMPANY_MASTER.md
├── CODEBASE_AUDIT_20260308.md
├── CLAUDE.md                           ← Project-level Claude instructions
├── PRD.md
├── PROPERTY_MANAGER_MASTER_PLAN.md
├── ONBOARDING_LESSONS.md
│
├── agent-app/                          ← Next.js 15 app (Railway deploy)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                ← Marketing homepage
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── onboard/                ← 7-step multi-niche intake
│   │   │   │   ├── page.tsx
│   │   │   │   ├── status/page.tsx
│   │   │   │   └── steps/              ← step1-7.tsx + niches/
│   │   │   ├── dashboard/              ← Authenticated client portal
│   │   │   │   ├── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── calls/[id]/page.tsx
│   │   │   │   ├── calls/page.tsx
│   │   │   │   ├── settings/page.tsx + SettingsView.tsx
│   │   │   │   ├── voices/page.tsx
│   │   │   │   ├── leads/page.tsx
│   │   │   │   ├── campaigns/page.tsx
│   │   │   │   └── clients/page.tsx
│   │   │   ├── admin/                  ← Admin-only (role: admin)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── calls/page.tsx
│   │   │   │   ├── insights/page.tsx
│   │   │   │   ├── prompt/page.tsx
│   │   │   │   └── test-lab/page.tsx
│   │   │   ├── for-*/page.tsx          ← 6 niche marketing pages
│   │   │   └── api/
│   │   │       ├── webhook/[slug]/
│   │   │       │   ├── inbound/route.ts      ← CRITICAL — Twilio entry point
│   │   │       │   └── completed/route.ts    ← CRITICAL — Ultravox callback
│   │   │       ├── dashboard/
│   │   │       │   ├── test-call/route.ts
│   │   │       │   ├── settings/route.ts + sync-agent/ + improve-prompt/ + prompt-versions/ + test-telegram/
│   │   │       │   ├── calls/[id]/messages/ + recording/ + whisper/
│   │   │       │   ├── voices/route.ts + assign/ + [voiceId]/preview/
│   │   │       │   ├── analysis/route.ts + [id]/ + analyze-now/
│   │   │       │   ├── leads/route.ts
│   │   │       │   ├── clients/route.ts
│   │   │       │   ├── dial/route.ts
│   │   │       │   ├── test-call/route.ts
│   │   │       │   ├── test-scenarios/route.ts + [id]/
│   │   │       │   ├── test-runs/route.ts
│   │   │       │   └── run-test-suite/route.ts
│   │   │       ├── admin/
│   │   │       │   ├── create-client-account/route.ts
│   │   │       │   ├── recording/route.ts
│   │   │       │   ├── transcript/route.ts
│   │   │       │   ├── recover/route.ts
│   │   │       │   └── sync-agents/route.ts
│   │   │       ├── cron/analyze-calls/route.ts
│   │   │       ├── provision/route.ts
│   │   │       ├── debug/run-test-suite/ + simulate-call/
│   │   │       └── health/route.ts
│   │   ├── lib/
│   │   │   ├── ultravox.ts             ← Agents API + createCall + HMAC + transcript
│   │   │   ├── twilio.ts               ← signature validation + TwiML builder
│   │   │   ├── openrouter.ts           ← classify calls + improve prompts
│   │   │   ├── telegram.ts             ← alert dispatch
│   │   │   ├── supabase/server.ts      ← createServerClient() + createServiceClient()
│   │   │   ├── supabase/client.ts      ← browser client
│   │   │   ├── schema.ts               ← FAQ + pricing JSON-LD schema
│   │   │   └── utils.ts
│   │   ├── middleware.ts               ← auth gate + role redirect
│   │   └── types/onboarding.ts
│   └── package.json
│
├── BUILD_PACKAGES/                     ← Canonical templates for new clients
│   ├── INBOUND_VOICE_AGENT/
│   │   ├── PROMPT_TEMPLATE_INBOUND.md
│   │   └── INTAKE_FORM_INBOUND.md
│   └── OUTBOUND_ISA_AGENT/
│       ├── PROMPT_TEMPLATE_ISA.md
│       └── INTAKE_FORM_ISA.md
│
├── PROVISIONING/                       ← Python provisioning app (FastAPI, Railway)
│   ├── app/
│   │   ├── main.py
│   │   ├── provision.py               ← orchestration runner
│   │   ├── prompt_builder.py          ← niche → prompt from client JSON
│   │   ├── n8n_client.py              ← clone workflow + activate
│   │   ├── twilio_client.py           ← buy number + configure webhook
│   │   ├── sheets_client.py           ← create + populate Google Sheet
│   │   ├── supabase_client.py         ← insert client record
│   │   └── notify.py                  ← Telegram notifications
│   ├── supabase_schema.sql            ← legacy provisioning DB schema
│   └── requirements.txt
│
├── HASAN SHARIF VOICE MAIL SYSTEM .../
│   ├── NEW_AISHA_PROMPT.txt
│   ├── workflow_backup.json
│   ├── workflow_booking_tools.json
│   └── workflow_live_feb23.json        ← last known live n8n export
│
├── MANZIL REALTY ISA SYSTEM/
│   ├── FATIMA_SYSTEM_PROMPT.txt        ← active prompt (50K limit)
│   ├── manzil_completion_v11_current.json
│   ├── live_outbound.json
│   └── workflow_backups/
│
├── PROPERTY MANAGER SYSTEM/
│   ├── AYANA_SYSTEM_PROMPT_v1.0.txt
│   ├── urban_vibe_backup_mar8.json
│   └── urban_vibe_workflow_draft.json
│
├── clients/                            ← Per-client folders (migrated Mar 2026)
│   ├── hasan-sharif/
│   │   ├── config.json                 ← Operational config (n8n IDs, Twilio, creds)
│   │   └── domain-knowledge.md         ← Business facts for prompt building
│   ├── windshield-hub/
│   │   ├── config.json
│   │   └── domain-knowledge.md
│   ├── manzil-isa/
│   │   ├── config.json
│   │   └── domain-knowledge.md
│   └── urban-vibe/
│       ├── config.json
│       └── domain-knowledge.md
│
└── .claude/
    ├── agents/                         ← Specialists (narrow tools, invoked by skills only)
    │   ├── n8n-auditor.md              ← n8n execution log audit (via system-audit)
    │   ├── twilio-auditor.md           ← Twilio call event audit (via system-audit)
    │   ├── ultravox-auditor.md         ← Ultravox call metadata audit (via system-audit)
    │   ├── niche-researcher.md         ← Web-research → domain-knowledge.md
    │   ├── prompt-builder.md           ← prompt_builder.py runner + PIPEDA validator
    │   └── n8n-verifier.md             ← DOC1 11-point workflow verification
    ├── skills/                         ← Orchestrators (invoke specialists + human loops)
    │   ├── onboard-client/SKILL.md     ← Full onboarding (7 steps, resume-aware)
    │   ├── debug-call/SKILL.md         ← Registry-aware parallel audit + RCA synthesis
    │   ├── n8n-code-javascript/
    │   ├── n8n-code-python/
    │   ├── n8n-expression-syntax/
    │   ├── n8n-mcp-tools-expert/
    │   ├── n8n-node-configuration/
    │   ├── n8n-validation-expert/
    │   └── n8n-workflow-patterns/
    ├── tasks/                          ← Onboarding task state: {slug}-onboard.json per client
    └── commands/
        └── provision.md                ← Updated: reads clients/<slug>/config.json
```

---

## 2. Next.js Client Portal

**Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS
**Deploy:** Git push `main` → Railway auto-deploy
**Live URL:** `https://unmissed-ai-production.up.railway.app`
**Supabase project:** `qwhvblomlgeapzhnuwlb` (unmissed-ai)

### UI Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | public | Marketing homepage (with Ticker, FAQ schema) |
| `/pricing` | public | Pricing page |
| `/login` | public | Supabase email/password auth |
| `/onboard` | public | Multi-step intake wizard (7 steps, 7 niches) |
| `/onboard/status` | public | Provisioning status polling |
| `/for-auto-glass` etc. | public | 6 niche landing pages |
| `/dashboard` | owner/admin | Main overview |
| `/dashboard/calls` | owner/admin | Call log |
| `/dashboard/calls/[id]` | owner/admin | Call detail (transcript + recording) |
| `/dashboard/settings` | owner/admin | Prompt editor, voice, sync, version history |
| `/dashboard/voices` | owner/admin | Voice selector + preview |
| `/dashboard/leads` | owner/admin | Lead list |
| `/dashboard/campaigns` | owner/admin | Campaigns |
| `/dashboard/clients` | admin sees all, owner sees own | Client list |
| `/admin/calls` | admin only | Cross-client call log |
| `/admin/insights` | admin only | Analytics |
| `/admin/prompt` | admin only | Prompt management |
| `/admin/test-lab` | admin only | Test scenarios + runs |

### API Routes

**Webhook endpoints (live call path — do not touch lightly):**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/webhook/[slug]/inbound` | Twilio → Ultravox call creation → TwiML stream |
| POST | `/api/webhook/[slug]/completed` | Ultravox callback → classify → upsert call_logs → SMS + Telegram |

**Dashboard API:**

| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/api/dashboard/settings` | Save prompt, status, God Mode fields |
| POST | `/api/dashboard/settings/sync-agent` | Force-push prompt+voice to Ultravox |
| POST | `/api/dashboard/settings/improve-prompt` | AI refinement via OpenRouter |
| GET/POST | `/api/dashboard/settings/prompt-versions` | List + restore version history |
| POST | `/api/dashboard/settings/test-telegram` | Test Telegram alert |
| GET | `/api/dashboard/voices` | List Ultravox voices + current voice |
| POST | `/api/dashboard/voices/assign` | Assign voice to client's Ultravox agent |
| POST | `/api/dashboard/voices/[voiceId]/preview` | Stream voice preview |
| POST | `/api/dashboard/test-call` | Fire outbound test call (owner/admin only) |
| GET | `/api/dashboard/calls/[id]/messages` | Proxy Ultravox transcript |
| GET | `/api/dashboard/calls/[id]/recording` | Proxy recording stream |
| GET | `/api/dashboard/calls/[id]/whisper` | Whisper transcription |
| GET/POST | `/api/dashboard/analysis` + `/[id]` | Call analysis CRUD |
| POST | `/api/dashboard/analyze-now` | Trigger immediate analysis |
| GET | `/api/dashboard/leads` | Lead list |
| GET | `/api/dashboard/clients` | Client list |
| POST | `/api/dashboard/dial` | Manual outbound dial |
| GET/POST | `/api/dashboard/test-scenarios` + `/[id]` | Test scenario CRUD |
| GET | `/api/dashboard/test-runs` | Test run history |
| POST | `/api/dashboard/run-test-suite` | Run automated test suite |

**Admin API:**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/create-client-account` | Create Supabase user for new client |
| GET | `/api/admin/recording` | Admin recording access |
| GET | `/api/admin/transcript` | Admin transcript access |
| POST | `/api/admin/recover` | Admin recovery operations |
| POST | `/api/admin/sync-agents` | Sync all Ultravox agents |

**Other:**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/cron/analyze-calls` | Scheduled call analysis (cron) |
| POST | `/api/cron/daily-digest` | Daily Telegram digest — 0 14 * * * (8AM CST). New intakes, pending activation, calls 24h, credit health. Auth: CRON_SECRET or ADMIN_PASSWORD |
| POST | `/api/provision` | Intake submission → inserts intake_submissions → Telegram to admin |
| POST | `/api/dashboard/generate-prompt` | Admin only. Intake → build prompt → create Ultravox agent → upsert clients row → seed classification_rules → create prompt_versions row → mark intake provisioned |
| POST | `/api/stripe/create-checkout` | Admin only. Create Stripe Checkout session ($20 setup fee). Body: { intakeId, clientId }. Returns { url } |
| POST | `/api/webhook/stripe` | Stripe checkout.session.completed. Full activation chain: (1) buy Twilio number, (1.5) send onboarding SMS from new number to callbackPhone with Telegram link, (2) status→active + telegram_registration_token, (3-5) create auth user + client_users row + password email, (6) intake.progress_status→activated, (7) Telegram alert to admin with client deep link + SMS status, (8) write activation_log JSONB to clients row |
| POST | `/api/webhook/telegram` | Telegram bot webhook. Handles /start {token} → captures client chat_id → writes telegram_chat_id + telegram_bot_token → sends "Connected!" reply. No secret check (UUID token is security). 500 on DB failure so Telegram retries. |
| POST | `/api/admin/setup-telegram-webhook` | Admin only. One-time: registers /api/webhook/telegram as hassitant_1bot webhook URL with Telegram. Idempotent. No secret_token — UUID token provides security. |
| POST | `/api/admin/generate-telegram-token` | Admin only. Generate (or regenerate) a registration token for any client. Returns { token, deepLink }. Use for testing or re-inviting a client. |
| POST | `/api/webhook/[slug]/fallback` | TwiML fallback — "system unavailable" message. Set as VoiceFallbackUrl on every Twilio number |
| GET | `/api/health` | Health check |

### Key Library Files

| File | Purpose |
|------|---------|
| `src/lib/ultravox.ts` | `createAgent`, `updateAgent`, `callViaAgent`, `createCall`, HMAC sign/verify, `getTranscript`, `getRecordingStream` |
| `src/lib/twilio.ts` | `validateSignature`, `buildStreamTwiml` |
| `src/lib/openrouter.ts` | Classify calls (call_status, summary, topics, sentiment) + improve prompts. Model: `anthropic/claude-haiku-4.5` |
| `src/lib/telegram.ts` | `sendAlert` — HOT/WARM/COLD/JUNK/UNKNOWN tiers |
| `src/lib/prompt-builder.ts` | `buildPromptFromIntake(intake)`, `validatePrompt(prompt)`, `NICHE_CLASSIFICATION_RULES`. TypeScript port of PROVISIONING/app/prompt_builder.py |
| `src/lib/sonar-enrichment.ts` | `enrichWithSonar(businessName, city, niche, websiteUrl)` — Perplexity Sonar Pro web research to enrich intake with local business facts |
| `src/lib/supabase/server.ts` | `createServerClient()` (user auth) + `createServiceClient()` (service role, bypasses RLS) |
| `src/middleware.ts` | Auth gate: unauthenticated → /login; non-admin → /dashboard (blocks /admin/*) |

---

## 3. Database Schema

**Supabase project:** `qwhvblomlgeapzhnuwlb` (agent-app, production)

### `clients`
One row per active client.
```
id (uuid PK)          slug                   business_name
niche                  status                 system_prompt
agent_voice_id         ultravox_agent_id      twilio_number
telegram_bot_token     telegram_chat_id       timezone
monthly_minute_limit   minutes_used_this_month
sms_enabled            sms_template           tools (jsonb)
active_prompt_version_id (UUID FK → prompt_versions)   ← added Mar 2026
claude_knowledge_path (TEXT)                             ← e.g. "clients/{slug}/domain-knowledge.md"
classification_rules (TEXT)                              ← per-client HOT/WARM/COLD hints for classifyCall(), added Mar 2026
telegram_registration_token (TEXT UNIQUE)                ← Gap 1, added Mar 2026 — UUID, consumed after /start
activation_log (JSONB)                                   ← added Mar 2026 — full audit trail per activation event
  { activated_at, stripe_session_id, stripe_amount, twilio_number_bought,
    telegram_link, telegram_token, contact_email, callback_phone,
    sms_sent, sms_skip_reason, email_sent, email_skip_reason, intake_id }
```

### `agent_registry` (view)
Read-only view over `clients` — canonical registry for all Claude Code agents and skills.
```sql
SELECT slug AS client_slug, ultravox_agent_id, active_prompt_version_id,
       twilio_number, claude_knowledge_path, tools AS tools_config, agent_voice_id, status
FROM clients;
```

### `client_users`
Auth bridge between Supabase users and clients.
```
id    user_id (→ auth.users)    client_id (→ clients, NULL for admin)
role: 'admin' | 'owner' | 'viewer'
```
Admin detection: `cu.role === 'admin'` (NOT email env var).

### `call_logs`
One row per call. Upserted by `/webhook/[slug]/completed` on `ultravox_call_id`.
```
id                   client_id              caller_phone
twilio_call_sid      ultravox_call_id
call_status          CHECK: live | processing | HOT | WARM | COLD | JUNK | MISSED | UNKNOWN
ai_summary           service_type           key_topics (jsonb)
sentiment            next_steps (jsonb)     quality_score
duration_seconds     recording_url          transcript
started_at           ended_at               test_call (bool)
```

### `prompt_versions`
Version history for system prompts.
```
id    client_id    version (int)    content    change_description    is_active    created_at
```

### `intake_submissions`
Provisioning intake forms (admin Clients page).
```
id                 client_slug        business_name      niche
intake_json (jsonb)                   contact_email      owner_name
status             progress_status    client_id (FK)     supabase_user_id
submitted_at
```
- `status`: `pending` → `provisioned` (after generate-prompt) → not changed again
- `progress_status`: null → `activated` (after Stripe webhook fires)
- `client_id`: FK → clients.id, set by generate-prompt on success

### Legacy Provisioning Tables (`PROVISIONING/supabase_schema.sql`)
*Separate DB — used by the Python provisioning app.*
```
clients            — twilio_subaccount_sid, n8n_workflow_id, google_sheet_id, mrr, stripe_*
sms_consent        — CASL compliance log (phone, opted_out, call_id)
provisioning_log   — step audit trail (step, status, detail jsonb, duration_ms)
View: active_clients
```

---

## 4. Agent Infrastructure

### Specialist Agents (`.claude/agents/`) — Invoke via skills only

| Agent | Model | Tools | Invoked by | Purpose |
|-------|-------|-------|-----------|---------|
| `n8n-auditor` | sonnet | Bash, Read | system-audit, debug-call | n8n execution log audit — credentials, dedup, callEndedWebhookUrl, TEST vs PROD tabs |
| `ultravox-auditor` | sonnet | Bash, Read | system-audit, debug-call | Ultravox call metadata — endReason, maxDuration, VAD, banned words, hangup loops |
| `twilio-auditor` | sonnet | Bash, Read | system-audit, debug-call | Twilio call events — TwiML Stream URL, statusCallback delivery, 11200 errors |
| `niche-researcher` | sonnet | WebSearch, WebFetch, Read, Write | onboard-client | Web-researches new client → writes `clients/{slug}/domain-knowledge.md` |
| `prompt-builder` | haiku | Read, Bash | onboard-client | Runs `prompt_builder.py` → validates PIPEDA + byte count → `/tmp/{slug}-prompt.txt` |
| `n8n-verifier` | haiku | Bash, Read | onboard-client | DOC1 11-point workflow verification — returns structured pass/fail |

### Orchestrator Skills (`.claude/skills/`)

| Skill | Specialists invoked | Purpose |
|-------|--------------------|---------|
| `onboard-client` | niche-researcher → prompt-builder → n8n-verifier | Full 7-step client onboarding with resume-aware task state |
| `debug-call` | n8n-auditor + ultravox-auditor + twilio-auditor (parallel) | Registry-aware call debugging with RCA synthesis |
| `n8n-code-javascript` | — | JS Code node patterns: `$input`, `$json`, `$node`, HTTP requests, error patterns |
| `n8n-code-python` | — | Python Code node patterns: `_input`, `_json`, standard library usage |
| `n8n-expression-syntax` | — | Expression validation, common `{{}}` mistakes |
| `n8n-mcp-tools-expert` | — | Using n8n-mcp MCP tools: search, validate, templates |
| `n8n-node-configuration` | — | Operation-aware node config, property dependencies |
| `n8n-validation-expert` | — | Interpret validation errors, false positives |
| `n8n-workflow-patterns` | — | AI agent, DB ops, HTTP API, scheduled tasks, webhook architecture patterns |

### Task State (`.claude/tasks/`)

Active onboarding sessions write state to `.claude/tasks/{slug}-onboard.json`.
Fields: `steps` (niche-research / prompt-build / infra-* / verification / client-approval), `artifacts` (prompt_path, twilio_number, sheets_id, workflow_id).
`/onboard-client` reads this on startup and resumes from last incomplete step.

### Slash Commands (`.claude/commands/`)

**`/provision [client-slug]`** — Legacy 7-step manual provisioning (superseded by `/onboard-client`):
1. Validate `clients/<slug>/config.json`
2. Generate prompt via `prompt_builder.py`
3. Generate sample transcripts
4. Guide through infra: Twilio number → Google Sheet → clone n8n workflow → activate → Telegram bot → Sheets OAuth
5. Run DOC1 verification (11 checks)
6. Inject sample transcripts after client approval
7. Update `clients/<slug>/config.json` with provisioned values

### Global Skills (user-level, relevant here)

| Skill | Trigger |
|-------|---------|
| `system-audit` | Failed call — spawns all 3 auditors in parallel, synthesizes RCA |
| `review-call` | After any test call — fetch transcript, score 5 dimensions |
| `prompt-deploy` | After editing any `*_SYSTEM_PROMPT.txt` — push to Supabase + sync Ultravox agent |
| `optimizeprompt` / `/op` | Optimize a prompt with Lyra framework |
| `intelligence-update` | 1st of month — sweep Ultravox/ISA benchmarks/CRTC compliance |

---

## 5. Orchestration State

### Inbound Call Flow (Railway — primary path)

```
Caller dials Twilio number
  ↓
Twilio: POST /api/webhook/{slug}/inbound (Railway)
  ↓
Validate Twilio HMAC signature (X-Twilio-Signature)
  ↓
Supabase: fetch client by slug (status must be 'active')
  ↓
Stale 'live' row cleanup (>15 min → mark MISSED)
  ↓
Returning caller detection: last 5 calls → build callerContext string
  ↓
if ultravox_agent_id:
  callViaAgent(agentId, { callerContext, metadata, callbackUrl })
  ↓ on failure → fallback:
  createCall({ systemPrompt + callerContext, voice, tools, callbackUrl })
else:
  createCall(systemPrompt, voice, tools)
  ↓
Sign callbackUrl with HMAC-SHA256 (WEBHOOK_SIGNING_SECRET)
  ↓
PATCH Ultravox call with signed callbackUrl (fire-and-forget)
  ↓
Insert 'live' row in call_logs (fire-and-forget)
  ↓
Return TwiML: <Response><Connect><Stream url="{joinUrl}"/></Connect></Response>
```

### Call Completion Flow

```
Ultravox call.ended event
  ↓
POST /api/webhook/{slug}/completed?sig={hmac} (Railway)
  ↓
Verify HMAC sig (timingSafeEqual)
  ↓
Build transcript from messages[] (filter: agent + user roles only)
  ↓
OpenRouter (anthropic/claude-haiku-4.5):
  → call_status (HOT/WARM/COLD/JUNK/UNKNOWN)
  → ai_summary, service_type, key_topics, sentiment, next_steps, quality_score
  ↓
Supabase upsert call_logs ON CONFLICT (ultravox_call_id)
  ↓
increment_seconds_used RPC (client second + minute tracking)
  ↓
if sms_enabled → Twilio SMS to caller (CASL: implied consent via inbound call)
  ↓
Telegram alert:
  HOT → ⚡  WARM → 🟡  COLD → ❄️  JUNK → 🗑️  UNKNOWN → ⚠️
```

### n8n Workflow Registry (RETIRED for voice agents — Mar 9 2026)

All voice agent n8n workflows deactivated. Railway handles all calls.

| Workflow | ID | Status |
|---------|-----|--------|
| Hasan Sharif / Aisha | `hjDvPPSMhlKKxSdN` | RETIRED |
| Windshield Hub / Mark | `sbztgErD8MV3WMOn` | RETIRED |
| Urban Vibe / Jade | `KzskPB8mGq5sz6OS` | RETIRED |
| Hasan Calendar Tools | `N9iBSLx1RFK52lIo` | Production (non-voice) |
| Manzil ISA / Fatima | `sKh2bzwPtpDCWVKO` | TEST MODE (only remaining n8n voice workflow) |
| Manzil Call Completion | `7EwdyrmlawE8Kc1t` | TEST MODE |

**n8n host:** `https://n8n.srv728397.hstgr.cloud` (for Manzil + Calendar only)

### Twilio Phone Number Map

| Number | Client | Current Twilio Voice URL target |
|--------|--------|---------------------------------|
| +15877421507 | Hasan Sharif (Aisha) | Railway `/api/webhook/hasan-sharif/inbound` ✅ |
| +15873551834 | Windshield Hub (Mark) | Railway `/api/webhook/windshield-hub/inbound` ✅ (Phase 4e DONE) |
| +15873296845 | Urban Vibe (Jade) | Railway `/api/webhook/urban-vibe/inbound` ✅ (Phase 4e DONE) |
| +15878014602 | Manzil ISA (Fatima) | n8n outbound trigger (TEST MODE) |
| New clients | via Stripe webhook | auto-purchased at activation, VoiceUrl set automatically |

### Ultravox Agent Registry

| Client | Slug | Agent ID | Voice ID | Mode |
|--------|------|----------|----------|------|
| Hasan Sharif (Aisha) | `hasan-sharif` | `f19b4ad7-233e-4125-a547-94e007238cf8` | `87edb04c-...` | Railway ✅ |
| Windshield Hub (Mark) | `windshield-hub` | `00652ba8-5580-4632-97be-0fd2090bbb71` | `b0e6b5c1-3100-44d5-8578-9015aa3023ae` | Railway ✅ |
| Urban Vibe (Jade) | `urban-vibe` | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` | `aa601962-1cbd-4bbd-9d96-3c7a93c3414a` | Railway ✅ |
| Manzil ISA (Fatima) | `manzil-isa` | via n8n per call | Nour `d766b9e3-69df-4727-b62f-cd0b6772c2ad` | n8n TEST 🧪 |

**Ultravox API key:** `ULTRAVOX_API_KEY` env var
**Model:** `ultravox-v0.7`
**maxDuration:** always `"600s"` — NEVER leave at default 3600s
**VAD:** `turnEndpointDelay: "0.64s"` / `minimumTurnDuration: "0.1s"` / `minimumInterruptionDuration: "0.2s"`
**callTemplate:** ALL config MUST be nested inside `callTemplate` — top-level fields silently ignored

### Auth Roles

| Role | `client_id` | Access |
|------|-------------|--------|
| `admin` | NULL | All clients, /admin/*, God Mode, Test Lab, Insights |
| `owner` | own client UUID | Own client only: Settings, Calls, Voices, Test Call |
| `viewer` | own client UUID | Read-only, no settings changes, no test calls |

---

---

## 6. Onboarding / Activation Pipeline (Phase C — Mar 2026)

New client lifecycle from intake to live:

```
1. Client submits /onboard (7-step wizard)
      ↓
   POST /api/provision → inserts intake_submissions (status=pending)
   → Telegram alert to admin
      ↓
2. Admin reviews in /dashboard/clients
   → Clicks "Generate prompt" on the intake row
      ↓
   POST /api/dashboard/generate-prompt
   → buildPromptFromIntake() (9 niches, template-fill)
   → Optional: enrichWithSonar() adds local business facts
   → validatePrompt() (min 5000 chars, must have hangUp + CALLER ENDS CALL)
   → createAgent() → Ultravox agent (name = client slug)
   → INSERT/UPDATE clients row (status='setup')
   → INSERT prompt_versions row (is_active=true)
   → UPDATE intake_submissions (status='provisioned', client_id=clientId)
      ↓
3. Admin clicks "Activate ($20)" on provisioned row
      ↓
   POST /api/stripe/create-checkout
   → Stripe Checkout session with metadata {intake_id, client_id, client_slug}
   → Returns URL → admin shares or opens
      ↓
4. Client pays $20 via Stripe
      ↓
   POST /api/webhook/stripe (checkout.session.completed)
   → Guard: skip if clients.status already 'active'
   → Search AvailablePhoneNumbers (CA or US by area code)
   → Buy number → VoiceUrl = /api/webhook/{slug}/inbound
                 → VoiceFallbackUrl = /api/webhook/{slug}/fallback
   → UPDATE clients: status='active', twilio_number
   → createUser → INSERT client_users (role='owner')
   → resetPasswordForEmail → welcome email
   → UPDATE intake_submissions: progress_status='activated'
   → Telegram alert to admin
      ↓
5. Client gets welcome email → sets password → logs in → sees their dashboard
```

**Stripe keys:** Test mode currently. Swap `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to live keys before charging real clients.

---

*To update: edit this file directly. Keep in sync with `AGENT_APP_ARCHITECTURE.md` and `memory/MEMORY.md`.*
*Last updated: 2026-03-10*
