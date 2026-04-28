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

> Paste the entire fenced block below into a fresh Claude Code chat at the unmissed-ai repo root (`/Users/owner/Downloads/CALLING AGENTs`). Tier 1 is already live (PR #41 squash-merged 2026-04-28T23:01:52Z, sha `03ad11c0`). This prompt picks up Tier 2 with all of the lessons learned during Tier 1 baked in — don't re-learn them the hard way.

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
Add Tier 2: natural-language Q&A. Owner texts "anything urgent today?"
or "summarize this week" or "did the wife of the guy from yesterday call
back?" → real, table-formatted answer grounded in their call_logs +
business_facts + extra_qa. No fabrication. Cited.

Tier 2 must:
  • Handle any free text that's NOT a slash command
  • Build system prompt from last 20 call_logs + business_facts +
    extra_qa scoped to the calling client_id (multi-tenant rule below)
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

═══════════════════════════════════════════════════════════════════════
LESSONS FROM TIER 1 — BAKE THESE INTO TIER 2 FROM DAY ONE
═══════════════════════════════════════════════════════════════════════

L1. ALWAYS combine monthly_minute_limit + bonus_minutes.
    Brian was grandfathered with 50 bonus minutes during his trial→paid
    swap. Any Tier 2 answer about usage / billing / limits MUST surface
    `total = monthly_minute_limit + bonus_minutes`. Never quote the
    monthly_minute_limit alone. Add this rule verbatim to the system
    prompt sent to Haiku.

L2. SKIP recording links by default in Tier 2 replies.
    /lastcall in Tier 1 inlines a 1h-signed recording URL. Brian opens
    Telegram next morning → dead link → confusion. Tier 2 must NOT
    include recording URLs in its answers. If owner explicitly asks
    "play that one back" / "send the recording", we add /play <call_id>
    in Tier 3, not Tier 2. Tier 2 references calls by caller name +
    time, not by URL.

L3. WARN owners against group chats in onboarding email.
    Tier 1 silently no-ops in group chats (data leak guard). Owners
    who add the bot to a family/team group think it's broken. Add one
    line to clients/<slug>/welcome-email-*.html as a side-quest in
    this PR or surface as a manual followup:
      "Keep this as a 1:1 chat with the bot — group chats are blocked
       for privacy."
    Don't bundle the email change in the Tier 2 PR if it bloats scope;
    flag in PR description as a follow-up.

L4. The 10/min rate limiter is in-memory.
    SlidingWindowRateLimiter resets on Railway redeploy. Acceptable for
    Tier 1 (read-only + Tier 2 cost guard). Tier 2 inherits it for free.
    DO NOT reuse this limiter for Tier 3 confirm tokens — those need DB
    state (telegram_pending_actions table — already designed in audit
    §H.2, save for Tier 3).

L5. Reuse the fake-Supabase test harness.
    src/lib/__tests__/telegram-router.test.ts has makeFakeSupa() — it's
    the first clean stub of Supabase chained-query syntax in this repo.
    BEFORE writing Tier 2 tests, extract makeFakeSupa() into
    src/lib/__tests__/_helpers/fake-supabase.ts so Tier 2 + Tier 3 tests
    + future tests (campaign dialer, knowledge stubs) can share it.
    This is a small refactor — do it as commit 1 of the Tier 2 PR.

L6. Don't trust any prior count of "settings cards" or "dashboard tiles".
    The Tier 1 audit said "19 settings cards" — the actual file count
    is ~60 .tsx in src/components/dashboard/settings/, with ~25 truly
    user-facing once you exclude tabs/admin/orphans. Before designing
    any parity statement, run Glob against the actual directory and
    cross-reference what AgentTab.tsx / home/ actually renders. Don't
    trust the audit doc's count for Tier 2/3 design.

L7. .single() vs .limit(1).maybeSingle() — repo-wide rule.
    client_users may have multiple rows for admins. Tier 2 will need to
    look up "is this chat_id linked to an admin user_id" once we add
    operator commands (/clients, /health). When that happens, NEVER
    .single() on client_users. Use .limit(1).maybeSingle(). The
    fetchClientByChatId pattern in queries.ts already does this for
    `clients` table — same discipline for any new joins.

L8. Operator-mode admin gate: slug+role, not slug alone.
    Tier 1 audit suggested gating /clients and /health on
    slug==='hasan-sharif'. That works because Hasan owns that client
    row. But the cleaner long-term gate is:
      chat_id → clients.id → join client_users → role==='admin'
    For Tier 2 keep it simple: gate operator-only NL questions on
    slug==='hasan-sharif'. Note this as a Tier 3 schema improvement
    (add clients.telegram_owner_user_id column to link chat back to
    Supabase auth user).

L9. Webhook reliability rule: 200 always for parsing/silent ignores,
    500 only on infrastructure failure (so Telegram retries for 24h).
    The existing webhook follows this — preserve it. If OpenRouter is
    down, Tier 2 should send a polite fallback reply and return 200,
    not 500. We do NOT want Telegram to retry an LLM-failed call; the
    user can ask again.

L10. Cost telemetry without PII.
     Log to a NEW table telegram_assistant_log:
       chat_id (bigint), client_id (uuid), model (text),
       input_tokens (int), output_tokens (int), latency_ms (int),
       outcome (text: 'ok' | 'timeout' | 'fallback' | 'error'),
       created_at (timestamptz).
     DO NOT log message text or reply text. PII-free. Use this for
     monthly cost reconciliation and to spot abuse patterns.

═══════════════════════════════════════════════════════════════════════
REQUIRED READING (in order, before writing any code)
═══════════════════════════════════════════════════════════════════════
 1. src/lib/telegram/router.ts                — your insertion point
 2. src/lib/telegram/queries.ts                — DB read patterns + multi-tenant rule
 3. src/lib/telegram/format.ts                 — reuse renderCallTable / renderCallSummary
 4. src/lib/__tests__/telegram-router.test.ts  — makeFakeSupa() pattern
 5. CALLINGAGENTS/Decisions/2026-04-28-Telegram-Tier1-Slash-Router.md
 6. CALLINGAGENTS/00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28.md
    (sections F = parity map, H = call_logs spike, J = TTL question)
 7. ~/.claude/rules/mcp-usage.md — OpenRouter curl pattern
    (uses $OPENROUTER_API_KEY, present in ~/.secrets but NOT yet in
    Railway prod — surfacing this as a manual gate is mandatory)
 8. .claude/rules/core-operating-mode.md — phase discipline + bug-buckets
 9. .claude/rules/prompt-edit-safety.md — only relevant if you touch
    voice agent prompts (you should NOT — Tier 2 sends a NEW prompt to
    Haiku for the assistant; the live voice agent prompts are off-limits)

═══════════════════════════════════════════════════════════════════════
GROUND RULES (project-specific)
═══════════════════════════════════════════════════════════════════════
- One narrow phase. Single PR. Title:
    "feat(telegram): tier 2 natural-language Q&A"
  Do NOT also start Tier 3.
- chat_id → client_id is the multi-tenant gate. fetchClientByChatId
  enforces it. Every NEW DB read must filter by client_id.
- OPENROUTER_API_KEY is in ~/.secrets locally. MUST be added to
  Railway prod env BEFORE the PR can be deployed. Surface this in
  the PR body as a checked-list item.
- 15s AbortSignal.timeout on the OpenRouter fetch.
- max_tokens: 600 — cost ceiling + keeps replies short.
- DO NOT log free-text user messages or LLM replies (PII).
  DO log token counts + outcome (see L10).
- Reuse the existing rateLimiter (10 msg/min) — Tier 2 inherits it.
- Reuse renderCallTable for any list of 3+ rows.
- HTML mode only. <b>, <i>, <code>, <pre>, <a href>. No markdown.
- Active clients to NOT disrupt: hasan-sharif, exp-realty,
  windshield-hub, urban-vibe, calgary-property-leasing.
  Any test against the live webhook should be sent from a chat_id
  YOU control (a fresh Telegram account or a synthetic POST in tests).

═══════════════════════════════════════════════════════════════════════
YOUR FIRST DELIVERABLE — DESIGN DOC (NO CODE YET)
═══════════════════════════════════════════════════════════════════════
Save to CALLINGAGENTS/00-Inbox/Telegram-Tier2-Design-<YYYY-MM-DD>.md.
Max ~2 pages. Cover:

a) System prompt skeleton (exact text)
   - The role line ("You are <business_name>'s call-log assistant")
   - The 20-call_logs rendering format (one line per call: time, caller,
     status, summary truncated to 120 chars)
   - business_facts inclusion (max 2K chars; if longer, truncate to
     most-recent N)
   - extra_qa inclusion (max 1K chars)
   - The citation rule ("cite call_id and time when referencing a
     specific call")
   - The no-fabrication rule ("if the answer isn't in the context, say
     so — do not guess")
   - The combined-minutes rule (L1 above)
   - The "no recording URL" rule (L2 above)
   - The 3-line-default + tables-for-3+-rows formatting rule
   - Output: HTML only, no markdown

b) Routing decision — which free-text messages go to LLM vs which
   should be quick keyword shortcuts (e.g. plain "calls" → /calls,
   "minutes" → /minutes, saving an LLM call). List the shortcut
   keywords explicitly.

c) Cost guard math
   - Avg ~2K input + 300 output per turn at Haiku 4.5 rates
   - 10 turns/min cap × 5 active clients = 50 max turns/min
   - Show monthly worst case in $ at full saturation
   - Show realistic case (1 turn/client/day = 150/mo)

