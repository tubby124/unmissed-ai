---
type: design-doc
status: ready-for-greenlight
related:
  - "[[00-Inbox/NEXT-CHAT-Telegram-Tier3]]"
  - "[[00-Inbox/Telegram-Tier3-Followups-2026-04-28]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
  - "[[00-Inbox/Telegram-Tier2-Design-2026-04-28]]"
  - "[[Architecture/control-plane-mutation-contract]]"
  - "[[Features/Telegram-Two-Way-Assistant]]"
updated: 2026-04-28
---

# Telegram Tier 3 — Design Doc (Confirmable Mutations + Operator Surface + Cost Guard)

> Scope: turn the bot from read-only into a controlled mutation surface — owners tap to act, operator gets a fleet view, every client gets a monthly LLM spend cap. Tier 1 + Tier 2 must keep working untouched. Repo root: `/Users/owner/Downloads/CALLING AGENTs`. Branch: `feat/telegram-tier3`. Single PR.

---

## a) `telegram_pending_actions` schema + resolver

**Migration file:** `supabase/migrations/20260428210000_create_telegram_pending_actions.sql`

```sql
CREATE TABLE IF NOT EXISTS public.telegram_pending_actions (
  token        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      bigint      NOT NULL,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action_kind  text        NOT NULL CHECK (action_kind IN ('mark_called_back','call_back_lead')),
  payload      jsonb       NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_pending_chat_expires
  ON public.telegram_pending_actions (chat_id, expires_at);

ALTER TABLE public.telegram_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON public.telegram_pending_actions
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sweeper.** "Delete-on-read" pattern — simpler than pg_cron in Supabase. Every `resolvePendingAction()` call first runs `DELETE FROM telegram_pending_actions WHERE expires_at < now()` (one extra round-trip, ~5ms). Acceptable because the table holds at most ~5 rows in flight at any time. A separate nightly retention DELETE on `telegram_assistant_log` and `telegram_reply_audit` ships in the retention commit (see h).

**Token format.** `cf:<uuid_v4>` — 39 bytes (well under Telegram's 64-byte `callback_data` cap, per L14). UUID v4 from `gen_random_uuid()`. TTL 60 seconds (per ground rules).

**Resolver semantics.**
```
createPendingAction(supa, client_id, chat_id, kind, payload)
  → INSERT, return token (uuid)

resolvePendingAction(supa, token, chat_id)
  → DELETE FROM telegram_pending_actions WHERE expires_at < now()        -- sweeper
  → SELECT ... WHERE token=$1 AND chat_id=$2 AND expires_at > now()     -- multi-tenant guard via chat_id
  → if no row: return null  (caller replies "expired" — never leak existence to a wrong chat_id)
  → DELETE WHERE token=$1                                                -- consume
  → return { client_id, action_kind, payload }
