-- Add alert_email_cc column and backfill alert_phone/alert_email from existing data.
--
-- 1. alert_email_cc: optional CC address for per-call owner email alerts.
--    Owners can route a copy to a second inbox (e.g. personal Yahoo + business inbox).
--
-- 2. Backfill: new signups will get alert_phone/alert_email pre-filled at provision
--    time. Existing clients get the same treatment here — copy callback_phone →
--    alert_phone and contact_email → alert_email where not already set.
--
-- Mutation class: DB_ONLY for all three — no agent sync required.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS alert_email_cc text;

COMMENT ON COLUMN clients.alert_email_cc IS
  'Optional CC email for per-call owner alerts. Sent alongside alert_email when set.';

-- Backfill alert_phone from callback_phone for clients that have none set
UPDATE clients
  SET alert_phone = callback_phone
  WHERE alert_phone IS NULL
    AND callback_phone IS NOT NULL;

-- Backfill alert_email from contact_email for clients that have none set
UPDATE clients
  SET alert_email = contact_email
  WHERE alert_email IS NULL
    AND contact_email IS NOT NULL;
