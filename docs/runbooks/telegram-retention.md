# Telegram Tables — Retention

> Tier 3 commit 7. Manual retention recipe for `telegram_assistant_log`
> and `telegram_reply_audit`. Both tables grow unbounded otherwise.

## Why this is a runbook, not a migration

Supabase free + low tiers don't ship with `pg_cron` enabled. Rather than
require a schema migration that flips on the extension (which has DBA
implications and isn't reversible without downtime), Tier 3 keeps the
retention policy as a documented manual step. Volumes are low enough
that a monthly run is sufficient:

- `telegram_assistant_log` — every NL Q&A turn writes one row. ~60-300
  turns/month per active client × 6 active clients = ~1.8K rows/month
  worst-case. Even at 5 years of accumulation, the table stays under
  120K rows.
- `telegram_reply_audit` — sampled at 1% per turn, so ~18 rows/month
  worst-case. Trivially small.
- `telegram_pending_actions` — auto-sweeps on every resolve; the table
  is bounded by in-flight tokens (≤5 fleet-wide at any moment). No
  retention policy needed.
- `telegram_updates_seen` — tier 1 idempotency table, separate from
  this runbook.

## Run nightly (or weekly)

Apply against project `qwhvblomlgeapzhnuwlb` via Supabase SQL editor or
`supabase db push`-style admin runner:

```sql
-- 90-day retention on Tier 2 + Tier 3 tables.
DELETE FROM public.telegram_assistant_log
 WHERE created_at < now() - interval '90 days';

DELETE FROM public.telegram_reply_audit
 WHERE created_at < now() - interval '90 days';
```

Each statement is fast — both tables are indexed on `(client_id,
created_at DESC)`, and the planner uses the index for the time scan.

## When to revisit

Move this to `pg_cron` once any of these is true:

1. The log volume crosses 100K rows in a month (likely indicator: a
   client launches with high user volume on the assistant).
2. The Supabase plan is upgraded to one that enables `pg_cron` by
   default.
3. A second time-series table joins the retention pattern (would amortize
   the cron-setup cost).

The cron job, when added, looks like:

```sql
SELECT cron.schedule(
  'telegram-retention-nightly',
  '15 3 * * *', -- 03:15 UTC every day
  $$DELETE FROM public.telegram_assistant_log WHERE created_at < now() - interval '90 days';
    DELETE FROM public.telegram_reply_audit  WHERE created_at < now() - interval '90 days';$$
);
```
