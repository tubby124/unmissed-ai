-- G7: Usage alert dedup timestamps
-- Tracks when 80% and 100% minute warnings were last sent per client.
-- Reset to NULL at the start of each billing cycle (Stripe webhook or cron).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS minute_warning_80_sent_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS minute_warning_100_sent_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN clients.minute_warning_80_sent_at  IS 'Timestamp of last 80% usage alert. NULL = not sent this cycle.';
COMMENT ON COLUMN clients.minute_warning_100_sent_at IS 'Timestamp of last 100% usage alert. NULL = not sent this cycle.';
