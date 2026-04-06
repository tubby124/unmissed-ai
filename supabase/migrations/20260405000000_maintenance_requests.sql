-- D405: maintenance_requests — structured write-back from PM voice agent
create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  unit_number text not null,
  tenant_name text not null,
  caller_phone text,
  category text not null,
  description text not null,
  urgency_tier text not null check (urgency_tier in ('urgent', 'routine')),
  preferred_access_window text,
  entry_permission boolean,
  status text not null default 'new',
  created_at timestamptz default now(),
  created_by text not null default 'voice_agent',
  call_log_id uuid,
  notes text[] default '{}'
);
alter table maintenance_requests enable row level security;
create policy "clients own their requests" on maintenance_requests
  for all using (client_id = auth.uid());
