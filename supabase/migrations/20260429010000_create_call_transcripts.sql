-- call_transcripts — full per-call transcripts pulled from Ultravox
-- Why: call_logs.ai_summary is a compressed Haiku output; for prompt-pattern mining
--      and per-call audit we need the raw turn-by-turn transcript. Storing once on
--      completed_webhook avoids hammering Ultravox's API for every analyst query.
-- Plan: niche-analyst report (2026-04-29). Companion: 20260429000000_create_learning_bank.sql.

create extension if not exists "pgcrypto";

create table if not exists public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_logs(id) on delete cascade,
  ultravox_call_id text not null,
  client_id uuid references public.clients(id) on delete cascade,
  slug text,
  full_transcript jsonb not null,
  -- ^ array of {role, text, timestamp_ms} turns. Stored as jsonb so we can query
  --   for specific phrases / role patterns via jsonb operators.
  turn_count int,
  total_chars int,
  agent_chars int,
  caller_chars int,
  fetched_at timestamptz not null default now(),
  source text default 'completed_webhook' check (source in ('completed_webhook','backfill','manual'))
);

-- One transcript per Ultravox call. Backfills/manual re-fetches must upsert on this key.
create unique index if not exists call_transcripts_ultravox_call_id_uniq
  on public.call_transcripts(ultravox_call_id);

create index if not exists call_transcripts_client_id_idx on public.call_transcripts(client_id);
create index if not exists call_transcripts_slug_idx on public.call_transcripts(slug);

comment on table public.call_transcripts is
  'Full turn-by-turn transcripts from Ultravox. Pulled once per call by the completed webhook (or by backfill). Used for prompt-pattern mining and per-call audit. call_logs.ai_summary remains the compressed summary surface.';
comment on column public.call_transcripts.full_transcript is
  'JSON array of {role, text, timestamp_ms} turns. role is typically "agent" or "user".';
comment on column public.call_transcripts.source is
  'How the transcript was fetched: completed_webhook (default — fired on call.ended), backfill (admin script for historical calls), manual (analyst pulled via dashboard).';

-- ----------------------------------------------------------------------------
-- RLS: admin-only writes. Per-client read for own transcripts.
-- ----------------------------------------------------------------------------
alter table public.call_transcripts enable row level security;

create policy "admins_all_call_transcripts"
  on public.call_transcripts
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

-- Per-client read for own data: any authenticated user mapped to the transcript's
-- client_id via client_users can SELECT.
create policy "client_read_call_transcripts"
  on public.call_transcripts
  for select
  using (
    client_id in (
      select client_id from public.client_users where user_id = auth.uid()
    )
  );
