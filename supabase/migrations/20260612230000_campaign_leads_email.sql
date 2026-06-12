-- Lead email for outbound speed-to-lead dials.
-- Applied to prod (qwhvblomlgeapzhnuwlb) 2026-06-12 via management API.
--
-- Threaded from the external lead-call trigger (hasansharif.ca knows the
-- lead's email) so the calendar book route can attach the lead as an event
-- attendee — Google then emails them the calendar invite.

alter table campaign_leads add column if not exists email text;
