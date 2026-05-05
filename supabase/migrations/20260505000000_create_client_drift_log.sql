-- D452: Weekly drift detection log
-- Why: Brian's slot-pipeline prompt diverged from regenerable output by 3,392 chars
-- and we had no visibility until manually running a recompose dryrun. Same risk for every
-- slot-pipeline client. Read-only awareness is a leverage gain even before D451/D453 ship.
-- Plan: ~/Downloads/unmissed-home-spine/CALLINGAGENTS/Tracker/D452.md

create extension if not exists "pgcrypto";

create table if not exists public.client_drift_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  checked_at timestamptz not null default now(),
  -- Char counts. NULL when status='legacy_monolithic' (snowflake clients can't be
  -- recomposed without forceRecompose; their drift is structural, not numeric).
  stored_chars int,
  recomposed_chars int,
  chars_dropped int,
  chars_added int,
  pct_change numeric(6,2),
  -- Section-level signal. Top section (by char delta) where the most content was lost.
  biggest_drop_section text,
  -- One-line human-readable diff summary, e.g. "8 sections changed; biggest drop: inline_examples (-3,392)"
  diff_summary text,
  -- Drift status. 'ok' = recompose succeeded and we have numeric drift. 'legacy_monolithic' =
  -- snowflake client, drift is structural and migration-gated (D445). 'error' = recompose
  -- threw something else; see error_message.
  status text not null default 'ok' check (status in ('ok', 'legacy_monolithic', 'error')),
  error_message text
);

create index if not exists client_drift_log_client_id_checked_at_idx
  on public.client_drift_log (client_id, checked_at desc);

create index if not exists client_drift_log_chars_dropped_idx
  on public.client_drift_log (chars_dropped desc nulls last)
  where status = 'ok';

comment on table public.client_drift_log is
  'D452: Snapshot of drift between clients.system_prompt (stored) and recomposePrompt() output (regenerable). Populated by scripts/drift-check-all.ts (weekly cron). Read-only — never mutates clients table.';
comment on column public.client_drift_log.chars_dropped is
  'Chars present in stored prompt but missing from recomposed output. >500 = high-risk hand-tuning that would be lost on recompose.';
comment on column public.client_drift_log.status is
  'ok = numeric drift available. legacy_monolithic = snowflake client, no slot markers, drift is migration-gated (D445). error = recompose threw — see error_message.';
