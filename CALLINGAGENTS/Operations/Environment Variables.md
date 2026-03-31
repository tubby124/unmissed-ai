---
type: operations
status: active
tags: [operations, railway, env, secrets]
related: [Operations/Deployment, Operations/Cron Jobs]
updated: 2026-03-31
---

# Environment Variables

## Critical Railway Env Vars

| Variable | Purpose | Risk if Missing |
|----------|---------|----------------|
| `CRON_SECRET` | Auth for all 10 cron endpoints | Silent failure of all crons |
| `SUPABASE_SERVICE_ROLE_KEY` | DB admin access | All API routes fail |
| `SUPABASE_URL` | DB connection | All API routes fail |
| `TWILIO_AUTH_TOKEN` | Webhook signature validation | All Twilio webhooks fail or pass unauthenticated |
| `TWILIO_ACCOUNT_SID` | Twilio REST API calls | SMS, transfer, outbound fail |
| `ULTRAVOX_API_KEY` | Create calls, update agents | All voice calls fail |
| `WEBHOOK_SIGNING_SECRET` | Tool route auth + completed webhook HMAC | Tool calls unauthenticated, completed webhook rejects |
| `ULTRAVOX_WEBHOOK_SECRET` | Native Ultravox webhook validation | `/api/webhook/ultravox` returns 500 |
| `STRIPE_SECRET_KEY` | Stripe API (upgrades, billing) | All billing routes fail |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation | Subscription events dropped |

## Demo-Specific Vars

| Variable | Purpose |
|----------|---------|
| `DEMO_TWILIO_NUMBER` | From-number for demo outbound calls |
| `DEMO_ULTRAVOX_AGENT_ID` | unmissed-demo agent (74ccdadb) |

## Secret Storage Rule
All local secrets in `~/.secrets` (chmod 600, sourced by `~/.zshrc`).
Never hardcode in `.env.local` beyond what's needed for local dev.
Never commit `.env` or `.env.local` files.

## Dev vs Prod Delta
| Config | Local (`.env.local`) | Railway (Production) |
|--------|---------------------|---------------------|
| Stripe key | `sk_test_...` | `sk_live_...` |
| Webhook base URL | `http://localhost:3000` | `https://unmissed-ai-production.up.railway.app` |
| Supabase URL | same | same (shared DB) |
| CRON_SECRET | `983d6f36...` | must be set manually in Railway |
