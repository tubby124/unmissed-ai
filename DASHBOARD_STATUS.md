# unmissed.ai Dashboard — Build Status & Roadmap
> Last updated: 2026-03-08 (Phase 2–6 hardening complete)

---

## What's Live (Railway Production)

### Infrastructure
- [x] Next.js 16 on Railway — auto-deploy on push to `main`
- [x] Supabase project `qwhvblomlgeapzhnuwlb` (unmissed-ai) — auth, DB, RLS, Storage
- [x] `next.config.ts` — `serverExternalPackages: ['twilio']` ✓
- [x] DB indexes — `idx_call_logs_client_started`, unique `idx_call_logs_ultravox_id`, `idx_call_logs_caller_phone`
- [x] Security — `anon_read_clients` policy DROPPED, HMAC webhook signing, Basic Auth on `/api/admin/*`
- [x] Recordings storage bucket (public)
- [x] Railway healthcheck — `GET /api/health` → `{ ok: true, ts: Date.now() }`
- [x] Zero-downtime config — `healthcheckTimeout: 300` in `railway.json`

### Auth / Users
| Email | Password | Role | Client |
|-------|----------|------|--------|
| `admin@unmissed.ai` | `COOLboy!@#4` | admin | all clients |
| `whub@unmissed.ai` | `qwerty` | owner | Windshield Hub Auto Glass |
| `uvibe@unmissed.ai` | `qwerty123` | owner | Urban Vibe Properties |

### Clients in DB
| Slug | Business | Twilio Number | Prompt | Telegram | Ultravox Agent ID |
|------|----------|--------------|--------|----------|--------------------|
| `hasan-sharif` | Hasan Sharif | +15877421507 | ✅ | ✅ | `f19b4ad7-233e-4125-a547-94e007238cf8` |
| `urban-vibe` | Urban Vibe Properties | +15873296845 | ✅ | ✅ | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` |
| `windshield-hub` | Windshield Hub Auto Glass | +15873551834 | ✅ | ✅ | `00652ba8-5580-4632-97be-0fd2090bbb71` |

### Webhook Routing (Current — pre Phase 4e)
| Client | Twilio Voice URL | Logs to Dashboard |
|--------|-----------------|-------------------|
| Hasan Sharif | `railway.app/api/webhook/hasan-sharif/inbound` | ✅ YES — native |
| Windshield Hub | `n8n.srv728397.../webhook/inbound-call-o` | ✅ YES — via n8n Dashboard Sync node |
| Urban Vibe | `n8n.srv728397.../webhook/urban-vibe-inbound` | ✅ YES — via n8n Dashboard Sync node |

> Phase 4e (Twilio URL switch for WH + UV) is **PENDING USER CONFIRMATION**. When ready, switch each number to `railway.app/api/webhook/{slug}/inbound` and set `VoiceFallbackUrl` → current n8n URL.

---

## Phase 1 — COMPLETE ✅
Core infrastructure, auth, multi-client dashboard, production UI polish

---

## Phase 2 — COMPLETE ✅ (Mar 8 2026)
- [x] Hasan Twilio → Railway webhook live and verified
- [x] HMAC webhook security — `signCallbackUrl()` / `verifyCallbackSig()` in `ultravox.ts` + `completed/route.ts`
- [x] Railway zero-downtime config — `railway.json` with healthcheckPath + overlap/draining seconds
- [x] `GET /api/health` endpoint live
- [x] Prompt editor in Settings dashboard — already existed, works ✅
- [x] Prompt → Ultravox agent sync on save (now updates `ultravox_agent_id` via PATCH)

---

## Phase 3 — COMPLETE ✅ (Mar 8 2026)
- [x] Add `telegram_bot_token` + `telegram_chat_id` for WH (winhubv1bot) in Supabase
- [x] UV tokens already set ✅
- [x] `💾 Dashboard Sync` Code node added to WH n8n completion workflow (`sbztgErD8MV3WMOn`)
- [x] `💾 Dashboard Sync` Code node added to UV n8n completion workflow (`KzskPB8mGq5sz6OS`)
- [ ] **Test & verify** — fire test calls for WH + UV → confirm rows appear in dashboard ← **TODO**

---

## Phase 4 — MOSTLY COMPLETE ✅ (Mar 8 2026)
- [x] `tools JSONB` column added to `clients`
- [x] `inbound/route.ts` — reads `client.tools` and passes to Ultravox `createCall()`
- [x] Ultravox Agents API migration — `createAgent()` + `callViaAgent()` in `ultravox.ts`
- [x] Agents created for all 3 clients, `ultravox_agent_id` stored in Supabase ✅
- [x] `inbound/route.ts` — uses `callViaAgent()` if `ultravox_agent_id` exists, else fallback to `createCall()`
- [ ] **Phase 4e — PENDING USER CONFIRMATION:** Switch Twilio Voice URLs for WH + UV → Railway
  - WH `+15873551834`: set Voice URL → `https://unmissed-ai-production.up.railway.app/api/webhook/windshield-hub/inbound` | VoiceFallbackUrl → `https://n8n.srv728397.hstgr.cloud/webhook/inbound-call-o`
  - UV `+15873296845`: set Voice URL → `https://unmissed-ai-production.up.railway.app/api/webhook/urban-vibe/inbound` | VoiceFallbackUrl → `https://n8n.srv728397.hstgr.cloud/webhook/urban-vibe-inbound`
