-- Resend email-event archive for delivery / open / click / bounce tracking.
-- Populated by /api/webhook/resend on each Resend webhook delivery.
-- Source of truth for "did this email actually land" — pairs with the per-send
-- record returned by sendBrandedEmail() (resend message id).
--
-- Why: hasansharif.ca learned the hard way (memory note 2026-05-14) that
-- without webhook archive + bounce handling, deliverability problems are
-- invisible until churn. Same scaffold here, scoped to End Voicemail.

create table if not exists public.resend_email_events (
  id              bigserial primary key,
  event_id        text unique not null,                 -- svix-id, for idempotency
  event_type      text not null,                        -- email.sent / .delivered / .opened / .clicked / .bounced / .complained / .delivery_delayed
  resend_email_id text,                                 -- maps to resend.emails.send response.data.id
  to_email        text,
  from_email      text,
  subject         text,
  client_id       uuid references public.clients(id) on delete set null,
  occurred_at     timestamptz not null default now(),
  data            jsonb,                                -- full event payload from Resend
  created_at      timestamptz not null default now()
);

create index if not exists idx_resend_events_email_id   on public.resend_email_events(resend_email_id);
create index if not exists idx_resend_events_to_email   on public.resend_email_events(to_email);
create index if not exists idx_resend_events_client_id  on public.resend_email_events(client_id);
create index if not exists idx_resend_events_occurred   on public.resend_email_events(occurred_at desc);
create index if not exists idx_resend_events_type       on public.resend_email_events(event_type);

-- Admin-only — no anon / authenticated read access. Service role only.
alter table public.resend_email_events enable row level security;

comment on table public.resend_email_events is 'Archive of Resend webhook events (sends, opens, clicks, bounces, complaints). Populated by /api/webhook/resend.';
