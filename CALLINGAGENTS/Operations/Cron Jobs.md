---
type: operations
status: active
tags: [operations, cron, railway, D233]
related: [Operations/Deployment, Tracker/D233]
updated: 2026-03-31
---

# Cron Jobs

## Critical: CRON_SECRET Required
All 10 cron jobs silently fail without `CRON_SECRET` set in Railway env vars.
**Action needed: verify in Railway Dashboard → Service → Variables.**
Local value: `983d6f36...` (in `.env.local`)

## Cron Job Inventory

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/reset-minutes` | 1st of month | Reset `seconds_used_this_month` to 0 |
| `/api/cron/digest` | Weekly (Mon 9am) | Weekly call digest → Telegram |
| `/api/cron/trial-expiry` | Daily | Check trial expiry → send warning emails |
| `/api/cron/drift-check` | Daily | Check DB vs Ultravox agent state → update `last_agent_sync_status` |
| `/api/cron/stale-processing` | Every 5 min | Recover calls stuck in `processing` state for >60s |
| `/api/cron/knowledge-gaps` | Weekly | Summarize unanswered knowledge queries → digest |
| `/api/cron/appointment-reminders` | Daily 8am | Day-before appointment SMS reminders (D200 — pending) |
| `/api/cron/missed-call-sms` | Every 15 min | Auto-SMS for missed calls (D219 — pending) |
| `/api/cron/callback-follow-up` | Every hour | Lead callback queue processing (D220 — pending) |
| `/api/cron/billing-sync` | Daily | Sync Stripe subscription status to DB |

## Auth
All cron endpoints validate `Authorization: Bearer {CRON_SECRET}` header before processing.
Without `CRON_SECRET` in Railway: HTTP 401, task silently skipped, no Telegram alert.

## Drift Check Cron (D221 — DONE)
- Runs daily, compares DB state vs Ultravox live agent state
- Sets `clients.last_agent_sync_status` to `'ok'`, `'drift'`, or `'error'`
- D223: surface this status on home dashboard as health indicator (pending)

## Stale Processing Recovery
- Looks for `call_logs` rows with `call_status='processing'` for >60s
- Re-triggers the completed webhook logic for those calls
- Prevents stuck calls from blocking notification and billing
