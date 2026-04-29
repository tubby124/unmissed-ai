---
type: followup-notes
status: open
related:
  - "[[00-Inbox/Telegram-Tier2-Design-2026-04-28]]"
  - "[[00-Inbox/NEXT-CHAT-Telegram-Tier2]]"
  - "[[Features/Telegram-Two-Way-Assistant]]"
updated: 2026-04-28
source: Tier 2 build session (PR #47)
---

# Telegram Tier 3 — Follow-ups + Gaps Discovered During Tier 2

> Captured the moment they surfaced so the Tier 3 cold-start prompt
> can pull them in. Not in scope for Tier 2 (PR #47).

---

## A. Real gaps Tier 2 left open

### A.1 Callback_query identity verification
The `update.callback_query` branch resolves `chat_id → client_id`
fresh on every tap, same as a typed message. But Telegram **does
not authenticate the chat_id at the callback level** — a malicious
actor who spoofs an `update.callback_query` payload to our webhook
endpoint would be ignored only because we don't expose a webhook
secret. If we ever add a webhook secret, callback_query branch must
also validate it. **Today this is fine — flag for Tier 3 design.**

### A.2 In-memory rate limiter resets on Railway redeploy (L4 confirmed)
Tier 1 already documents this (`SlidingWindowRateLimiter` lives in
process memory). Tier 2 inherits it. **Tier 3 confirm-token TTL
store MUST be DB-backed** (`telegram_pending_actions` table per
audit §H.2) — otherwise a redeploy mid-confirm-flow voids the
pending action and the owner's tap silently fails.

### A.3 Citation guard is regex, not LLM-validated
`citationGuardOk()` checks phones (≥10 digits) and UUIDs against
known data. It will MISS:
- Caller names invented by the LLM (no name list to compare against
  cheaply — would need fuzzy matching or a second LLM pass)
- Time/date claims that contradict `started_at`
- Service-type assertions not present in the data

Acceptable for v1 because the prompt rule + temperature default
keep this rare, but log review on real traffic should drive a
v2 guard. Add a "reply audit" cron in Tier 3+ that samples
`telegram_assistant_log` rows and runs the original RECENT_CALLS
+ reply through a stricter validator.

### A.4 Bot token is shared across all clients
`platformBotToken = process.env.TELEGRAM_BOT_TOKEN` is written to
EVERY client's `clients.telegram_bot_token` on connect. So
`@AIReceptionist_bot` (renamed from `@hassitant_1bot` 2026-04-28) is the
single pipe for all clients today. Future
white-label clients ("@yourcompany_bot") will need:
- Per-client bot token storage (already supported by the column)
- Per-client `setMyCommands` / `setChatMenuButton` calls during
  bot creation
- Webhook routing by bot username, not chat_id alone (or one
  webhook URL per bot)

**Not Tier 3 scope** — flag for a future "bot fleet" milestone.

### A.5 Operator (Hasan) chat has no operator-only command surface
The audit calls out `/clients` and `/health` as operator commands.
Tier 2 still routes operator messages through the same client
lookup (slug='hasan-sharif'). Tier 3 should add:
- `/clients` — list all active clients with chat_id status
- `/health` — last-deploy hash, OpenRouter latency p95, DB lag
- `/spend` — telegram_assistant_log aggregate this month
Gate: `client.slug === 'hasan-sharif'` (operator only).

### A.6 Reserved Tier 3 callback codes are advertised but unbuilt
`cb:<id>` and `mk:<id>` are reserved in `menu.ts`. Tier 2 NL
replies with `intent='urgent'` ALSO show those buttons in the
context-aware keyboard (per design). **Today the urgent keyboard
in commit 0 only includes static codes** — I deliberately did NOT
emit `cb:<top_id>` / `mk:<top_id>` from `buildContextActionsKeyboard`
because those handlers aren't built. When Tier 3 ships, the urgent
intent keyboard must START emitting those codes; right now it's
the static `📞 Calls / ⏰ Today / 🔔 Missed` set. Note this in the
Tier 3 cold-start.

---

## B. Things we didn't think about until building

### B.1 `let outcome` lint nit shipped to prod
Trivial — flagged by ESLint after commit 6. Production builds and
runs fine. Send a 1-line follow-up PR (`const outcome` instead of
`let outcome`) before any future Tier 3 PR so the diff is clean.

### B.2 `npx tsx` is now mandatory locally — not in package.json
`tsx` runs via npx every time. With `npm test:all` running 33+ test
files, this adds a few seconds per invocation. Consider adding
`tsx` to devDependencies for faster CI feedback. Out of scope for
Tier 3 but a 1-min cleanup.

### B.3 Webhook fast-ack vs sendChatAction
`handleAssistantRequest` awaits `sendChatAction("typing")` BEFORE
calling OpenRouter. Telegram's typing indicator only persists ~5s,
so for a 12-14s LLM call the typing dot fades mid-wait. Two options
for Tier 3:
- Re-fire `sendChatAction` every 4s while waiting (interval timer)
- Accept the fade — the inline keyboard still arrives with the reply

I'd accept the fade. Document the choice.

### B.4 No per-client monthly LLM spend cap
Cost math says realistic-heavy is $7.50/mo. Worst case (theoretical
saturation) is $1,080/mo. The rate limiter (10 turns/min) is the
only gate. Tier 3 should add a per-client monthly cap read from
`clients` (e.g. `telegram_assistant_monthly_cap_usd` defaulting to
$5) — when exceeded, the assistant returns a polite throttle reply
and Tier 1 keeps working. Add to schema + queries.

### B.5 `telegram_assistant_log` has no retention policy
Inserts grow forever. Add a Tier 3+ cron: `DELETE FROM
telegram_assistant_log WHERE created_at < now() - interval '90 days'`.
Or partition by month. Low-priority but easier to plan now than
retro-fit at 100K rows.

### B.6 Group-chat data leak guard is router-only, not webhook-only
`routeTelegramMessage` returns `noop` for `chatType !== 'private'`.
But the `/start` registration path (lines 167-225 of
`webhook/telegram/route.ts`) does NOT check chat_type — if a client
adds the bot to a group and someone pastes the registration token,
the registration would succeed and write a GROUP chat_id to
`clients.telegram_chat_id`. **Result:** all subsequent alerts
broadcast to the group.

This is a latent Tier 1 gap, not a Tier 2 regression. Fix:
add `if (chatType !== 'private') return 200` at the top of the
`/start` branch too. Could ship as a tiny standalone fix-up PR
before Tier 3.

### B.7 `dispatchCommand` is now public API
`router.ts` exports `dispatchCommand` so the callback_query handler
can reuse it. Future maintainers may be tempted to call it from
arbitrary places (e.g. a cron). It assumes:
- `client` is already auth'd (chat_id resolved)
- Rate limiting is already applied (or skipped intentionally)
- Idempotency check is already done

Document this in a JSDoc or rename to `_internalDispatchCommand`
to signal it's not a general-purpose entry point.

---

## C. Tier 3 cold-start prompt — additions

When writing the Tier 3 cold-start prompt, **add these sections**:

1. **Operator-only commands** (`/clients`, `/health`, `/spend`)
   gated by slug='hasan-sharif'.
2. **Confirm-token TTL store** (`telegram_pending_actions` table —
   chat_id, client_id, action_kind, payload_json, token UUID, ttl
   60s). DB-backed so redeploys don't void pending actions.
3. **Tier 3 callback dispatch** — `cb:<id>` and `mk:<id>` codes
   wire to `lead_status` PATCH endpoints. Update
   `buildContextActionsKeyboard('urgent')` to emit these codes
   from the actual top urgent call's `id` (currently static).
4. **Per-client spend cap** — new `clients.telegram_assistant_cap_usd`
   column + a query that sums `input_tokens × $1/M + output_tokens
   × $5/M` from `telegram_assistant_log` for this calendar month.
   When exceeded: `"You've hit this month's assistant cap. Tier 1
   commands still work."`
5. **Group-chat guard on /start** — add `if (chatType !== 'private')
   return 200` at the top of the `/start` branch (B.6). Trivial
   ship.
6. **Reply-audit sampling** — log a 1% sample of (system_prompt
   hash, reply, recentCalls_count, citation_passed) to a separate
   table so we can review hallucination rate manually. PII-free
   if we hash the prompt instead of storing it raw.
7. **Mark-as-called-back action** — `mk:<id>` must call the same
   PATCH endpoint the dashboard uses (`lead_status='contacted'` or
   similar) to maintain path-parity per audit §F.

---

## D. What NOT to do in Tier 3

- ❌ Don't write directly to `clients.*` from Tier 3 mutations.
  Route through existing dashboard PATCH endpoints to preserve
  prompt patchers, knowledge reseed, and Ultravox sync. (Audit §C.2)
- ❌ Don't expand the slash command list past ~10 entries. Telegram's
  menu becomes unusable past that on small screens.
- ❌ Don't add a webhook secret retroactively without also updating
  the callback_query handler to validate it (A.1).
- ❌ Don't trust `update.callback_query.from` for client identity —
  always re-resolve `chat_id → clients` fresh.