d) Failure modes — exact reply text for each
   - OpenRouter 429 (rate limited upstream)
   - OpenRouter 500 / network error
   - 15s timeout
   - Empty / unparseable LLM response
   - LLM responds but cites no call (likely hallucination guard)

e) Test plan — at least 6 cases
   1. "anything urgent?" with HOT calls present → urgent table
   2. "anything urgent?" with no calls today → honest empty answer
   3. "summarize this week"
   4. "what's my balance?" / "how many minutes left?" → uses combined
      monthly_minute_limit + bonus_minutes (L1)
   5. Plain word "calls" → keyword shortcut to /calls (no LLM call)
   6. Ambiguous question with no useful context → fallback reply
   7. Stubbed OpenRouter timeout → Tier 1 commands still work
      (regression test)

f) Schema changes
   - New table telegram_assistant_log (per L10) — full SQL in design doc
   - No other schema changes
   - Note that NO migration to clients table is needed for Tier 2
     (operator user_id link is a Tier 3 concern per L8)

g) Manual ops gates (call out in PR body)
   - Add OPENROUTER_API_KEY to Railway prod env vars
   - Apply telegram_assistant_log migration
   - Verify Tier 1 commands still work after deploy
   - Optional: add the group-chat warning line to welcome emails (L3)

When the design doc is ready, ASK ME ONE QUESTION if anything is
ambiguous, then say:
    "Tier 2 design ready — greenlight the build?"
