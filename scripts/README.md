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
