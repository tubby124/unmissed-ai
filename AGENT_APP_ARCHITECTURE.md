# unmissed.ai — Master Architecture Reference
*Claude Code instruction document. Read at session start. Never re-explain what's here.*

---

## 1. System Overview

**What it is:** unmissed.ai — AI voice agent deployment platform. Service businesses (inbound) and sales teams (outbound ISA) get a managed AI phone agent.

**Live URL:** `https://unmissed-ai-production.up.railway.app`
**Deploy:** Git push to main → Railway auto-deploys the `agent-app/` Next.js app
**Supabase project:** `qwhvblomlgeapzhnuwlb` (unmissed-ai)

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 15 (App Router), TypeScript, Tailwind |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| AI Voice | Ultravox (Agents API + per-call createCall) |
| Telephony | Twilio (inbound/outbound, TwiML) |
| AI Classification | OpenRouter → `anthropic/claude-haiku-4.5` |
| AI Prompt Improve | OpenRouter → `anthropic/claude-haiku-4.5` |
| Notifications | Telegram Bot API |
| Legacy (retired) | n8n — only Manzil ISA (test) + Calendar Tools remain |

---

## 2. Active Clients

| Client | Slug | Twilio Number | Ultravox Agent ID | Status |
|--------|------|---------------|-------------------|--------|
| Hasan Sharif (Aisha) | `hasan-sharif` | +15877421507 | `f19b4ad7-233e-4125-a547-94e007238cf8` | Railway native |
| Windshield Hub (Mark) | `windshield-hub` | +15873551834 | `00652ba8-5580-4632-97be-0fd2090bbb71` | Railway native |
| Urban Vibe (Alisha) | `urban-vibe` | +15873296845 | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` | Railway native |
| Manzil ISA (Fatima) | `manzil-isa` | +15878014602 | via n8n per call | TEST MODE (n8n legacy) |

All voice agent clients are Railway-native (Phase 4e completed Mar 9 2026). n8n retired for voice agents.

---

## 3. Database Schema (key tables)

### `clients`
Primary config per client. One row per client.
```
id (uuid PK) | slug | business_name | niche | status (active/paused)
system_prompt | agent_voice_id | ultravox_agent_id
twilio_number | telegram_bot_token | telegram_chat_id | timezone
monthly_minute_limit | minutes_used_this_month
sms_enabled | sms_template | tools (jsonb)
```

### `client_users`
Auth link between Supabase users and clients.
```
id | user_id (→ auth.users) | client_id (→ clients, nullable for admin)
role: 'admin' | 'owner' | 'viewer'
```

### `call_logs`
One row per call. Upserted by `/webhook/[slug]/completed`.
```
id | client_id | caller_phone | call_status (live/processing/HOT/WARM/COLD/JUNK/MISSED/UNKNOWN)
ai_summary | service_type | key_topics (jsonb) | sentiment | next_steps (jsonb)
quality_score | duration_seconds | recording_url | transcript
started_at | ended_at | ultravox_call_id | twilio_call_sid | test_call (bool)
```

### `prompt_versions`
Version history for system prompts.
```
id | client_id | version (int) | content | change_description | is_active | created_at
```

### `intake_submissions`
Provisioning intake forms (admin Clients page).
```
id | client_slug | business_name | niche | intake_json (jsonb)
progress_status | generated_prompt | created_at
```

---

## 4. Per-Call Webhook Flow

### Inbound Call
```
Twilio → POST /api/webhook/[slug]/inbound
  1. Verify Twilio signature (X-Twilio-Signature)
  2. Look up client by slug → check status (paused → reject)
  3. Check minute limit (reject if over)
  4. Query last 5 calls from caller_phone → build callerContext (returning caller detection)
  5. If ultravox_agent_id:
       callViaAgent(agentId, { callerContext, metadata, callbackUrl })
     Else (or if callViaAgent fails):
       createCall({ systemPrompt, voice, tools, callbackUrl, metadata })  ← SAFETY FALLBACK
  6. Sign callbackUrl with HMAC (signCallbackUrl)
  7. Return TwiML: <Response><Connect><Stream url="{joinUrl}"/></Connect></Response>
