# Knowledge Three-Store Consolidation Plan

**Created:** 2026-03-30
**Source:** Code inspection of `src/lib/embeddings.ts`, `src/lib/agent-context.ts`, `src/lib/seed-knowledge.ts`, `src/lib/knowledge-summary.ts`, `src/lib/knowledge-retrieval.ts`, `src/app/api/dashboard/settings/route.ts`, `src/app/api/webhook/[slug]/inbound/route.ts`
**Purpose:** Architecture plan for converging three knowledge stores into a single runtime truth.

---

## 1. Current State

### 1.1 The Three Stores

```
┌─────────────────────────────────────────────────────────────────┐
│ STORE 1: clients.business_facts (JSONB / text)                  │
│   Type:    free-text string or string[] in the clients row      │
│   Written: settings PATCH, provision/trial, scrape approval     │
│   Read:    buildKnowledgeSummary() → ctx.knowledge.block        │
│            reseedKnowledgeFromSettings() (write path to Store 3)│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STORE 2: clients.extra_qa (JSONB array)                         │
│   Type:    [{ q: string, a: string }]                           │
│   Written: settings PATCH, provision/trial, scrape approval     │
│   Read:    buildKnowledgeSummary() → ctx.knowledge.block        │
│            reseedKnowledgeFromSettings() (write path to Store 3)│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STORE 3: knowledge_chunks (pgvector table)                      │
│   Type:    embedded text chunks with source, kind, trust_tier   │
│   Written: reseedKnowledgeFromSettings() [source='settings_edit']│
│            seedKnowledgeFromScrape() [source='website_scrape']  │
│            seedKnowledgeFromGBP() [source='gbp']                │
│            embedChunks() from AI compiler [source='compiled_import']│
│            PDF upload pipeline [source='document']              │
│   Read:    queryKnowledge tool at call time (pgvector search)   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 knowledge_chunks Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `client_id` | uuid | FK to clients |
| `content` | text | The embedded text |
| `content_hash` | text | Dedup key (nullable — populated by trigger or caller) |
| `chunk_type` | text | `fact`, `qa`, `page_content`, `manual`, `niche_template`, `call_learning`, `document` |
| `source` | text | `website_scrape`, `settings_edit`, `gbp`, `compiled_import`, `manual_entry`, etc. |
| `source_run_id` | text | Run ID for dedup / provenance |
| `source_url` | text | Optional — per-URL cleanup for scraped chunks |
| `compile_run_id` | uuid | FK to `compiler_runs` — present for AI compiler chunks |
| `metadata` | jsonb | Arbitrary extra data |
| `embedding` | vector | 1536-dim OpenAI text-embedding-3-small |
| `fts` | tsvector | Full-text search column (auto-generated) |
| `status` | text | `'approved'` (default) — only `approved` chunks are queried |
| `trust_tier` | text | `'high'` (settings_edit), `'medium'` (website_scrape, gbp), `'low'` (compiled_import) |
| `hit_count` | int | Incremented when chunk is returned in a query result |
| `last_hit_at` | timestamp | Last time this chunk was served to an agent |
| `created_at`, `updated_at` | timestamps | Standard |

### 1.3 Write Paths (all stores)

```
User edits Facts card or FAQ card in dashboard
  → PATCH /api/dashboard/settings
      [1] Write updates.business_facts / updates.extra_qa to clients row
      [2] IF knowledge_backend='pgvector':
            reseedKnowledgeFromSettings(clientId, business_facts, extra_qa)
              → deleteClientChunks(clientId, 'settings_edit')
              → embedChunks(clientId, fact/qa chunks, status='approved', trust_tier='high')
                                       ↑ awaited, not fire-and-forget
          ELSE: reseed is SKIPPED — Store 3 is not updated

User approves website scrape during onboarding
  → seedKnowledgeFromScrape()
      → deleteClientChunks(clientId, 'website_scrape')
      → embedChunks(clientId, scrape chunks, source='website_scrape')
      → syncClientTools() — registers queryKnowledge tool

User uploads PDF
  → embedChunks(clientId, document chunks, source='document')

AI compiler apply
  → embedChunks(clientId, compiled chunks, source='compiled_import', compile_run_id=...)
  → syncClientTools()

GBP data ingest
  → seedKnowledgeFromGBP()
      → deleteClientChunks(clientId, 'gbp')
      → embedChunks(clientId, gbp chunks, source='gbp', trust_tier='medium')
      → syncClientTools()
