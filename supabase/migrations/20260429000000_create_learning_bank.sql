-- Learning Bank — promoted patterns library + raw call observations + application audit
-- Why: cross-niche prompt lessons need a structured home so we can promote, retire, score,
--      and track which prompts received which patterns + the metric impact.
-- Plan: niche-analyst report (2026-04-29). Companion: 20260429010000_create_call_transcripts.sql
--       and seed file 20260429020000_seed_prompt_patterns.sql.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- prompt_patterns: promoted reusable lessons library
-- ----------------------------------------------------------------------------
create table if not exists public.prompt_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'voice_naturalness','hangup','ai_disclosure','edge_case',
    'qualification','close','formatting','prompt_injection','identity','triage'
  )),
  verbatim_line text,
  -- ^ exact prompt line to inject (when applicable). Null for behavioral rules
  --   without a single canonical line.
  rationale text,
  source_slug text,
  -- ^ slug of the client whose prompt the pattern was first observed in.
  source_call_id uuid references public.call_logs(id) on delete set null,
  niche_applicability text[] not null default '{all}',
  -- ^ '{all}' = applies to every niche. Otherwise a list like '{auto_glass,property_mgmt}'.
  status text not null default 'candidate' check (status in ('candidate','promoted','retired')),
  score int default 0 check (score between 0 and 10),
  -- ^ 0-10 cross-niche prevalence/impact score. 8-10 = ship-by-default.
  added_at timestamptz not null default now(),
  promoted_at timestamptz,
  promoted_by uuid,
  notes text
);

create index if not exists prompt_patterns_status_idx on public.prompt_patterns(status);
create index if not exists prompt_patterns_category_idx on public.prompt_patterns(category);
create index if not exists prompt_patterns_niche_idx on public.prompt_patterns using gin(niche_applicability);

comment on table public.prompt_patterns is
  'Library of promoted, reusable prompt lessons. Each row is a candidate or promoted pattern that can be injected into one or more client prompts. niche_applicability=''{all}'' = ships everywhere.';
comment on column public.prompt_patterns.verbatim_line is
  'Exact prompt line to inject when this pattern is applied. Null for behavioral rules without a single canonical line.';
comment on column public.prompt_patterns.score is
  'Cross-niche prevalence/impact score 0-10. Patterns with score >= 8 are ship-by-default for new prompts in matching niches.';
comment on column public.prompt_patterns.niche_applicability is
  'Array of niches this pattern applies to. ''{all}'' means cross-niche (default).';

-- ----------------------------------------------------------------------------
-- prompt_lessons: raw observations from individual calls
-- ----------------------------------------------------------------------------
create table if not exists public.prompt_lessons (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  call_id uuid references public.call_logs(id) on delete set null,
  observation_type text not null check (observation_type in ('failure','success','edge_case','knowledge_gap')),
  what_happened text not null,
  recommended_change text,
  severity text not null default 'low' check (severity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','applied','rejected','promoted')),
  promoted_pattern_id uuid references public.prompt_patterns(id) on delete set null,
  -- ^ once a lesson is promoted into the patterns library, link it back here.
  source text not null default 'manual' check (source in ('manual','call_insights_threshold','knowledge_query_log','call_review')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create index if not exists prompt_lessons_status_idx on public.prompt_lessons(status);
create index if not exists prompt_lessons_client_idx on public.prompt_lessons(client_id);
create index if not exists prompt_lessons_observation_idx on public.prompt_lessons(observation_type);

comment on table public.prompt_lessons is
  'Raw per-call observations that may eventually be promoted into prompt_patterns. Each lesson is scoped to a client/call and has a workflow status (open -> applied/rejected/promoted).';
comment on column public.prompt_lessons.source is
  'How this lesson was generated: manual entry, automated call_insights threshold trigger, knowledge_query_log gap detection, or post-call review.';

-- ----------------------------------------------------------------------------
-- pattern_application_log: track which patterns shipped to which prompts + impact
-- ----------------------------------------------------------------------------
create table if not exists public.pattern_application_log (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.prompt_patterns(id) on delete cascade,
  applied_to_slug text not null,
  applied_to_client_id uuid references public.clients(id) on delete set null,
  applied_at timestamptz not null default now(),
  prompt_version_before int,
  prompt_version_after int,
  before_metrics jsonb,
  -- ^ snapshot of relevant metrics (info_capture_rate, hangup_compliance, etc.) before apply.
  after_metrics jsonb,
  -- ^ same metrics measured after a defined post-apply window.
  rolled_back_at timestamptz,
  notes text
);

create index if not exists pattern_application_log_pattern_idx on public.pattern_application_log(pattern_id);
create index if not exists pattern_application_log_slug_idx on public.pattern_application_log(applied_to_slug);

comment on table public.pattern_application_log is
  'Audit trail of which patterns were applied to which client prompts, including before/after metrics for impact analysis. Used to validate or retire patterns.';

-- ----------------------------------------------------------------------------
-- view: active patterns expanded by niche for fast lookup
-- ----------------------------------------------------------------------------
create or replace view public.v_active_patterns_by_niche as
  select unnest(p.niche_applicability) as niche, p.*
  from public.prompt_patterns p
  where p.status = 'promoted';

comment on view public.v_active_patterns_by_niche is
  'Flattened view of promoted patterns by niche. Each pattern row is repeated once per niche in its niche_applicability array (or once with niche=''all'' for cross-niche patterns).';

-- ----------------------------------------------------------------------------
-- RLS: admin-only writes/reads. No per-client read on these — they are platform truth.
-- ----------------------------------------------------------------------------
alter table public.prompt_patterns enable row level security;
alter table public.prompt_lessons enable row level security;
alter table public.pattern_application_log enable row level security;

create policy "admins_all_prompt_patterns"
  on public.prompt_patterns
  for all
  using (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admins_all_prompt_lessons"
  on public.prompt_lessons
  for all
  using (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admins_all_pattern_application_log"
  on public.pattern_application_log
  for all
  using (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Service role bypasses RLS — server-side ingestion (call_insights threshold,
-- knowledge_query_log gap detection) writes via service role and is unaffected
-- by these admin-only policies.