```

### Call Completion
```
Ultravox → POST /api/webhook/[slug]/completed
  1. Verify HMAC signature (verifyCallbackSig)
  2. Build transcript from messages[]
  3. OpenRouter classify → call_status + ai_summary + key_topics + sentiment + next_steps + quality_score
  4. Supabase upsert call_logs (create or update by ultravox_call_id)
  5. increment_minutes_used RPC
  6. If sms_enabled → send post-call SMS via Twilio
  7. Telegram alert (tier: HOT→⚡ / WARM→🟡 / COLD→❄️ / JUNK→🗑️ / UNKNOWN→⚠️)
```

### Outbound Test Call
```
Dashboard → POST /api/dashboard/test-call
  1. Auth: owner or admin (viewer = 403)
  2. Owner → targets own client_id only
  3. Create Ultravox call (callViaAgent or createCall)
  4. Twilio outbound dial: to=toPhone, twiml=<Stream url=joinUrl>
  5. Logged with metadata.test_call='true'
```

---

## 5. Ultravox Integration

### Two Modes

**Agents API (preferred):** Persistent agent profile with stored `callTemplate`.
```typescript
// Create agent (one-time, at provisioning)
POST /api/agents
{ name, callTemplate: { systemPrompt, voice, model, vadSettings, ... } }

// Call via agent (per call — lightweight)
POST /api/agents/{id}/calls
{ templateContext: { callerContext }, medium, callbacks, metadata }

// Update agent (when prompt changes)
PATCH /api/agents/{id}
{ callTemplate: { systemPrompt, voice, ... } }   // FULL callTemplate required — PATCH replaces entire callTemplate atomically (Mar 15 incident)
```

**createCall (fallback):** Full config per call.
```typescript
createCall({ systemPrompt, voice, tools, callbackUrl, metadata })
```

### Critical Facts
- `callTemplate` must be nested — top-level fields silently ignored
- Updates only affect NEW calls; existing live calls unaffected
- `callViaAgent` failure → safety fallback to `createCall` with Supabase prompt
- `maxDuration` defaults to 3600s — always set to `"600s"` for inbound
- VAD: `turnEndpointDelay: 640`, `minimumTurnDuration: 100`, `minimumInterruptionDuration: 200`
- Model: `ultravox-v0.7` (API name, NOT HuggingFace name)

### Prompt Sync Pipeline
```
Settings save → Supabase update → await updateAgent() → prompt_versions insert
                                ↓ if updateAgent fails
                          ultravox_error returned to UI
                          User sees orange warning banner
                          User clicks "Re-sync Agent" → POST /api/dashboard/settings/sync-agent
                          → await updateAgent() → confirms sync