```

The `chat_id` predicate in the SELECT is the multi-tenant guard against L12 (a token issued in chat A used in chat B is silently ignored — the SELECT returns nothing, identical to expiry). No information leak about whether the token existed in the other chat.

---

## b) `cb:<id>` / `mk:<id>` wiring

**Today** (`src/lib/telegram/menu.ts`): `buildContextActionsKeyboard('urgent')` always emits the static `📞 Calls / ⏰ Today / 🔔 Missed` set — `cb:<id>` and `mk:<id>` are reserved prefixes only, no real handler.

**After Tier 3.** `buildContextActionsKeyboard(intent, opts?)` accepts an optional `{ topUrgent?: { id: string; name: string | null } }`. When `intent === 'urgent'` and `topUrgent` is present, the keyboard becomes:

```ts
inline_keyboard: [
  [{ text: '📞 Call back ' + (topUrgent.name ?? 'top lead'), callback_data: 'cb:' + topUrgent.id }],
  [{ text: '✅ Mark called back', callback_data: 'mk:' + topUrgent.id }],
  [{ text: '🔔 See all missed', callback_data: 'm' }],
]
```

Falls back to today's static set when there is no top urgent call (preserves the Tier 2 contract for the empty-state case).

**Wiring point** (`src/lib/telegram/assistant.ts` `handleAssistantRequest` → caller). After `inferIntent` returns `'urgent'`, look up the top HOT/WARM row in `recentCalls` (the array we already fetch for the system prompt) — first row where `call_status ∈ ('HOT','WARM')` AND `lead_status IS NULL OR lead_status='new'`. Pass `{ id, name: caller_name }` into `buildContextActionsKeyboard`. Zero extra DB reads.

**Callback dispatch table** (added to webhook `route.ts` callback_query branch, after the existing Tier 2 single-letter codes and before the `Tier3ReservedCode` fallback):

| `data` value | Action |
|---|---|
| `cb:<id>` | Look up call by id (scoped to chat_id's client). Create pending action `kind='call_back_lead'`, `payload={call_id, name, phone}`. Reply: `"📞 Call back <name> (<phone>)?\n\nLast call <HH:MM>."` + 2-button keyboard `[✅ Confirm cf:<token>] [❌ Cancel]`. |
| `mk:<id>` | Look up call. Create pending action `kind='mark_called_back'`, `payload={call_id, name}`. Reply: `"✅ Mark <name> called back?"` + 2-button keyboard `[✅ Confirm cf:<token>] [❌ Cancel]`. |
| `cf:<uuid>` | `resolvePendingAction(supa, uuid, chat_id)`. If null → `answerCallbackQuery(toast='That confirmation expired.')` + sendMessage `"That confirmation expired. Tap the action again to retry."`. If valid → execute via shared mutator (see ground rule below), `answerCallbackQuery(toast='Done — <name> marked called back ✅')`, sendMessage follow-up with the static keyboard. |
| `cancel:<uuid>` | Idempotent best-effort delete on the pending row. Toast `"Cancelled."` Static keyboard. |

**`cb:<id>` is "stage one"** — it does NOT dial out. It only opens the confirm flow that, on `cf:<uuid>` tap, marks `lead_status='called_back'` (same semantic as `mk:`) and includes the phone number prominently in the reply so the owner can tap-to-call from Telegram. We are NOT building a Twilio outbound dial path in Tier 3 (per "DO NOT in this PR" → no per-client bot fleet, no production voice changes). The owner's phone makes the call. This matches the Top-1% bar item "owner can mark a lead called back without typing — only tapping" — `cb:` and `mk:` both end at `lead_status='called_back'`; `cb:` adds the dial affordance.

---

## c) Operator commands (`/clients`, `/health`, `/spend`)

**Gate** (in `router.ts` `dispatchCommand`, BEFORE the existing `case '/help'`):

```ts
if (cmd === '/clients' || cmd === '/health' || cmd === '/spend') {
  if (client.slug !== 'hasan-sharif') {
    // Non-operator typing /clients should not 404 — fall through to NL assistant.
    // Returning kind:'fallthrough' here would re-trigger /start logic; instead
    // route as plain text to the assistant.
    return { kind: 'assistant', text, client }
  }
  return dispatchOperator(cmd, ctx)
}
```

This means a non-operator who types `/clients` gets a normal Tier 2 NL reply ("I don't have that yet — try /calls or /missed") rather than command leakage. The audit §J "operator commands gated" rule is preserved.

**`src/lib/telegram/operator.ts`** — three pure render functions, each takes `supa` + returns `RouterResult`:

`/clients` output (≤80 char rows, per design constraint):
```
<b>Fleet — 5 active clients</b>
<pre>
slug                  chat_id     last_call    minutes_used  cap_pct
hasan-sharif          ✅ 7847…    12 min ago   142/600       18%
windshield-hub        ✅ 5121…    2h ago       89/600        —
exp-realty            ✅ 9333…    4h ago       3/600         0%
urban-vibe            ❌ —        —            —             —
calgary-prop-leasing  ✅ 6612…    yesterday    27/600        —
velly-remodeling      ✅ 8401…    —            0/0           —
</pre>
```
- `chat_id` shown truncated (`✅ 7847…` = first 4 digits, `❌ —` if null) — fleet view is operator-private but truncation is hygiene.
- `cap_pct` is MTD assistant spend ÷ `clients.telegram_assistant_cap_usd`, blank if cap is null.

`/health` output (per L19 — no slugs, no agent IDs, ever):
```
<b>Fleet health</b>
Deploys: ✅ <code>74f1ac4</code> (Railway 4 min ago)
OpenRouter p95: 1.8s (last 1h)
DB lag: 0.3s
Active clients: 5
Errors (24h): 0
```
- Deploy SHA from `process.env.RAILWAY_GIT_COMMIT_SHA` truncated to 7 chars.
- OpenRouter p95 = 95th percentile of `telegram_assistant_log.latency_ms` for `outcome='ok'` over the last 1h, all clients.
- DB lag = `now() - max(call_logs.created_at)` truncated to seconds (proxy for "is the DB writing").
- Errors = count of `telegram_assistant_log.outcome IN ('error','timeout')` last 24h.
- **Regex assertion in tests:** the rendered string must match `^[^a-zA-Z]*$` for the first word of each line that's a slug-shaped token (no `[a-z-]{4,}` matching a known slug). See test 7.

`/spend` output (MTD aggregate per client_id, self only — operator can drill in via `/clients`):
```
<b>This month</b>
hasan-sharif: $0.07 / $5.00 (1.4%)
142 turns · ok=140 fallback=2 timeout=0 error=0
```

**Cost math** (shared with d):
```
spend_usd = SUM(input_tokens) * 1e-6 * $1.00
          + SUM(output_tokens) * 1e-6 * $5.00