```

### 1.4 Read Paths at Call Time

```
Inbound webhook: POST /api/webhook/[slug]/inbound
  → SELECT clients row (includes business_facts, extra_qa, knowledge_backend)
  → buildAgentContext(clientRow, ...)
      → buildKnowledgeSummary(business)          ← reads Store 1 + Store 2 directly
          → extractFactsFromText(business_facts)
          → extractFactsFromQa(extra_qa)
          → top 15 facts, max 1200 chars → knowledge.block
      → buildRetrievalConfig(capabilities, knowledge, corpusAvailable, knowledgeBackend)
          → if knowledge_backend='pgvector': retrieval.enabled=true
  → knowledgeBlockStr = ctx.knowledge.block      ← Store 1 + 2 derived, NO Store 3
  → if retrieval.enabled: append retrieval instruction (points to queryKnowledge tool)
  → inject knowledgeBlockStr into templateContext.businessFacts

At query time (agent calls queryKnowledge tool):
  → POST /api/knowledge/[slug]/query
      → hybrid_match_knowledge() pgvector search   ← reads Store 3 only
      → returns top-k approved chunks
```

**Key insight:** At call time, `knowledge.block` is built exclusively from Stores 1 and 2 (the raw JSON columns). Store 3 is never read at call creation — it is only queried on-demand when the agent invokes `queryKnowledge`. This means the inline knowledge the agent has without a tool call is always the JSON columns, regardless of what is in `knowledge_chunks`.

---

## 2. The Problem: When the Stores Diverge

### 2.1 Divergence Conditions

| Condition | Store 1/2 state | Store 3 state | User-visible symptom |
|-----------|----------------|---------------|----------------------|
| Client has `knowledge_backend=NULL` or `knowledge_backend='ultravox'` | Current | Never seeded from settings edits | Agent answers from JSON facts only; `queryKnowledge` tool is not registered; Store 3 may be empty or stale from onboarding scrape |
| Client edits facts while `knowledge_backend='pgvector'` but embedding API is down | Updated | Stale (reseed failed silently) | Agent's inline summary reflects new facts; agent's search results reflect old facts. Inconsistent answers depending on whether the agent calls the tool |
| Client is migrated from NULL → pgvector but `reseedKnowledgeFromSettings()` is not explicitly triggered | Current | Not yet populated with settings_edit chunks | `queryKnowledge` may return 0 results for facts the agent already has inline |
| Two parallel settings saves race (unlikely, but possible) | Last-write-wins | Race between two reseed calls; second deleteClientChunks wipes chunks the first just embedded | Transient: chunks disappear between delete and re-embed for ~100ms |
| `reseedKnowledgeFromSettings()` partial failure (`stored=N, failed=M`) | Updated | Partially seeded | Some facts are searchable; others are not. No UI visibility of partial failure |
| Scrape approval writes Store 3 but does not write Store 1/2 (the approved `approvedPackage` path) | May be stale if not also written to clients row | Current | `buildKnowledgeSummary()` shows stale JSON; agent's inline context is wrong even though search works |
| AI compiler `apply` writes compiled_import chunks to Store 3 | Unchanged | Updated | Compiler-derived facts are searchable via tool but NOT in the inline summary |

### 2.2 The Most Common Failure Path (Current)

For the four active Railway clients, `knowledge_backend` is either NULL or 'pgvector'. For those on NULL:

1. Facts and Q&A are edited in the dashboard → saved to `clients.business_facts` / `clients.extra_qa`.
2. Reseed is **gated** on `knowledge_backend='pgvector'` — so Store 3 is never touched.
3. The agent's inline knowledge summary (from `buildKnowledgeSummary`) reflects the new data correctly.
4. But if the client is later migrated to pgvector, Store 3 is empty for settings_edit — the reseed is only triggered by the next settings save that touches `business_facts` or `extra_qa`.

For clients on `knowledge_backend='pgvector'`:

1. Facts are edited → reseed fires → embedding API call is awaited synchronously in the PATCH handler.
2. If the embedding API is slow (>10s), the PATCH response is delayed. If it times out, the try/catch swallows the error silently and `knowledgeReseeded` stays false.
3. No retry mechanism. No user-visible indication that the reseed failed.

### 2.3 The Structural Tension

`buildKnowledgeSummary()` in `knowledge-summary.ts` is a pure function that reads only from the DB JSON columns. It has no awareness of Store 3. This is correct by design for the non-pgvector path, but creates a permanent dual-truth problem for the pgvector path:

- The agent's **inline knowledge** (always injected, 15-fact cap) comes from Stores 1+2.
- The agent's **searchable knowledge** (on-demand, unlimited depth) comes from Store 3.
- If Stores 1+2 and Store 3 diverge, the agent's answers will depend on whether it chose to call `queryKnowledge` or answer from inline context — and those answers may contradict each other.

---

## 3. Target State

### 3.1 Single Source of Truth Architecture

The target: `knowledge_chunks` with `status='approved'` is the authoritative runtime truth. The JSON columns (`business_facts`, `extra_qa`) become write-through caches kept for:

- The non-pgvector fallback path (clients not yet on pgvector use them directly)
- The prompt character budget estimate (counting facts before embedding)
- Rollback surface (if pgvector is disabled, the JSON still has the data)

```
TARGET ARCHITECTURE:

