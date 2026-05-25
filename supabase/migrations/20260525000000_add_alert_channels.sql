-- Add multichannel owner-alert columns to clients table.
--
-- Purpose: per-channel destination + toggle for the new dashboard /notifications
-- page that lets owners pick SMS, Email, Telegram (or any combination) for per-call alerts.
--
-- Channel semantics (per spec docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md):
--   - alert_phone   → SMS destination (FROM = client.twilio_number). Falls back to callback_phone in code.
--   - alert_email   → Email destination. Falls back to contact_email in code.
--   - sms_alerts_enabled → toggle for the new per-call owner-SMS channel. Default null → UI shows OFF.
--
-- Mutation class: DB_ONLY for all three (no Ultravox/prompt/tool impact).
-- - No agent redeploy required when these change
-- - Read at call time by /api/webhook/[slug]/completed
--
-- Trigger event: 2026-05-25 — Velly Remodeling (Kausar) needs per-call email at
-- info@vellyremodeling.com (≠ her login email kausarimam10@yahoo.com), plus SMS
-- to her cell as a third channel. Existing Telegram-only flow is too high-friction
-- for non-technical owners.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS alert_phone text,
  ADD COLUMN IF NOT EXISTS alert_email text,
  ADD COLUMN IF NOT EXISTS sms_alerts_enabled boolean;

COMMENT ON COLUMN clients.alert_phone IS
  'E.164 phone for owner-direction SMS call alerts. Read as alert_phone ?? callback_phone.';

COMMENT ON COLUMN clients.alert_email IS
  'Email address for per-call owner alerts. Read as alert_email ?? contact_email.';

COMMENT ON COLUMN clients.sms_alerts_enabled IS
  'Toggle for the per-call owner-SMS alert channel. NULL treated as OFF in UI. New columns added 2026-05-25.';
