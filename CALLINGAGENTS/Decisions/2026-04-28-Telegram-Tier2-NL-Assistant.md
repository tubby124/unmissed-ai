---
type: decision
status: shipped
tags:
  - decision
  - telegram
  - openrouter
  - haiku
date: 2026-04-28
shipped_pr: https://github.com/tubby124/unmissed-ai/pull/47
merge_sha: 74f1ac4
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[00-Inbox/Telegram-Tier2-Design-2026-04-28]]"
  - "[[00-Inbox/Telegram-Tier3-Followups-2026-04-28]]"
updated: 2026-04-28
---

# Decision — Telegram Tier 2: NL Q&A + Discoverable Tap Surface

## Context

Tier 1 (PR #41) shipped six slash commands behind a router with multi-tenant scoping, in-memory rate limiting, and `update_id` idempotency. Tier 2 had two competing designs:

1. **LLM-first** — every non-slash text goes to Haiku, no shortcuts.
2. **Keyword + LLM** — plain words ("calls", "today") short-circuit to slash equivalents; everything else goes to Haiku.

The hard constraint: SMB owners (Brian, Mark, Alisha) do **not** know slash commands exist. The bot has to be usable without typing.

## Decision

Ship Tier 2 with three layered surfaces:

1. **Bot menu** — `setMyCommands` + `setChatMenuButton` register the six commands so Telegram's official Menu button + `/` autocomplete populate without owner education.
2. **Persistent inline keyboard** — every reply (Tier 1 + Tier 2 + onboarding `/start` success) ends with the same static 4-button keyboard (📞 Calls / ⏰ Today / 🔔 Missed / 📊 Minutes). Buttons emit short-code `callback_data` (≤64 bytes) that the webhook re-dispatches through `routeTelegramMessage` as a synthetic message.
3. **Keyword shortcuts** — plain "calls" / "today" / "missed" / "minutes" match before the LLM fires (no OpenRouter cost). Everything else is NL Q&A.

NL Q&A uses `anthropic/claude-haiku-4-5` via OpenRouter, 15s `AbortSignal.timeout`, 600 max_tokens. System prompt grounds in last 20 `call_logs` + `business_facts` + `extra_qa` scoped by `chat_id → client_id`. Citation guard regex rejects replies with phone/UUID claims absent from context. Reply formatted as HTML; tables for 3+ rows, short text otherwise.

PII-free cost telemetry via new `telegram_assistant_log` (chat_id, client_id, model, input_tokens, output_tokens, latency_ms, outcome, created_at). User questions and reply text are NOT logged.

Tier 1 commands remain functional when OpenRouter is down — `routeTelegramMessage` falls through to the assistant only on the default branch.

## Why this over the alternatives

- **Discoverability beats LLM cleverness.** A bot a non-technical owner can't navigate by tapping is invisible, regardless of how smart its replies are. The 4-button keyboard is the actual product surface; the LLM is a power-user feature on top.
- **Keyword shortcuts cap cost.** "calls" / "today" / "missed" are the queries owners send most. Skipping the LLM on those eliminates the bulk of OpenRouter spend at the cost of three lines of router logic.
- **`callback_query` re-dispatch reuses the same router.** Tap and type produce identical replies because both flow through `dispatchCommand`. No separate code path to drift.
- **Static keyboard on every reply enforces "tap-only" UX.** Owners never have to know slash commands exist.

## Consequences

Positive:
- Owners can complete a full session (open bot → see calls → check minutes → mark called back later in Tier 3) without typing a single character.
- Cost ceiling per turn is ~$0.0005 (Haiku 4.5 rates × 2K input + 300 output). Realistic-heavy estimate: $7.50/mo across 5 clients.
- Tier 1 is independently testable and stays functional during OpenRouter outages.
- Citation guard catches the easy fabrication failures (phone numbers, UUIDs) without an extra LLM pass.

Negative / accepted:
- **Typing dot fades mid-wait** during 12-14s LLM turns (Telegram's `sendChatAction` only persists ~5s). Accepted vs. firing on a 4s interval — the inline keyboard arrival is the actual "I'm done" signal. Documented in `route.ts` and `Tier3-Followups.B.3`.
- **Citation guard is regex-only** — misses fabricated caller names, time claims, service-type assertions. Tier 3+ adds 1% reply-audit sampling so a stricter validator can be designed against real traffic.
- **In-memory rate limiter** resets on Railway redeploy. Acceptable for cost guard; insufficient for confirm tokens (handled by Tier 3 with `telegram_pending_actions`).
- **Bot token is shared across all clients today** (`@hassitant_1bot`). Per-client tokens are in the schema but the white-label fleet is deferred to Tier 4.

## Status

**Shipped** — PR #47 squash-merged 2026-04-28, sha `74f1ac4`. Lint cleanup followup (`const outcome`) shipped as PR #48 sha `a0e409f`.

## What's next

Tier 3 (mutation surface) — see [[Decisions/2026-04-28-Telegram-Tier3-Mutation-Surface]] and [[00-Inbox/NEXT-CHAT-Telegram-Tier3]].
