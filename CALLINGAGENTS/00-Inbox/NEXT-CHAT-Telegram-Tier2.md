---
type: chat-prompt
status: ready-to-start
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
updated: 2026-04-28
---

# Cold-Start Prompt — Telegram Tier 2 (Natural-Language Q&A + Discoverable Menu)

> Paste the entire fenced block below into a fresh Claude Code chat at the unmissed-ai repo root (`/Users/owner/Downloads/CALLING AGENTs`). Tier 1 is already live (PR #41 squash-merged 2026-04-28T23:01:52Z, sha `03ad11c0`). Tier 2 must add NL Q&A AND make the bot usable by tapping — not just typing slash commands.

---

```
You are a senior product engineer continuing the @hassitant_1bot Telegram
build for unmissed.ai. The repo is at /Users/owner/Downloads/CALLING AGENTs
(Next.js 15 on Railway, Ultravox + Twilio + Supabase). I am Hasan, sole
engineer + owner. Standing autonomy applies — git push to origin, Railway
redeploys, and Supabase migrations on project qwhvblomlgeapzhnuwlb are
pre-authorized when I say "ship", "merge", or "do it". Do NOT delete data,
drop tables, or send outbound customer communications without confirmation.

═══════════════════════════════════════════════════════════════════════
TIER 1 IS LIVE — DO NOT REBUILD ANY OF THIS
═══════════════════════════════════════════════════════════════════════
PR #41 squash-merged 2026-04-28T23:01:52Z, sha 03ad11c0. Railway has
auto-deployed. Migration 20260428100000_create_telegram_updates_seen
applied to prod. Smoke-tested:
  - GET https://unmissed-ai-production.up.railway.app/ → 200
  - POST /api/webhook/telegram with synthetic /help → 200

Live commands: /help /calls /today /missed /lastcall /minutes
Hardening live: private-chat guard, 10/min rate limit (in-memory),
update_id idempotency (DB-backed), multi-tenant scoping by client_id.
Tests: 11/11 in src/lib/__tests__/telegram-router.test.ts.

Files in place (DO NOT REWRITE — extend):
  src/lib/telegram/router.ts   — switch statement; default case currently
                                 returns renderUnknown(). YOUR insertion
                                 point: replace that default with a Tier 2
                                 dispatch to assistant.ts (new file).
  src/lib/telegram/queries.ts  — read helpers, multi-tenant safe
  src/lib/telegram/format.ts   — HTML formatting (reuse renderCallTable,
                                 renderCallSummary, escapeHtml)
  src/app/api/webhook/telegram/route.ts — webhook entry; do NOT add a
                                 second entry path; route everything
                                 through routeTelegramMessage()
  supabase/migrations/20260428100000_create_telegram_updates_seen.sql
  src/lib/__tests__/telegram-router.test.ts — has makeFakeSupa() — reuse it

═══════════════════════════════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════════════════════════════
Add Tier 2: natural-language Q&A AND make the bot usable by tapping
(menu + inline keyboards). Owner texts "anything urgent today?" or taps
a button → real, table-formatted answer grounded in their call_logs +
business_facts + extra_qa. No fabrication. Cited.

Tier 2 must:
  • Handle any free text that's NOT a slash command
  • Build system prompt from last 20 call_logs + business_facts +
    extra_qa scoped to the calling client_id
  • Call OpenRouter with anthropic/claude-haiku-4-5
    - 15s AbortSignal.timeout
    - max_tokens: 600 (cost ceiling AND keeps replies short)
  • Format replies as HTML — reuse renderCallTable for any list of 3+
    rows; otherwise short text with <b>...</b>
  • Show "typing…" indicator (sendChatAction) while waiting
  • Cite exact call IDs / phones / times — never invent
  • Fall back to "I don't have that yet — try /calls or /missed" when
    LLM returns empty / nonsense / errors
  • Keep Tier 1 working when OpenRouter is down — Tier 1 ≠ Tier 2
  • REGISTER A SLASH-COMMAND MENU + ATTACH INLINE KEYBOARD TO EVERY
    REPLY so non-technical owners can tap instead of type (L11 below)

═══════════════════════════════════════════════════════════════════════
LESSONS FROM TIER 1 — BAKE THESE INTO TIER 2 FROM DAY ONE
═══════════════════════════════════════════════════════════════════════

L1.  ALWAYS combine monthly_minute_limit + bonus_minutes.
     Brian was grandfathered with 50 bonus minutes during his trial→paid
     swap. Any answer about usage / billing / limits MUST surface
     `total = monthly_minute_limit + bonus_minutes`. Never quote the
     monthly_minute_limit alone. Add this rule verbatim to the system
     prompt sent to Haiku.

L2.  SKIP recording links by default in Tier 2 replies.
     /lastcall in Tier 1 inlines a 1h-signed URL. Brian opens Telegram
     next morning → dead link → confusion. Tier 2 must NOT include
     recording URLs. /play <call_id> can come in Tier 3.

L3.  WARN owners against group chats in onboarding email.
     Tier 1 silently no-ops in groups (data leak guard). Owners who
     add the bot to a family/team group think it's broken. Add one
     line to clients/<slug>/welcome-email-*.html (or flag as a
     follow-up if it bloats this PR's scope):
       "Keep this as a 1:1 chat with the bot — group chats are
        blocked for privacy."

L4.  The 10/min rate limiter is in-memory.
     SlidingWindowRateLimiter resets on Railway redeploy. Acceptable
     for Tier 2 cost guard. Tier 3 confirm tokens MUST be DB-backed
     (telegram_pending_actions, designed in audit §H.2 — save for T3).

L5.  Reuse the fake-Supabase test harness as commit 1.
     telegram-router.test.ts has makeFakeSupa(). Extract to
     src/lib/__tests__/_helpers/fake-supabase.ts so Tier 2/3 tests +
     future tests can share it.

L6.  Don't trust prior counts of settings cards / dashboard tiles.
     The Tier 1 audit said "19 settings cards" — actual is ~60 .tsx
     files; ~25 user-facing. Glob the dir + cross-reference what
     AgentTab.tsx renders before designing any parity statement.

L7.  Never .single() on client_users.
     Admins can have multiple rows. Use .limit(1).maybeSingle().
     fetchClientByChatId in queries.ts already does this.

L8.  Operator admin gate: slug+role, not slug alone.
     /clients and /health (when added) should resolve through
     chat_id → clients.id → join client_users → role==='admin'.
     For Tier 2 keep slug==='hasan-sharif' if simpler. Note this as
     a Tier 3 schema improvement (clients.telegram_owner_user_id).

L9.  Webhook reliability: 200 always for parsing/silent ignores;
     500 only on infra failure (so Telegram retries for 24h).
     If OpenRouter is down → polite fallback reply + 200 (no retry).

L10. Cost telemetry without PII.
     New table telegram_assistant_log:
       chat_id (bigint), client_id (uuid), model (text),
       input_tokens (int), output_tokens (int), latency_ms (int),
       outcome (text: 'ok' | 'timeout' | 'fallback' | 'error'),
       created_at (timestamptz).
     DO NOT log message text or reply text. PII-free.

L11. DISCOVERABILITY — owners do NOT know about slash commands.
     Brian, Mark, Alisha will never type "/calls" because they don't
     know slash commands exist. Tier 2 MUST make the bot usable
     without typing any command. Three complementary mechanisms:

     (a) BOT COMMAND MENU — register the slash list with Telegram
         via setMyCommands so the official "Menu" button + the "/"
         autocomplete dropdown both populate. One-time admin call,
         idempotent:
           POST https://api.telegram.org/bot<TOKEN>/setMyCommands
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
         Wire into src/app/api/admin/setup-telegram-webhook/route.ts
         (already runs once at deploy) so it fires alongside the
         existing setWebhook call. ALSO call setChatMenuButton with
         { type: "commands" } so the persistent menu icon next to
         the message input opens this list.

     (b) PERSISTENT INLINE-KEYBOARD QUICK ACTIONS — every Tier 1 AND
         Tier 2 reply must end with an inline keyboard the owner
         can TAP. Default 4-button layout below the reply text:

           ┌──────────┬──────────┐
           │ 📞 Calls │ ⏰ Today │
           ├──────────┼──────────┤
           │ 🔔 Missed│ 📊 Minutes│
           └──────────┴──────────┘

         Use callback_data (NOT slash text) so the bot receives a
         clean callback_query. callback_data MUST stay under 64
         bytes — use short codes ("c"=calls, "t"=today, "m"=missed,
         "l"=lastcall, "n"=minutes, "h"=help). Update the webhook
         to handle update.callback_query in addition to
         update.message:
           - call answerCallbackQuery first (silent ack, kills the
             spinner on the tapped button)
           - then dispatch through the same routeTelegramMessage
             with the resolved command as synthetic text

         For Tier 2 NL replies, generate context-aware follow-up
         buttons (e.g. after "anything urgent?" → buttons:
         [📞 Call back top lead] [📋 See all missed] [✅ Mark called back]).
         Tier 1 commands keep the static 4-button layout.

     (c) ONBOARDING NUDGE — the very first message a freshly
         registered chat_id receives (right after "Connected!" in
         /api/webhook/telegram/route.ts) must include the inline
         keyboard so the owner sees "tap me" buttons before they
         have any chance to wonder how to use the bot.

     (d) FALLBACK TEXT — if a user types something the router
         can't parse ("yo" / "hey"), renderUnknown must attach
         the keyboard. Discoverability beats literacy.

     This is NON-NEGOTIABLE. A Telegram bot without a registered
     command menu and inline keyboard buttons is invisible to
     non-technical owners. The owner must be able to use the bot
     by tapping ONLY — typing is OPTIONAL. Build menu wiring as
     commit 0 (before assistant.ts) and verify in tests:
       - every renderX() returns text + reply_markup
       - the webhook handles callback_query the same as a message
       - setMyCommands fires on the deploy hook

═══════════════════════════════════════════════════════════════════════
REQUIRED READING (in order, before writing any code)
═══════════════════════════════════════════════════════════════════════
 1. src/lib/telegram/router.ts                — your insertion point
 2. src/lib/telegram/queries.ts                — DB read patterns + multi-tenant rule
 3. src/lib/telegram/format.ts                 — reuse renderCallTable / renderCallSummary
 4. src/lib/__tests__/telegram-router.test.ts  — makeFakeSupa() pattern
 5. src/app/api/admin/setup-telegram-webhook/route.ts — where setMyCommands wires in
 6. src/app/api/webhook/telegram/route.ts      — add callback_query branch here
 7. CALLINGAGENTS/Decisions/2026-04-28-Telegram-Tier1-Slash-Router.md
 8. CALLINGAGENTS/00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28.md
    (sections F = parity map, H = call_logs spike, J = TTL question)
 9. ~/.claude/rules/mcp-usage.md — OpenRouter curl pattern
    (uses $OPENROUTER_API_KEY, present in ~/.secrets but NOT yet in
    Railway prod — this is a manual gate)
10. .claude/rules/core-operating-mode.md — phase discipline + bug-buckets
11. .claude/rules/prompt-edit-safety.md — only relevant if you touch
    voice agent prompts (you should NOT — Tier 2 sends a NEW prompt to
    Haiku for the assistant; live voice agent prompts are off-limits)
12. Telegram Bot API references:
    - https://core.telegram.org/bots/api#setmycommands
    - https://core.telegram.org/bots/api#setchatmenubutton
    - https://core.telegram.org/bots/api#inlinekeyboardmarkup
    - https://core.telegram.org/bots/api#answercallbackquery

═══════════════════════════════════════════════════════════════════════
GROUND RULES (project-specific)
═══════════════════════════════════════════════════════════════════════
- One narrow phase. Single PR. Title:
    "feat(telegram): tier 2 NL Q&A + discoverable menu/keyboards"
  Do NOT also start Tier 3.
- chat_id → client_id is the multi-tenant gate. fetchClientByChatId
  enforces it. Every NEW DB read must filter by client_id.
- OPENROUTER_API_KEY is in ~/.secrets locally. MUST be added to
  Railway prod env BEFORE the PR is deployed. Surface in PR body.
- 15s AbortSignal.timeout on the OpenRouter fetch.
- max_tokens: 600 — cost ceiling + short replies.
- DO NOT log free-text user messages or LLM replies (PII).
  DO log token counts + outcome (L10).
- Reuse the existing rateLimiter (10 msg/min) — Tier 2 inherits it.
- Reuse renderCallTable for any list of 3+ rows.
- HTML mode only. <b>, <i>, <code>, <pre>, <a href>. No markdown.
- callback_data payloads MUST stay under 64 bytes. Short codes only.
- Active clients to NOT disrupt: hasan-sharif, exp-realty,
  windshield-hub, urban-vibe, calgary-property-leasing.

═══════════════════════════════════════════════════════════════════════
YOUR FIRST DELIVERABLE — DESIGN DOC (NO CODE YET)
═══════════════════════════════════════════════════════════════════════
Save to CALLINGAGENTS/00-Inbox/Telegram-Tier2-Design-<YYYY-MM-DD>.md.
Max ~2 pages. Cover:

a) System prompt skeleton (exact text)
   - Role line, 20-call_logs rendering format (time, caller, status,
     summary trunc 120 chars), business_facts (max 2K), extra_qa
     (max 1K), citation rule, no-fabrication rule, combined-minutes
     rule (L1), no-recording-URL rule (L2), 3-line-default +
     tables-for-3+-rows rule. Output: HTML only, no markdown.

b) Routing decision — keyword shortcuts vs LLM
   - Plain "calls" / "minutes" / "today" → no-LLM shortcut
   - List the shortcut keywords explicitly
   - List the callback_data short codes (c/t/m/l/n/h)

c) Cost guard math
   - ~2K input + 300 output per turn at Haiku 4.5 rates
   - 10 turns/min cap × 5 active clients = 50 max turns/min
   - Monthly worst case at full saturation
   - Realistic case (1 turn/client/day = 150/mo)

d) Failure modes — exact reply text for each
   - OpenRouter 429 / 500 / network / 15s timeout / empty response /
     no-citation hallucination guard

e) Discoverability surface (L11) — exact JSON / TS
   - setMyCommands payload (6 commands)
   - setChatMenuButton payload
   - Static 4-button inline_keyboard markup as a TS literal
   - Tier 2 context-aware keyboard mapping by intent
   - /start success message new payload (text + keyboard)

f) Test plan — at least 9 cases
   1. "anything urgent?" with HOT calls present → urgent table + keyboard
   2. "anything urgent?" with no calls today → honest empty answer
   3. "summarize this week"
   4. "what's my balance?" / "minutes left?" → uses combined limit
      + bonus_minutes (L1)
   5. Plain word "calls" → keyword shortcut to /calls (no LLM)
   6. Ambiguous question with no useful context → fallback reply
   7. Stubbed OpenRouter timeout → Tier 1 commands still work
   8. callback_query tap on "📞 Calls" button → same reply as
      typing /calls (L11)
   9. /start success message includes the static 4-button keyboard
      so the owner sees tappable actions on first contact (L11)

g) Schema changes
   - New table telegram_assistant_log (L10) — full SQL in design doc
   - No clients-table change (operator user_id is Tier 3)

h) Manual ops gates (call out in PR body)
   - Add OPENROUTER_API_KEY to Railway prod env vars
   - Apply telegram_assistant_log migration
   - Hit /api/admin/setup-telegram-webhook so setMyCommands registers
   - Verify Tier 1 commands still work after deploy
   - Optional: welcome-email group-chat warning (L3)

When the design doc is ready, ASK ME ONE QUESTION if anything is
ambiguous, then say:
    "Tier 2 design ready — greenlight the build?"
and wait for my go.

═══════════════════════════════════════════════════════════════════════
TIER 2 BUILD PLAN (after design greenlight)
═══════════════════════════════════════════════════════════════════════
Commit 0 ships discoverability BEFORE the LLM goes in — owners get
tappable buttons even if Railway env var is missing.

0. feat(telegram): discoverability — bot menu + inline keyboards (L11)
   - src/lib/telegram/menu.ts — exports the 6-command list +
     buildQuickActionsKeyboard() (static 4 buttons) +
     buildContextActionsKeyboard(intent) stub
   - src/app/api/admin/setup-telegram-webhook/route.ts — add
     setMyCommands + setChatMenuButton calls (idempotent)
   - sendTelegramMessage in /api/webhook/telegram/route.ts: accept
     optional reply_markup; thread it through
   - Update every renderX() in src/lib/telegram/format.ts to return
     { text, reply_markup } instead of bare strings
   - RouterResult type updated:
       { kind: 'reply'; text: string; reply_markup?: InlineKeyboardMarkup }
   - Add update.callback_query branch to webhook:
       answerCallbackQuery → resolve short code → re-dispatch
   - /start success message attaches the static keyboard
   - All telegram-router tests assert reply_markup; new test for
     callback_query dispatch path
   - npm run build green; existing tests pass + new tests

1. refactor(telegram): extract makeFakeSupa() to shared test helper
   - Move from telegram-router.test.ts to
     src/lib/__tests__/_helpers/fake-supabase.ts
   - npx tsx --test → all tests still pass

2. feat(telegram): assistant.ts skeleton + system prompt builder
   - src/lib/telegram/assistant.ts — answerForClient(client, message)
   - System prompt built from queries.ts data
   - OpenRouter fetch w/ 15s timeout + 600 max_tokens
   - Returns { reply, outcome, usage, intent? }
   - Stubbed-fetch tests (no network)

3. feat(telegram): keyword shortcuts (no-LLM fast path)
   - router.ts default branch checks shortcuts first; only falls
     through to assistant.ts if no match
   - Shortcut replies inherit the static keyboard from L11

4. feat(telegram): wire assistant into router default branch
   - sendChatAction('typing') in webhook BEFORE calling assistant
   - Tier 2 replies attach buildContextActionsKeyboard(intent)
   - Log to telegram_assistant_log (no PII per L10)
   - Reply with HTML

5. feat(db): telegram_assistant_log migration
   - chat_id, client_id, model, input_tokens, output_tokens,
     latency_ms, outcome, created_at
   - RLS: service-role only

6. test(telegram): full Tier 2 test suite
   - Stubbed OpenRouter for happy path + each failure mode
   - Citation format assertion
   - Multi-tenant leak guard (extends Tier 1 leak test)
   - Tier-1-still-works when OpenRouter is stubbed to throw
   - callback_query tap = same reply as typing the command
   - /start onboarding includes keyboard regression test

═══════════════════════════════════════════════════════════════════════
TOP-1% BAR (every reply must clear these)
═══════════════════════════════════════════════════════════════════════
- Replies under 5s for LLM Q&A; under 2s for shortcuts and taps
- Never invents data — cites exact call IDs / phones / times
- 3-line default; tables for 3+ rows; <pre> for monospace alignment
- Honest "I don't have that yet" beats hallucinated answers
- Conversational — handles "yo" / "hey" without lecturing
- Every reply ends with a tappable inline keyboard — typing OPTIONAL
- Tier 1 keeps working when OpenRouter is down — verified by test
- No PII in logs; only token counts + outcome
- Owner can complete a full session (open bot → see calls → mark
  called back → check minutes) without typing a single character

═══════════════════════════════════════════════════════════════════════
SUCCESS CRITERIA FOR THIS CHAT
═══════════════════════════════════════════════════════════════════════
- Design doc delivered to CALLINGAGENTS/00-Inbox/ and approved
- 7 commits on a feat/telegram-tier2 branch (commit 0 = menu,
  1-6 = NL Q&A as listed), single PR opened
- All tests green (Tier 1 + Tier 2 + new keyboard / callback tests)
- npm run build green
- PR body lists OPENROUTER_API_KEY → Railway as an explicit manual
  gate, the migration apply step, AND the setup-telegram-webhook
  re-run to register the menu in prod
- After merge + env var set + menu register hit, I can:
    (a) open @hassitant_1bot on my phone
    (b) tap the Menu button → see the 6 commands
    (c) send any free-text question → real, cited answer with
        follow-up buttons
    (d) tap a button instead of typing → same answer as typing
        the command

═══════════════════════════════════════════════════════════════════════
START BY:
═══════════════════════════════════════════════════════════════════════
1. Reading the 12 required references in order
2. Producing the design doc (do NOT write code yet)
3. Asking me one question if anything is ambiguous

When the design is in front of me, say:
    "Tier 2 design ready — greenlight the build?"

Do not start coding before greenlight.
```

---

## Why this prompt is structured this way

- **Tier 1 status snapshot first** — Claude doesn't re-derive what shipped
- **L1–L11 numbered rules** — every gotcha from Tier 1 surfaces here so the next chat doesn't trip on it
- **L11 = discoverability** — bot must work by tapping; typing is optional. setMyCommands + setChatMenuButton + persistent inline keyboards + onboarding nudge + callback_query branch in the webhook
- **Required reading expanded to 12 items** — adds the setup-webhook route, the webhook entry, and Telegram Bot API URLs
- **Commit 0 = discoverability** — ships before assistant.ts so the menu lands even if OpenRouter env var slips
- **9 test cases** including callback_query dispatch and the onboarding-keyboard regression
- **Manual ops gates** explicitly include re-running setup-telegram-webhook so setMyCommands actually registers in prod
- **Top-1% bar** ends with the no-typing acceptance criterion: owner completes a full session without a keystroke
