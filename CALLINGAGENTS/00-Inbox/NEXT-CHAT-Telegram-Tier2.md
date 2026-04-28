---
type: chat-prompt
status: ready-to-start
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
updated: 2026-04-28
---

# Cold-Start Prompt — Telegram Tier 2 (Natural-Language Q&A)

> Paste the entire fenced block below into a fresh Claude Code chat at the unmissed-ai repo root (`/Users/owner/Downloads/CALLING AGENTs`). Tier 1 is already live (PR #41 squash-merged 2026-04-28). This prompt picks up Tier 2.

---

```
You are a senior product engineer continuing the @hassitant_1bot Telegram
build for unmissed.ai. The repo is at /Users/owner/Downloads/CALLING AGENTs
(Next.js 15 on Railway, Ultravox + Twilio + Supabase). I am Hasan, sole
engineer + owner. Standing autonomy applies — git push to origin, Railway
redeploys, and Supabase migrations on project qwhvblomlgeapzhnuwlb are
pre-authorized when I say "ship", "merge", or "do it". Do NOT delete data,
drop tables, or send outbound customer communications without confirmation.

CONTEXT: TIER 1 IS LIVE
PR #41 squash-merged 2026-04-28T23:01:52Z, sha 03ad11c0. Migration
20260428100000_create_telegram_updates_seen applied to prod. Six commands
live: /help /calls /today /missed /lastcall /minutes. All hardening in
place: private-chat guard, 10/min rate limit, update_id idempotency,
multi-tenant scoping. 11/11 tests green.

Files already in place that you'll extend:
  src/lib/telegram/router.ts   — switch statement; add a default-case branch
                                 for free text → Tier 2 handler
  src/lib/telegram/queries.ts  — read helpers (extend as needed)
  src/lib/telegram/format.ts   — HTML formatting (reuse for table replies)
  src/app/api/webhook/telegram/route.ts — webhook entry; do NOT add a new
                                 entry path; route everything through the
                                 existing routeTelegramMessage()

YOUR MISSION
Add Tier 2: natural-language Q&A. The owner can text "anything urgent
today?" or "summarize this week" or "did the wife of the guy from
yesterday call back?" and get a real, table-formatted answer grounded
in their call_logs + business_facts + extra_qa. No fabrication.

Tier 2 must:
  • work for any free text that's NOT a slash command
  • build a system prompt with the last 20 call_logs + business_facts +
    extra_qa scoped to the calling client_id (reuse the multi-tenant
    pattern from queries.ts)
  • call OpenRouter with anthropic/claude-haiku-4-5, 15s timeout,
    max_tokens: 600 (cost ceiling)
  • format replies as HTML — reuse renderCallTable for any list of 3+
    rows; otherwise plain text with <b>...</b> for emphasis
  • show a "typing…" indicator (sendChatAction) while waiting on the LLM
  • cite exact call IDs / phones / times — never invent
  • fall back to "I don't have that yet — try /calls or /missed" if
    the LLM returns nothing useful
  • keep Tier 1 working when OpenRouter is down — Tier 1 ≠ Tier 2

REQUIRED READING (in order, before any code)
 1. src/lib/telegram/router.ts                    — your insertion point
 2. src/lib/telegram/queries.ts                   — DB read patterns + the multi-tenant rule
 3. src/lib/telegram/format.ts                    — reuse renderCallTable / renderCallSummary
 4. CALLINGAGENTS/Decisions/2026-04-28-Telegram-Tier1-Slash-Router.md
 5. CALLINGAGENTS/00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28.md
    — sections F (parity map) and H (spike with table format)
 6. ~/.claude/rules/mcp-usage.md                  — OpenRouter curl pattern
    (uses $OPENROUTER_API_KEY, already in ~/.secrets but NOT in Railway)
 7. .claude/rules/core-operating-mode.md          — bug-buckets, phase discipline

GROUND RULES (project-specific)
- One narrow phase. Tier 2 ships as a single PR. Title: "feat(telegram):
  tier 2 natural-language Q&A". Do not also start Tier 3.
- chat_id → client_id is the multi-tenant gate (already enforced by
  fetchClientByChatId — keep it that way).
- OPENROUTER_API_KEY is in ~/.secrets locally. It MUST be added to Railway
  prod env before the PR can be deployed; surface this as a manual step
  in the PR description.
- 15s AbortSignal.timeout on the OpenRouter fetch.
- max_tokens: 600 — cost ceiling, also keeps replies short (Telegram bar:
  3-line answers default).
- Do not log free-text user messages to any new table — PII. OK to log
  the chat_id + matched intent + token count for cost tracking.
- Reuse the existing rateLimiter (10 msg/min) — Tier 2 inherits it for free.
- Reuse renderCallTable for any list of 3+ rows. <pre> wrapper, fixed
  column widths, total <600 chars per reply.
- HTML mode only. <b>, <i>, <code>, <pre>, <a href> render. No markdown.

YOUR FIRST DELIVERABLE — DESIGN (before any code)
A short markdown doc (max 1 page) saved to
CALLINGAGENTS/00-Inbox/Telegram-Tier2-Design-<date>.md covering:
  a) System prompt skeleton — exact text including the 20-call_logs
     rendering format, business_facts inclusion, citation rule, no-
     fabrication rule, "I don't have that yet" fallback
  b) Routing decision — which free-text messages should go to LLM vs
     which should be handled by a quick keyword shortcut (e.g. "calls"
     → /calls, "minutes" → /minutes — saves a Haiku call when the user
     was just typing the command without the slash)
  c) Cost guard — how the rate limiter + max_tokens cap protects spend
  d) Failure modes — what happens when OpenRouter returns 429, 500,
     or times out. Reply text for each.
  e) Test plan — at least 5 test cases:
       1. "anything urgent?" with HOT calls present
       2. "anything urgent?" with no calls today
       3. "summarize this week"
       4. ambiguous question that needs a fallback
       5. message with no recent calls (empty client)

Once the design is in front of me, I'll greenlight the build.

TIER 2 BUILD PLAN (after design greenlight)
1. New file: src/lib/telegram/assistant.ts
   - export async function answerForClient(client, message): Promise<string>
   - Builds system prompt from last-20 call_logs + business_facts + extra_qa
   - Calls OpenRouter, returns formatted reply
   - 15s timeout, 600 max_tokens
2. Wire into src/lib/telegram/router.ts default case (currently
   returns renderUnknown())
3. Add sendChatAction('typing') in the webhook before calling answerForClient
4. New tests in src/lib/__tests__/telegram-assistant.test.ts:
   - Stubs OpenRouter response
   - Asserts citation format (call_id present in reply)
   - Asserts table format for list answers
   - Asserts fallback on stubbed timeout
5. Update PR description to require:
   [ ] Add OPENROUTER_API_KEY to Railway prod env vars
   [ ] Verify Tier 1 commands still work after deploy

TOP-1% BAR (every reply must clear these)
- Replies under 5s for LLM Q&A
- Never invents data — cites exact call IDs / phones / times
- 3-line answers default; tables for 3+ rows
- Honest "I don't have that yet" beats hallucinated answers
- Conversational — handles "yo" / "hey" without lecturing
- Every reply ends with a suggested next step ("/calls for more")
- Tier 1 keeps working when OpenRouter is down

SUCCESS CRITERIA FOR THIS CHAT
- Design doc delivered (markdown, in CALLINGAGENTS/00-Inbox/) and approved
- Tier 2 PR opened against main with passing tests + green build
- PR description lists OPENROUTER_API_KEY → Railway as a manual gate
- I can text the bot "anything urgent?" and get a real, cited answer
  once OPENROUTER_API_KEY is in Railway and the PR merges

START BY:
1. Reading the 7 required files in order
2. Producing the design doc (do NOT write code yet)
3. Asking me one question if anything is ambiguous

When you're done with the design, say "Tier 2 design ready —
greenlight the build?" and wait for my go.
```

---

## How to use this

1. Open a fresh Claude Code session at the repo root (`cd "/Users/owner/Downloads/CALLING AGENTs"`)
2. Paste the entire fenced block above as your first message
3. Claude will read the spec + relevant code, write the design doc, and pause
4. Greenlight the design → Claude opens the Tier 2 PR
5. Add `OPENROUTER_API_KEY` to Railway → merge → live

## Why this prompt is structured this way

- **Status snapshot first.** Tier 1 is live — Claude doesn't need to re-derive that.
- **Required reading list.** Stops "I'll just edit router.ts real quick."
- **Design before code.** Forces the citation rule + fallback design before they get written wrong.
- **Single PR.** Tier 2 ships alone. Tier 3 starts in another chat.
- **Manual env-var gate.** Surfaces the Railway step in the PR body so you don't deploy a broken bot.
