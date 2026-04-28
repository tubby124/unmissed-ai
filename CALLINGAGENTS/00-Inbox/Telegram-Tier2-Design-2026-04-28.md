---
type: design-doc
status: ready-for-greenlight
related:
  - "[[00-Inbox/NEXT-CHAT-Telegram-Tier2]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[Features/Telegram-Two-Way-Assistant]]"
updated: 2026-04-28
---

# Telegram Tier 2 — Design Doc (NL Q&A + Discoverable Menu)

> Scope: NL free-text Q&A grounded in the calling client's data, plus tappable bot menu + inline keyboards (L11). Tier 1 slash router stays untouched and degrades cleanly when OpenRouter is down.
> Repo root: `/Users/owner/Downloads/CALLING AGENTs`. PR title: `feat(telegram): tier 2 NL Q&A + discoverable menu/keyboards`.

---

## a) System prompt skeleton (sent to anthropic/claude-haiku-4-5)

```
You are the unmissed.ai assistant texting <BUSINESS_NAME> the owner via Telegram.
You answer ONLY from the data blocks below. Never invent a caller, time, phone,
call ID, balance, or limit. If the data does not contain the answer, reply
"I don't have that yet — try /calls or /missed" and stop.

# OUTPUT RULES
- HTML only. Allowed tags: <b>, <i>, <code>, <pre>, <a href>. No markdown.
- Default 3 lines or fewer. If listing 3+ rows, render as <pre>…</pre> table
  with the same column order Tier 1 uses: emoji  HH:MM  phone  name  service.
- Every row must cite real fields from RECENT_CALLS. Cite phones formatted
  exactly as shown; never re-format or invent area codes.
- Never include recording URLs (they expire — owners hit dead links next morning).
- For minutes/balance/usage questions, the available total is
  monthly_minute_limit + bonus_minutes. Always quote the COMBINED total.
  Never quote monthly_minute_limit alone.
- For "anything urgent?" / triage questions, define urgent =
  call_status in (HOT, WARM) AND (lead_status IS NULL OR lead_status='new').
  No urgent rows → reply honestly that nothing is open.
- Conversational greetings (yo, hey, sup) → friendly 1-line ack + suggest a tap.

# DATA — RECENT_CALLS (last 20, newest first)
<table: id | started_at(ISO) | caller_phone | caller_name | call_status | lead_status | service_type | duration_seconds | ai_summary[trunc 120]>

# DATA — BUSINESS_FACTS (max 2KB)
<verbatim from clients.business_facts; null/empty allowed>

# DATA — EXTRA_QA (max 1KB)
<verbatim from clients.extra_qa, formatted Q: … / A: …>

# DATA — USAGE
business_name=<...>  monthly_minute_limit=<n>  bonus_minutes=<n>
combined_total=<limit + bonus>  used_minutes=<ceil(seconds_used/60)>
remaining=<combined_total − used_minutes>  timezone=America/Regina

# CITATION RULE
If the answer references a specific call, name the caller as shown and the
HH:MM in their timezone. Never paste an ID outside <code> tags.

User question: {{message}}
```

Token budget: 1.5–2.0K input typical, 600 output cap.

---

## b) Routing — keyword shortcuts vs LLM

`router.ts` default branch becomes a 3-step decision:

1. **Slash command** → existing handler (no change).
2. **Keyword shortcut** (no-LLM, instant): lowercased single-word match against
   `{ calls:'/calls', call:'/calls', today:'/today', missed:'/missed', last:'/lastcall', lastcall:'/lastcall', minutes:'/minutes', minute:'/minutes', help:'/help', menu:'/help' }`.
   Hits dispatch through the same handler chain, get the static keyboard.
3. **Else** → `assistant.answerForClient(client, msg.text, ctx)` (LLM).

Callback-data short codes (≤64 bytes — well under, all 1 char):
`c=/calls · t=/today · m=/missed · l=/lastcall · n=/minutes · h=/help`.

For Tier 2 NL responses, intent is inferred by the assistant and returned as
`intent ∈ {'urgent','schedule','minutes','knowledge','generic'}`. Mapping →
context-aware keyboard in (e).

---

## c) Cost guard math (anthropic/claude-haiku-4-5 via OpenRouter)

Pricing: ~$1/M input · ~$5/M output (Haiku 4.5 OR rate, Apr 2026).

Per turn worst case: 2,000 in × 600 out
= $0.002 + $0.003 = **$0.005/turn**.

