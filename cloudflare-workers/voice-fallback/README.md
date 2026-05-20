# unmissed.ai — Voice Fallback Worker

Cloudflare Worker that serves a Twilio voicemail TwiML when the primary
Railway voice route is down. Independent failure domain from Railway.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/voice` | Twilio `VoiceFallbackUrl` — returns voicemail TwiML |
| `POST` | `/recording` | Twilio recording-status callback — alerts operator on Telegram |
| `GET`  | `/health` | Liveness probe |

## First-time setup

```bash
cd cloudflare-workers/voice-fallback
npm install

# Authenticate (one time)
npx wrangler login

# Set secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_OPERATOR_CHAT_ID
npx wrangler secret put TWILIO_AUTH_TOKEN

# Deploy
npm run deploy
```

## DNS

`fallback.endvoicemail.ai` is a custom domain on the Worker. After first
deploy, the route in `wrangler.toml` provisions the DNS record automatically
(Cloudflare manages `endvoicemail.ai` already).

If DNS isn't ready yet, use the workers.dev URL printed by `wrangler deploy`
for smoke testing — Twilio will accept any HTTPS URL as `VoiceFallbackUrl`.

## Wire Twilio

Run from the main repo:

```bash
npx tsx scripts/set-twilio-voice-fallback.ts
```

The script iterates every active client number and sets
`VoiceFallbackUrl = https://fallback.endvoicemail.ai/voice`.

## Outage recovery

When the primary Railway route comes back:

1. Read the Telegram operator chat for the day — every fallback fire is logged
2. Run `npx tsx scripts/ingest-fallback-recordings.ts --since=<ISO-timestamp>`
3. The script reads the Twilio recordings list, finds the ones not yet in
   `call_logs`, downloads them, uploads to Supabase Storage, and inserts
   `call_logs` rows with `call_status='VOICEMAIL'` + `source='fallback'`

## Why a separate Worker

Railway can go down (May 19 2026 incident: site-wide outage took every voice
route with it). If the fallback also runs on Railway, the fallback is moot —
the same outage takes both. Cloudflare Workers run on Cloudflare's edge with
99.99% SLA + independent failure domain.

## Update the number-to-slug map

When provisioning a new client, add the Twilio number to `NUMBER_TO_SLUG` in
`src/index.ts` and redeploy. Until then the Telegram alert says
`(unknown number)` — still works, just less specific.