```

---

## 6. Auth & Roles

| Role | Access |
|------|--------|
| `admin` | All clients, God Mode settings, Test Lab, Insights, Admin Clients page |
| `owner` | Own client only, Settings, Voices, Call Logs, Test Call |
| `viewer` | Read-only (no settings changes, no test calls) |

- Admin detection: `cu.role === 'admin'` (NOT email env var — that was the old bug)
- Admin has `client_id = NULL` in client_users
- All API routes check `cu.role` from `client_users` table
- Middleware: non-admin → `/dashboard` (cannot access `/admin/*`)
- Supabase RLS: call_logs visible to admin (all) or owner (own client only)

### Auth Users (Supabase)
| UUID | Email | Role | client_id |
|------|-------|------|-----------|
| a0000001-... | admin@unmissed.ai | admin | NULL |
| f21fa782-... | jade@urbanvibe.ca | owner | 42a66c19 (urban-vibe) |
| 79545df7-... | mark@windshieldhub.ca | owner | bff9d635 (windshield-hub) |

---

## 7. Dashboard API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| PATCH | `/api/dashboard/settings` | owner/admin | Save prompt, status, God Mode fields |
| POST | `/api/dashboard/settings/sync-agent` | owner/admin | Force-push prompt+voice to Ultravox |
| POST | `/api/dashboard/settings/improve-prompt` | owner/admin | AI refinement via OpenRouter |
| GET | `/api/dashboard/settings/prompt-versions` | owner/admin | List version history |
| POST | `/api/dashboard/settings/prompt-versions` | owner/admin | Restore a version |
| GET | `/api/dashboard/voices` | authenticated | List Ultravox voices + myVoiceId |
| POST | `/api/dashboard/voices/assign` | owner/admin | Assign voice to client agent |
| POST | `/api/dashboard/test-call` | owner/admin | Fire outbound test call |
| POST | `/api/dashboard/settings/test-telegram` | admin | Test Telegram alert |

---

## 8. n8n Status (RETIRED for voice agents — Mar 9 2026)

All voice agent n8n workflows have been deactivated. Railway handles all inbound/outbound calls.

| Workflow | ID | Status |
|---------|-----|--------|
| Hasan Sharif AI Voice (Aisha) | `hjDvPPSMhlKKxSdN` | RETIRED — Railway native |
| Windshield Hub (Mark) | `sbztgErD8MV3WMOn` | RETIRED — Railway native |
| Urban Vibe (Ayana) | `KzskPB8mGq5sz6OS` | RETIRED — Railway native |
| Hasan Calendar Tools | `N9iBSLx1RFK52lIo` | Production (non-voice, still active) |
| Manzil Realty ISA | `sKh2bzwPtpDCWVKO` | TEST MODE (only remaining n8n voice workflow) |
| Manzil Call Completion | `7EwdyrmlawE8Kc1t` | TEST MODE |
| Global Error Handler | `5mAUUqnYhr2fHIf4` | Applied to Manzil workflows |

Phase 4e: DONE (Mar 9 2026). All Twilio Voice URLs switched to Railway.

---

## 9. Known Production Bugs Fixed

| Bug | Fix | Date |
|-----|-----|------|
| call_logs CHECK constraint missing 'UNKNOWN' | Dropped + recreated constraint | Mar 8 2026 |
| Admin detection using email env var | Changed to `cu.role === 'admin'` | Mar 8 2026 |
| updateAgent() fire-and-forget | Changed to awaited in all routes | Mar 8 2026 |
| Ultravox agent had empty systemPrompt (hasan-sharif) | Emergency PATCH + structural fix | Mar 8 2026 |
| callViaAgent failure = dead call | Added safety fallback to createCall | Mar 8 2026 |
| Callback URL never received by Ultravox | Fixed rawCallbackUrl passing in inbound route | Mar 8 2026 |
| Recordings bucket private | Made public via PUT /storage/v1/bucket/recordings | Mar 8 2026 |
| OpenRouter model ID wrong | Changed to `anthropic/claude-haiku-4.5` (no date suffix) | Mar 8 2026 |

---

## 10. Roadmap

### Phase 4e (DONE — Mar 9 2026)
All Twilio Voice URLs switched to Railway. VoiceFallbackUrls switched from n8n to Railway `/api/webhook/[slug]/fallback`.

### Phase C — Intake → Auto-Prompt Generation
```
POST /api/generate-prompt?intakeId=xxx
  1. Fetch intake_submissions.intake_json
  2. Determine niche → load niche baseline prompt template
  3. OpenRouter Haiku → merge intake vars into template
  4. Store in intake_submissions.generated_prompt
  5. Admin: preview + "Deploy to Agent" → clients.system_prompt + Ultravox
```
Niche baselines needed: `voicemail` / `inbound-retail` / `property-management` / `isa-outbound`

### Phase D — Per-Call Learning Loop
```
On each completion:
  classify → extract patterns → if quality_score < 6 flag as potential gap
Weekly aggregate:
  COLD/MISSED patterns → OpenRouter → suggest prompt refinements
  Alert admin via Telegram + dashboard notification
Admin master-tweak:
  Apply approved refinements across all clients in a niche
```

---

## 11. Claude Code Integration Guide

### How Memory Works (Claude Code docs, confirmed)
- `MEMORY.md`: first 200 lines loaded at every session start. Lines 201+ NOT loaded.
- Topic files (e.g., `debugging.md`): NOT loaded at startup — Claude reads them on demand via file tools
- `CLAUDE.md`: loaded in full (no line limit) — but keep under 200 lines per file for best adherence
- **Current problem:** MEMORY.md is 386 lines → only 200 lines are loaded → later sessions miss context

### Fix MEMORY.md Now
Move all detailed sections into topic files:
- `memory/n8n-workflows.md` — workflow IDs, TEST/PROD flip nodes
- `memory/ultravox-agents.md` — agent IDs, API patterns, VAD settings, model names
- `memory/supabase-schema.md` — tables, RLS notes, migrations
- `memory/clients.md` — per-client details (slugs, phones, agents, Telegram)
- `memory/phase-history.md` — what was built in each phase
Keep MEMORY.md as a 1-2 line index pointing to topic files.

### Rules Files (path-specific)
Create `.claude/rules/` in the calling agents folder for scoped instructions:
```
.claude/rules/
├── agent-app.md        # Next.js API rules (auth patterns, route conventions)
├── ultravox.md         # Ultravox API patterns + gotchas
├── production-safety.md # DO NOT TOUCH files, Twilio safety
```

### Hooks (useful for this project)
Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "async": true,
        "command": "cd '/Users/owner/Downloads/CALLING AGENTs/agent-app' && npx tsc --noEmit 2>&1 | tail -5 >> /tmp/unmissed-tsc.log"
      }]
    }],
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "cat '/Users/owner/Downloads/CALLING AGENTs/AGENT_APP_ARCHITECTURE.md' | head -50"
      }]
    }]
  }
}
```

### Multi-Agent Vision (Future)

When we build multiple specialized agents:

```
Coordinator Agent (Claude)
├── Research Agent → web searches, API docs, competitor analysis
├── Docs Agent    → reads/writes architecture docs, keeps MEMORY up to date
├── Code Agent    → writes and edits TypeScript/Next.js
├── QA Agent      → runs TypeScript checks, reviews diffs for production safety
└── Deploy Agent  → manages git commits, Railway deploys
```

Each agent as `.claude/agents/<name>.md`:
```yaml
---
name: unmissed-researcher
description: Researches Ultravox API updates, n8n patterns, and voice agent best practices
tools: Read, Grep, Glob, WebSearch, WebFetch
model: haiku
memory: project
---
Focus on: Ultravox API changelog, n8n node documentation, voice agent benchmarks.
Always update agent-app/memory/research-findings.md with new discoveries.
```

Subagents share the project memory directory — they can read each other's findings.

### Import Syntax for CLAUDE.md
This file can be referenced from CLAUDE.md:
```
@AGENT_APP_ARCHITECTURE.md
```
Or use path-specific rules to load it only when working in agent-app/:
```markdown
---
paths:
  - "agent-app/**/*"
