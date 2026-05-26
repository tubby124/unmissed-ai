-- Client nervous system event ledger.
--
-- Append-only normalized timeline over existing source tables. This does not
-- replace intake_submissions, clients, prompt_versions, call_logs,
-- notification_logs, tool_invocations, client_drift_log, or harness_findings.
-- It links them into one client narrative.

create extension if not exists "pgcrypto";

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  client_slug text,
  event_version int not null default 1,
  event_type text not null,
  event_group text not null,
  severity text not null default 'info'
    check (severity in ('debug','info','notice','warning','critical')),
  actor_type text not null
    check (actor_type in ('anonymous','owner','admin','system','cron','webhook','harness')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null,
  source_route text,
  correlation_id text,
  dedupe_key text,
  run_id text,
  call_log_id uuid references public.call_logs(id) on delete set null,
  ultravox_call_id text,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  harness_finding_id uuid references public.harness_findings(id) on delete set null,
  status text not null
    check (status in ('started','success','warning','error','skipped')),
  visibility text not null default 'admin_only'
    check (visibility in ('admin_only','owner_safe','system_only')),
  summary text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- `recordClientEvent()` uses upsert(..., { onConflict: 'dedupe_key',
-- ignoreDuplicates: true }) when a dedupe key is supplied. Postgres unique
-- constraints permit many NULLs, so events without a dedupe key remain
-- append-only and keyed retries do not mutate existing rows.
create unique index if not exists client_events_dedupe_key_uniq
  on public.client_events (dedupe_key);

create index if not exists client_events_client_created_idx
  on public.client_events (client_id, created_at desc);

create index if not exists client_events_slug_created_idx
  on public.client_events (client_slug, created_at desc)
  where client_slug is not null;

create index if not exists client_events_group_created_idx
  on public.client_events (event_group, created_at desc);

create index if not exists client_events_correlation_idx
  on public.client_events (correlation_id)
  where correlation_id is not null;

create index if not exists client_events_call_log_idx
  on public.client_events (call_log_id)
  where call_log_id is not null;

alter table public.client_events enable row level security;

create policy client_events_admin_select
  on public.client_events
  for select
  using (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy client_events_owner_safe_select
  on public.client_events
  for select
  using (
    visibility = 'owner_safe'
    and client_id in (
      select client_id from public.client_users
      where user_id = auth.uid()
        and role = 'owner'
    )
  );

comment on table public.client_events is
  'Append-only client nervous system event ledger. Links onboarding, prompt, tool, call, notification, drift, and harness source tables into one timeline. Writes are service-role only through src/lib/client-events.ts.';

comment on column public.client_events.dedupe_key is
  'Optional idempotency key for webhook, cron, and harness retries. Unique when present; NULL events remain append-only.';

comment on column public.client_events.visibility is
  'admin_only = admin timeline; owner_safe = future owner-facing timeline with redacted payloads; system_only = service-role diagnostics.';

comment on column public.client_events.before is
  'Redacted before-state subset. Never store secrets, raw request bodies, signatures, or full transcripts.';

comment on column public.client_events.after is
  'Redacted after-state subset. Store large/source payloads in the originating table and link by IDs.';

comment on column public.client_events.details is
  'Redacted structured metadata for investigation. Use hashes/summaries for private values.';
