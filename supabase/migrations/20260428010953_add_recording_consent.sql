-- Recording Consent — universal acknowledgment (Wave 1.5)
-- Why: every inbound call has recordingEnabled=true in Ultravox. Liability for caller
-- consent currently sits ambiguously between us and the operator. New onboardings must
-- check a consent box; existing operators get a one-time login modal to acknowledge.
--
-- Outbound features (campaign queue, ISA dialer) are gated on this acknowledgment.

alter table clients
  add column if not exists recording_consent_acknowledged_at timestamptz;

alter table clients
  add column if not exists recording_consent_version int default 1;

comment on column clients.recording_consent_acknowledged_at is
  'Timestamp when operator acknowledged liability for caller-consent compliance in their jurisdiction. Required before outbound features unlock.';

comment on column clients.recording_consent_version is
  'Version of the legal text the operator agreed to. Bump if we change the disclosure language and need re-acknowledgment.';
