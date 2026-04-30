-- Phase A: concierge-status skill schema additions
-- Additive-only, all nullable. No app code reads these yet.
-- Ref: ~/.claude/projects/-Users-owner/memory/unmissed-concierge-status-skill-phase-a.md

alter table clients
  add column if not exists carrier text,
  add column if not exists voicemail_removed_at timestamptz,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_msg_id text;

comment on column clients.carrier is
  'Owner''s mobile carrier for the line being forwarded to AI DID. Values: rogers, rogers_business, bell, telus, fido, koodo, virgin, public_mobile, freedom, sasktel, other. Used by /concierge-status skill + future Go Live wizard (D292) to render the right dial code + carrier support phone number.';

comment on column clients.voicemail_removed_at is
  'Timestamp the client confirmed they removed carrier voicemail (per Decisions/2026-04-29-voicemail-removal-required-for-cf.md). Self-attested today; future may add automated verification via test-call landing on AI DID.';

comment on column clients.welcome_email_sent_at is
  'Timestamp the client''s welcome email was sent via gmail.py. Set during the manual concierge onboarding flow.';

comment on column clients.welcome_email_msg_id is
  'Gmail message ID of the welcome email send. Used by /concierge-status to surface a link back to the original send for auditing or follow-up.';
