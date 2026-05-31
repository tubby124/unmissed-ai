# Concierge Payment Link

> Use this when you want to send a one-off Stripe link to a client — any price, any plan — and have it "just work": activates them in End Voicemail, anchors their billing cycle, sends a welcome email, and pings Telegram.

## When to use

- Custom price (founding-concierge $29/mo, mid-tier $119/mo, anything off-menu)
- Direct outreach (text/email Brian a link, he pays, he's onboarded)
- A client who already exists in `clients` table (created via manual concierge SOP) and now needs to be flipped from `trialing` to `active`

Do NOT use for: standard self-serve onboarding (the `/onboard` flow already handles that via `intake_id + client_id + client_slug` metadata).

## How it works

Handler: `src/app/api/webhook/stripe/route.ts` — branch fires when:
- Stripe sends `checkout.session.completed`
- `metadata.client` is set on the session
- `metadata.intake_id` and `metadata.clientId` are both **absent** (so we don't collide with onboarding or dashboard-upgrade branches)

On match, the handler:
1. Looks up `clients` row by `slug = metadata.client`
2. If `anchor_day` is set, updates the Stripe subscription's `trial_end` to push the next billing date to the next occurrence of that day of month (+ any `extra_days_free`)
3. Writes `subscription_status='active'`, `trial_converted=true`, `status='active'`, plus the new `stripe_customer_id` / `stripe_subscription_id` to Supabase
4. Sends a Telegram alert to the `hasan-sharif` admin row
5. Sends a branded welcome email to `clients.contact_email` (falls back to the Stripe customer email if blank)
6. Logs to `notification_logs`

If the slug doesn't exist, the handler calls `notifySystemFailure()` so you find out instead of silently dropping the payment.

## Stripe metadata contract

| Key | Required | Example | What it does |
|---|---|---|---|
| `client` | **yes** | `velly-remodeling` | Must match `clients.slug` exactly. Lowercase, hyphenated. |
| `program` | no | `founding_concierge` | Label for analytics + Telegram alert text. Free-form. |
| `anchor_day` | no | `1` | Push billing to the Nth day of the month (1–28). Today's payment stays; next charge skips to the anchor day. |
| `extra_days_free` | no | `1` | Add N free days on top of the anchor push. Use to round off odd dates. |

## Creating a payment link (Stripe Dashboard)

1. Stripe → **Payment Links** → "+ New"
2. Pick the product/price (e.g. $119/mo CAD recurring, or $29/mo "founding")
3. Under "Advanced options" → "Metadata", add:
   - `client` = `<slug>` (must already exist in Supabase `clients` table — onboard the client first via the manual concierge SOP)
   - `program` = `<label>` (optional)
   - `anchor_day` = `1` (optional, for 1st-of-month billing)
   - `extra_days_free` = `1` (optional)
4. Copy the link, send to the client.

## Creating a payment link (Stripe API)

```bash
curl https://api.stripe.com/v1/payment_links \
  -u "${STRIPE_SECRET_KEY}:" \
  -d "line_items[0][price]=price_XXXX" \
  -d "line_items[0][quantity]=1" \
  -d "metadata[client]=brian-calgary-property-leasing" \
  -d "metadata[program]=mid_tier_custom" \
  -d "metadata[anchor_day]=1" \
  -d "metadata[extra_days_free]=0"
```

## Test before sending to a real client

1. Create a payment link in Stripe **test mode** with `metadata.client=hasan-sharif` (or another slug you don't mind activating)
2. Pay with `4242 4242 4242 4242`
3. Check:
   - Supabase `clients` row updated (`subscription_status=active`, `stripe_subscription_id` set, `subscription_current_period_end` matches the anchor)
   - Telegram alert hit your admin chat
   - Welcome email landed in the inbox tied to that test client
4. Revert Supabase fields manually if needed

## When it doesn't fire (debugging)

Stripe webhook logs live in Stripe Dashboard → Developers → Webhooks → endvoicemail.ai endpoint. Look for:

- **400 invalid signature** — `STRIPE_WEBHOOK_SECRET` env mismatch
- **Event landed, no side effects** — handler hit but no branch matched. Check `stripe_events` table in Supabase for the event row, then inspect the raw payload to confirm `metadata.client` is set
- **`client slug not found` Telegram alert** — typo in metadata slug, or the client was never created in Supabase. Create the client first (`/onboard-client [slug]` skill), then re-fire the event from Stripe Dashboard → Events → "Resend"
- **Subscription period_end didn't move to your anchor day** — `anchor_day` was missing or `>28`. The handler clamps to 28 to avoid month-edge weirdness (Feb only has 28 days).

## Manual recovery (if Stripe webhook is offline)

If a payment lands while the webhook is down, you can manually patch the client row. See the May 31 retrospective for Velly Remodeling — same fields, same approach. Then resend the Stripe event from the Stripe Dashboard once the handler is back up; it's idempotent (`stripe_events` table has UNIQUE on `event_id`).

## Related

- [hermes-client-lifecycle.md](./hermes-client-lifecycle.md) — how Hermes reads client lifecycle state
- `src/app/api/webhook/stripe/route.ts` — handler source
- `src/lib/email/send.ts` — branded email helper
- `src/lib/telegram.ts` — `sendAlert()` helper
