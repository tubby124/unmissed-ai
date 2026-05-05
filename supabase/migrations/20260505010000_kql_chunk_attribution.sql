-- D-NEW-tool-invocation-log — chunk attribution for knowledge_query_log + D270 aggregation views
-- 2026-05-05

-- 1. Add matched_chunk_ids array column to knowledge_query_log
ALTER TABLE public.knowledge_query_log
  ADD COLUMN IF NOT EXISTS matched_chunk_ids uuid[] DEFAULT NULL;

-- 2. GIN index — enables "find all queries that matched chunk X"
CREATE INDEX IF NOT EXISTS knowledge_query_log_chunk_ids_gin_idx
  ON public.knowledge_query_log USING gin (matched_chunk_ids);

-- 3. Topic aggregation view — base surface for D270 + general query analytics
CREATE OR REPLACE VIEW public.knowledge_query_topic_aggregate AS
SELECT
  kql.client_id,
  kql.query_text,
  COUNT(*)                                                          AS hits_total,
  COUNT(*) FILTER (WHERE kql.created_at > now() - interval '7 days')  AS hits_last_7d,
  COUNT(*) FILTER (WHERE kql.created_at > now() - interval '30 days') AS hits_last_30d,
  COUNT(*) FILTER (WHERE kql.result_count = 0)                       AS empty_count,
  COUNT(*) FILTER (WHERE kql.result_count > 0)                       AS hit_count,
  AVG(kql.top_similarity) FILTER (WHERE kql.result_count > 0)        AS avg_top_similarity,
  MAX(kql.created_at)                                                AS last_queried_at,
  MIN(kql.created_at)                                                AS first_queried_at,
  (
    SELECT array_agg(DISTINCT chunk_id)
    FROM public.knowledge_query_log kql2,
         LATERAL unnest(kql2.matched_chunk_ids) AS chunk_id
    WHERE kql2.client_id = kql.client_id
      AND kql2.query_text = kql.query_text
      AND kql2.matched_chunk_ids IS NOT NULL
      AND kql2.created_at > now() - interval '90 days'
  ) AS distinct_matched_chunk_ids
FROM public.knowledge_query_log kql
WHERE kql.created_at > now() - interval '90 days'
GROUP BY kql.client_id, kql.query_text;

COMMENT ON VIEW public.knowledge_query_topic_aggregate IS
  '90-day rolling rollup of knowledge_query_log by client_id + query_text. Source surface for D270 promotion logic and general query analytics. Inherits RLS from knowledge_query_log.';

-- 4. Promotion candidate view — D270 input
CREATE OR REPLACE VIEW public.knowledge_promotion_candidates AS
SELECT
  client_id,
  query_text,
  hits_last_7d,
  hits_last_30d,
  empty_count,
  hit_count,
  avg_top_similarity,
  last_queried_at,
  distinct_matched_chunk_ids
FROM public.knowledge_query_topic_aggregate
WHERE hits_last_7d >= 5 OR hits_last_30d >= 20
ORDER BY hits_last_7d DESC NULLS LAST, hits_last_30d DESC NULLS LAST;

COMMENT ON VIEW public.knowledge_promotion_candidates IS
  'Queries that meet D270 promotion thresholds (5+ in 7d OR 20+ in 30d). Surfaces FAQ candidates for the prompt faq_pairs slot.';