Stores 1+2 (JSON columns)
   ↓ write-through on every edit (already true)
   ↓ trigger reseed regardless of knowledge_backend
   ↓
Store 3 (knowledge_chunks, source='settings_edit')
   ↓ status='approved', trust_tier='high'
   ↓
SINGLE READ PATH at call time:
   IF knowledge_backend='pgvector':
     buildKnowledgeSummary() reads from knowledge_chunks WHERE source='settings_edit'
       — not from raw JSON columns
   ELSE (fallback):
     buildKnowledgeSummary() reads from JSON columns as today
```

### 3.2 Write-Through Rules (target)

| Write event | Stores 1+2 | Store 3 | Notes |
|-------------|-----------|---------|-------|
| Facts/FAQ dashboard edit | YES (always) | YES (always, not gated on pgvector) | Phase 1 change |
| Scrape approval | YES (written to clients row via approvedPackage path) | YES (website_scrape) | Verify scrape approval writes back to clients row |
| AI compiler apply | NO (compiler does not write JSON columns) | YES (compiled_import) | Phase 3: surface compiled facts to inline summary |
| PDF upload | NO | YES (document) | No change needed |
| GBP ingest | NO | YES (gbp) | No change needed |
| knowledge_backend change NULL → pgvector | YES (unchanged) | Trigger backfill of settings_edit chunks from existing JSON | Phase 2 |

### 3.3 Read Path at Call Time (target for pgvector clients)

```
Phase 3 target:

buildKnowledgeSummary(business, knowledgeChunks)
  IF pgvector backend:
    → SELECT content FROM knowledge_chunks
        WHERE client_id=X AND status='approved' AND source IN ('settings_edit')
        ORDER BY trust_tier DESC, updated_at DESC
        LIMIT 15
    → Build block from chunk content
  ELSE:
    → extractFactsFromText(business.businessFacts)  [current behavior unchanged]
    → extractFactsFromQa(business.extraQa)          [current behavior unchanged]
```

This makes `buildKnowledgeSummary()` no longer a pure function — it requires a DB read. That is acceptable because the inbound webhook already does multiple DB reads. The function signature must change to accept pre-fetched chunks (or become async with its own DB call).

---

## 4. Migration Path

### Phase 1 — Reliable Reseed on Every Settings Edit

**Goal:** Remove the `knowledge_backend='pgvector'` gate from the reseed trigger. Ensure `settings_edit` chunks are always current regardless of backend.

**Problem being fixed:** Facts edited while `knowledge_backend` is NULL are never seeded into Store 3. When the client later enables pgvector, their settings-derived facts are missing from the vector store.

**File:** `src/app/api/dashboard/settings/route.ts`, lines 210–229.

**Change:** Remove the `if (freshClient?.knowledge_backend === 'pgvector')` guard. Always call `reseedKnowledgeFromSettings()` when `business_facts` or `extra_qa` changes.

**Risk:** Clients on NULL backend will now embed their facts to Store 3 even though `queryKnowledge` tool is not registered. This is benign — the chunks exist but are never queried. The cost is a small number of embedding API calls per settings save for clients not on pgvector.

**Verification:** After a settings save on a NULL-backend client, confirm rows appear in `knowledge_chunks` with `source='settings_edit'`. Confirm no change to call behavior.

**Rollback:** Re-add the `knowledge_backend='pgvector'` gate.

---

### Phase 2 — Backfill on Backend Switch (NULL → pgvector)

**Goal:** When a client's `knowledge_backend` is changed to `'pgvector'`, immediately seed their existing `business_facts` and `extra_qa` into Store 3.

**Problem being fixed:** Current code does not trigger a reseed when `knowledge_backend` changes. A client manually switched to pgvector by an admin will have no `settings_edit` chunks until their next facts edit.

**File:** `src/app/api/dashboard/settings/route.ts`, in the `needsAgentSync` / `updates` processing block.

**Change:** In the `if ('knowledge_backend' in updates)` path (or when constructing the agentSync block), detect when `knowledge_backend` is being set to `'pgvector'` and fire `reseedKnowledgeFromSettings()` with the current `business_facts` and `extra_qa` from the fresh DB read.

**Also needed:** An admin-callable backfill endpoint (or a one-time migration script) to seed `settings_edit` chunks for all existing clients that already have `knowledge_backend='pgvector'` but whose last facts edit predates Phase 1. The SQL check is:

```sql
SELECT c.id, c.slug, c.knowledge_backend,
       COUNT(kc.id) FILTER (WHERE kc.source = 'settings_edit') AS settings_edit_chunk_count
