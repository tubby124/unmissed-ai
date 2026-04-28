---
type: decision
date: 2026-04-28
status: shipped
tags: [pricing, plans, unit-economics]
related: [[Decisions/2026-04-27-ai-receptionist-119-standard-plan]]
---

# AI Receptionist — Lower Included Minutes from 400 to 200

## Decision

AI Receptionist (Core, $119/mo CAD) ships with **200 minutes/month** included, down from 400.

## Why

400 min/mo at $119 = $0.30/minute floor. With voice infra costs (Ultravox ~$0.05/min + Twilio ~$0.013/min) and ops overhead, 400 leaves thin margin and disincentivizes upgrades to Pro for high-volume customers.

200 still beats every direct competitor at this price point:
- Rosie: $49/mo for 250 min, but booking requires +$100/mo
- My AI Front Desk: $99/mo for 200 min, bilingual +$50/mo
- Goodcall: $79/mo for 100 unique callers, not minutes
- Smith.ai: $95/mo for 50 calls (human hybrid)
- Ask Benny: $49 CAD/mo for 150 min, no niche prompts

200 min is enough for ~80 typical calls/mo (avg 2.5 min). Most B2B clients in our target niches (auto glass, plumbing, real estate, property mgmt, dental) take well under 80 calls/mo on their main line. Front Desk Pro at 1,000 min covers high-volume use.

## Grandfathering

Existing AI Receptionist subscribers retain their current `clients.monthly_minute_limit` (was 400). New rules apply to:
- New trial-to-Core upgrades via Stripe webhook
- New direct Core checkouts

`getEffectiveMinuteLimit()` (in `src/lib/plan-entitlements.ts`) reads from plan entitlements at runtime, so new subscribers automatically get 200. Existing rows are not bulk-updated.

## Files changed

- `src/lib/pricing.ts` — `PLANS[1].minutes` 400→200; feature copy "400 minutes/month included"→"200 minutes/month included"
- `src/lib/plan-entitlements.ts` — `CORE.minutes` 400→200
- `src/components/dashboard/UpgradeModal.tsx` — feature pill copy
- `src/components/dashboard/settings/BillingTab.tsx` — comparison chip

## Manual follow-up (out-of-band)

- Update Stripe product description for `prod_UCl8nni05Nk9lB` ("AI Receptionist") to reflect 200 min
- Update marketing landing pages on hasansharif.ca + unmissed.ai if they reference the old number
- If a customer complains post-change, treat as grandfathered and bump their `monthly_minute_limit` manually in Supabase

## Reversibility

Pure config change. To roll back:
1. Set both `minutes: 200` back to `400` in pricing.ts + plan-entitlements.ts
2. Update Stripe + UpgradeModal + BillingTab copy
3. No data migration needed
