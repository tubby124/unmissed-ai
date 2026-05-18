-- Two columns to support new email triggers (minute usage warning + demo follow-up).
-- usage_warnings_sent: JSONB keyed by year-month for idempotent per-cycle warnings
--   shape: {"2026-05": {"75": "2026-05-18T...", "90": "2026-05-22T..."}, "2026-06": {...}}
--   resets implicitly each month — next month's key is different
-- followup_sent_at: one-shot timestamp on demo_calls — set after demo follow-up email sent
--   prevents duplicate sends if cron retries or restarts

alter table public.clients
  add column if not exists usage_warnings_sent jsonb default '{}'::jsonb;

alter table public.demo_calls
  add column if not exists followup_sent_at timestamptz;

create index if not exists idx_demo_calls_followup_pending
  on public.demo_calls (ended_at)
  where caller_email is not null and followup_sent_at is null;

comment on column public.clients.usage_warnings_sent is 'JSONB keyed by year-month → {"75": ts, "90": ts}. Set by /api/cron/minute-usage-alert. Implicitly resets each month.';
comment on column public.demo_calls.followup_sent_at is 'Set by /api/cron/demo-followup after one-time follow-up email send. Null = candidate for follow-up.';
