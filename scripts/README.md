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
