---
type: feature
status: in-progress
tags: [notifications, sms, email, telegram, dashboard, owner-alerts]
related: [[Project/Index]], [[Architecture/Control-Plane-Mutation-Contract]], [[Clients/hasan-sharif]]
updated: 2026-05-25
---

# Multichannel Owner-Alert Notifications

Third per-call owner-alert channel: **owner-direction SMS**, alongside existing Telegram + Email. Dashboard `/notifications` page rebuilt with 3 channel cards (each with destination input + Send Test button).

> Status: Tasks 0-9 shipped on `main` (14 commits ahead of `origin/main`, NOT pushed). Task 10 (Playwright) paused for user decision. Task 11 (Hasan Gate A manual test) is the only must-ship gate.

## Why

Velly Remodeling (Kausar, first $29 concierge client) needs per-call email at `info@vellyremodeling.com` (≠ her login `kausarimam10@yahoo.com`) plus SMS to her cell as a third channel. Existing Telegram-only flow is too high-friction for non-technical owners.

## DB Fields (all DB_ONLY, triggersSync: false)

| Field | Type | Default | Read fallback |
|---|---|---|---|
| `alert_phone` | text | null | `alert_phone ?? callback_phone` |
| `alert_email` | text | null | `alert_email ?? contact_email` |
| `sms_alerts_enabled` | boolean | null | UI treats null as OFF; explicit opt-in required |

Migration: [supabase/migrations/20260525000000_add_alert_channels.sql](../../supabase/migrations/20260525000000_add_alert_channels.sql) (applied to prod `qwhvblomlgeapzhnuwlb`).

**No agent redeploy** — all 3 fields excluded from `SYNC_TRIGGER_FIELDS` (test enforces). Hasan-sharif, exp-realty, windshield-hub, urban-vibe stay untouched.

## Key Files

- `src/lib/completed-notifications.ts` — `sendOwnerSmsAlert` (new), `buildOwnerSmsBody` (new), `resolveSmsOwnerDestination` (new); `sendEmailNotification` updated to use `alert_email ?? contact_email`; `shouldSendPerCallEmail` unified to `!== false` semantic.
- `src/app/api/webhook/[slug]/completed/route.ts` — SELECT extended; `sendOwnerSmsAlert` added as 4th sibling in fanout (Telegram → caller-SMS → owner-SMS → email).
- `src/app/api/dashboard/notifications/test/route.ts` — new POST endpoint, auth + 5/client/hour rate limit, synthetic NotificationContext.
- `src/components/dashboard/settings/AlertsTab.tsx` — 2-toggle Notification Preferences block (lines 253-313) → 3 channel cards with destination input + Save + Send test alert.
- `src/lib/settings-schema.ts` — FIELD_REGISTRY, Zod (E.164 regex for alert_phone), buildUpdates.

## Gates & Semantics

- **SMS** (owner-direction): gated on `sms_alerts_enabled === true` (explicit opt-in). FROM = `client.twilio_number`. TO = `alert_phone ?? callback_phone`. Skips with `notification_logs.status='skipped_no_destination'` or `'skipped_no_from'` if missing inputs.
- **Email**: gated on `email_notifications_enabled !== false` (unified semantic — formerly only voicemail/message_only got this default; non-voicemail required explicit true). **Prod backfill applied**: 10 NULL rows opted out to preserve pre-deploy behavior; 4 active clients were already explicit false.
- **Telegram**: unchanged. Still uses `telegram_notifications_enabled !== false` AND chat_id present.

## Critical Invariants

- The 3 new fields MUST stay out of `SYNC_TRIGGER_FIELDS`. Test in `notification-guards.test.ts` enforces.
- `channel='sms_owner'` is a NEW value in `notification_logs` (distinct from existing `'sms'` which means caller-direction SMS follow-up).
- Existing global `notificationsAlreadySent(callId)` idempotency guard at `route.ts:364` already protects all 4 channels from Ultravox retries — no per-channel dedup needed at the wiring site.

## Test Coverage Added

- `src/lib/__tests__/notification-guards.test.ts` — 12 settings-registry tests + 4 email-destination tests + updated email-gate semantic test
- `src/lib/__tests__/notification-channels.test.ts` (new) — 4 destination resolution + 4 body builder tests

Total: 2160 → 2172 passing (2 skipped, 0 fail). tsc clean.

## Known Issues

- Email + Telegram synthetic test (Task 7) writes `notification_logs` row with `call_id=null` — minor deviation from spec §6.3. Acceptable, follow-up if needed.
- Plan file referenced wrong Supabase project ID (`kntgxkvgxlhrwonlfbny` is brevo-realtor; correct is `qwhvblomlgeapzhnuwlb`). Task 0.5 amendment notes the correction.

## Gate A (must-ship) checklist

1. Push `main` to origin (14 commits ahead).
2. SQL on `hasan-sharif`: set `sms_alerts_enabled=true`, `alert_phone='<Hasan's cell>'`, `email_notifications_enabled=true`, `alert_email='hasan.sharif@exprealty.com'`.
3. Visual: 3 cards render at `/dashboard/notifications`.
4. Click "Send test SMS/email/Telegram" — each lands within 10-30s.
5. Real call to Aisha → all 3 channels fire within 30s.
6. Drift check: `last_agent_sync_at` BEFORE the migration timestamp (no agent re-sync).

## Plan / Spec

- Plan: [[../docs/superpowers/plans/2026-05-25-multichannel-notifications]] (plan-commit `83fd57df`)
- Spec: [[../docs/superpowers/specs/2026-05-25-multichannel-notifications-design]]
- Session handoff: [[../SESSION-HANDOFF]]
