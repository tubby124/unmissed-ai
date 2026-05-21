# Ops Scripts Index

All operational scripts for unmissed.ai. Run from the project root unless noted otherwise.

## Prompt & Agent Management

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy_prompt.py` | Versioned prompt deploy: reads local `SYSTEM_PROMPT.txt`, inserts prompt_versions row, updates Supabase + PATCHes Ultravox agent, writes changelog | `python3 scripts/deploy_prompt.py <slug> "<change>"` / `--dry-run` / `--rollback N` |
| `prompt_status.py` | Per-client prompt drift check: compares local file hash vs Supabase vs Ultravox live agent | `python3 scripts/prompt_status.py [slug ...]` |
| `repair-agents.py` | One-shot repair: PATCHes Ultravox agents with correct callTemplate, restores `ultravox_agent_id` in Supabase | `python3 scripts/repair-agents.py` |
| `repair-agents.sh` | Bash version of repair-agents.py (same logic, shell implementation) | `bash scripts/repair-agents.sh` |
| `rebuild-tools.mjs` | Rebuild `clients.tools` JSON for all live clients from current flags (no Ultravox API calls) | `node scripts/rebuild-tools.mjs` |
| `register-ultravox-webhook.py` | Register an Ultravox account-level webhook (call.ended, call.billed). Outputs webhook ID + secret | `python3 scripts/register-ultravox-webhook.py` |
| `test-sip-transfer.py` | Test native SIP cold transfer (INVITE + REFER modes) between two live phone numbers | `python3 scripts/test-sip-transfer.py <from-number> <to-number>` |

## Knowledge / RAG Backfill

| Script | Purpose | Usage |
|--------|---------|-------|
| `backfill-chunks.ts` | Import custom knowledge chunks (JSON) into pgvector for a client | `npx tsx scripts/backfill-chunks.ts --slug <slug> --file <json> [--dry-run] [--replace-source manual]` |
| `backfill-corpus.py` | Backfill existing `client_knowledge_docs` into Ultravox corpus (legacy corpus API) | `ULTRAVOX_API_KEY=xxx ULTRAVOX_CORPUS_ID=xxx python3 scripts/backfill-corpus.py` |
| `backfill-pgvector.mjs` | One-shot: embed windshield-hub business_facts + extra_qa into `knowledge_chunks` via OpenRouter embeddings | `node scripts/backfill-pgvector.mjs` |
| `init-corpus.py` | Create the shared Ultravox corpus. Prints corpus ID for Railway env var | `ULTRAVOX_API_KEY=xxx python3 scripts/init-corpus.py` |

## Testing & Cleanup

| Script | Purpose | Usage |
|--------|---------|-------|
| `reset-test-calls.js` | Wipe caller context + AI summary for a phone number or all calls for a client (clean test state) | `node scripts/reset-test-calls.js [+1phone] [slug]` / `node scripts/reset-test-calls.js all <slug>` |
| `reset-test-calls.sh` | Bash version of reset-test-calls.js (same logic, curl + Supabase REST) | `bash scripts/reset-test-calls.sh [+1phone] [slug]` / `bash scripts/reset-test-calls.sh all <slug>` |

## Data Hygiene Check

Nightly audit that catches "customer updates that conflict, look stale, or contain bad content". Companion to crons.yml (operational scheduler). Runs from GitHub Actions, hits Supabase directly — no Railway dependency. See `.github/workflows/data-hygiene-check.yml` for the schedule.

| Check | What it catches |
|-------|-----------------|
| A. Stale injected_notes | `injected_note IS NOT NULL` and expiry is past OR NULL — the class of bug that left a weeks-old typo-ridden crisis note live |
| B. Content red-flags | Competitor mentions, profanity, explicit content, or URLs inside `injected_note` — the porn / Tim Hortons injection class |
| C. Trial-status drift | `subscription_status='trialing'` past `trial_expires_at` — the 14 stuck rows the trial-expiry cron skipped because they were already `status='paused'` |
| D. Zombie active subs | `subscription_status='active'` with no Stripe sub id and not on concierge allow-list |
| E. Plan-tier tool mismatch | Lite plan with transferCall / bookAppointment / checkForCoaching (or Core with checkForCoaching) |
| F. Stuck live calls | `call_status='live'` for >2h — Twilio/Ultravox webhook never closed the row |
| G. Untranscribed voicemails | VOICEMAIL >24h with no `ai_summary` (or PLACEHOLDER) |
| H. Duplicate twilio_numbers | Two clients holding the same `twilio_number` (call-routing race) |

Run locally (dry-run, no Telegram, no DB writes):
```bash
SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
  npx tsx scripts/data-hygiene-check.ts --dry-run
