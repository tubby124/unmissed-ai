---
type: decision
status: shipped
tags: [decision, pricing, billing, stripe]
related: [Decisions/Plan-Equals-Mode, src/lib/pricing.ts]
date: 2026-04-27
---

# Decision: AI Receptionist ($119 CAD/mo) is the Standard Plan

## Context
- Hasan is selling only the **AI Receptionist** tier going forward.
- Solo and Front Desk Pro tiers remain in code but aren't being actively sold.

## What shipped (PR #33, merged 2026-04-27)
- `src/lib/pricing.ts` line 75 was pointing at the **stale $99 Stripe price** (`price_1TELcr0tFbm4ZBYUIoRpqUMR`, nickname "Core Monthly").
- The product page listed $119 but Stripe checkout charged $99 — a fake-control bug visible to the customer.
- Swapped to `price_1TQdWK0tFbm4ZBYUz7JyvVpe` (nickname "Core Monthly v2", $119 CAD).
- Archived the $99 price in Stripe (`active=false`) so it can never be re-wired by accident. Existing subscribers on it (if any) keep their grandfathered rate — Stripe never auto-migrates customers when a price is archived.

## Stripe state of record (AI Receptionist — `prod_UCl8nni05Nk9lB`)
| Price ID | Amount | Status | Notes |
|----------|--------|--------|-------|
| `price_1TQdWK0tFbm4ZBYUz7JyvVpe` | $119 CAD/mo | **ACTIVE — wired** | Core Monthly v2 — current standard |
| `price_1TELcr0tFbm4ZBYUIoRpqUMR` | $99 CAD/mo | ARCHIVED 2026-04-27 | Old "Core Monthly" — locked off |
| `price_1TELcr0tFbm4ZBYUgCoLTyef` | $948 CAD/yr | active | Annual — not currently surfaced |

## Why this matters
- Standard plan = $119/mo CAD.
- The fake-control bug existed because two monthly prices co-existed on the same product. Going forward only one active monthly price per tier — archive any superseded prices immediately.

## How to apply
- All new AI Receptionist signups now charge $119/mo via `price_1TQdWK0tFbm4ZBYUz7JyvVpe`.
- If raising the price again: create new price in Stripe, update `pricing.ts:75`, archive the old one.
- Solo + Front Desk Pro are still wired in `pricing.ts` but not marketed.

## References
- PR: https://github.com/tubby124/unmissed-ai/pull/33
- File: `src/lib/pricing.ts` line 75
- Stripe dashboard: https://dashboard.stripe.com/products/prod_UCl8nni05Nk9lB