Caps:
- 10 turns/min/chat (existing rate limiter).
- 5 active clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe, calgary-property-leasing).
- Theoretical worst case: 10 × 5 × 60 × 24 × 30 × $0.005 = **$1,080/mo** if every owner spam-types nonstop.
- Realistic (1 turn/client/day): 5 × 30 × $0.005 = **$0.75/mo**.
- Realistic heavy use (10 turns/client/day): **$7.50/mo**.

Hard cost ceiling on a single turn: 600 × $5/M ≈ $0.003 even at max output.
Rate limiter remains the only spend gate; no per-client monthly cap in v1.

---

## d) Failure modes — exact reply text

| Mode | Trigger | Reply |
|---|---|---|
| OpenRouter HTTP 429 | rate-limited upstream | `⏱ Busy right now — try again in a moment, or tap below.` + static keyboard |
| OpenRouter HTTP 5xx | upstream down | `I can't reach the assistant right now — Tier 1 commands still work.` + static keyboard |
| Network error | fetch throws | same as 5xx |
| 15s AbortSignal timeout | `AbortError` | `That took too long. Try /calls or tap below.` + static keyboard |
| Empty/whitespace `choices[0].message.content` | LLM returned nothing | `I don't have that yet — try /calls or /missed.` + static keyboard |
| Citation guard fail (reply contains a phone or call_id not present in RECENT_CALLS) | regex check on output | swap to: `I don't have that yet — try /calls or /missed.` |
| Outcome telemetry tag | `'ok' / 'timeout' / 'fallback' / 'error'` | logged to `telegram_assistant_log` per L10 |

In every failure path the static 4-button keyboard is attached so the owner can
tap onward. Tier 1 commands keep working — assistant.ts is fully isolated.

---

## e) Discoverability surface (L11) — exact payloads

### setMyCommands payload (POST `/bot<TOKEN>/setMyCommands`)

```json
{
  "commands": [
    { "command": "calls",    "description": "Last 5 calls" },
    { "command": "today",    "description": "Today's calls" },
    { "command": "missed",   "description": "Calls to follow up on" },
    { "command": "lastcall", "description": "Full summary of most recent call" },
    { "command": "minutes",  "description": "Minutes used this month" },
    { "command": "help",     "description": "Show menu" }
  ]
}
```

### setChatMenuButton payload

```json
{ "menu_button": { "type": "commands" } }
```

Both fire from `setup-telegram-webhook/route.ts` alongside existing `setWebhook`. Idempotent — Telegram replaces on re-call.

### Static 4-button keyboard (TS literal in `src/lib/telegram/menu.ts`)

```ts
import type { InlineKeyboardMarkup } from './types'

export const QUICK_ACTIONS: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '📞 Calls',   callback_data: 'c' },
      { text: '⏰ Today',   callback_data: 't' },
    ],
    [
      { text: '🔔 Missed',  callback_data: 'm' },
      { text: '📊 Minutes', callback_data: 'n' },
    ],
  ],
}

export function buildQuickActionsKeyboard(): InlineKeyboardMarkup {
  return QUICK_ACTIONS
}
```

### Context-aware Tier 2 keyboard mapping (intent → buttons)

| Intent | Keyboard rows |
|---|---|
| `urgent` | `[📞 Call back top lead → cb:<top_id>]` `[📋 See all missed → m]` `[✅ Mark called back → mk:<top_id>]` |
| `schedule` | `[⏰ Today → t]` `[📞 Calls → c]` `[🔔 Missed → m]` |
| `minutes` | `[📊 Minutes → n]` `[📞 Calls → c]` |
| `knowledge` | `[📞 Calls → c]` `[🔔 Missed → m]` `[📊 Minutes → n]` |
| `generic` (fallback) | static `QUICK_ACTIONS` |

Tier 3 callback codes (`cb:<id>`, `mk:<id>`) are reserved here but **not implemented in this PR** — they fall back to `renderUnknown` if tapped. Reserving them now keeps `callback_data` payloads stable.

### /start success message — new payload

After existing "Connected!" text, attach `QUICK_ACTIONS` so the owner sees tappable buttons before they have a chance to wonder how to use the bot.

```ts
await sendTelegramMessage(chatId, connectedText, { reply_markup: QUICK_ACTIONS })
```

---

## f) Test plan — 9+ cases (extends `telegram-router.test.ts`)

