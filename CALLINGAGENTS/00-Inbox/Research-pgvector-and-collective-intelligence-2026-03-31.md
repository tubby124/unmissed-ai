---
type: research
tags: [research, pgvector, knowledge, collective-intelligence, sonar]
date: 2026-03-31
source: Perplexity Sonar Pro via OpenRouter (4 queries)
status: logged
---

# Research — pgvector Optimization + Collective Niche Intelligence

## Query 1: pgvector Performance Tuning

### Recommended Config for Our Scale (100-10K rows per client)
- **Index type: HNSW** (not IVFFlat) — 1.5ms vs 2.4ms query latency, higher recall
- **Settings:** `m=16, ef_construction=64, ef_search=40` → sub-10ms retrieval
- **Hybrid search:** YES — BM25 + vector is better than pure vector for FAQ/fact data. Exact keyword matches matter for voice agents. We already have `hybrid_match_knowledge()`.
- **Chunk size:** 256-512 tokens optimal for FAQ/fact data. Smaller (128-256) for precise FAQ matching.
- **Supabase-specific:** Upgrade to pgvector 0.5+, use 2XL+ compute, parallel HNSW builds, `SET hnsw.ef_search=40`

### Action Items
- [ ] Check current pgvector version on Supabase project `qwhvblomlgeapzhnuwlb`
- [ ] Add HNSW index on `knowledge_chunks.embedding` if not already present
- [ ] Verify hybrid_match_knowledge() uses BM25 + vector (it does)
- [ ] Audit chunk sizes — are we exceeding 512 tokens?

## Query 2: AI Knowledge Compiler Optimization

### Key Findings
- **Haiku 4.5 is adequate** for extraction but schema-constrained generation (JSON output schemas) improves reliability
- **Format for voice:** Short spoken answers under 20 words + expandable detail bullets
- **Recommended schema per extracted item:**
  ```json
  { "short_spoken": "one sentence fact", "details": ["bullet1", "bullet2"], "confidence": 0.95 }
  ```
- **Deduplication:** Embed chunks, cluster by cosine similarity > 0.9, merge duplicates via LLM reconciliation
- **Conflict detection:** Programmatic checks (range/logic rules) + flag conflicts for human adjudication with provenance

### Action Items for D298 (Compiler as Universal Gateway)
- [ ] Add JSON schema constraint to compiler extraction call
- [ ] Add `short_spoken` field to knowledge_chunks (GLM-4.6 formatted answer)
- [ ] Add dedup pass: cosine similarity > 0.9 against existing chunks before insert
- [ ] Add conflict detection: flag when new chunk contradicts existing approved chunk

## Query 3: Cross-Client Collective Learning ⭐

### Validated Patterns
- **Centralized model training:** Shared AI model ingests anonymized aggregates → improved defaults
- **Federated/collective learning:** Tenants contribute metadata without raw data transfer
- **Usage-based loops:** Cross-client metadata for ongoing model refinement
- **Privacy model:** Strip identifiers → pool stats per niche → feed templates. Per-tenant encryption + audit logs.

### Our Implementation Path (D299)
1. `knowledge_query_log` already tracks every caller question per niche — AGGREGATE this
2. `call_insights` already tracks outcomes — AGGREGATE per niche
3. Weekly cron: compute `niche_intelligence` table from anonymized aggregates
4. `buildNicheFaqDefaults()` reads from niche_intelligence when sufficient data (3+ clients, 100+ calls)
5. Onboarding shows: "Based on 15 dental offices on our platform"

### Privacy Guarantee
- Only aggregate STATS cross-tenant (question frequency, answer hit rates, triage conversion)
- NEVER share raw knowledge_chunks, call transcripts, or caller data
- Each client's data isolated by RLS (`client_id` on every table)
- Niche intelligence computed from counts and percentages only

## Query 4: Re-Ranking and Embedding Quality

### Re-Ranking Verdict: SKIP for foreground, consider background
- Adds 50-150ms per query — too slow for real-time voice (<200ms budget)
- Our hybrid search (BM25 + vector) at our scale is sufficient
- If needed later: background pre-fetching + caching pattern (VoiceAgentRAG)

### Embedding Model: text-embedding-3-small is still correct
- Remains strong for FAQ/fact retrieval
- No clear 2025-2026 successor for our use case
- If latency exceeds 50ms, consider text-embedding-3-large (more accurate, slower)

### "No Good Match" Handling
- Set cosine similarity threshold at 0.7-0.8
- Below threshold: "I don't have that info, but I'll have {{CLOSE_PERSON}} call you back"
- Monitor with retrieval observability for threshold tuning
- Current: we return top 3 results regardless of score — should add threshold check

### Action Items
- [ ] Add similarity threshold (0.75) to hybrid_match_knowledge() — don't return low-confidence matches
- [ ] Log retrieval scores to knowledge_query_log for threshold tuning
- [ ] Skip re-ranking for now — hybrid search is sufficient at our scale

---

## Summary: What to Do Now vs Later

### Do Now (Phase 3 adjacent)
- Verify HNSW index exists on knowledge_chunks.embedding
- Add similarity threshold to hybrid_match_knowledge()

### Do in Phase 5-6
- Knowledge compiler schema constraint (D298)
- Per-item editing/archiving (D290)
- Dedup pass in compiler (D298)

### Do Post-6
- Collective niche intelligence aggregation (D299)
- Background re-ranking if scale demands it
- `short_spoken` field on knowledge_chunks