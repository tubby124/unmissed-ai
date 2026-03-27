-- Track B.1 / Track A: SMS outcome truth + atomic idempotency + stronger audit trail
--
-- 1. sms_outcome column on call_logs — enum-constrained, no failed_no_consent (not implemented)
-- 2. Unique attempt key on sms_logs(related_call_id) for outbound in-call sends
--    → only one outbound SMS per production call_log row can be inserted; DB rejects duplicates
--    → this makes the idempotency guard atomic (not a read-then-skip race)
-- 3. Stronger audit columns on sms_logs
-- 4. Index on sms_opt_outs for O(1) opt-out lookups

-- ── 1. sms_outcome on call_logs ───────────────────────────────────────────────
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sms_outcome text
  CHECK (sms_outcome IN (
    'sent',
    'blocked_opt_out',
    'failed_provider',
    'failed_missing_phone'
  ));

-- Backfill from existing boolean flag
UPDATE call_logs SET sms_outcome = 'sent' WHERE in_call_sms_sent = true AND sms_outcome IS NULL;

-- ── 2. Unique attempt constraint on sms_logs ──────────────────────────────────
-- Prevents concurrent double-sends for the same production call.
-- Only applies when related_call_id IS NOT NULL (production calls, not demos).
-- The partial unique index allows multiple NULL related_call_id rows (demo calls, standalone SMS).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_unique_incall_send
  ON sms_logs (related_call_id)
  WHERE related_call_id IS NOT NULL AND direction = 'outbound';

-- ── 3. Stronger audit columns on sms_logs ────────────────────────────────────
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS provider_message_sid text;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS attempted_at timestamptz DEFAULT now();

-- ── 4. Fast opt-out lookup index ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_lookup
  ON sms_opt_outs (client_id, phone_number);