---
@AGENT_APP_ARCHITECTURE.md
```

---

## 12. Critical File Index (Quick Nav)

| File | Purpose | Touch safely? |
|------|---------|---------------|
| `agent-app/src/app/api/webhook/[slug]/inbound/route.ts` | Live call handler | ⚠️ Caution — test thoroughly |
| `agent-app/src/app/api/webhook/[slug]/completed/route.ts` | Call completion + classify | ⚠️ Caution |
| `agent-app/src/lib/ultravox.ts` | Ultravox client (Agents + fallback) | ✅ Yes |
| `agent-app/src/lib/openrouter.ts` | AI classify + UNKNOWN guard | ✅ Yes |
| `agent-app/src/lib/supabase/server.ts` | Supabase clients (server + service) | ✅ Yes |
| `agent-app/src/app/dashboard/settings/SettingsView.tsx` | Main settings UI | ✅ Yes |
| `agent-app/src/app/dashboard/settings/page.tsx` | Settings data + ClientConfig type | ✅ Yes |
| `agent-app/src/app/api/dashboard/settings/improve-prompt/route.ts` | AI improvement | ✅ Yes |
| `agent-app/src/app/api/dashboard/settings/sync-agent/route.ts` | Force Ultravox sync | ✅ Yes |
| `agent-app/src/app/api/dashboard/test-call/route.ts` | Test call trigger | ✅ Yes |
| `agent-app/src/app/middleware.ts` | Auth gate + role redirect | ⚠️ Careful |
| `agent-app/src/app/dashboard/layout.tsx` | Admin detection + sidebar | ✅ Yes |

---

*Last updated: 2026-03-08 | Maintained by Claude Code auto-memory + manual updates*
*To update this file: Edit AGENT_APP_ARCHITECTURE.md directly. Keep in sync with MEMORY.md topic files.*
