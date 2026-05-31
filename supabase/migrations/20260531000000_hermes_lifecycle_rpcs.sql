-- Hermes lifecycle RPCs — single-client lookup + fleet status
-- Exposed to anon role with security definer so Hermes can read client lifecycle
-- state from the VPS without holding the service role key.
--
-- Used by: Hermes agent (zarabot) via /rest/v1/rpc endpoints
-- Documented in: docs/runbooks/hermes-client-lifecycle.md +
-- ~/Downloads/Obsidian Vault/zarabot-live/HERMES-CONTEXT.md
-- ----------------------------------------------------------------------------

create or replace function public.client_lifecycle(p_slug text)
returns table (
  slug                              text,
  business_name                     text,
  status                            text,
  subscription_status               text,
  trial_converted                   boolean,
  selected_plan                     text,
  stripe_customer_id                text,
  stripe_subscription_id            text,
  trial_expires_at                  timestamptz,
  subscription_current_period_end   timestamptz,
  contact_email                     text,
  monthly_minute_limit              int,
  minutes_used_this_month           int,
  recent_notifications              jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    c.slug,
    c.business_name,
    c.status,
    c.subscription_status,
    c.trial_converted,
    c.selected_plan,
    c.stripe_customer_id,
    c.stripe_subscription_id,
    c.trial_expires_at,
    c.subscription_current_period_end,
    c.contact_email,
    c.monthly_minute_limit,
    c.minutes_used_this_month,
    (
      select jsonb_agg(jsonb_build_object(
        'created_at', nl.created_at,
        'channel',    nl.channel,
        'status',     nl.status,
        'content',    nl.content,
        'error',      nl.error
      ) order by nl.created_at desc)
      from (
        select * from public.notification_logs
        where client_id = c.id
        order by created_at desc
        limit 10
      ) nl
    ) as recent_notifications
  from public.clients c
  where c.slug = p_slug;
$$;

grant execute on function public.client_lifecycle(text) to anon;
comment on function public.client_lifecycle(text) is
  'Single-client lifecycle snapshot — for Hermes / external operator agents. Read-only.';

-- ----------------------------------------------------------------------------

create or replace function public.client_fleet_status()
returns table (
  slug                              text,
  business_name                     text,
  status                            text,
  subscription_status               text,
  trial_converted                   boolean,
  selected_plan                     text,
  stripe_subscription_id            text,
  trial_expires_at                  timestamptz,
  subscription_current_period_end   timestamptz,
  monthly_minute_limit              int,
  minutes_used_this_month           int,
  days_until_renewal_or_trial_end   int,
  last_call_at                      timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.slug,
    c.business_name,
    c.status,
    c.subscription_status,
    c.trial_converted,
    c.selected_plan,
    c.stripe_subscription_id,
    c.trial_expires_at,
    c.subscription_current_period_end,
    c.monthly_minute_limit,
    c.minutes_used_this_month,
    case
      when c.subscription_status = 'trialing' and c.trial_expires_at is not null
        then extract(day from c.trial_expires_at - now())::int
      when c.subscription_current_period_end is not null
        then extract(day from c.subscription_current_period_end - now())::int
      else null
    end as days_until_renewal_or_trial_end,
    (
      select max(cl.started_at)
      from public.call_logs cl
      where cl.client_id = c.id
    ) as last_call_at
  from public.clients c
  where c.slug not in ('hasan-sharif', 'unmissed-demo')  -- exclude internal/admin/demo rows
    and c.business_name is not null
  order by
    case c.subscription_status
      when 'past_due' then 1
      when 'trialing' then 2
      when 'active'   then 3
      else 4
    end,
    c.subscription_current_period_end nulls last,
    c.trial_expires_at nulls last;
$$;

grant execute on function public.client_fleet_status() to anon;
comment on function public.client_fleet_status() is
  'All non-internal clients with lifecycle state — for Hermes fleet view. Read-only.';