and wait for my go.

═══════════════════════════════════════════════════════════════════════
TIER 2 BUILD PLAN (after design greenlight)
═══════════════════════════════════════════════════════════════════════
Commit-by-commit:

1. refactor(telegram): extract makeFakeSupa() to shared test helper
   - Move from telegram-router.test.ts to
     src/lib/__tests__/_helpers/fake-supabase.ts
   - Re-import in existing test file
   - npx tsx --test → 11/11 still pass

2. feat(telegram): assistant.ts skeleton + system prompt builder
   - src/lib/telegram/assistant.ts — answerForClient(client, message)
   - System prompt built from queries.ts data
   - OpenRouter fetch with 15s timeout, 600 max_tokens
   - Returns { reply: string, outcome: 'ok'|'timeout'|'fallback'|'error',
     usage: { input_tokens, output_tokens } }
   - Unit tests with stubbed fetch (no network in CI)

3. feat(telegram): keyword shortcuts (no-LLM fast path)
   - src/lib/telegram/router.ts default branch → check keyword shortcuts
     first; only fall through to assistant.ts if no match

4. feat(telegram): wire assistant into router default branch
   - sendChatAction('typing') in webhook BEFORE calling assistant
   - Log to telegram_assistant_log (no PII per L10)
   - Reply with HTML

5. feat(db): telegram_assistant_log migration
   - timestamp_create_telegram_assistant_log.sql
   - chat_id, client_id, model, input_tokens, output_tokens,
     latency_ms, outcome, created_at
   - RLS: service-role only, deny all to anon/authenticated

6. test(telegram): Tier 2 test suite
   - Stubbed OpenRouter responses for happy path + each failure mode
   - Citation format assertion
   - Multi-tenant leak guard (extending the Tier 1 leak test)
   - Tier-1-still-works when OpenRouter is stubbed to throw

═══════════════════════════════════════════════════════════════════════
TOP-1% BAR (every reply must clear these)
═══════════════════════════════════════════════════════════════════════
- Replies under 5s for LLM Q&A; under 2s for keyword shortcuts
- Never invents data — cites exact call IDs / phones / times
- 3-line default; tables for 3+ rows; <pre> for monospace alignment
- Honest "I don't have that yet" beats hallucinated answers
- Conversational — handles "yo" / "hey" without lecturing
- Every reply ends with a suggested next step ("/calls for more")
- Tier 1 keeps working when OpenRouter is down — verified by test
- No PII in logs; only token counts + outcome

═══════════════════════════════════════════════════════════════════════
SUCCESS CRITERIA FOR THIS CHAT
═══════════════════════════════════════════════════════════════════════
- Design doc delivered to CALLINGAGENTS/00-Inbox/ and approved
- 6 commits on a feat/telegram-tier2 branch, single PR opened
- All tests green (Tier 1 + Tier 2)
- npm run build green
- PR body lists OPENROUTER_API_KEY → Railway as an explicit
  manual gate, plus the migration apply step
- After merge + env var set, I can text the bot
  "anything urgent today?" and get a real, cited answer

═══════════════════════════════════════════════════════════════════════
START BY:
═══════════════════════════════════════════════════════════════════════
1. Reading the 9 required files in order
2. Producing the design doc (do NOT write code yet)
3. Asking me one question if anything is ambiguous

When the design is in front of me, say:
    "Tier 2 design ready — greenlight the build?"

Do not start coding before greenlight.
```

---

## Why this prompt is structured this way

- **Tier 1 status snapshot first** — Claude doesn't re-derive what already shipped or rebuild any of it
- **Lessons L1-L10 baked in as numbered rules** — every gotcha from Tier 1 surfaces here so the next chat doesn't trip on it (combined minutes, no recording URLs, group-chat onboarding warning, in-memory limiter scope, fake-Supabase reuse, settings-card count distrust, .single() ban, slug+role admin gate, webhook reliability rule, PII-free telemetry)
- **Required reading list with order** — stops "I'll just open assistant.ts real quick"
- **Design before code** — forces the citation rule + fallback design + cost math before they get hand-waved
- **Single-PR phase discipline** — Tier 3 stays out of scope
- **Manual env-var gate surfaced explicitly** — Railway OPENROUTER_API_KEY can't be silently forgotten
- **Commit-by-commit build plan** — narrow diffs, reviewable units, each commit is independently revertable