FROM clients c
LEFT JOIN knowledge_chunks kc ON kc.client_id = c.id AND kc.status = 'approved'
WHERE c.knowledge_backend = 'pgvector'
GROUP BY c.id, c.slug, c.knowledge_backend
HAVING COUNT(kc.id) FILTER (WHERE kc.source = 'settings_edit') = 0
   AND (c.business_facts IS NOT NULL OR c.extra_qa IS NOT NULL);
```

Any row returned by this query needs a one-time `reseedKnowledgeFromSettings()` call.

**Rollback:** No change to data model. If the backfill produced bad chunks, `deleteClientChunks(clientId, 'settings_edit')` removes them cleanly.

---

### Phase 3 — `buildKnowledgeSummary()` Reads from Store 3 for pgvector Clients

**Goal:** For pgvector clients, the agent's inline 15-fact summary is built from `knowledge_chunks` (Store 3), not from the raw JSON columns. This makes Stores 1+2 irrelevant to runtime behavior for pgvector clients.

**Problem being fixed:** AI-compiler-derived facts and GBP facts are in Store 3 but are never included in the inline summary. A client who runs the AI compiler to extract 20 facts has those facts searchable but not summarized — the inline summary still reflects only the JSON column facts.

**Files requiring changes:**

| File | Change |
|------|--------|
| `src/lib/knowledge-summary.ts` | Add overload: `buildKnowledgeSummary(business, approvedChunks?)`. If `approvedChunks` is passed, use them instead of reading `business.businessFacts` / `business.extraQa`. |
| `src/lib/agent-context.ts` | `buildAgentContext()` currently pure. Either: (a) keep pure and pass pre-fetched chunks as a new parameter, or (b) accept pre-fetched chunk content as part of `ClientRow`. Option (a) is cleaner. |
| `src/app/api/webhook/[slug]/inbound/route.ts` | If `knowledge_backend='pgvector'`, fetch `SELECT content FROM knowledge_chunks WHERE client_id=X AND source IN ('settings_edit','compiled_import','gbp') AND status='approved' ORDER BY trust_tier DESC, updated_at DESC LIMIT 30` before calling `buildAgentContext()`. Pass result as `approvedChunks`. |
| `src/app/api/webhook/[slug]/transfer-status/route.ts` | Same change as inbound route. |
| `src/app/api/webhook/demo/inbound/route.ts` | Same if demo clients use pgvector. |
| `src/app/api/dashboard/agent-test/route.ts` | Same for dashboard test calls. |
| `src/app/api/dashboard/browser-test-call/route.ts` | Same for browser test calls. |

**Data contract for chunk-derived summary:**

When building from chunks, the summary should include only chunks whose `source` is one of: `settings_edit`, `compiled_import`, `gbp`. It should NOT include `website_scrape` chunks in the inline summary — those are better served via `queryKnowledge` because they can be long-form. The distinction:

| Source | In inline summary | In queryKnowledge search |
|--------|-----------------|------------------------|
| `settings_edit` | YES | YES |
| `compiled_import` | YES | YES |
| `gbp` | YES | YES |
| `website_scrape` | NO (too long) | YES |
| `document` | NO (too long) | YES |

**Rendering:** Chunks of `chunk_type='fact'` render as bullet lines. Chunks of `chunk_type='qa'` render as `Q: ... → A: ...`. This matches the current `buildKnowledgeSummary()` output format exactly.

**Backward compatibility:** When `approvedChunks` is not passed (all non-pgvector call paths), `buildKnowledgeSummary()` falls back to the current JSON-column behavior. No change for non-pgvector clients.

**Non-blocking call path concern:** Adding a DB read to the inbound webhook adds latency before call creation. Mitigation: this SELECT is a simple indexed query on `client_id + status + source`. At ~5-30 chunks per client, it should complete in <5ms. It can be run in parallel with other webhook reads (prior calls, VIP roster) using `Promise.all()`.

---

### Phase 4 — Deprecate Direct JSON Reads at Call Time

**Goal:** Once all active clients are on pgvector and Phase 3 is stable, remove the JSON fallback from `buildKnowledgeSummary()`. `business_facts` and `extra_qa` become write-only caches for non-pgvector clients and for rollback/export.

**Preconditions:**
- All production clients have `knowledge_backend='pgvector'`.
- Phase 1 has been running for at least one full billing cycle (all settings edits seeded).
- Phase 3 is stable with no complaints about inline summary content.

**Files requiring changes:**

| File | Change |
|------|--------|
| `src/lib/knowledge-summary.ts` | Remove `extractFactsFromText`/`extractFactsFromQa` from the main `buildKnowledgeSummary()` call path. Keep these functions as utilities for other consumers (e.g. admin scripts). |
| `src/lib/agent-context.ts` | Remove `businessFacts` and `extraQa` from `AssembledContextBlocks` (they are already empty strings in Phase 3 for pgvector clients). |
| Inbound + all call routes | Remove JSON column fallback. Only the chunk-based path remains. |

**Deferral condition:** If any client will not migrate to pgvector (e.g. a client with an active `knowledge_backend='ultravox'` setup), this phase must be deferred until that client is migrated or deprovisioned. Never remove the fallback while a non-pgvector client exists in production.

---

## 5. Risks and Rollback

### Risk 1: Phase 1 reseed fires for NULL-backend clients and slows settings saves

**Likelihood:** Low. `reseedKnowledgeFromSettings()` is awaited synchronously in the PATCH handler (not fire-and-forget). For clients with many facts (>20 lines), embedding can take 500ms–2s.

**Mitigation:** Move the reseed to a fire-and-forget async block (same pattern as the scrape pipeline). Accept that Store 3 may lag Store 1/2 by a few seconds. Since Store 3 is not read at call time until Phase 3, there is no user-visible impact for NULL-backend clients.

**Rollback:** Re-add the `knowledge_backend='pgvector'` gate to the reseed trigger.

---

### Risk 2: Phase 2 backfill produces duplicate chunks for clients already on pgvector

**Likelihood:** Low but present. `embedChunks()` uses an upsert on `(client_id, content_hash, chunk_type, source)`. If `content_hash` is NULL for existing rows (it is nullable per the schema), the upsert constraint cannot deduplicate — new rows are inserted alongside old ones.

**Mitigation:** Before running the backfill, verify that `content_hash` is populated for all existing `settings_edit` chunks. If not, delete all `settings_edit` chunks and re-embed from scratch. The delete-then-embed pattern is already used by `reseedKnowledgeFromSettings()` (deletes all `settings_edit` then re-embeds), so the Phase 2 backfill is simply calling that same function for eligible clients.

**Rollback:** `DELETE FROM knowledge_chunks WHERE source='settings_edit' AND client_id=X` for any affected client. The next settings save will regenerate.

---

### Risk 3: Phase 3 DB read adds latency to the inbound webhook

**Likelihood:** Present, but manageable. The inbound webhook already does 3–4 DB reads before call creation. Adding one more SELECT on an indexed table is low risk.

**Mitigation:** Run in parallel with the prior-calls SELECT and VIP roster SELECT using `Promise.all()`. Add a 5-second timeout via `AbortSignal.timeout()` (consistent with the project's timeout rules). If it times out, fall back to the JSON-column path.

**Rollback:** Gate the chunk fetch behind `knowledge_backend === 'pgvector'` (it already is). Remove the chunk fetch to revert to JSON-only inline summary.

---

### Risk 4: Phase 3 silently drops facts if Store 3 is empty for a pgvector client

**Likelihood:** Medium, particularly immediately after Phase 3 is deployed if Phase 1/2 backfill has not run.

**Symptom:** Agent's inline summary says `## Key Business Facts` with no bullets, even though `clients.business_facts` is populated.

