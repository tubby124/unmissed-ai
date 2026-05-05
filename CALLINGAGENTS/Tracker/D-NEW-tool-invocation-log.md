---
type: tracker
status: open
priority: P1
phase: Phase-9-Agent-Intelligence
related:
  - Features/Knowledge-Pipeline
  - Architecture/Per-Call-Context
opened: 2026-05-05
revised: 2026-05-05
fix_branch: feat/knowledge-query-log-chunk-attribution
---

# D-NEW — Add `matched_chunk_ids` to `knowledge_query_log` + D270 aggregation view

## Status
**OPEN** — opened 2026-05-05 with wrong premise (assumed no logging existed). Revised same day after codebase audit. Tool-call logging infrastructure already exists per-tool. Real gap is much smaller: chunk attribution missing from `knowledge_query_log`, and no aggregation view for D270 promotion logic.

## Audit findings (2026-05-05)

**Logging that ALREADY exists** (per-tool, in domain-specific tables):
- `knowledge_query_log` — every `queryKnowledge` invocation. 13 columns: `id, client_id, slug, query_text, result_count, top_similarity, threshold_used, latency_ms, created_at, resolved_at, resolution_type, source, query_embedding`. RLS enabled. 4 indexes (incl. HNSW vector on unresolved gaps). [src/app/api/knowledge/[slug]/query/route.ts:200-235](src/app/api/knowledge/[slug]/query/route.ts#L200-L235).
- `sms_logs` — every `sendTextMessage` invocation. [src/app/api/webhook/[slug]/sms/route.ts:134](src/app/api/webhook/[slug]/sms/route.ts#L134) (also writes from `calendar/[slug]/book` for booking confirmation SMS).
- `bookings` — every `bookAppointment` invocation. [src/app/api/calendar/[slug]/book/route.ts:120](src/app/api/calendar/[slug]/book/route.ts#L120).
- `maintenance_requests` — every `submitMaintenanceRequest` invocation. [src/app/api/webhook/[slug]/maintenance-request/route.ts:79](src/app/api/webhook/[slug]/maintenance-request/route.ts#L79).
- `notification_logs` — every Telegram/email dispatch.

**What's actually missing:**

1. **Chunk attribution on `knowledge_query_log`.** When `queryKnowledge` returns hits, we know `top_similarity` and `result_count` but not WHICH specific chunks were returned. D270 ("frequent KB query → auto-suggest FAQ") needs to know "chunk X got queried 5×/week" — that requires per-chunk attribution. Currently, attribution survives only as the `knowledge_chunks.hit_count` aggregate counter (no time-windowing, no per-call attribution).

2. **No aggregation view** for D270. The data is in `knowledge_query_log` but no rollup exists. D270's promotion decision logic ("3+ same query in 7 days → suggest as FAQ") needs a queryable surface.

3. **`transferCall` has no log table.** Transfer attempts are tracked via `call_logs.transfer_status` (string) but not as separate event rows with timing/outcome. Out-of-scope for this D-item — file `D-NEW-transfer-attempt-log` if Phase 9 needs it.

## Bug bucket classification

Per `.claude/rules/core-operating-mode.md`:
- **Source-of-truth bug** (chunk attribution lives only in aggregate `hit_count`, not per-event)
- **Capability-gating bug** (D270 logic depends on data we have but can't query efficiently)

## Solution (revised — much smaller than original D-item)

### Change 1 — Add `matched_chunk_ids uuid[]` column to `knowledge_query_log`

Migration `supabase/migrations/<timestamp>_kql_chunk_attribution.sql`:

```sql
ALTER TABLE public.knowledge_query_log
  ADD COLUMN matched_chunk_ids uuid[] DEFAULT NULL;

-- GIN index — enables "show me all queries that matched chunk X"
CREATE INDEX knowledge_query_log_chunk_ids_gin_idx
  ON public.knowledge_query_log USING gin (matched_chunk_ids);
```

### Change 2 — Populate `matched_chunk_ids` in queryKnowledge route

[src/app/api/knowledge/[slug]/query/route.ts:122-127](src/app/api/knowledge/[slug]/query/route.ts#L122-L127) — `logQuery()` is called once with no chunk IDs. Change to pass `sorted.map(m => m.id)` when results exist.

`logQuery()` helper at line 200-235 — add `matchedChunkIds: string[] | null` param, set `row.matched_chunk_ids = matchedChunkIds` when non-null.

Total diff: ~5 lines in 1 file.

### Change 3 — Create D270 aggregation view

```sql
CREATE OR REPLACE VIEW public.knowledge_query_topic_aggregate AS
SELECT
  client_id,
  query_text,
  COUNT(*)                                              AS hits_total,
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')   AS hits_last_7d,
  COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')  AS hits_last_30d,
  COUNT(*) FILTER (WHERE result_count = 0)              AS empty_count,
  COUNT(*) FILTER (WHERE result_count > 0)              AS hit_count,
  MAX(created_at)                                       AS last_queried_at,
  MIN(created_at)                                       AS first_queried_at,
  array_agg(DISTINCT unnest_chunks.chunk_id) FILTER (WHERE unnest_chunks.chunk_id IS NOT NULL)
                                                        AS distinct_matched_chunk_ids
FROM public.knowledge_query_log kql
LEFT JOIN LATERAL unnest(kql.matched_chunk_ids) AS unnest_chunks(chunk_id) ON true
WHERE created_at > now() - interval '90 days'
GROUP BY client_id, query_text;

-- Promotion candidate view — purpose-built for D270
CREATE OR REPLACE VIEW public.knowledge_promotion_candidates AS
SELECT
  client_id,
  query_text,
  hits_last_7d,
  hits_last_30d,
  empty_count,
  hit_count,
  last_queried_at,
  distinct_matched_chunk_ids
FROM public.knowledge_query_topic_aggregate
WHERE hits_last_7d >= 5 OR hits_last_30d >= 20
ORDER BY hits_last_7d DESC, hits_last_30d DESC;
```

RLS: views inherit from `knowledge_query_log` policies (admin + owner read).

## Files
- New: `supabase/migrations/20260505XXXXXX_kql_chunk_attribution.sql` (Changes 1 + 3)
- Edit: [src/app/api/knowledge/[slug]/query/route.ts](src/app/api/knowledge/[slug]/query/route.ts) (Change 2 — ~5 lines)
- Add: `src/lib/__tests__/knowledge-query-log.test.ts` — assert `matched_chunk_ids` populates on hit + stays NULL on empty

## Acceptance criteria

- [ ] Migration applies cleanly to dev + prod
- [ ] Existing 16 rows for Brian retain NULL `matched_chunk_ids` (no backfill — going-forward only)
- [ ] Next real `queryKnowledge` call against any client populates the column with the matched chunk IDs
- [ ] `knowledge_promotion_candidates` view returns 0 rows initially (correct — no client crosses 5×/7d threshold yet)
- [ ] After 1 simulated test call where 1 query is fired 5+ times, the view returns that query
- [ ] `npm run test:all` green
- [ ] PR includes the SELECT against the view as proof

## Out of scope (do NOT bundle)

- **Building D270 itself** (UI surface, promotion job, demote logic) — this D-item is the data layer. D270 ships separately.
- **Backfill `matched_chunk_ids` for historical 16 rows** — not worth it; we can re-run the queries through the new code path if needed.
- **Logging `transferCall`** — file `D-NEW-transfer-attempt-log` if Phase 9 needs it. Currently tracked via `call_logs.transfer_status` string.
- **Demo path query logging** — `demo_calls` doesn't currently log queryKnowledge invocations. If D270 should learn from demo traffic, file separately.
- **PII expansion / query_text retention policy** — out of scope. PII review needed before we expose the view to non-admin users.

## Dependencies
- Blocks: D270 (Phase 9 — frequent KB query → auto-suggest FAQ)
- Blocked by: nothing
- Related: D-NEW-niche-template-trim (sister item — that one cuts in-prompt FAQ pressure; this one adds the data needed to safely cut more later)

## Why the original scope was wrong

Hasan's intuition (2026-05-05) was right that we needed observability. My first pass on this D-item assumed no logging existed and proposed a unified `tool_invocations` table covering 5+ tools. The codebase audit showed every meaningful tool already logs to its own domain-specific table — `knowledge_query_log`, `sms_logs`, `bookings`, `maintenance_requests`, `notification_logs`. The actual gap was ~5 lines of code + 1 column + 1 view, not a new table + helper + 5 instrumentation passes.

This is a "diagnose vs change" win per `.claude/rules/core-operating-mode.md` — verifying the source of truth before patching saved a 200-line PR.

## Connections
- → [[Features/Knowledge-Pipeline]]
- → [[Architecture/Per-Call-Context]]
- → [[Tracker/D270]] (Phase 9 — depends on this)
- → [[Tracker/D-NEW-niche-template-trim]] (sister item)