1. `"anything urgent today?"` with one HOT call present → reply contains the caller name + HH:MM, ends with urgent-intent keyboard.
2. `"anything urgent?"` with no HOT/WARM rows → honest empty answer, no fabrication, static keyboard.
3. `"summarize this week"` with mixed call_status → `<pre>` table with ≥3 rows.
4. `"what's my balance?"` / `"minutes left?"` → response contains `monthly_minute_limit + bonus_minutes` (combined total) — L1 regression.
5. Plain word `"calls"` → keyword shortcut, identical text to `/calls`, **no OpenRouter fetch invoked** (assert mock was not called).
6. Ambiguous question with empty business_facts + extra_qa → reply matches `/I don't have that yet/` regex.
7. Stubbed OpenRouter throws → all 6 Tier 1 commands still pass their existing assertions (regression net).
8. `update.callback_query` with `data: 'c'` → answerCallbackQuery invoked (assert mock) **and** sendMessage receives the same body as typing `/calls`.
9. /start success path → outgoing sendMessage call body includes `reply_markup` with 4 inline_keyboard buttons.
10. Citation guard: stub LLM to return a phone not present in RECENT_CALLS → router replaces with the fallback string and tags outcome `'fallback'`.
11. Multi-tenant leak: client A asks "anything urgent?" but client B has the urgent calls → assert reply contains zero of B's phones (extends Tier 1 leak test).

Test infra: extract `makeFakeSupa()` to `src/lib/__tests__/_helpers/fake-supabase.ts` (commit 1) and stub `global.fetch` per case for OpenRouter and Telegram outbound.

---

## g) Schema changes — `telegram_assistant_log` (L10)

File: `supabase/migrations/20260428200000_create_telegram_assistant_log.sql`

```sql
CREATE TABLE IF NOT EXISTS public.telegram_assistant_log (
  id              bigserial PRIMARY KEY,
  chat_id         bigint      NOT NULL,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  model           text        NOT NULL,
  input_tokens    integer     NOT NULL DEFAULT 0,
  output_tokens   integer     NOT NULL DEFAULT 0,
  latency_ms      integer     NOT NULL DEFAULT 0,
  outcome         text        NOT NULL CHECK (outcome IN ('ok','timeout','fallback','error')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_assistant_log_client_created
  ON public.telegram_assistant_log (client_id, created_at DESC);

ALTER TABLE public.telegram_assistant_log ENABLE ROW LEVEL SECURITY;

-- Service-role only. No client-side reads (cost telemetry is operator-only).
CREATE POLICY "service role full access"
  ON public.telegram_assistant_log
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

No PII. No message text. No reply text. Tokens + latency + outcome only.

No `clients` table changes. Operator-user-id Tier 3 work stays deferred.

---

## h) Manual ops gates (called out in PR body)

1. **`OPENROUTER_API_KEY` on Railway prod env** — already set as of 2026-04-28 (`sk-or-v1-…` confirmed via `railway variables`). PR body confirms presence; no action needed.
2. **Apply `telegram_assistant_log` migration** — `supabase db push` against project `qwhvblomlgeapzhnuwlb` after merge. Standing autonomy applies.
3. **Hit `POST /api/admin/setup-telegram-webhook`** — re-runs setWebhook + the new setMyCommands + setChatMenuButton calls. Idempotent. Required so the bot's command menu populates in production.
4. **Verify Tier 1 commands still respond** — manual /calls /today /missed /lastcall /minutes /help against @hassitant_1bot from Hasan's chat after deploy.
5. **Optional welcome-email group-chat warning (L3)** — flagged as a follow-up, not in this PR's scope (would touch all client welcome-email HTML).

---

## Build plan recap (commits, in order)

0. `feat(telegram): discoverability — bot menu + inline keyboards (L11)` — `menu.ts`, `setup-telegram-webhook` adds setMyCommands + setChatMenuButton, `route.ts` adds callback_query branch + reply_markup threading, every `renderX` returns `{text, reply_markup}`, /start ships keyboard, tests for keyboard + callback_query.
1. `refactor(telegram): extract makeFakeSupa() to shared test helper`.
2. `feat(telegram): assistant.ts skeleton + system prompt builder` (no router wiring yet).
3. `feat(telegram): keyword shortcuts (no-LLM fast path)` in router default branch.
4. `feat(telegram): wire assistant into router default branch` + `sendChatAction('typing')` + assistant_log insert.
5. `feat(db): telegram_assistant_log migration`.
6. `test(telegram): full Tier 2 test suite` (cases 1–11).

All on branch `feat/telegram-tier2`, single PR.

---

## One question before greenlight

The keyboard mapping in (e) reserves `cb:<id>` and `mk:<id>` callback codes for Tier 3 (call-back / mark-called-back) but Tier 2 will route those taps to `renderUnknown` for now. **Do you want me to (a) reserve them silently and let unknown taps fall through, or (b) reply with a clear "Coming in Tier 3 — for now use /missed" message when one is tapped?** I prefer (b) so owners aren't confused by silence.

**Tier 2 design ready — greenlight the build?**
