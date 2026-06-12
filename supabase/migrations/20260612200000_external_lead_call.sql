-- External lead-call integration (hasansharif.ca speed-to-lead, Phase 1)
-- 1. clients.lead_webhook_url — when set, the completed webhook POSTs outbound
--    call outcomes (HMAC-signed with LEAD_WEBHOOK_SECRET) to this URL for any
--    campaign_lead that carries an external_ref.
-- 2. campaign_leads.external_ref — the source system's lead id (e.g. the
--    hasansharif.ca public.leads UUID) so outcomes can be written back.

alter table clients add column if not exists lead_webhook_url text;

alter table campaign_leads add column if not exists external_ref text;

create index if not exists idx_campaign_leads_external_ref
  on campaign_leads (external_ref)
  where external_ref is not null;