**Mitigation:** Add a fallback in Phase 3: if the chunk query returns 0 rows for a pgvector client, fall back to the JSON-column path and log a warning. This makes Phase 3 safe to deploy before Phase 2 backfill is complete.

```typescript
// Proposed guard in buildKnowledgeSummary with chunk path:
if (approvedChunks.length === 0 && business.businessFacts) {
  console.warn(`[knowledge-summary] No approved chunks for pgvector client ${business.clientId} — falling back to JSON columns`)
  // fall back to current JSON path
}
```

---

### Risk 5: Race between settings save and concurrent call (Phase 3)

**Likelihood:** Low but theoretically possible. A settings save deletes `settings_edit` chunks, then re-embeds. A concurrent inbound call in the ~100ms window between delete and re-embed will see zero `settings_edit` chunks.

**Mitigation:** Phase 3's fallback guard (Risk 4 mitigation) handles this: if chunks are 0 and JSON columns are non-empty, fall back to JSON. This is already the safe behavior.

**Long-term mitigation:** Use a `INSERT ... ON CONFLICT DO UPDATE` pattern that never deletes before inserting (replace delete+insert with upsert). Requires `content_hash` to be reliably populated for all chunks.

---

## 6. Scope Estimate

### Files by Phase

**Phase 1 (remove reseed gate):**

