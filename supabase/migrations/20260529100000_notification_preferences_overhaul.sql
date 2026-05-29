-- 20260529100000_notification_preferences_overhaul.sql
--
-- D457/D458: Notification preferences overhaul
-- 1. New opt-in column for spam filtering of owner alerts
-- 2. Flip column defaults so new clients default to all-channels-on
-- 3. Backfill existing clients where the values are NULL (preserve explicit false)

-- 1) New column: opt-in spam filter for owner alerts.
--    Default false means every call alerts (Hasan's stated direction).
--    When true, JUNK-classified calls skip the dispatcher entirely.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS notification_filter_spam boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clients.notification_filter_spam IS
  'Opt-in: when true, JUNK-classified calls do not trigger any owner notifications. '
  'Default false = every call alerts (D457).';

-- 2) Flip column defaults so new clients get all three notification channels on.
--    Existing rows are unaffected by ALTER ... SET DEFAULT.
ALTER TABLE clients ALTER COLUMN email_notifications_enabled SET DEFAULT true;
ALTER TABLE clients ALTER COLUMN telegram_notifications_enabled SET DEFAULT true;
ALTER TABLE clients ALTER COLUMN sms_alerts_enabled SET DEFAULT true;

-- 3) Backfill: existing clients whose notification flags are NULL should be on.
--    Explicit false is preserved (owner opted out).
UPDATE clients
  SET email_notifications_enabled = true
  WHERE email_notifications_enabled IS NULL;

UPDATE clients
  SET telegram_notifications_enabled = true
  WHERE telegram_notifications_enabled IS NULL;

UPDATE clients
  SET sms_alerts_enabled = true
  WHERE sms_alerts_enabled IS NULL;
