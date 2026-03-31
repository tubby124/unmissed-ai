---
type: architecture
status: active
tags: [architecture, billing, stripe, supabase, plans]
related: [Architecture/Control Plane Mutation, Decisions/Agents API vs createCall]
updated: 2026-03-31
---

# Billing and Stripe Architecture

## Flow: Subscription → Tools

```
Stripe checkout / subscription event
  ↓
POST /api/webhook/stripe
  ↓ stripe.webhooks.constructEvent() — validates + idempotency via stripe_events table
  ↓ checkout.session.completed → activateClient()
      → write selected_plan, subscription_status, monthly_minute_limit to clients
      → ensureTwilioProvisioned() → writes twilio_number
      → syncClientTools() → rebuilds clients.tools with new plan entitlements
  ↓ customer.subscription.updated → update selected_plan + subscription_status
      → syncClientTools() — plan change = tools resync
  ↓ customer.subscription.deleted → subscription_status='canceled'
      → syncClientTools()
```

## Plan Tiers

| Plan | Display Name | Minute Cap | Key Tools Unlocked |
|------|-------------|-----------|-------------------|
| `lite` | AI Voicemail | 100 min/mo | SMS disabled, transfer disabled, booking disabled |
| `core` | Smart Receptionist | 300 min/mo | SMS + Transfer enabled |
| `pro` | Receptionist + Booking | 600 min/mo | All tools including calendar booking |
| trial | (trial) | 7 days | All tools (trial bypass) |

**Source of truth:** `src/lib/plan-entitlements.ts` — `PLAN_ENTITLEMENTS`, `getPlanEntitlements()`

## Minute Enforcement (inbound route)

```
POST /api/webhook/{slug}/inbound
  → getEffectiveMinuteLimit(client) — accounts for grace period + subscription_status
  → if seconds_used_this_month / 60 >= effectiveLimit → return voicemail TwiML
  → after call: billed webhook increments seconds_used_this_month
```

Grace period: `subscription_status='past_due'` + `grace_period_end` → still allows calls

## Billing API Routes

| Route | Purpose |
|-------|---------|
| `/api/billing/upgrade` | Stripe checkout session for upgrade |
| `/api/billing/downgrade` | Immediate plan downgrade + tool resync |
| `/api/billing/portal` | Stripe Customer Portal link |
| `/api/billing/invoices` | Invoice history |
| `/api/billing/buy-minutes` | One-time minute top-up purchase |

All routes use `verifyBillingAuth()` — requires authenticated session + client_users lookup.

## Key DB Columns (clients table)

| Column | Set by | Purpose |
|--------|--------|---------|
| `selected_plan` | Stripe webhook | Tool gating |
| `subscription_status` | Stripe webhook | `active/trialing/past_due/canceled` |
| `stripe_subscription_id` | Stripe webhook | For portal + management |
| `stripe_customer_id` | Stripe webhook | For invoice lookup |
| `monthly_minute_limit` | Stripe webhook (from plan) | Enforcement cap |
| `seconds_used_this_month` | `/api/webhook/ultravox` billed event | Usage tracking |

## Drift Risk

- **Plan change without tool resync**: If `selected_plan` changes but `syncClientTools()` fails, the agent keeps old tools. Stripe webhook DOES call `syncClientTools()` on plan changes — but if that call errors, tools are stale.
- **Trial bypass**: `subscription_status='trialing'` bypasses plan gating in `buildAgentTools()`. If trial expires and webhook doesn't fire, all tools remain active.

## Stripe Keys

- Railway has `sk_live_` key for production
- `.env.local` has `sk_test_` key for local dev
- Promo code `FOUNDING29` = coupon `i0s7bCCd` → Lite $49→$29/mo. See `memory/stripe-promo-codes.md`.
