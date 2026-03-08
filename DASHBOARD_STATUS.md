# unmissed.ai Dashboard — Build Status & Roadmap
> Last updated: 2026-03-08

---

## What's Live (Railway Production)

### Infrastructure
- [x] Next.js 16 on Railway — auto-deploy on push to `main`
- [x] Supabase project `qwhvblomlgeapzhnuwlb` (unmissed-ai) — auth, DB, RLS, Storage
- [x] `next.config.ts` — `serverExternalPackages: ['twilio']` ✓
- [x] DB indexes — `idx_call_logs_client_started`, unique `idx_call_logs_ultravox_id`
- [x] Security — `anon_read_clients` policy DROPPED (was leaking system_prompt, tokens publicly)
- [x] Recordings storage bucket created

### Auth / Users
| Email | Password | Role | Client |
|-------|----------|------|--------|
| `admin@unmissed.ai` | `COOLboy!@#4` | admin | all clients |
| `whub@unmissed.ai` | `qwerty` | owner | Windshield Hub Auto Glass |
| `uvibe@unmissed.ai` | `qwerty123` | owner | Urban Vibe Properties |

### Clients in DB
| Slug | Business | Twilio Number | Prompt | Telegram |
|------|----------|--------------|--------|----------|
| `hasan-sharif` | Hasan Sharif | +15877421507 | ✅ | ✅ |
| `urban-vibe` | Urban Vibe Properties | +15873296845 | ✅ | ❌ needs token |
| `windshield-hub` | Windshield Hub Auto Glass | +15873551834 | ✅ | ❌ needs token |

### Webhook Routing (Current)
| Client | Twilio Voice URL | Logs to Dashboard |
|--------|-----------------|-------------------|
| Hasan Sharif | `railway.app/api/webhook/hasan-sharif/inbound` | ✅ YES |
| Windshield Hub | `n8n.srv728397.../webhook/inbound-call-o` | ❌ no (n8n only) |
| Urban Vibe | `n8n.srv728397.../webhook/urban-vibe-inbound` | ❌ no (n8n only) |

### Dashboard Features
- [x] Login page (`/login`) — Supabase email/password
- [x] Calls page (`/dashboard/calls`) — admin sees all clients with tab switcher
- [x] Call detail page (`/dashboard/calls/[id]`) — transcript, audio player, summary
- [x] Settings page (`/dashboard/settings`) — minute usage meter
- [x] **LiveCallBanner** — green glow card with animated waveform + live duration counter when calls are active
- [x] **StatsGrid** — themed stat cards (red/blue/green/zinc), radial glows, animated count-up
- [x] **StatusBadge** — glow box-shadows per status (HOT=red, WARM=amber, COLD=blue, live=green)
- [x] **CallRow** — service type pill, monospaced phone, better hierarchy
- [x] **CallsList** — staggered entrance animation, admin client tabs, search by phone + business name
- [x] Realtime Supabase subscription — new calls appear without refresh
- [x] Multi-client classifier — OpenRouter Haiku with `businessContext` per client
- [x] Telegram crash alerts — uses `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` from `.env`

---

## Phase 1 — COMPLETE ✅
Core infrastructure, auth, multi-client dashboard, production UI polish

---

## Phase 2 — Hasan System Dial-In (Next)
> Goal: Hasan's voice agent fully visible + manageable from dashboard

- [ ] **Verify Hasan's Twilio → Railway webhook is live** — call `+15877421507`, confirm call appears in dashboard
- [ ] **Call detail — transcript sync** — verify transcript populates after Hasan call completes
- [ ] **Settings page** — populate `monthly_minute_limit` for Hasan in DB
- [ ] **Telegram alerts for Hasan** — confirm HOT lead notification fires to `hassistant1_bot`
- [ ] **Prompt editor** — `/dashboard/settings` should let admin edit `system_prompt` inline (currently read-only)
- [ ] **Call recording playback** — verify audio waveform player works on real Hasan calls
- [ ] **Live call test** — fire a test call, watch it appear in LiveCallBanner in real-time

---

## Phase 3 — Windshield Hub + Urban Vibe Migration
> Goal: move WH + UV off n8n onto native webhooks so their calls log to dashboard

**Decision needed:** Native webhooks currently don't pass Ultravox tools (calendar booking).
Options:
- A) Switch Twilio → Railway native (loses calendar booking tools temporarily)
- B) Keep n8n but add a Supabase upsert step at end of completion workflow (keeps tools, adds logging)

**Recommended:** Option B first (non-breaking), then migrate fully in Phase 4

- [ ] Add Supabase HTTP upsert to WH n8n completion workflow (`sbztgErD8MV3WMOn`)
- [ ] Add Supabase HTTP upsert to UV n8n completion workflow (`KzskPB8mGq5sz6OS`)
- [ ] Verify WH + UV calls appear in dashboard after test calls
- [ ] Add `telegram_bot_token` + `telegram_chat_id` for WH (winhubv1bot) + UV (urbanvibepptmgmt_bot) to clients table

---

## Phase 4 — Tools + Native Full Migration
> Goal: native webhooks support Ultravox tools (calendar booking, SMS)

- [ ] Add `tools` JSONB column to `clients` table
- [ ] `inbound/route.ts` — read `client.tools` and pass to Ultravox `CreateCallRequest`
- [ ] Add WH calendar booking tool config to `clients.tools`
- [ ] Add UV calendar booking tool config to `clients.tools`
- [ ] Switch WH Twilio → `railway.app/api/webhook/windshield-hub/inbound`
- [ ] Switch UV Twilio → `railway.app/api/webhook/urban-vibe/inbound`
- [ ] Decommission n8n inbound workflows for WH + UV (keep as fallback voice_fallback_url)

---

## Phase 5 — Post-Call Automation (native)
> Goal: SMS + calendar confirmations handled natively, not via n8n

- [ ] Post-call SMS via Twilio — triggered from `completed/route.ts` using client config
- [ ] Google Calendar booking from Ultravox tool calls — webhook handler in `/api/tools/[slug]/book-appointment`
- [ ] Per-client Telegram bot support — `clients.telegram_bot_token` + `telegram_chat_id`
- [ ] Lead scoring history chart on call detail page

---

## Phase 6 — Client Self-Service Portal
> Goal: each client (whub, uvibe) can log in and manage their own agent

- [ ] Client dashboard — their own calls, stats, prompt
- [ ] Prompt editor with live preview and version history
- [ ] Test call trigger button in dashboard
- [ ] Billing / minute usage with Stripe

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
| `OPENROUTER_API_KEY` | see `.env.local` | ✅ |
| `TELEGRAM_BOT_TOKEN` | `8018224669:AAGdog...` | ✅ |
| `TELEGRAM_CHAT_ID` | `7278536150` | ✅ |
| `ADMIN_PASSWORD` | set to anything | ❌ NOT SET (blocks `/admin/*`) |
