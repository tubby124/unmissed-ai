# unmissed.ai — Pricing Configuration

> Single source of truth for all pricing values across the app.
> Update this file when pricing changes, then update the corresponding code references below.

---

## Setup Fees (one-time)

| Item | Price (CAD) | Stripe cents | Description |
|------|------------|-------------|-------------|
| Fresh number setup | $25 | 2500 | New Twilio number purchased + provisioned |
| Inventory number setup | $20 | 2000 | Pre-owned number from inventory (save $5) |

Both options include **50 free bonus minutes** credited on activation.

## Minute Reloads

| Package | Price (CAD) | Stripe cents | Notes |
|---------|------------|-------------|-------|
| 100 min | $10 | 1000 | Promo pricing |
| 200 min | $20 | 2000 | |
| 300 min | $30 | 3000 | |
| 400 min | $40 | 4000 | |
| 500 min | $50 | 5000 | |

Rate: **$0.10/min** (promo). Added to `bonus_minutes` on `clients` table.

## Monthly Plans (displayed on /pricing)

| Plan | Monthly | Annual | Minute limit |
|------|---------|--------|-------------|
| Starter | $147 | $122 | 100 calls/mo |
| Pro | $247 | $206 | 300 calls/mo |
| Business | $397 | $331 | Unlimited |

> Plans are **display-only** right now. No Stripe subscription integration yet.
> `monthly_minute_limit` on the `clients` table controls enforcement (default: 500).

## Code References

Update these files when pricing changes:

### Setup fee amounts
- `src/app/api/stripe/create-public-checkout/route.ts` — `unit_amount` (line ~215)
- `src/app/api/stripe/create-checkout/route.ts` — `unit_amount` (line ~70)

### Setup fee UI
- `src/app/onboard/status/page.tsx` — "$20 CAD" / "$25 CAD" labels + CTA button text
- `src/components/dashboard/ClientsTable.tsx` — "Activate ($25)" button + modal
- `src/app/dashboard/settings/SettingsView.tsx` — "$25 (paid)" display

### Minute reload
- `src/app/api/stripe/create-reload-checkout/route.ts` — `PRICE_PER_100_MIN = 1000`

### Free minutes on activation
- `src/app/api/webhook/stripe/route.ts` — `bonus_minutes: 50` in Step 2 update

### Inventory number UI
- `src/app/admin/numbers/page.tsx` — admin inventory description
- `src/app/api/public/available-numbers/route.ts` — API comment

### Pricing page (marketing)
- `src/components/PricingCards.tsx` — `plans` array (monthly/annual prices)
- `src/app/pricing/page.tsx` — metadata, comparison tables
- `src/lib/schema.ts` — `pricingSchema` (lowPrice/highPrice for structured data)

---

## Currency

- All customer-facing prices: **CAD**
- Exception: `create-checkout/route.ts` was originally USD — now corrected to CAD
- Stripe `unit_amount` is always in **cents** (e.g. $25 = 2500)
