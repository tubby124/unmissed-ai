# Hermes — Client Lifecycle Access

> How to give the Hermes agent (or any external operator agent) read access to End Voicemail client lifecycle state: who paid, when they renew, what alerts went out, when emails fire.

## What Hermes needs to know

| Question | Where the answer lives |
|---|---|
| Did this client pay? | `clients.subscription_status`, `clients.trial_converted` |
| When was the last successful payment? | Stripe (single source of truth) — also reflected in `clients.subscription_current_period_end` |
| When will they renew? | `clients.subscription_current_period_end` |
| When does their trial expire? | `clients.trial_expires_at` |
| Did the welcome email go out? | `notification_logs` rows filtered by `client_id` |
| Did the Telegram alert fire? | `notification_logs` rows |
| Is the agent active? | `clients.status` (`active`, `paused`, `canceled`) |
| What plan are they on? | `clients.selected_plan`, `clients.monthly_minute_limit` |

## Access options (pick one)

### Option A — Direct Supabase read (recommended)

Give Hermes the **anon key + a read-only RPC** rather than the service-role key. Two-step setup:

1. Create a Postgres function exposed via PostgREST that returns the lifecycle view:

```sql
create or replace function public.client_lifecycle(p_slug text)
returns table (
  slug text,
  business_name text,
  status text,
  subscription_status text,
  trial_converted boolean,
  selected_plan text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_expires_at timestamptz,
  subscription_current_period_end timestamptz,
  contact_email text,
  recent_notifications jsonb
) language sql security definer as $$
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
    (
      select jsonb_agg(jsonb_build_object(
        'created_at', nl.created_at,
        'channel',    nl.channel,
        'status',     nl.status,
        'content',    nl.content
      ) order by nl.created_at desc)
      from notification_logs nl
      where nl.client_id = c.id
      order by nl.created_at desc
      limit 10
    ) as recent_notifications
  from clients c
  where c.slug = p_slug;
$$;

grant execute on function public.client_lifecycle(text) to anon;
```

2. Hermes calls it as:

```bash
curl -s "${SUPABASE_URL}/rest/v1/rpc/client_lifecycle" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_slug": "velly-remodeling"}'
```

Why this is better than handing Hermes the service-role key: the function is read-only and scoped to one client at a time. Hermes can't write or list every client at once.

### Option B — Stripe API direct

For "when does Brian renew" questions, the source of truth is Stripe — Supabase is a mirror that can drift. Give Hermes a **restricted Stripe API key** with read-only access on Subscriptions, Customers, and Invoices.

Stripe Dashboard → Developers → API keys → "Create restricted key" → allow only:
- `Subscriptions` read
- `Customers` read
- `Invoices` read
- `Checkout Sessions` read
- `Payment Links` read

Hermes queries:
```bash
# All active subscriptions
curl -s "https://api.stripe.com/v1/subscriptions?status=active&limit=100" \
  -u "${STRIPE_RESTRICTED_KEY}:"

# One customer by email
curl -s "https://api.stripe.com/v1/customers?email=brian@calgaryleasing.com" \
  -u "${STRIPE_RESTRICTED_KEY}:"

# When does this sub renew?
curl -s "https://api.stripe.com/v1/subscriptions/sub_XXXX" \
  -u "${STRIPE_RESTRICTED_KEY}:" | jq '.items.data[0].current_period_end'
```

### Option C — Dedicated admin API endpoint

If Hermes needs to read AND write (e.g. "extend Brian's trial by 3 days"), build a single admin endpoint behind a shared bearer token:

```
POST /api/admin/client-lifecycle
Headers: Authorization: Bearer ${HERMES_ADMIN_TOKEN}
Body: { "action": "read" | "extend_trial" | "anchor_billing", "slug": "<client>", ... }
```

Not built yet. If you want to go this route, ask for it in a new session — it's a separate phase.

## When alerts fire (so Hermes knows what's expected)

| Event | Telegram fires? | Email fires? | Source code |
|---|---|---|---|
| Concierge payment link paid | yes (admin) | yes (customer) | `webhook/stripe/route.ts` concierge branch |
| Standard onboarding checkout | yes (admin) | yes (customer, via `activateClient`) | `webhook/stripe/route.ts` activation branch |
| Dashboard trial → paid upgrade | yes (admin) | no | `webhook/stripe/route.ts` upgrade branch |
| Subscription renewal | yes (admin) | no | `webhook/stripe/route.ts` `invoice.payment_succeeded` branch |
| Payment failed | yes (admin) | yes (customer, grace period notice) | `webhook/stripe/route.ts` `invoice.payment_failed` branch |
| Subscription canceled | yes (admin) | no | `webhook/stripe/route.ts` `customer.subscription.deleted` branch |
| Minute reload (one-time pack) | yes (admin) | no | `webhook/stripe/route.ts` `minute_reload` branch |
| Trial midpoint nudge (day 3-4) | no | yes (customer) | `cron/demo-followup/route.ts` |
| Minute usage warning (75% / 90%) | yes (admin) | yes (customer) | `cron/minute-usage-alert/route.ts` |
| Trial expiry approaching | no | yes (customer) | `cron/trial-expiry/route.ts` |

## Sanity check Hermes can run before answering Hasan

```bash
# 1. Does the slug exist?
curl -s "${SUPABASE_URL}/rest/v1/rpc/client_lifecycle" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -d '{"p_slug": "<slug>"}'

# 2. Is Stripe + Supabase in sync? (sub_id should match, current_period_end within 24h)
# Run lifecycle → get stripe_subscription_id → fetch from Stripe → compare current_period_end

# 3. Did the welcome email actually send? (Resend dashboard or notification_logs.channel='email')
```

If Hermes ever answers "they should have gotten an email" without checking `notification_logs`, that's the failure mode. Always read the log before claiming a side-effect happened.

## Setup checklist

- [ ] Run the `client_lifecycle` SQL function above in Supabase SQL editor (project `qwhvblomlgeapzhnuwlb`)
- [ ] Test from terminal with one slug to confirm it returns
- [ ] Add `SUPABASE_URL` + `SUPABASE_ANON_KEY` to Hermes's environment
- [ ] (Optional, if Hermes also queries Stripe) Create the restricted Stripe key and store as `STRIPE_RESTRICTED_KEY`
- [ ] Document the Hermes prompt: "When Hasan asks about a client, call `client_lifecycle(slug)` first, then optionally Stripe for renewal verification"
