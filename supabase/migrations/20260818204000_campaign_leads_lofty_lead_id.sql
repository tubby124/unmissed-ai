-- Store numeric Lofty CRM lead IDs separately from website/external UUID refs.
-- This keeps Aisha/Hasan Lofty writeback from ever treating hasansharif.ca
-- external_ref UUIDs as CRM lead IDs.
alter table campaign_leads add column if not exists lofty_lead_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaign_leads_lofty_lead_id_numeric_chk'
      and conrelid = 'campaign_leads'::regclass
  ) then
    alter table campaign_leads
      add constraint campaign_leads_lofty_lead_id_numeric_chk
      check (lofty_lead_id is null or lofty_lead_id ~ '^[1-9][0-9]{0,17}$')
      not valid;
  end if;
end $$;

create index if not exists idx_campaign_leads_lofty_lead_id
  on campaign_leads (lofty_lead_id)
  where lofty_lead_id is not null;
