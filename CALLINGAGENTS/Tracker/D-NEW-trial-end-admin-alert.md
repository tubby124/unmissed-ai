---
type: tracker
status: open
priority: P1
phase: TBD
related:
  - Features/Trial-Lifecycle
  - Tracker/D-NEW-trial-auto-disable
  - Clients/calgary-property-leasing
  - Clients/velly-remodeling
opened: 2026-05-04
---

# D-NEW — Owner-side trial-ending alert (Telegram digest to Hasan)

## Status
**OPEN** — small infra, no policy gating. Can ship anytime.

## Problem
Trial-reminder cron sends emails to **clients** (Day-3 / Day-1 nudges via `trial_reminder_sent` jsonb gate). Hasan himself gets **no signal** when a client's trial is approaching expiry. Surfaced 2026-05-04 after extending Brian (calgary-property-leasing) AND Kausar (velly-remodeling) on the same day — Hasan only knew to act because he was manually reading vault notes, not because anything pinged him.

Hasan's words: *"there has to be a way for me to get notified that like, you know, trials are ending or something, so I at least know, 'cause like these guys are getting these trial account notifications instead of the actual message."*

## Why this is separate from [[Tracker/D-NEW-trial-auto-disable]]
- D-NEW-trial-auto-disable = **client-side lifecycle** (does the agent stop answering when trial expires?). Owner-gated policy decision.
- D-NEW-trial-end-admin-alert (this) = **owner-side visibility** (does Hasan know a trial is ending?). No policy gate — pure infra.

## Proposed shape (cheapest, ships in one PR)
Daily Telegram digest at **09:00 Saskatoon time** (15:00 UTC, matches Hasan's working hours) to Hasan's chat ID. Cron-driven via existing Railway scheduler.

**Body format:**
```
🕐 Trial digest — 2026-05-04

⚠️ Past expiry, no conversion (3):
  • Brian / calgary-property-leasing — expired 2d ago (last extended 2026-05-04)
  • Kausar / velly-remodeling — expired 0d ago
  • Sample / sample-slug — expired 5d ago

🔜 Expiring in next 7 days (2):
  • Foo / foo-slug — expires 2026-05-09 (5d)
  • Bar / bar-slug — expires 2026-05-11 (7d)

✅ Converted last 7 days (0)
```

Quiet days (zero rows in all 3 buckets) → skip the message entirely. No daily noise.

## Acceptance criteria
- [ ] Cron route `/api/cron/trial-admin-digest` (Railway-cron compatible, signed via `CRON_SECRET` like existing)
- [ ] Query: `SELECT slug, business_name, trial_expires_at, contact_email, owner_name FROM clients WHERE subscription_status='trialing' AND trial_converted=false AND trial_expires_at IS NOT NULL ORDER BY trial_expires_at`
- [ ] Bucket rows into past-expiry / next-7-days / converted-7-days
- [ ] Skip Telegram send if all buckets empty
- [ ] Telegram alert via existing `lib/telegram.ts` chain — no new bot, no new chat ID
- [ ] Cron schedule: `0 15 * * *` (15:00 UTC = 09:00 CST)
- [ ] Smoke test: invoke route manually, verify Telegram lands in Hasan's DM
- [ ] Add row to `Features/Trial-Lifecycle` doc

## Out of scope (deliberately)
- Per-client mid-trial nudges (that's D-NEW-trial-auto-disable territory)
- Auto-disabling expired trials (D-NEW-trial-auto-disable)
- Stripe payment-failure alerts (separate concern, already handled by Stripe-side webhook + existing `🎉 Trial converted` chain)
- SMS to Hasan (Telegram is enough; SMS is reserved for client-facing comms)

## Connections
- → [[Features/Trial-Lifecycle]]
- → [[Tracker/D-NEW-trial-auto-disable]] (client-side counterpart — different code surface)
- → [[Clients/calgary-property-leasing]] (Brian — example)
- → [[Clients/velly-remodeling]] (Kausar — example, surfaced this gap)
- → [[Architecture/Webhook-Security-and-Idempotency]] (cron auth pattern)
