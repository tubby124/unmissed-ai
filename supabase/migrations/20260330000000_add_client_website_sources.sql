-- client_website_sources: per-URL scrape tracking for multi-URL plan gating
create table if not exists client_website_sources (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  url             text not null,
  scrape_status   text not null default 'idle',
  last_scraped_at timestamptz,
  chunk_count     int,
  scrape_error    text,
  created_at      timestamptz not null default now(),
  unique (client_id, url)
);

alter table client_website_sources enable row level security;

create policy "service_role bypass" on client_website_sources
  using (true) with check (true);

-- Add source_url to knowledge_chunks for per-URL chunk tracking
alter table knowledge_chunks add column if not exists source_url text;
