---
type: operations
status: active
tags: [operations, cron, github-actions, D233]
related: [Operations/Deployment, Tracker/D233]
updated: 2026-05-20
---

# Cron Jobs

## Scheduler: GitHub Actions (NOT Railway)

**Crons run from [`.github/workflows/crons.yml`](../../.github/workflows/crons.yml)**, NOT from Railway.

Why: Railway only honors `deploy.cronSchedule` (single string per service) — the `cron[]` array in `railway.json` was never valid Railway schema and was silently ignored since the file was authored. An external scheduler was hitting the cron URLs until ~2026-05-19T22:23 UTC, then went silent (likely 308'd post-domain-migration to `endvoicemail.ai`). Resurrected as GitHub Actions 2026-05-20 (commit `6bb3e3b`).

## Required secrets

| Secret | Where | Value |
|---|---|---|
| `CRON_SECRET` (GitHub repo secret) | `gh secret set CRON_SECRET --repo tubby124/unmissed-ai` | 48-char value, matches Railway env var |
| `CRON_SECRET` (Railway env var) | Railway → Variables | Same 48-char value |

If either secret is missing, every cron silently 401s. Confirm via the **Recent runs** tab of the [Scheduled crons workflow](https://github.com/tubby124/unmissed-ai/actions/workflows/crons.yml).

## Cron inventory (14 jobs)

| Endpoint | Schedule (UTC) | Purpose |
|----------|----------------|---------|
| `/api/cron/scheduled-callbacks` | `*/5 * * * *` | Outbound dialer for scheduled callbacks |
| `/api/cron/follow-up-reminders` | `*/30 * * * *` | Nudge owner on aged HOT/WARM leads |
| `/api/cron/notification-health` | `0 * * * *` | Failed notification recovery + stuck call_log re-trigger |
| `/api/cron/cleanup-tokens` | `0 * * * *` | Delete `outbound_connect_tokens` >10min old |
| `/api/cron/minute-usage-alert` | `15 * * * *` | 75% / 90% minute-cap warning emails |
| `/api/cron/demo-followup` | `30 * * * *` | Email demo callers 1–24h post-call |
| `/api/cron/fleet-drift` | `45 * * * *` | Twilio + webhook + prompt-vs-tool audit; Telegram on CRITICAL |
| `/api/cron/drift-check` | `0 */6 * * *` | Supabase ↔ Ultravox prompt drift detection + auto-fix; writes `clients.last_agent_sync_*` |
| `/api/cron/analyze-calls` | `0 2 * * *` | Claude-Haiku call-quality analysis → `call_analysis_reports` |
| `/api/cron/trial-expiry` | `0 7 * * *` | Pause expired trials + send conversion email |
| `/api/cron/daily-digest-client` | `0 13 * * *` | Client morning email digest |
| `/api/cron/daily-digest` | `0 14 * * *` | Admin Telegram digest |
| `/api/cron/weekly-digest-client` | `0 15 * * 0` | Sunday client perf email |
| `/api/cron/reset-minutes` | `0 6 1 * *` | Monthly `seconds_used_this_month` reset to 0 |

## Auth

Every cron route validates `Authorization: Bearer {CRON_SECRET}` before processing. The GH Actions workflow uses `curl -L --fail` so future redirects can't silently swallow runs (the original 2026-05-17 → 2026-05-19 silent failure mode).

## On-demand triggering

Need to fire a single cron manually? Use the workflow's `workflow_dispatch` input:

```bash
gh workflow run crons.yml --repo tubby124/unmissed-ai --ref main -f job=drift-check
gh run watch $(gh run list --workflow crons.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

`job` accepts any single cron name or `all` to fire all 14 in sequence.

## How drift-check works

- Runs every 6 hours
- For each active client with `ultravox_agent_id`: pulls Supabase `system_prompt` + live UV `callTemplate.systemPrompt`, compares (after normalization)
- If drifted: auto-PATCH UV with the Supabase copy, set `last_agent_sync_status='success'`, `last_agent_sync_at=now`
- If errored: set `last_agent_sync_status='error'`, populate `last_agent_sync_error`
- Returns JSON: `{checked, alreadySynced, drifted, fixed, errors}`

The "Synced" dashboard badge in `AgentSyncBadge.tsx` currently reads `last_agent_sync_status === 'success'` — see Risk 4 in `docs/architecture/control-plane-mutation-contract.md` for the gap (it doesn't distinguish "fresh save succeeded" from "drift cron auto-fixed it 5 hours ago").

## Stale processing recovery

Built into `notification-health` (hourly). Looks for `call_logs` rows with `call_status='processing'` for >60s and re-triggers the completed webhook logic. Prevents stuck calls from blocking notification + billing.
</content>
