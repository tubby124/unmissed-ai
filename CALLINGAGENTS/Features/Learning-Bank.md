---
type: feature
status: scaffolded
tags: [feature, learning-bank, prompt-improvement, observability]
mutation-class: DB_ONLY
plan-gate: admin-only
related: [Clients/unmissed-demo, Decisions/2026-04-29-Learning-Bank, Decisions/2026-04-29-Zara-Rewrite]
updated: 2026-04-29
---

# Feature: Learning Bank

> Cross-client prompt-improvement system. Turns every call into a candidate lesson; promotes proven lessons into reusable patterns; injects promoted patterns into future prompts.

## Why
Every active agent generates `call_insights` data (talk_ratio, loop_rate, repeated_questions, agent_confused_moments, caller_frustrated, agent_confidence). Until now it was a passive log. The learning bank promotes it to active feedback and turns 845+ existing calls into prompt training data.

## Architecture
```
call → /completed webhook
  ├─ persist transcript     → call_transcripts (full turn-by-turn JSON)
  ├─ analyze quality        → call_insights (existing)
  └─ generate lessons       → prompt_lessons (NEW — auto from thresholds)

admin reviews open lessons  → /dashboard/admin/learning-bank
  └─ promote good ones      → prompt_patterns (NEW — reusable library)

future prompt regenerated   → recomposePrompt()
  └─ if LEARNING_BANK_INJECT=true: queries v_active_patterns_by_niche
                                   injects # LESSONS LEARNED block
                                   logs to pattern_application_log
```

## Tables
- **`prompt_patterns`** — promoted reusable lessons. Columns: name, category (voice_naturalness | hangup | ai_disclosure | edge_case | qualification | close | formatting | prompt_injection | identity | triage), verbatim_line, rationale, source_slug, source_call_id, niche_applicability text[], status (candidate | promoted | retired), score 0-10. Migration: `20260429000000_create_learning_bank.sql`. Seeded with 14 cross-niche patterns + 10 niche one-liners.
- **`prompt_lessons`** — raw observations from calls. Columns: client_id, call_id, observation_type (failure | success | edge_case | knowledge_gap), what_happened, recommended_change, severity (low|medium|high), status (open | applied | rejected | promoted), source (manual | call_insights_threshold | knowledge_query_log | call_review).
- **`pattern_application_log`** — append-only log of pattern→prompt applications with before/after metrics for A/B retrospective.
- **`call_transcripts`** — full turn-by-turn JSON pulled from Ultravox at call-end. Migration: `20260429010000_create_call_transcripts.sql`. Unique on `ultravox_call_id`.
- **`v_active_patterns_by_niche`** — view: expands `niche_applicability` array to one row per niche for fast lookup.

## Auto-lesson thresholds
Triggered in `/completed` `after()` block via `src/lib/lesson-generator.ts`:
| Trigger | observation_type | severity | source |
|---|---|---|---|
| `loop_rate > 0.2` (proxy: `repeated_questions >= 3 OR agent_confused_moments >= 2`) | failure | high | call_insights_threshold |
| `caller_frustrated=true` | failure | high | call_insights_threshold |
| `agent_confidence < 0.5 AND duration_seconds > 30` | failure | medium | call_insights_threshold |
| `agent_confused_moments > 2` | failure | medium | call_insights_threshold |
| `unanswered_questions > 0` | knowledge_gap | medium | call_insights_threshold |
| `hollowAffirmationCount > 2` (transcript) | failure | low | call_insights_threshold |
| `didDenyBeingAI=true` (transcript) | failure | high | call_insights_threshold |
| `duration_seconds > 90 AND call_status='HOT'` | success | low | call_insights_threshold |
| 3+ unresolved `knowledge_query_log` rows on same query cluster (cron) | knowledge_gap | medium | knowledge_query_log |

## Key Files
- Migration: [supabase/migrations/20260429000000_create_learning_bank.sql](supabase/migrations/20260429000000_create_learning_bank.sql)
- Migration: [supabase/migrations/20260429010000_create_call_transcripts.sql](supabase/migrations/20260429010000_create_call_transcripts.sql)
- Seed: [supabase/migrations/20260429020000_seed_prompt_patterns.sql](supabase/migrations/20260429020000_seed_prompt_patterns.sql)
- Persist transcript + analyze: [src/lib/call-transcripts.ts](src/lib/call-transcripts.ts)
- Auto-lesson generator: [src/lib/lesson-generator.ts](src/lib/lesson-generator.ts)
- Webhook integration: [src/app/api/webhook/[slug]/completed/route.ts](src/app/api/webhook/[slug]/completed/route.ts) (lines 474-501)
- Admin UI: `src/app/dashboard/admin/learning-bank/page.tsx` (3 tabs: Open Lessons | Promoted Patterns | Application Log)
- Admin APIs: `src/app/api/admin/learning-bank/{lessons,promote,patterns}/route.ts`
- Recompose injection (gated): `src/lib/slot-regenerator.ts` — gated behind `LEARNING_BANK_INJECT=true` (default OFF)
- Backfill script: [scripts/backfill-transcripts.ts](scripts/backfill-transcripts.ts) — `npx tsx scripts/backfill-transcripts.ts --limit 200 --dry-run`
- Skill: `~/.claude/skills/learn/` — `/learn audit [slug]` · `/learn promote-pattern` · `/learn weekly-digest` · `/learn seed`

## Operational Cadence
- **Per-call:** `/completed` webhook auto-creates lessons from thresholds.
- **Weekly:** `/learn weekly-digest` produces `CALLINGAGENTS/Operations/Learning-Digest-YYYY-WW.md`.
- **Per-niche:** `/learn audit [slug]` for focused review.
- **On promotion:** `/learn promote-pattern` interactive flow OR admin UI button.
- **Pattern injection:** flip `LEARNING_BANK_INJECT=true` per-niche after manual validation; pattern_application_log records before/after metrics.

## Status (2026-04-29)
- ✅ Migrations written (3 files), DB drift fix applied (Aria→Zara)
- ✅ Webhook integrated — auto-lesson generation wired
- ✅ Admin UI scaffolded
- ✅ /learn skill registered
- ✅ Backfill script written (NOT yet run — Hasan to execute)
- ⏳ Migrations NOT applied to remote yet (`supabase db push` pending)
- ⏳ Seed has not run yet (waits for migration apply)
- ⏳ Pattern injection gated OFF until validated (W3+ work)

## Known Gaps
- `call_insights.loop_rate` does NOT exist as a column — substituted `repeated_questions >= 3 OR agent_confused_moments >= 2` as proxy throughout. Swap once a `loop_rate` column lands.
- `SUPABASE_DB_URL` env var not currently set — required for `/learn` skill psql scripts. Add from Supabase dashboard pooler string.
- W4 cross-niche embedding clustering of `prompt_lessons.recommended_change` is deferred — start once 50+ patterns accumulate.