- [ ] WH + UV tool configs (calendar booking) — deferred until booking n8n webhook confirmed

---

## Phase 5 — COMPLETE ✅ (Mar 8 2026)
- [x] Returning caller detection — `inbound/route.ts` queries last 5 calls by `caller_phone + client_id`, injects context
- [x] Index `idx_call_logs_caller_phone ON call_logs(caller_phone, client_id)` added
- [x] SMS post-call — `completed/route.ts` sends SMS if `client.sms_enabled && callerPhone !== 'unknown' && status !== 'JUNK'`
- [x] `sms_enabled BOOLEAN` + `sms_template TEXT` columns added to `clients`
- [x] UNKNOWN classification guard — `openrouter.ts` fallback is now `UNKNOWN` (not `COLD`)
- [x] UNKNOWN tier in Telegram routing — ⚠️ badge for manual review
- [x] `classificationHints` param in `classifyCall()` for per-client HOT criteria

---

## Phase 6 — COMPLETE ✅ (Mar 8 2026)
- [x] `prompt_versions` table with RLS (admin full + user read-own)
- [x] Settings PATCH route records immutable version on every prompt save
- [x] `GET /api/dashboard/settings/prompt-versions` — list versions
- [x] `POST /api/dashboard/settings/prompt-versions` — restore specific version (admin only)
- [x] `POST /api/dashboard/test-call` — dials operator's phone via Twilio + Ultravox stream

---

## How to Remove n8n (when ready)
**Criteria:** WH + UV on native webhooks for 7+ days with zero VoiceFallbackUrl fires.
1. WH: flip Twilio Voice URL (Phase 4e) → test 5 calls → confirm dashboard rows
2. UV: same
3. After 7 days: disable n8n inbound workflows `sbztgErD8MV3WMOn` (WH) + `KzskPB8mGq5sz6OS` (UV)
4. Keep PERMANENTLY: `N9iBSLx1RFK52lIo` (Hasan calendar), `7nF5fJIcmwKHLY5I` (Manzil calendar), `sKh2bzwPtpDCWVKO` + `7EwdyrmlawE8Kc1t` (Manzil ISA outbound), `5mAUUqnYhr2fHIf4` (error handler)
5. VoiceFallbackUrl can point to a simple `<Response><Say>This service is temporarily unavailable.</Say></Response>` TwiML bin once n8n is confirmed dead

---

## Env Vars Needed in Railway
| Var | Value | Status |
|-----|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qwhvblomlgeapzhnuwlb.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | see `.env.local` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | see `.env.local` | ✅ |
| `ULTRAVOX_API_KEY` | `4FowyUSm...` | ✅ |
| `TWILIO_ACCOUNT_SID` | `ACff197fc7...` | ✅ |
| `TWILIO_AUTH_TOKEN` | see `.env.local` | ✅ |
| `TWILIO_FROM_NUMBER` | default Twilio number for outbound | ✅ |
| `OPENROUTER_API_KEY` | see `.env.local` | ✅ |
| `TELEGRAM_BOT_TOKEN` | `8018224669:AAGdog...` (hassistant1_bot) | ✅ |
| `TELEGRAM_CHAT_ID` | `7278536150` | ✅ |
| `WEBHOOK_SIGNING_SECRET` | any 32-char random string | ❌ ADD THIS — enables HMAC webhook verification |
| `ADMIN_PASSWORD` | anything | ❌ ADD THIS — required for `/api/admin/*` routes |
| `NEXT_PUBLIC_APP_URL` | `https://unmissed-ai-production.up.railway.app` | ✅ |
