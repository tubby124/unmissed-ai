-- Add embedding column for zero-result queries (gaps) to enable auto-cascade resolution.
-- When a gap is answered, semantically similar gaps are auto-resolved via pgvector.

ALTER TABLE knowledge_query_log
  ADD COLUMN IF NOT EXISTS query_embedding vector(1536);

-- Partial index — only index unresolved zero-result rows (gaps)
CREATE INDEX IF NOT EXISTS kql_gap_embedding_idx
  ON knowledge_query_log
  USING hnsw (query_embedding vector_cosine_ops)
  WHERE result_count = 0 AND resolved_at IS NULL AND query_embedding IS NOT NULL;

-- Function: find and auto-resolve semantically similar unresolved gaps.
-- Called after a gap is manually resolved. Uses pgvector cosine distance.
CREATE OR REPLACE FUNCTION auto_resolve_similar_gaps(
  p_client_id uuid,
  p_query_embedding vector(1536),
  p_source_query text,
  p_similarity_threshold float DEFAULT 0.80,
  p_max_resolve int DEFAULT 50
)
RETURNS TABLE(resolved_count int, resolved_queries text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resolved_count int := 0;
  v_resolved_queries text[] := '{}';
BEGIN
  WITH similar_gaps AS (
    SELECT id, query_text,
           1 - (query_embedding <=> p_query_embedding) AS similarity
    FROM knowledge_query_log
    WHERE client_id = p_client_id
      AND result_count = 0
      AND resolved_at IS NULL
      AND query_embedding IS NOT NULL
      AND lower(trim(query_text)) != lower(trim(p_source_query))
      AND 1 - (query_embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY similarity DESC
    LIMIT p_max_resolve
  ),
  resolved AS (
    UPDATE knowledge_query_log kql
    SET resolved_at = now(),
        resolution_type = 'auto_cascade'
    FROM similar_gaps sg
    WHERE kql.id = sg.id
    RETURNING kql.query_text
  )
  SELECT count(*)::int, array_agg(DISTINCT query_text)
  INTO v_resolved_count, v_resolved_queries
  FROM resolved;

  RETURN QUERY SELECT v_resolved_count, COALESCE(v_resolved_queries, '{}');
END;
$$;
