-- 2026-04-12: Add outbound scheduling config columns to clients table.
-- These back the OutboundSchedulingCard in the Actions dashboard tab.
-- outbound_enabled  — master toggle (false = no scheduled outbound attempts)
-- outbound_number   — E.164 number to call FROM (defaults to twilio_number if blank)
-- outbound_time_window_start / end — HH:MM local-time window for outbound calls
-- outbound_max_attempts — max dial attempts per lead before giving up

alter table clients
  add column if not exists outbound_enabled           boolean     default false,
  add column if not exists outbound_number            text,
  add column if not exists outbound_time_window_start text,
  add column if not exists outbound_time_window_end   text,
  add column if not exists outbound_max_attempts      integer     default 3;