```

Auto-fix stale rows (clears injected_note for A, sets `subscription_status='expired'` for C, marks stuck calls `unknown` for F — never auto-fixes B/D/E/G/H, which need owner review):
```bash
SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
  npx tsx scripts/data-hygiene-check.ts --fix
```

Flag patterns (competitors / profanity / explicit / URL regex) live in `scripts/data-hygiene-flags.json`. Add new competitor names in place; no schema change needed.

Idempotency: writes `.github/data-hygiene-state/last-run.json`. Same finding set within 24h → no Telegram re-alert. Delete the state file to force re-alert.

Unit tests: `npx tsx --test src/lib/__tests__/data-hygiene.test.ts`.

## NotebookLM Sync

| Script | Purpose | Usage |
|--------|---------|-------|
| `nlm-sync.sh` | Copy all NLM-tracked files (from `nlm-registry.txt`) to `~/Downloads/unmissed-notebooklm/`. Shows new/changed files for manual NLM upload | `bash scripts/nlm-sync.sh` / `--check` (dry run) |
| `nlm-watch.sh` | Background watcher: auto-runs `nlm-sync.sh` on `.md` file changes via `fswatch`. Started by LaunchAgent | `bash scripts/nlm-watch.sh &` / stop: `pkill -f nlm-watch.sh` |
| `nlm-registry.txt` | File list for NLM sync. One entry per line: `PATH \| DESCRIPTION`. Add new files here then run `nlm-sync.sh` | Edit directly, then `bash scripts/nlm-sync.sh` |
| `nlm-watch.log` | Log output from `nlm-watch.sh` background watcher | Read-only (auto-generated) |

## Environment Requirements

Most scripts require env vars from `~/.secrets`:
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY` in older scripts)
- `ULTRAVOX_API_KEY`
- `OPENROUTER_API_KEY` (embedding scripts only)

Python scripts use stdlib only (no pip install needed). Node scripts require `@supabase/supabase-js` (already in project deps).

## Notes

- `repair-agents.py` and `repair-agents.sh` contain hardcoded API keys from early development. They are one-shot scripts kept for reference only. Do not run without updating credentials.
- `backfill-pgvector.mjs` is windshield-hub-specific. For other clients, use `backfill-chunks.ts`.
- `backfill-corpus.py` targets the legacy Ultravox corpus API. pgvector is the current knowledge backend.
- `backfill-chunks.ts` references `agent-app/.env.local` for env vars -- this path is stale after S12-OPS4 repo unification. Use root `.env.local` instead.

## Nightly Drift Check

`scripts/nightly-drift-check.ts` — read-only diff of Supabase `clients` vs live Ultravox agent state. Runs nightly at 09:00 UTC via [.github/workflows/nightly-drift-check.yml](../.github/workflows/nightly-drift-check.yml) and posts a single Telegram alert to the owner if drift is found. Complements `/api/cron/drift-check` (which auto-fixes prompt drift) — this script covers voice, tools, X-Tool-Secret presence, and capability fake-on.

### Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ULTRAVOX_API_KEY`
- `TELEGRAM_BOT_TOKEN` (required unless `--dry-run`)
- `TELEGRAM_OWNER_CHAT_ID` (optional — script falls back to `clients.telegram_chat_id` where `slug = 'hasan-sharif'`)

### Local test

```bash
SUPABASE_SERVICE_ROLE_KEY=... \
NEXT_PUBLIC_SUPABASE_URL=https://qwhvblomlgeapzhnuwlb.supabase.co \
ULTRAVOX_API_KEY=... \
npx tsx scripts/nightly-drift-check.ts --dry-run
```

### Expected output

```
[nightly-drift] Starting (dry-run)…
  [OK   ] auto-glass-yyc
  [DRIFT] urban-vibe — 2 finding(s)
     · voice: f6f50e3e-0e0e-… ≠ Mark-English
     · capability_fake_on:forwarding: selected_plan == "pro" ≠ core
  [OK   ] windshield-hub
[nightly-drift] checked=3 findings=2 fetch_errors=0
[nightly-drift] DRY RUN — would alert. signature=a3f1c2d4e5b6…
```

Exit codes: `0` = no drift, `1` = drift found (Telegram already sent inline, GitHub Action shows red), `2` = setup/env error.

### Idempotency

The script writes `.github/drift-state/last-alert.json` with the SHA-256 of the drift fingerprint. If the same drift recurs within 24h, no duplicate Telegram is sent. Delete the state file to force a re-alert.

## Twilio Ownership Check

`scripts/twilio-ownership-check.ts` — nightly diff of `clients.twilio_number` (Supabase) vs the live Twilio account inventory. Catches the silent-fail class where Twilio releases / suspends / ports-out / mis-routes a number we still believe we own — inbound calls 404 at Twilio with no internal signal until the customer complains. Runs at 10:00 UTC via [.github/workflows/twilio-ownership-check.yml](../.github/workflows/twilio-ownership-check.yml). Writes findings via `recordFindings({ harness: 'twilio-ownership', ... })` and posts a single Telegram alert on P0.

