---
type: decision
status: ready-to-build
tags:
  - decision
  - telegram
  - mutations
  - operator-surface
date: 2026-04-28
cold_start: "[[00-Inbox/NEXT-CHAT-Telegram-Tier3]]"
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[Decisions/2026-04-28-Telegram-Tier2-NL-Assistant]]"
  - "[[00-Inbox/Telegram-Tier3-Followups-2026-04-28]]"
  - "[[Architecture/control-plane-mutation-contract]]"
updated: 2026-04-28
---

# Decision — Telegram Tier 3: Mutation Surface + Operator Commands

## Context

After Tier 2 shipped, owners can read everything but change nothing. The next logical step is to make the bot a mutation surface — owner taps "📞 Call back top lead" → bot routes the action through the existing dashboard PATCH endpoints. Three forces shape this tier:

1. **Standing rule (`control-plane-mutation-contract.md`)** — never write directly to `clients.*` from auxiliary surfaces. Always reuse the dashboard PATCH endpoint that already does the same mutation.
2. **Confirmability** — destructive actions need a confirm step that survives a Railway redeploy.
3. **Operator visibility** — Hasan needs a fleet view (`/clients`, `/health`, `/spend`) without building a separate admin dashboard yet.

## Decision

Tier 3 is one PR, nine commits, no breaking changes to Tier 1 or Tier 2.

**Confirm-token TTL store (DB-backed).** New `telegram_pending_actions` table: `chat_id`, `client_id`, `action_kind`, `payload jsonb`, `token uuid unique`, `expires_at timestamptz`. 60-second TTL. Deletes-on-read pattern (no separate sweeper required for v1; nightly cron documented for later).

**Callback dispatch.** Three new code prefixes wired in `menu.ts`:
- `cb:<lead_id>` — "Call back" lead — emitted dynamically when intent='urgent' and there's a top urgent call
- `mk:<lead_id>` — "Mark called back" lead — same emission rule
- `cf:<token_uuid>` — "Confirm" pending action

Tap flow: `cb:<id>` / `mk:<id>` → bot creates a `pending_action` row + replies "📞 Call back &lt;name&gt;?" with [✅ Confirm cf:&lt;token&gt;] + [❌ Cancel]. Tap on `cf:<token>` → resolve token (multi-tenant guard) → execute via dashboard PATCH endpoint → `answerCallbackQuery` toast.

**Operator commands.** `/clients`, `/health`, `/spend` gated by `clients.slug === 'hasan-sharif'` BEFORE the NL fallback fires. `/health` respects the project's "no IDs in health endpoints" rule — fleet-aggregate status only.

**Per-client spend cap.** New column `clients.telegram_assistant_cap_usd` (default `5.00`). MTD spend computed from `telegram_assistant_log` at Haiku 4.5 rates ($1/M in, $5/M out). When exceeded, polite throttle reply for NL Q&A; Tier 1 commands remain exempt.

**1% reply-audit sampling.** `Math.random() < 0.01` inside `handleAssistantRequest`, fire-and-forget insert into `telegram_reply_audit` (system_prompt sha256 hash + reply text + recentCalls_count + citation_passed). PII-free; user questions never logged.

**Group-chat `/start` guard.** Latent Tier 1 bug — `/start` registration path doesn't check `chat.type !== 'private'`. Lands as commit 0 of Tier 3 (separable; could spin out as its own PR if Tier 3 grows).

**90-day retention.** SQL function deleting `telegram_assistant_log` + `telegram_reply_audit` rows older than 90 days. Document as a manual nightly job if `pg_cron` isn't available in this Supabase tier.

## Why this over the alternatives

- **Why DB-backed pending actions (not in-memory)?** The Tier 1 in-memory rate limiter is fine to lose on redeploy because losing 1 minute of rate-limit state is harmless. Losing a confirm token mid-flow silently breaks a destructive mutation — owner taps Confirm and nothing happens. DB-backed is the right cost.
- **Why route mutations through dashboard PATCH?** Direct writes to `clients.*` skip prompt patchers, knowledge reseed, and Ultravox sync. The mutation contract document is explicit. Reuse beats reinvention.
- **Why slug-based operator gate (not `clients.telegram_owner_user_id`)?** Premature schema. Hasan is the only operator. When a second operator joins, Tier 4 introduces the column. Until then, slug match is one line of code.
- **Why 1% sampling (not 100%)?** 100% means a row per turn; at realistic 300 turns/mo across 5 clients, that's 300 rows/mo for a feature that's manually reviewed. 1% gives 3 rows/mo — enough to spot patterns, cheap to keep.
- **Why a soft throttle (not a hard kill)?** Hitting the cap shouldn't break Tier 1. The throttle reply tells the owner what happened; `/calls` / `/missed` / `/minutes` keep working.
- **Why no webhook secret yet?** Adding one without also validating `update.callback_query` would create a false sense of security. Tier 4 ships them together.

## Consequences

Positive:
- Owner can mark a lead called back via two taps. No typing.
- Cost ceiling per client is enforceable; runaway loops are throttled, not bankruptcy.
- Operator surface unlocks fleet visibility without building a new dashboard.
- Reply-audit creates the data needed to design a stricter Tier 4 hallucination guard.
- Group-chat `/start` leak closed (latent Tier 1 bug).

Negative / accepted:
- **Confirm token can be replayed within 60s if intercepted.** Mitigated by multi-tenant guard (token issued to chat A is rejected if used in chat B). Webhook signature would harden further; deferred to Tier 4.
- **`dispatchCommand` becomes effectively-public** because cron-style misuse is possible. Mitigated by JSDoc warning + commented invariants. Refactor to formal `_internalDispatchCommand` deferred to Tier 4.
- **`telegram_reply_audit` grows ~3 rows/mo** but has no automated review path — reviewing is a Hasan task. Acceptable trade-off vs. building a review UI in Tier 3.

## Status

**Ready to build** — cold-start prompt at [[00-Inbox/NEXT-CHAT-Telegram-Tier3]]. Open a fresh chat at the repo root, paste the fenced block from the cold-start file, and the next agent will produce a design doc first, then build 9 commits in one PR.

## What's next

After Tier 3 lands: monitor the reply-audit table for fabrication patterns; design Tier 4 (per-client white-label bot fleet + webhook signature + formal operator-user model) when the first white-label client signs OR the audit data demands a stricter citation guard.
