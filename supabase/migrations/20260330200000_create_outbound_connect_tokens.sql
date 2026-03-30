-- D91: Short-lived token table for outbound AMD callback URLs.
-- Stores the Ultravox joinUrl + voicemail script for in-flight outbound calls
-- so the outbound-connect webhook URL stays short enough for Twilio (<200 chars).
-- TTL: 5 minutes (set by insert logic). Cleanup cron deletes rows older than 10 minutes.

create table if not exists outbound_connect_tokens (
  id              uuid primary key default gen_random_uuid(),
  join_url        text not null,
  vm_script       text,
  ultravox_call_id text,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

-- Index for the cleanup cron's range delete on created_at
create index if not exists outbound_connect_tokens_created_at_idx
  on outbound_connect_tokens (created_at);

-- Row-level security: service role only (no user access needed)
alter table outbound_connect_tokens enable row level security;
