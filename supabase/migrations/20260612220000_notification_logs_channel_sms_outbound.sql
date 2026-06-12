-- Extend notification_logs channel check.
-- Applied to prod (qwhvblomlgeapzhnuwlb) 2026-06-12 via management API.
--
-- 1. 'sms_outbound' — new channel for outbound lead-qual post-call SMS lanes
--    (booked confirm + vm/no-answer pair). Distinct from 'sms_followup' so the
--    24h missed-lane dedupe can't be false-positived by prior inbound SMS rows.
-- 2. 'sms_owner' — LATENT BUG FIX: sendOwnerSmsAlert (shipped 2026-05-25) has
--    been inserting channel='sms_owner', which violated the old constraint.
--    Sends worked; every log insert silently failed (error-logged only).

ALTER TABLE notification_logs DROP CONSTRAINT notification_logs_channel_check;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_channel_check
  CHECK (channel = ANY (ARRAY[
    'telegram'::text,
    'email'::text,
    'sms_followup'::text,
    'sms_owner'::text,
    'sms_outbound'::text
  ]));