### Checks

| Severity | Check | What it catches |
|----------|-------|-----------------|
| P0 | `twilio_number_orphan_in_db` | DB has a number Twilio doesn't have at all — inbound calls 404 |
| P0 | `twilio_number_suspended` | Twilio status ≠ `in-use` (suspended for billing / compliance / TCR) |
| P0 | `twilio_voice_url_mismatch` | `voiceUrl` drifted (someone edited it in Twilio console, or APP_URL changed) |
| P1 | `twilio_voice_fallback_url_mismatch` | Fallback URL no longer points at the Cloudflare Worker |
| P1 | `twilio_status_callback_mismatch` | `statusCallback` drift (skipped unless `statusCallback` is wired) |
| P1 | `twilio_number_orphan_in_account` | Twilio has a number not in DB — paying ~$1.15/mo for nothing |
| P1 | `twilio_number_capabilities_missing` | Number lacks Voice, or lacks SMS while `clients.sms_enabled = true` |

### Required env vars

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` (required unless `--dry-run`)
- `TELEGRAM_OWNER_CHAT_ID` (optional — script falls back to `clients.telegram_chat_id` where `slug='hasan-sharif'`)
- `NEXT_PUBLIC_APP_URL` (optional — defaults to `https://endvoicemail.ai`)
- `VOICE_FALLBACK_URL` (optional — defaults to `https://fallback.endvoicemail.ai/voice`)

### Local test

Pull env from `.env.local` and run dry (no DB writes, no Telegram):

```bash
npx tsx scripts/twilio-ownership-check.ts --dry-run
```

Exit codes: `0` = clean, `1` = P1 findings only, `2` = at least one P0 (calls failing) or setup error.

### Unit tests

```bash
npx tsx --test src/lib/__tests__/twilio-ownership.test.ts
```

The diff logic lives in `src/lib/twilio-ownership.ts` — pure, no I/O. The runner script is just env + Supabase + Twilio SDK wiring.

## Stripe Drift Check

`scripts/stripe-drift-check.ts` — nightly cross-check of Supabase `clients` against live Stripe state. Catches "Stripe and DB disagree on subscription state" — the silent revenue leak class (portal cancels, refunds, past-due, deleted customers, stuck-trial conversions). Runs at 09:45 UTC via [.github/workflows/stripe-drift-check.yml](../.github/workflows/stripe-drift-check.yml) — 15 min after data-hygiene-check, 30 min after nightly-drift-check.

Read-only: never mutates `clients.*` or calls Stripe write endpoints. Findings persist via `recordFindings({ harness: 'stripe-drift', ... })`; P0s also fire a single Telegram alert to the owner chat. Triage from `/admin/harness`.

| Check | Severity | What it catches |
|-------|----------|-----------------|
| `stripe_customer_deleted` | P0 | DB has `stripe_customer_id` but Stripe shows `deleted: true` (or 404) |
| `stripe_sub_missing` | P0 | DB has `stripe_subscription_id` but Stripe returns 404 |
| `stripe_status_mismatch` | P0 | DB says active/trialing/past_due, Stripe says canceled/incomplete_expired/unpaid/paused (the portal-cancel-webhook-dropped class) |
| `stripe_trial_converted_db_still_trialing` | P0 | Stripe `status=active` with `trial_end < now()`, DB still `subscription_status=trialing` |
| `stripe_past_due_db_active` | P1 | Stripe `status=past_due`, DB still `active` — grace-period clock never started |
| `stripe_orphan_active_sub` | P1 | Stripe has an active sub whose customer is unknown to DB (only fires when sub carries `metadata.unmissed_slug`; no-op until that tag convention is added at checkout) |

### Required env vars

- `STRIPE_SECRET_KEY` (live mode `sk_live_*` for prod runs; `sk_test_*` works locally)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` (required unless `--dry-run`)
- `TELEGRAM_OWNER_CHAT_ID` (optional — falls back to `clients.telegram_chat_id` where `slug = 'hasan-sharif'`)

### Local test

```bash
STRIPE_SECRET_KEY=sk_test_... \
NEXT_PUBLIC_SUPABASE_URL=https://qwhvblomlgeapzhnuwlb.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/stripe-drift-check.ts --dry-run
```

Exit codes: `0` = clean, `1` = any P0 (silent revenue leak in progress), `2` = any P1 (and no P0).

### Unit tests

`npx tsx --test src/lib/__tests__/stripe-drift.test.ts` — mocks Stripe responses with stub projections; no live key or network. Validates each check function plus exit-code aggregation.: nightly stripe-drift harness — Stripe vs Supabase)
