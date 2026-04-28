-- Telegram update_id idempotency
-- Telegram retries on any 5xx for up to 24h. We persist update_id so retried
-- messages are no-ops. Auto-pruned after 48h via cron / manual cleanup.

CREATE TABLE IF NOT EXISTS telegram_updates_seen (
  update_id BIGINT PRIMARY KEY,
  chat_id   BIGINT NOT NULL,
  seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_updates_seen_seen_at_idx
  ON telegram_updates_seen (seen_at);

-- No RLS needed — service-role only writes (webhook).
ALTER TABLE telegram_updates_seen ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; deny all to anon/auth as a belt-and-suspenders.
CREATE POLICY telegram_updates_seen_deny_all
  ON telegram_updates_seen FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
