# Baseline Snapshot — 2026-03-21 08:58 CST

## Contents

### Supabase State
- `supabase-clients.json` — 12 client rows (all non-deleted), 20 fields each
- `supabase-prompt-versions.json` — 8 active prompt versions with lengths

### Ultravox Agent Configs (full API responses)
- `ultravox-agent-hasan-sharif.json` — 25,176 bytes
- `ultravox-agent-windshield-hub.json` — 17,719 bytes
- `ultravox-agent-urban-vibe.json` — 19,258 bytes
- `ultravox-agent-exp-realty.json` — 27,880 bytes
- `ultravox-agent-unmissed-demo.json` — 21,067 bytes

### System Prompts (SYSTEM_PROMPT.txt copies)
- `prompt-hasan-sharif.txt` — 7,174 bytes (v53)
- `prompt-windshield-hub.txt` — 7,929 bytes (v20)
- `prompt-urban-vibe.txt` — 9,267 bytes (v22)
- `prompt-exp-realty.txt` — 9,666 bytes (v15)

### Client Config Files
- `config-hasan-sharif.json`
- `config-windshield-hub.json`
- `config-urban-vibe.json`
- `config-exp-realty.json`
- `config-manzil-isa.json`
- `config-unmissed-demo.json`

### Test Results
- `test-results-promptfoo.txt` — 31,547 bytes (ran successfully)
- `test-results-sync-check.txt` — SKIPPED (SUPABASE_SECRET_KEY not in local env; data captured via MCP instead)

## Capture Notes
- Environment: local dev (macOS), querying prod Supabase (`qwhvblomlgeapzhnuwlb`) and prod Ultravox API
- Supabase project ID: `qwhvblomlgeapzhnuwlb` (unmissed-ai)
- Schema discovery: `knowledge_chunk_count` column does not exist; hours columns are `business_hours_weekday`/`business_hours_weekend` (not `_start`/`_end`)
- 12 total clients in DB (5 active prod, 2 demo, 1 paused, 1 test, 3 others)
- All 5 Ultravox agent configs fetched successfully with valid JSON

## Active Prompt Versions at Freeze Time

| Client | Version | Length | Last Change |
|--------|---------|--------|-------------|
| hasan-sharif | v53 | 7,124 chars | 2026-03-21 — B3 call state + KNOWN_PARAM_CALL_ID |
| windshield-hub | v20 | 7,873 chars | 2026-03-20 — hangUp temporaryTool fix |
| urban-vibe | v22 | 9,183 chars | 2026-03-20 — hangUp temporaryTool fix |
| exp-realty | v15 | 9,606 chars | 2026-03-20 — hangUp temporaryTool fix |
| unmissed-demo | v6 | 7,783 chars | 2026-03-20 — Pattern A tool response |
| e2e-test-plumbing-co | v1 | 12,379 chars | 2026-03-10 — auto-generated |
| nofal-barber | v1 | 16,565 chars | 2026-03-15 — auto-generated |
| true-color | v15 | 2,235 chars | 2026-03-19 — dashboard edit |