| File | Change size |
|------|------------|
| `src/app/api/dashboard/settings/route.ts` | 3-line change (remove the `knowledge_backend='pgvector'` if-guard) |

Effort: 30 minutes including testing. Low risk.

---

**Phase 2 (backfill on backend switch + migration script):**

| File | Change size |
|------|------------|
| `src/app/api/dashboard/settings/route.ts` | ~10 lines: detect `knowledge_backend` change to pgvector, fire reseed |
| New admin script or admin API endpoint | ~50 lines: iterate eligible clients, call `reseedKnowledgeFromSettings()` for each |

Effort: 2–3 hours including the backfill run and verification SQL. Medium risk (do not run during peak call hours).

---

**Phase 3 (chunk-based inline summary):**

| File | Change size |
|------|------------|
| `src/lib/knowledge-summary.ts` | ~30 lines: add `approvedChunks` parameter, alternate build path |
| `src/lib/agent-context.ts` | ~10 lines: accept and pass `approvedChunks` to `buildKnowledgeSummary()` |
| `src/app/api/webhook/[slug]/inbound/route.ts` | ~20 lines: chunk SELECT, `Promise.all()`, pass to `buildAgentContext()` |
| `src/app/api/webhook/[slug]/transfer-status/route.ts` | ~20 lines: same as inbound |
| `src/app/api/webhook/demo/inbound/route.ts` | ~20 lines: same pattern |
| `src/app/api/dashboard/agent-test/route.ts` | ~20 lines: same pattern |
| `src/app/api/dashboard/browser-test-call/route.ts` | ~20 lines: same pattern |

Effort: 1–2 days including tests. Medium-high risk — touches all call creation paths. Requires regression testing with at least one live pgvector client before deploying.

---

**Phase 4 (deprecate JSON read path):**

| File | Change size |
|------|------------|
| `src/lib/knowledge-summary.ts` | Remove JSON fallback path |
| `src/lib/agent-context.ts` | Remove JSON-derived fields from `AssembledContextBlocks` if unused |

Effort: 2–3 hours. Only execute when all production clients are on pgvector and Phase 3 has been stable for 2+ weeks.

---

### Summary Table

| Phase | Goal | Files touched | Effort | Risk |
|-------|------|--------------|--------|------|
| 1 | Reseed always on facts/FAQ edit | 1 file | 30 min | Low |
| 2 | Backfill existing pgvector clients + backend-switch trigger | 2 files + 1 script | 2–3 hours | Medium |
| 3 | Inline summary reads from Store 3 for pgvector clients | 7 files | 1–2 days | Medium-high |
| 4 | Retire JSON read path | 2 files | 2–3 hours | Low (gated on full pgvector rollout) |

---

## 7. Non-Goals

The following are explicitly out of scope for this consolidation:

- **Changing the AI compiler pipeline.** `compiled_import` chunks flow correctly into Store 3 today. Phase 3 surfaces them to the inline summary — that is the only change.
- **Changing the `queryKnowledge` tool or the vector search function.** `hybrid_match_knowledge()` and the knowledge query route are not touched in any phase.
- **Migrating existing clients to pgvector.** This plan assumes clients migrate to pgvector through the existing admin path. The consolidation phases work correctly regardless of the migration schedule.
- **Removing `business_facts` and `extra_qa` columns from the DB.** These columns stay as write-through caches and rollback surfaces indefinitely. They are also used by the AI compiler's upstream diff logic.
- **Changing the prompt patching system.** `patchCalendarBlock()`, `patchAgentName()`, etc. are orthogonal to knowledge storage.
