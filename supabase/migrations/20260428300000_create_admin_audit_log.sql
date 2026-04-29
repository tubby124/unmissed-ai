-- Phase 0.5.1 — Admin "acting as" audit log
-- Records every cross-client mutation made by an admin via target_client_id scoping.
-- Why: prevents the "I accidentally pushed my prompt to Brian's agent" disaster.
-- Once paying clients exist, this is required for trust + dispute resolution.
-- Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_client_id uuid not null references public.clients(id) on delete cascade,
  acting_client_id uuid references public.clients(id) on delete set null,
  -- ^ admin's own client_users.client_id at the time of the action (if any).
  --   Lets us distinguish "admin acting as someone else" from "admin acting on their own row".
  route text not null,
  method text not null,
  payload_hash text,
  -- ^ sha256 of normalized request payload. Lightweight dedup + tamper signal.
  before_diff jsonb,
  -- ^ subset of target row fields BEFORE the write (only fields included in updates).
  after_diff jsonb,
  -- ^ same fields AFTER the write.
  status text not null default 'ok' check (status in ('ok', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_user_id_idx on public.admin_audit_log (admin_user_id, created_at desc);
create index if not exists admin_audit_log_target_client_id_idx on public.admin_audit_log (target_client_id, created_at desc);
create index if not exists admin_audit_log_route_idx on public.admin_audit_log (route, created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only admins can SELECT. Writes happen via service role from the API helper.
-- The viewer UI is out of scope per the plan; this RLS policy exists so a future
-- admin-only viewer route can read directly without service-role escalation.
create policy "admins_select_audit_log"
  on public.admin_audit_log
  for select
  using (
    exists (
      select 1 from public.client_users
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users — service role only.

comment on table public.admin_audit_log is
  'Phase 0.5 guardrail: every admin write made via target_client_id scoping is logged here. Service role inserts only. Admin-only SELECT.';