```
Scoped to `client_id` for the calling client. Filter: `created_at >= date_trunc('month', now() AT TIME ZONE 'America/Regina')` (per L17 timezone rule).

---

## d) Per-client spend cap

**Schema add** (in the same migration file as `telegram_pending_actions`):
```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_assistant_cap_usd numeric(10,4) NOT NULL DEFAULT 5.00;
```
Default $5.00 — matches the prompt's spec.

**Check location.** `assistant.ts` `answerForClient`, BEFORE the OpenRouter fetch and AFTER the recentCalls fetch:

```ts
const cap = Number(client.telegram_assistant_cap_usd ?? 5.00)
if (cap > 0) {
  const mtdSpend = await fetchMtdSpendUsd(opts.supa, client.id, opts.timezone)
  if (mtdSpend >= cap) {
    return {
      reply: `You've hit this month's assistant cap ($${cap.toFixed(2)}). Tier 1 commands like /calls, /missed, /minutes still work.`,
      outcome: 'fallback',
      intent,
      model: MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    }
  }
}
```

`fetchMtdSpendUsd(supa, clientId, tz)` lives in `src/lib/telegram/spend.ts` — single SQL aggregate query, ~10ms.

**Tier 1 commands are EXEMPT** (per L17). They never call `answerForClient`; the cap check sits inside the Tier 2 path only. `/calls`, `/missed`, `/minutes`, `/today`, `/lastcall`, `/help` keep working with the cap exhausted.

**Outcome telemetry.** Throttled-cap turns log to `telegram_assistant_log` with `outcome='fallback'`, `input_tokens=0`, `output_tokens=0`. This makes the throttle visible in `/spend` and `/health` ("fallback=N" in `/spend`, included in errors-24h aggregate is cleaner if we exclude it from the error count — implementation: only count `outcome IN ('error','timeout')`, not `'fallback'`).

---

## e) Reply-audit sampling (1%)

**Migration** (same migration file or sibling):
```sql
CREATE TABLE IF NOT EXISTS public.telegram_reply_audit (
  id                  bigserial PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  system_prompt_hash  text        NOT NULL,        -- sha256 hex digest
  reply               text        NOT NULL,
  recent_calls_count  integer     NOT NULL,
  citation_passed     boolean     NOT NULL,
  intent              text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_reply_audit_client_created
  ON public.telegram_reply_audit (client_id, created_at DESC);

ALTER TABLE public.telegram_reply_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON public.telegram_reply_audit
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample location.** `assistant.ts` `answerForClient`, AFTER `citationGuardOk` check resolves to a final reply (whether `'ok'` or fallback-via-citation), with this pattern:

```ts
if (Math.random() < 0.01) {
  void supa.from('telegram_reply_audit').insert({
    client_id: client.id,
    system_prompt_hash: sha256Hex(systemPrompt),
    reply: content,
    recent_calls_count: recentCalls.length,
    citation_passed: citationGuardOk(content, recentCalls),
    intent,
  })
}
```

`sha256Hex` from `node:crypto`. Hashed because system prompt contains `business_facts` + `extra_qa` which the customer owns (per L16).

**Fire-and-forget exception.** Per command-routing.md "All DB writes awaited", `.then()`-style writes are normally banned. This insert is the documented exception because (a) outcome is non-blocking — user already sees the reply, (b) failure to log is non-user-facing, (c) at 1% sample rate over 5 active clients, the volume is ~3 rows/mo (per L20). The PR body lists this exception explicitly so reviewers don't flag it as a regression.

**No raw user message stored.** Reply is fine (LLM produced it; we already render it in chat). System prompt is hashed. User question is NEVER stored — it inherits Tier 2 L10's no-PII rule.

---

## f) Group-chat /start guard (Commit 0 — separable)

**Diff** at `src/app/api/webhook/telegram/route.ts` line ~229 (top of `/start` branch):

```ts
- const token = text.slice(6).trim() // "/start TOKEN"
+ if (chatType !== 'private') {
+   return new NextResponse('OK', { status: 200 }) // group-chat data leak guard (B.6)
+ }
+ const token = text.slice(6).trim() // "/start TOKEN"
```

`chatType` is already extracted at line 207. Zero new lookups. One-liner.

**Test case.** Synthetic group-chat update body (`message.chat.type='group'`, `text='/start abc'`, real-looking token) → handler returns 200, no DB read on `clients`, no DB write on `telegram_chat_id`, no sendMessage. Mocked Supabase + fetch both assert call count = 0.

**Why ship as commit 0.** It's a latent Tier 1 bug (B.6 — already merged in PR #41 without this guard). Landing it first means commits 1-8 build on a fixed foundation, and the patch is small enough to spin out as its own PR if Tier 3 grows large.

---

## g) Test plan — 12 cases (in `src/lib/__tests__/telegram-tier3.test.ts` + extensions)

| # | Test | Asserts |
|---|---|---|
| 1 | `cb:<id>` tap with valid call in client's set | `telegram_pending_actions` insert mock called once with `kind='call_back_lead'`; sendMessage body contains `Confirm cf:<uuid>` |
| 2 | `cf:<uuid>` tap within 60s | `resolvePendingAction` returns valid row; shared lead_status mutator called with `(call_id, client_id, 'called_back')`; `answerCallbackQuery` mock called with non-empty toast |
| 3 | `cf:<uuid>` tap after 60s (clock advanced 61s) | `resolvePendingAction` returns null; reply contains `"expired"`; mutator NOT called |
| 4 | `cf:<uuid>` from chat B with token issued in chat A | `resolvePendingAction(token, chat_id_B)` returns null; reply identical to test 3 (no leak that token existed); mutator NOT called |
| 5 | `/clients` as `slug='hasan-sharif'` | sendMessage body contains `<pre>` table; row count >= 1; matches `cap_pct` regex |
| 6 | `/clients` as `slug='windshield-hub'` | NO operator output; result is `kind: 'assistant'` (falls through to Tier 2 NL) |
| 7 | `/health` regex assertion | output matches `/Deploys: ✅ <code>/`; output does NOT contain any active client slug (regex: `/(hasan-sharif|exp-realty|windshield-hub|urban-vibe|calgary-property-leasing|velly-remodeling)/i` is absent); no UUID v4 patterns in output |
| 8 | `/spend` with no `telegram_assistant_log` rows for client | output contains `"$0.00"`; output contains `"0 turns"` |
| 9 | Spend cap exceeded (mock `fetchMtdSpendUsd` returns 5.01, cap=5.00) | Tier 2 NL call returns the throttle reply; assert OpenRouter fetch mock NOT called; subsequent `/calls` call still produces real call table (Tier 1 unaffected) |
| 10 | Group-chat `/start` payload | `message.chat.type='group'`; handler returns 200; mocked Supabase `from('clients').update` was NOT called; mocked sendMessage was NOT called |
| 11 | Reply-audit sampling rate | mock `Math.random` to return [0.005, 0.05, 0.005, 0.05, 0.005] across 5 NL turns → 3 audit inserts (the .005 indices); insert payload has `system_prompt_hash` matching `/^[a-f0-9]{64}$/` and no raw prompt text |
| 12 | Audit insert is non-blocking | mock `supa.from('telegram_reply_audit').insert` to throw; `answerForClient` still returns the same reply with `outcome='ok'`; latency unchanged ±5ms |

Existing Tier 1 + Tier 2 tests (~32 + ~17) must all still pass. Total Telegram tests after Tier 3 ≥ 50.

---

## h) Manual ops gates (PR body checklist)

Hasan applies these in order after merge:

1. **Apply migration** — `supabase db push` against project `qwhvblomlgeapzhnuwlb`. Adds `telegram_pending_actions`, `telegram_reply_audit`, `clients.telegram_assistant_cap_usd` (default 5.00).
2. **Set test cap to trigger throttle path** — `UPDATE clients SET telegram_assistant_cap_usd = 0.01 WHERE slug='hasan-sharif';` then send a NL question to confirm throttle reply. Roll back to 5.00 after.
3. **Verify webhook URL still set** — hit `POST /api/admin/setup-telegram-webhook` once. No menu changes (Tier 2 already registered them) but confirms the webhook didn't drift after Railway redeploy.
4. **Smoke-test Tier 1 + Tier 2** — `/calls /today /missed /lastcall /minutes /help` from Hasan's chat. Then ask `"anything urgent?"` and confirm the new urgent keyboard now includes `📞 Call back <name>` + `✅ Mark called back` (cb/mk codes).
5. **Smoke-test Tier 3** — tap `📞 Call back <name>`, confirm cf:<uuid>, watch the lead_status flip in the dashboard `/dashboard/calls/[id]`. Wait 61s, tap an old confirm, see "expired" reply. Confirm group-chat `/start` no-ops.
6. **Retention follow-up** — schedule a manual or pg_cron nightly job: `DELETE FROM telegram_assistant_log WHERE created_at < now() - interval '90 days'` (and same for `telegram_reply_audit`). Implementation lands in commit 7 (chore — retention) but the SQL is run nightly. If pg_cron isn't enabled in Supabase free tier, document the manual run in the PR body and keep it as a reminder.

---

## Build plan recap (commits, in order)

0. `fix(telegram): block /start registration in group chats (B.6)` — one-line guard at the top of the `/start` branch in webhook `route.ts`. Test: synthetic group-chat /start → 200, no DB write, no sendMessage. Separable; could ship as standalone PR.
1. `feat(db): telegram_pending_actions + telegram_reply_audit + telegram_assistant_cap_usd` — single migration file, three schema additions.
2. `feat(telegram): pending-actions store + cf:<uuid> handler` — `src/lib/telegram/pending-actions.ts` (`createPendingAction`, `resolvePendingAction`); webhook callback_query branch routes `cf:<uuid>` through resolver → shared lead_status mutator → answerCallbackQuery toast.
3. `feat(telegram): wire cb:<id> + mk:<id> to confirm prompts` — `menu.ts` `buildContextActionsKeyboard(intent, opts)` accepts `topUrgent`; `assistant.ts` passes `topUrgent` for `intent='urgent'`; webhook callback_query branch handles `cb:` and `mk:` → create pending action → reply with confirm keyboard.
4. `feat(telegram): operator commands /clients /health /spend` — `src/lib/telegram/operator.ts` with three render fns; `router.ts` dispatch BEFORE NL fallback, gated by `slug='hasan-sharif'`; `/health` output passes the no-slug regex assertion.
5. `feat(telegram): per-client spend cap throttle` — `src/lib/telegram/spend.ts` `fetchMtdSpendUsd`; cap check in `assistant.ts` BEFORE OpenRouter fetch; throttle reply with static keyboard; `outcome='fallback'` log row.
6. `feat(telegram): 1% reply-audit sampling` — sha256 hash util; `Math.random() < 0.01` insert in `assistant.ts`; fire-and-forget exception documented in PR body.
7. `chore(telegram): retention SQL + dispatchCommand JSDoc` — manual nightly DELETE recipe in `docs/runbooks/telegram-retention.md`; JSDoc `@internal` on `dispatchCommand` (B.7) — auth + rate limiting + idempotency are caller-enforced; do NOT call from a cron.
8. `test(telegram): full Tier 3 test suite` — all 12 cases above. `npm run build` green. Total Telegram tests ≥ 50.

---

## DO NOT touch (per ground rules)

- ❌ Voice agent prompts on hasan-sharif, exp-realty, windshield-hub, urban-vibe, calgary-property-leasing, velly-remodeling. Tier 3 is router/webhook/DB only.
- ❌ `clients.system_prompt`, Ultravox `updateAgent()`, knowledge reseed pipelines, prompt patchers. Tier 3 mutations write `call_logs.lead_status` only — DB_ONLY mutation class, no agent sync.
- ❌ Per-client bot fleet (`@yourcompany_bot`). Bot token stays shared.
- ❌ Webhook secret. Flag as future milestone — when added, callback_query handler must also validate it (A.1).
- ❌ Direct UPDATEs on `clients.*` from any Tier 3 path. The mutator helper writes only to `call_logs`. Anything else = path-parity violation.

---

## ONE QUESTION before greenlight

**The `lead_status` PATCH endpoint requires user-session auth, which the Telegram service-role context can't satisfy.** I read `src/app/api/dashboard/calls/[id]/route.ts` lines 7-49: `PATCH` calls `createServerClient()` + `supabase.auth.getUser()` + `client_users` lookup. The Telegram webhook runs as service-role (`createServiceClient()`); it has no user session. The cold-start prompt says "Route every mutation through the existing dashboard PATCH endpoints — NEVER direct UPDATEs on clients.*" but the existing PATCH endpoint isn't callable from the webhook.

Two options:

- **(a) Extract a shared mutator** (`src/lib/calls/lead-status.ts` exporting `updateLeadStatusForClient(supa, callId, clientId, status)`) — refactor the dashboard PATCH route to call it, AND have the Telegram `cf:<uuid>` handler call it directly. Same SQL (`update.eq('id').eq('client_id')`), same validation against `VALID_LEAD_STATUSES`, same multi-tenant scope (chat_id → client_id is the gate on the Telegram side). One narrow refactor inside the existing PATCH route. This is what I'd recommend — preserves path-parity in code (the only sense that matters for a DB_ONLY mutation), avoids an internal HTTP roundtrip with no security benefit, and satisfies the spirit of D.1.

- **(b) Add a service-role HTTP entry point** to the dashboard route — `?internal=1` + a `Bearer ${INTERNAL_SECRET}` header bypass. Bigger surface area (a new auth bypass on a customer-facing route is a footgun) and an HTTP roundtrip that buys nothing.

I'll go with (a) unless you say otherwise. The "ground rule" — *if you can't find one [PATCH endpoint], STOP and ask before introducing a direct DB write* — sent me here. Confirm (a) and I'll proceed.

The note about `call_logs.lead_status` not appearing in `control-plane-mutation-contract.md` §2 is consistent: that doc only classifies `clients.*` fields. `call_logs.lead_status` is a DB_ONLY mutation on a non-clients table — no agent sync, no prompt patch, no reseed. The audit §F.2 confirms: "Idempotent. Strong Tier 3 wave 1 candidate (no agent sync, low risk)."

---

**Tier 3 design ready — greenlight the build?**
