-- ─────────────────────────────────────────────────────────────────────────────
-- v_hot_knowledge_queries — Smart-Promotion Telemetry View
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Status: STAGED — NOT YET APPLIED. Hasan sign-off required before `supabase db push`.
-- Created: 2026-06-04
-- Source: 2026-06-04 matrix-test-findings-and-smart-promotion vault note
--
-- Purpose:
--   Aggregate knowledge_query_log entries by client × normalized_query × time bucket
--   so the smart-promotion loop can identify queries hit ≥ N times that are
--   candidates for auto-baking into extra_qa (skip the KB tool on future calls).
--
-- This is a READ-ONLY view. No table changes. No RLS changes. No write paths.
--
-- It is the data-collection foundation for:
--   - SuggestionPromoter (proposes "this query was hit 8 times in 30 days, want to auto-FAQ?")
--   - NicheCompletenessProfile self-tuning (cross-client niche-level patterns)
--   - Dashboard "hot questions this month" surface
--
-- Behavior unchanged in production until something queries this view.
--
-- Read access: same as knowledge_query_log (admin/owner/service per existing RLS).
-- Service-role queries are unaffected (existing pattern).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_hot_knowledge_queries as
with normalized as (
  select
    kql.client_id,
    -- Normalize: lowercase, collapse whitespace, strip trailing punctuation.
    -- Keep simple — fancier normalization (stemming, synonyms) can come later.
    regexp_replace(
      lower(trim(kql.query_text)),
      '[[:space:]]+', ' ', 'g'
    ) as normalized_query,
    kql.created_at,
    -- Schema reality (verified 2026-06-04 against prod):
    --   knowledge_query_log has resolved_at (timestamp, null = unresolved)
    --   and top_similarity (float). No `resolved` bool / `confidence` column.
    (kql.resolved_at is not null) as is_resolved,
    kql.top_similarity as confidence,
    c.niche
  from public.knowledge_query_log kql
  join public.clients c on c.id = kql.client_id
  where kql.created_at >= now() - interval '90 days'
    and kql.query_text is not null
    and length(trim(kql.query_text)) >= 3
)
select
  client_id,
  niche,
  normalized_query,
  count(*) as hit_count_90d,
  count(*) filter (where created_at >= now() - interval '30 days') as hit_count_30d,
  count(*) filter (where created_at >= now() - interval '7 days')  as hit_count_7d,
  count(*) filter (where is_resolved is true) as resolved_count,
  count(*) filter (where is_resolved is false) as unresolved_count,
  -- Resolution rate as a percentage of total hits
  case
    when count(*) = 0 then null
    else round(100.0 * count(*) filter (where is_resolved is true) / count(*), 1)
  end as resolution_rate_pct,
  avg(confidence) as avg_confidence,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from normalized
group by client_id, niche, normalized_query
having count(*) >= 3   -- Filter out one-off queries; ≥3 hits is the floor for "hot"
order by client_id, hit_count_30d desc, hit_count_90d desc;

comment on view public.v_hot_knowledge_queries is 'Per-client x normalized-query rollup of knowledge_query_log for the last 90 days. Used by the smart-promotion loop to identify auto-FAQ candidates. See docs/architecture/niche-completeness-profile.md and the 2026-06-04 matrix-test-findings vault note for usage patterns.';

-- Optional companion view: niche-level aggregation across all clients.
-- Surfaces "all home_renovation agents are getting hit with this question" patterns,
-- which feeds the NicheCompletenessProfile self-tuning loop.
create or replace view public.v_hot_knowledge_queries_by_niche as
select
  niche,
  normalized_query,
  count(distinct client_id) as clients_affected,
  sum(hit_count_30d) as total_hits_30d,
  sum(hit_count_90d) as total_hits_90d,
  avg(resolution_rate_pct) as avg_resolution_rate_pct
from public.v_hot_knowledge_queries
where niche is not null
group by niche, normalized_query
having count(distinct client_id) >= 2  -- Cross-client signal; single-client noise filtered out
   and sum(hit_count_30d) >= 10        -- Niche-level "hot" floor
order by niche, total_hits_30d desc;

comment on view public.v_hot_knowledge_queries_by_niche is 'Cross-client niche-level aggregation of hot KB queries. Floor: >=2 distinct clients affected AND >=10 total hits in last 30 days. Feeds NicheCompletenessProfile auto-propose-topic loop.';
