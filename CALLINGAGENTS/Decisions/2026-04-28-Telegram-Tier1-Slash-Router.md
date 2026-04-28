---
type: decision
status: shipped
date: 2026-04-28
tags:
  - telegram
  - architecture
  - decision
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
  - "[[Architecture/control-plane-mutation-contract]]"
  - "[[Architecture/webhook-security-and-idempotency]]"
---

# Telegram Tier 1 — Slash router with no LLM, no new external deps

## Context

@hassitant_1bot was a one-way notifier: outbound post-call summaries worked, but every inbound message besides `/start <token>` was silently dropped at [src/app/api/webhook/telegram/route.ts:56-58](../../src/app/api/webhook/telegram/route.ts#L56-L58). Brian, Mark, and Alisha all check Telegram more than the dashboard. Domain is blocked (S15) so email-default is not an option.

We need to give clients a read-side surface from their phone without taking on:
- LLM cost or new env vars
- A new schema for conversation memory
- A new auth model

## Decision

Replace the silent-drop gate with a slash-command router. Six commands, all pure DB lookups: `/help`, `/calls`, `/today`, `/missed`, `/lastcall`, `/minutes`. No LLM. No new external dependency.

## What got built

- [src/lib/telegram/router.ts](../../src/lib/telegram/router.ts) — dispatch + private-chat guard + per-chat_id rate limiter (10/min) + multi-tenant gate
- [src/lib/telegram/queries.ts](../../src/lib/telegram/queries.ts) — `fetchClientByChatId`, `fetchLastNCalls`, `fetchTodayCalls`, `fetchMissedCalls`, `recordUpdateSeen`. All scoped by `client_id` derived from `chat_id` — never trusts the message body.
- [src/lib/telegram/format.ts](../../src/lib/telegram/format.ts) — HTML `<pre>` table renderer + summary card with optional inline signed recording URL
- [supabase/migrations/20260428100000_create_telegram_updates_seen.sql](../../supabase/migrations/20260428100000_create_telegram_updates_seen.sql) — `update_id` dedup table (Telegram retries on 5xx for 24h)
- [src/lib/__tests__/telegram-router.test.ts](../../src/lib/__tests__/telegram-router.test.ts) — 11 tests covering group-chat guard, multi-tenant isolation, rate limit, idempotency, command dispatch
- [src/app/api/webhook/telegram/route.ts](../../src/app/api/webhook/telegram/route.ts) — wires router; `/start` registration path unchanged

## Why slash before NL

- **Cost.** $0/month at any volume vs. ~$0.0005/turn for Tier 2 LLM. Tier 1 is ship-once-forget.
- **Latency.** Sub-2s. One DB query, one Telegram sendMessage.
- **Failure modes.** Tier 1 keeps working when OpenRouter is down. Tier 2 will sit on top of Tier 1, not replace it.
- **Verification.** Every reply is a typed DB row — no fabrication risk. NL builds confidence on top of this baseline.

## What we explicitly didn't do

- **No webhook secret.** The UUID `telegram_registration_token` is the auth for `/start`; the chat_id → clients lookup is the auth for everything else. Documented in [webhook-security-and-idempotency.md §2](../../docs/architecture/webhook-security-and-idempotency.md). Adding a secret causes silent drops during deploys, which is the bigger risk for a notification surface.
- **No conversation memory table.** Single-turn per message. Add `telegram_conversations` only if multi-turn coherence becomes the top complaint.
- **No write paths.** Every mutation (Tier 3) will route through existing dashboard PATCH endpoints to preserve prompt patchers, tool registration, and Ultravox sync (the fake-control rule from [core-operating-mode.md](../../.claude/rules/core-operating-mode.md)).

## Multi-tenant rule (hard)

`chat_id → clients.id` is the multi-tenant boundary. Every DB query inside the router filters by the resolved `client_id` — message body is untrusted. The fake supabase test harness [src/lib/__tests__/telegram-router.test.ts](../../src/lib/__tests__/telegram-router.test.ts) verifies this with a "leak" call from a different client_id that must never appear in the reply.

## Idempotency rule

Telegram retries any 5xx for 24h. `telegram_updates_seen(update_id pk)` gives us O(1) dedup with a 48h cleanup window. RLS denies all to anon/authenticated; service role bypasses for the webhook.

## Bug-bucket classification

| Bucket | Status |
|---|---|
| source-of-truth | OK — `chat_id → client_id` is the only auth path |
| propagation | OK — Tier 1 is read-only, no agent sync needed |
| path-parity | Latent for Tier 3 — every write must go through dashboard PATCH |
| fake-control | Latent for Tier 3 — never write directly to `clients.*` |
| partial-failure | OK — rate limit + idempotency + Tier 1 doesn't depend on Tier 2 |
| capability-gating | Deferred to Tier 3 — plan entitlements re-evaluated at the dashboard PATCH layer |
| duplicate-surface | OK — Tier 1 reuses `call_logs` columns the dashboard already reads |

## Verification

- `npx tsx --test src/lib/__tests__/telegram-router.test.ts` — 11/11 pass
- `npm run build` — green
- Migration applied to prod Supabase `qwhvblomlgeapzhnuwlb` 2026-04-28T23:01:52Z
- PR #41 squash-merged: https://github.com/tubby124/unmissed-ai/pull/41 (sha `03ad11c0`)

## Smoke test

From any registered client chat_id, send:
- `/help` → command list (no DB read needed)
- `/calls` → last-5 table or "No calls yet" message
- `/today` → today's calls in client timezone
- `/missed` → HOT/WARM that haven't been called back
- `/lastcall` → full summary with inline signed recording URL (1h TTL)
- `/minutes` → "X / Y min used (Z%) — N min remaining this cycle"

If a non-registered chat_id messages the bot: "This bot only responds to clients of unmissed.ai."

## Followups

- [[00-Inbox/NEXT-CHAT-Telegram-Tier2]] — Tier 2 cold-start prompt (NL Q&A via OpenRouter Haiku 4.5)
- Tier 3 wave 1 actions: `mark_called_back` (call_logs.lead_status), `add_vip` (existing client_contacts endpoint)
- WhatsApp port: rename `chat_id` → `wa_id`, swap sendMessage wrapper, ~1 day delta when WhatsApp Business API is mature
