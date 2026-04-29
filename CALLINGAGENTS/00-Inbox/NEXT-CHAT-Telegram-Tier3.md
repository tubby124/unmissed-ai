---
type: chat-prompt
status: ready-to-start
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28]]"
  - "[[00-Inbox/Telegram-Tier2-Design-2026-04-28]]"
  - "[[00-Inbox/Telegram-Tier3-Followups-2026-04-28]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
updated: 2026-04-28
---

# Cold-Start Prompt — Telegram Tier 3 (Confirmable Mutations + Operator Surface)

> Paste the entire fenced block below into a fresh Claude Code chat at the unmissed-ai repo root (`/Users/owner/Downloads/CALLING AGENTs`). Tier 1 (PR #41, sha `03ad11c0`) and Tier 2 (PR #47, sha `74f1ac4`) are both live on `main`. Tier 3 turns the bot from read-only into a controlled mutation surface — owners can tap a button to act on a call, and the operator (Hasan) gets a fleet view.

---

```
You are a senior product engineer continuing the @AIReceptionist_bot Telegram
build for unmissed.ai (renamed from @hassitant_1bot 2026-04-28 via @BotFather;
token unchanged, all 6 registered clients keep working with no disruption).
The repo is at /Users/owner/Downloads/CALLING AGENTs
(Next.js 15 on Railway, Ultravox + Twilio + Supabase). I am Hasan, sole
engineer + owner. Standing autonomy applies — git push to origin, Railway
redeploys, and Supabase migrations on project qwhvblomlgeapzhnuwlb are
pre-authorized when I say "ship", "merge", or "do it". Do NOT delete data,
drop tables, or send outbound customer communications without confirmation.

═══════════════════════════════════════════════════════════════════════
TIER 1 + TIER 2 ARE LIVE — DO NOT REBUILD ANY OF THIS
═══════════════════════════════════════════════════════════════════════
Tier 1 PR #41 squash-merged 2026-04-28 sha 03ad11c0.
Tier 2 PR #47 squash-merged 2026-04-28 sha 74f1ac4.
Railway has auto-deployed both. Migrations applied to prod
(qwhvblomlgeapzhnuwlb): telegram_updates_seen, telegram_assistant_log.
OPENROUTER_API_KEY is set in Railway env. setMyCommands +
setChatMenuButton fired via /api/admin/setup-telegram-webhook.

Live capability surface (DO NOT TOUCH — extend):
  Slash commands: /help /calls /today /missed /lastcall /minutes
  NL Q&A: any free-text → Haiku 4.5 via OpenRouter, cited replies
  Keyword shortcuts: "calls", "today", "missed", "minutes" → no-LLM
  Discoverability: bot menu + persistent 4-button inline keyboard
                   on every reply + callback_query branch in webhook
  Hardening: private-chat router guard, 10/min in-memory rate limit,
             update_id idempotency (DB), citation guard regex
  Tests: 32+ in src/lib/__tests__/telegram-*.test.ts

Files in place (DO NOT REWRITE — extend):
  src/lib/telegram/router.ts           — slash dispatch + NL fallback
  src/lib/telegram/assistant.ts        — OpenRouter call + system prompt
  src/lib/telegram/queries.ts          — multi-tenant DB reads
  src/lib/telegram/format.ts           — HTML rendering + tables
  src/lib/telegram/menu.ts             — slash list + keyboards
                                         (cb:<id> / mk:<id> codes are
                                         RESERVED HERE — Tier 3 wires
                                         them. See A.6 below.)
  src/lib/__tests__/_helpers/fake-supabase.ts — shared test harness
  src/app/api/webhook/telegram/route.ts        — webhook entry +
                                                callback_query branch +
                                                /start registration path
  src/app/api/admin/setup-telegram-webhook/route.ts — menu registration
  supabase/migrations/20260428100000_create_telegram_updates_seen.sql
  supabase/migrations/20260428*_create_telegram_assistant_log.sql

═══════════════════════════════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════════════════════════════
Add Tier 3: confirmable mutations from the bot, an operator-only
fleet surface, and per-client cost guards. Owner taps "📞 Call back
top lead" → bot replies with a confirm step → tap "✅ Confirm" → the
lead is marked contacted in the dashboard PATCH endpoint (NOT a direct
clients-table write). Hasan types /health → fleet status. Each client
gets a monthly LLM spend cap so a runaway loop can't bankrupt the
account.

Tier 3 must:
  • Wire the RESERVED cb:<id> and mk:<id> callback codes in menu.ts to
    real handlers — currently buildContextActionsKeyboard('urgent')
    emits the static 4-button set; it must START emitting cb:<top_id>
    and mk:<top_id> from the actual top urgent call (A.6, C.3)
  • Introduce a DB-backed confirm-token TTL store (telegram_pending_actions
    table) — in-memory tokens void on Railway redeploy mid-flow (A.2, C.2)
  • Route every mutation through the existing dashboard PATCH endpoints
    (lead_status, etc.) — NEVER direct UPDATEs on clients.* (D.1)
  • Add operator commands gated by slug='hasan-sharif':
      /clients — fleet roll-up (chat_id status, last call, MTD usage)
      /health  — last-deploy hash, OpenRouter latency p95, DB lag
      /spend   — telegram_assistant_log MTD aggregate this month (C.1)
  • Add per-client monthly LLM spend cap from
    clients.telegram_assistant_cap_usd (default $5) — when exceeded:
    polite throttle reply, Tier 1 keeps working (B.4, C.4)
  • Ship the group-chat guard on /start registration (B.6, C.5) — this
    is a Tier 1 latent bug, NOT a Tier 3 regression. Land it as the
    very first commit so it's separable.
  • Add 1% reply-audit sampling — log (system_prompt_hash, reply,
    recentCalls_count, citation_passed) to telegram_reply_audit so I
    can review hallucination rate manually. PII-free — hash the prompt,
    don't store it raw (B.3, C.6)
  • Add a 90-day retention policy on telegram_assistant_log — cron or
    pg_cron DELETE WHERE created_at < now() - interval '90 days' (B.5)
  • Treat dispatchCommand as internal-only — rename to
    _internalDispatchCommand or add a JSDoc warning (B.7)

DO NOT in this PR:
  • Add a webhook secret. If we ever do, callback_query handler must
    also validate it (A.1) — flag as a future milestone, not here.
  • Build a per-client bot fleet (@yourcompany_bot). Per-client tokens
    are in the schema but the fleet is post-Tier-3 (A.4).
  • Touch live voice agent prompts. Tier 3 sends a NEW prompt to Haiku
    for the audit sampler if needed; production voice prompts are
    off-limits (.claude/rules/prompt-edit-safety.md).

═══════════════════════════════════════════════════════════════════════
LESSONS FROM TIER 2 — BAKE THESE INTO TIER 3 FROM DAY ONE
═══════════════════════════════════════════════════════════════════════
(Numbered to continue the L1–L11 series from the Tier 2 cold-start.)

L12. CALLBACK_QUERY DOES NOT AUTHENTICATE THE CHAT_ID.
     Tier 2's callback_query branch resolves chat_id → client_id fresh
     on every tap, same as a typed message. That is correct — keep
     doing it for every cb:<id> / mk:<id> dispatch. Telegram only
     proves the *update* came from Telegram (we don't currently
     validate that — see A.1). Until we add a webhook secret, NEVER
     trust update.callback_query.from for client identity. Always
     re-resolve chat_id → clients fresh.

L13. CONFIRM-TOKEN TTL STORE MUST BE DB-BACKED.
     L4 in Tier 2 said the in-memory rate limiter is acceptable
     because it resets on Railway redeploy. The same is NOT true for
     confirm tokens. If Hasan taps "📞 Call back top lead" → bot shows
     "Confirm?" → Railway redeploys → Hasan taps "✅ Confirm" → token
     is gone → silent failure. telegram_pending_actions schema (per
     audit §H.2):
       chat_id      bigint not null,
       client_id    uuid not null references clients(id),
       action_kind  text not null,        -- 'mark_called_back' | 'cb_lead'
       payload      jsonb not null,        -- { lead_id, ...extras }
       token        uuid not null unique,  -- emitted in callback_data
       expires_at   timestamptz not null,  -- now() + interval '60 seconds'
       created_at   timestamptz default now()
     Index (token), index (chat_id, expires_at). RLS service-role only.
     Sweeper cron deletes expired rows nightly.

L14. callback_data IS LIMITED TO 64 BYTES — token UUIDs eat 36 bytes.
     The Tier 2 codes (c/t/m/l/n/h) are 1 byte. Tier 3 codes need to
     fit a UUID + a kind prefix in ≤64 bytes. Format:
       "cf:<uuid>"  (confirm action by token)  → 39 bytes — fine
       "cb:<id>"    (call back lead)            → 39 bytes — fine
       "mk:<id>"    (mark called back)          → 39 bytes — fine
     Use the lead UUID directly, not a separate token, for cb/mk. The
     confirm-token (cf:<uuid>) is ONLY for destructive mutations
     where a redeploy-survivable record matters.

L15. EVERY MUTATION ROUTES THROUGH THE DASHBOARD PATCH ENDPOINT.
     Per docs/architecture/control-plane-mutation-contract.md (D.1 in
     the Tier 3 followups), do NOT write directly to clients.* or
     call_logs.* from the Telegram handler. Reuse the same PATCH
     endpoints the dashboard uses so prompt patchers, knowledge
     reseed, and Ultravox sync all run. For "mark called back": call
     the existing dashboard endpoint that updates lead_status. For
     "call back top lead": same — the action that the dashboard's
     "Call back" button already triggers. Find the existing path
     before introducing a new one (per the project's Search-First
     Rule in CLAUDE.md).

L16. REPLY-AUDIT SAMPLING IS PII-FREE.
     The audit table stores: hash(system_prompt) + reply text +
     recentCalls_count + citation_passed (boolean). Reply text is
     fine because we already render it in chat — the LLM produced
     it. The system prompt is hashed because it contains
     business_facts + extra_qa which the customer owns. NEVER store
     the user's free-text question — that's why Tier 2 L10 banned it
     and Tier 3 inherits the rule.

L17. SPEND CAP IS A SOFT THROTTLE, NOT A HARD KILL.
     When a client hits clients.telegram_assistant_cap_usd MTD, the
     Tier 2 NL path returns:
       "You've hit this month's assistant cap (${cap}). Tier 1
        commands like /calls, /missed, /minutes still work."
     Tier 1 slash commands MUST keep working — they don't hit
     OpenRouter. The cap only gates the NL Q&A path. Re-read L9 from
     Tier 2: 200 always for parsing/silent ignores; the throttle is
     a normal reply, not a 5xx.

L18. OPERATOR COMMANDS USE slug='hasan-sharif' FOR NOW.
     Audit §J had a debate about a real operator-user mapping
     (clients.telegram_owner_user_id). Tier 3 keeps it simple —
     match clients.slug === 'hasan-sharif' inside the router default
     branch BEFORE the assistant fires. Document this as a Tier 4
     schema improvement: a dedicated platform_operators table or
     clients.telegram_owner_user_id column.

L19. operator /health DOES NOT EXPOSE SLUGS OR AGENT IDS.
     /health returns aggregate status only (per the project's coding
     pattern in command-routing.md "Health endpoints must not leak
     IDs"). Format:
       <b>Fleet health</b>
       Deploys: ✅ <code>74f1ac4</code> (Railway 4 min ago)
       OpenRouter p95: 1.8s (last 1h)
       DB lag: 0.3s
       Active clients: 5
       Errors (24h): 0
     Slugs only appear in /clients (operator command, fleet view).

L20. SAMPLE 1% — NOT 100%.
     Reply-audit at 100% sampling means duplicating every reply into
     a second table. At 1% (Math.random() < 0.01 inside
     handleAssistantRequest), the audit table grows ~1 row/100
     turns. Realistic-heavy estimate (300 turns/mo across 5 clients)
     = 3 rows/mo. Cheap, reviewable. Bump to 5% later if needed.

═══════════════════════════════════════════════════════════════════════
REQUIRED READING (in order, before writing any code)
═══════════════════════════════════════════════════════════════════════
 1. CALLINGAGENTS/00-Inbox/Telegram-Tier3-Followups-2026-04-28.md
    — A.1-A.6 (real gaps), B.1-B.7 (build-time discoveries),
      C.1-C.7 (cold-start additions), D.1-D.4 (anti-patterns).
      THIS IS YOUR SCOPE DOCUMENT. Re-read C.1-C.7 word-for-word.
 2. CALLINGAGENTS/00-Inbox/Telegram-Two-Way-Assistant-Audit-2026-04-28.md
    — sections H.2 (telegram_pending_actions schema), F (parity map
      from dashboard buttons → telegram actions), J (operator gating)
 3. CALLINGAGENTS/00-Inbox/Telegram-Tier2-Design-2026-04-28.md
    — system prompt skeleton + keyword shortcut list (you must NOT
      regress these)
 4. src/lib/telegram/menu.ts
    — buildContextActionsKeyboard('urgent') currently emits static
      codes. RESERVED cb:<id> / mk:<id> live here. Wire them.
 5. src/lib/telegram/router.ts
    — dispatchCommand is exported. Add operator-command branch
      BEFORE the NL fallback. Add the "internal-only" JSDoc (B.7).
 6. src/app/api/webhook/telegram/route.ts
    — /start registration path (lines ~167-225) needs the group-chat
      guard (B.6). callback_query branch needs cf:<uuid> dispatch.
 7. src/lib/telegram/assistant.ts
    — handleAssistantRequest is where the spend cap check goes
      (BEFORE the OpenRouter fetch) and the 1% reply-audit sample
      goes (AFTER a successful reply).
 8. docs/architecture/control-plane-mutation-contract.md
    — section "Do Not Do This" → "Do not write directly to clients.*".
      Find the dashboard PATCH endpoint that already does
      "mark called back" and reuse it. (Hint: lead_status is in
      call_logs or a separate leads table — confirm by reading.)
 9. docs/architecture/webhook-security-and-idempotency.md
    — telegram webhook section. Tier 3 inherits the existing
      idempotency model (update_id seen-table). No new auth gate.
10. .claude/rules/core-operating-mode.md
    — bug-bucket rule. Classify every Tier 3 deviation as
      source-of-truth / propagation / path-parity / fake-control /
      partial-failure / capability-gating / duplicate-surface.
11. .claude/rules/command-routing.md
    — "Centralized URLs" + "Recordings are PRIVATE" + "Health
      endpoints must not leak IDs". /health output respects this.
12. https://core.telegram.org/bots/api#answercallbackquery
    — for cf:<uuid> taps, answerCallbackQuery shows a 5-second
      toast on success ("Done — top lead marked called back ✅").
      Use the toast for confirmation, the inline keyboard for
      follow-up.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (project-specific)
═══════════════════════════════════════════════════════════════════════
- One narrow phase. Single PR. Title:
    "feat(telegram): tier 3 confirmable mutations + operator surface"
  Do NOT also start Tier 4 (per-client bot fleet).
- chat_id → client_id is the multi-tenant gate. Every Tier 3 read +
  write inherits it. Operator commands are the ONE exception — they
  intentionally read across clients (gated by slug='hasan-sharif').
- Confirm tokens expire in 60 seconds. After expiry the bot replies
  "That confirmation expired. Tap the action again to retry."
- Reuse the dashboard PATCH endpoint for every mutation (L15).
  If you can't find one, STOP and ask before introducing a direct
  DB write.
- Spend cap is read fresh per turn from clients.telegram_assistant_cap_usd
  (default $5). Compute MTD spend by summing
  telegram_assistant_log.input_tokens × $1/M + output_tokens × $5/M
  for the current calendar month, scoped by client_id.
- Reply audit at 1% sampling. PII-free per L16.
- Group-chat /start guard ships as commit 0 — it's a separable safety
  fix and could even spin out as its own PR if Tier 3 grows large.
- Active clients to NOT disrupt: hasan-sharif, exp-realty,
  windshield-hub, urban-vibe, calgary-property-leasing, velly-remodeling.
- Standing rule: do NOT redeploy any of those clients' voice agents.
  Tier 3 is router/webhook/DB only — voice prompts untouched.

═══════════════════════════════════════════════════════════════════════
YOUR FIRST DELIVERABLE — DESIGN DOC (NO CODE YET)
═══════════════════════════════════════════════════════════════════════
Save to CALLINGAGENTS/00-Inbox/Telegram-Tier3-Design-<YYYY-MM-DD>.md.
Max ~3 pages. Cover:

a) telegram_pending_actions schema + sweeper
   - Full SQL (table + indexes + RLS).
   - Sweeper: pg_cron job OR a "delete expired on every read" pattern
     (recommend the latter — simpler than pg_cron in Supabase).
   - Token format: cf:<uuid>; UUID v4; 60s TTL.

b) cb:<id> / mk:<id> wiring
   - Exact change to buildContextActionsKeyboard('urgent') so it emits
     cb:<top_id> + mk:<top_id> when there is a top urgent call,
     falls back to the static set when there isn't.
   - callback_query dispatch table:
       cb:<id> → "📞 Call back <name>?" + [✅ Confirm cf:<token>] [❌ Cancel]
       mk:<id> → "✅ Mark <name> called back?" + [✅ Confirm] [❌ Cancel]
       cf:<uuid> → look up pending_action, execute via dashboard
                    PATCH, answerCallbackQuery toast, return follow-up
                    keyboard.

c) Operator commands
   - /clients output format (table, ≤80 char rows)
   - /health output format (per L19 — no IDs)
   - /spend output format (current MTD vs cap, per client_id)
   - Gating: client.slug === 'hasan-sharif' BEFORE NL fallback

d) Spend cap math + reply text
   - Default $5. Read clients.telegram_assistant_cap_usd
   - MTD calc: sum telegram_assistant_log for current month,
     scoped to client_id, costed at Haiku 4.5 rates ($1/M in,
     $5/M out)
   - Throttle reply text (verbatim, with $ values resolved)
   - Tier 1 commands EXEMPT from cap

e) Reply-audit sampling
   - telegram_reply_audit schema (full SQL)
   - 1% sampling location in handleAssistantRequest
   - Hash function: sha256 of system_prompt, hex digest
   - Insert is fire-and-forget (.then-style is BANNED per
     command-routing.md "All DB writes awaited" — but explicitly
     allowed for the reply-audit because outcome is non-blocking
     and not user-facing. Document this exception in the PR body.)

f) Group-chat /start guard
   - Exact diff for src/app/api/webhook/telegram/route.ts at the
     /start branch top (B.6).
   - Test case: synthetic group chat /start payload returns 200
     with no DB write.

g) Test plan — at least 12 cases
   1. cb:<id> tap with valid call → confirm prompt + token row
   2. cf:<uuid> tap within 60s → action executes, toast shown
   3. cf:<uuid> tap after 60s → "expired" reply, no action
   4. cf:<uuid> tap with stolen token from another chat_id →
      ignored (multi-tenant guard)
   5. /clients as hasan-sharif → fleet table
   6. /clients as windshield-hub → routes to NL fallback
      (operator command not exposed)
   7. /health output has no slugs or agent IDs (regex assertion)
   8. /spend with no usage → "$0.00 MTD"
   9. Spend cap exceeded → throttle reply, /calls still works
   10. Group-chat /start → 200 + no clients.telegram_chat_id write
   11. Reply-audit sample fires at expected rate (mock random)
   12. Audit insert never blocks the reply (latency unchanged)

h) Manual ops gates (call out in PR body)
   - Apply telegram_pending_actions migration
   - Apply telegram_reply_audit migration
   - Add clients.telegram_assistant_cap_usd column (default 5.00)
   - Set clients.telegram_assistant_cap_usd manually for hasan-sharif
     to test the throttle path (e.g. 0.01 → instant cap hit)
   - Hit /api/admin/setup-telegram-webhook (no menu changes — but
     verify the webhook URL is still set after Railway redeploy)
   - Verify Tier 1 + Tier 2 commands still work

When the design doc is ready, ASK ME ONE QUESTION if anything is
ambiguous, then say:
    "Tier 3 design ready — greenlight the build?"
and wait for my go.

═══════════════════════════════════════════════════════════════════════
TIER 3 BUILD PLAN (after design greenlight)
═══════════════════════════════════════════════════════════════════════
Commit 0 ships the latent /start group-chat fix BEFORE anything else.
It's separable — could even land as a tiny standalone PR before Tier
3 if you want. Either way, it lands first so the rest of Tier 3 is
built on a fixed foundation.

0. fix(telegram): block /start registration in group chats (B.6)
   - One-line guard at the top of the /start branch:
       if (chatType !== 'private') return new Response('ok', { status: 200 })
   - Test: synthetic group chat /start → 200 + no DB write
   - npm run build green; existing tests pass

1. feat(db): telegram_pending_actions + telegram_reply_audit migrations
   - Two new tables, RLS service-role only
   - Add clients.telegram_assistant_cap_usd column (numeric, default 5.00)
   - Migration files in supabase/migrations/

2. feat(telegram): confirm-token TTL store + cf:<uuid> handler
   - src/lib/telegram/pending-actions.ts —
     createPendingAction(client_id, chat_id, kind, payload) → token
     resolvePendingAction(token, chat_id) → action | null (deletes
     expired-or-mismatch on read; multi-tenant guard)
   - callback_query branch: route cf:<uuid> through resolver →
     execute via dashboard PATCH → answerCallbackQuery toast
   - Stubbed-fetch tests for the dashboard PATCH call

3. feat(telegram): wire cb:<id> + mk:<id> to real handlers
   - menu.ts: buildContextActionsKeyboard('urgent') accepts a top
     urgent call ID and emits cb:<id> + mk:<id> dynamically; falls
     back to static set when there's no top urgent call
   - assistant.ts: when intent='urgent' and recentCalls has at least
     one HOT/WARM row, pass top_id to the keyboard builder
   - callback_query branch: cb:<id> + mk:<id> create a
     pending_action and reply with the confirm prompt

4. feat(telegram): operator commands /clients /health /spend
   - src/lib/telegram/operator.ts — three render functions
   - router.ts: BEFORE the NL fallback, check
     client.slug === 'hasan-sharif' → dispatch operator command
   - /health respects L19 (no IDs)
   - /spend computes MTD from telegram_assistant_log
   - Tests: gating + format

5. feat(telegram): per-client spend cap throttle
   - assistant.ts: BEFORE the OpenRouter fetch, compute MTD for the
     calling client_id from telegram_assistant_log; if ≥ cap,
     return the throttle reply with the static keyboard
   - Tier 1 commands skip this check (they don't pass through
     assistant.ts)
   - Tests: cap exceeded, cap not exceeded, no usage

6. feat(telegram): 1% reply-audit sampling
   - assistant.ts: AFTER a successful reply, with Math.random() < 0.01,
     insert a telegram_reply_audit row (hash + reply + counts +
     citation_passed). Fire-and-forget — explicitly documented
     exception to the "no .then() writes" rule.
   - Tests: sampling rate (mock random), insert is non-blocking

7. chore(telegram): retention cron + dispatchCommand JSDoc
   - SQL function: delete telegram_assistant_log + telegram_reply_audit
     rows older than 90 days
   - pg_cron job (or document a manual nightly job if pg_cron isn't
     enabled in this Supabase tier)
   - Add JSDoc to dispatchCommand: @internal — auth + rate limiting
     + idempotency are caller-enforced; do NOT call from a cron

8. test(telegram): full Tier 3 test suite
   - All 12 cases from the design doc
   - Multi-tenant leak guard for cf:<uuid> (extends Tier 1+2 leak tests)
   - Operator gating regression
   - npm run build green; total Telegram tests ≥ 50

═══════════════════════════════════════════════════════════════════════
TOP-1% BAR (every reply must clear these)
═══════════════════════════════════════════════════════════════════════
- Owner can mark a lead called back without typing — only tapping
- Confirm prompts ALWAYS show the lead name + last call time before
  asking for confirmation; never just "Confirm action?"
- 60-second TTL is exact — no off-by-one window
- Stolen tokens (a token issued to chat A used in chat B) are
  rejected silently — never leak the existence of the action
- Spend cap throttle is a polite single-line reply; Tier 1 commands
  keep working
- /health never reveals slugs or agent IDs even in error messages
- Reply audit is invisible — no extra latency, no user-visible side
  effect, just a row in the audit table sometimes
- Tier 1 + Tier 2 still work when Tier 3 tables are empty
- No direct writes to clients.* — every mutation goes through a
  dashboard PATCH endpoint

═══════════════════════════════════════════════════════════════════════
SUCCESS CRITERIA FOR THIS CHAT
═══════════════════════════════════════════════════════════════════════
- Design doc delivered to CALLINGAGENTS/00-Inbox/ and approved
- 9 commits on a feat/telegram-tier3 branch (commit 0 = group-chat
  fix, 1-8 = Tier 3 features as listed), single PR opened
- All tests green (Tier 1 + Tier 2 + Tier 3)
- npm run build green
- PR body lists migration applies + clients.telegram_assistant_cap_usd
  default + a manual sanity-test recipe
- After merge + migrations applied, I can:
    (a) text "anything urgent?" → urgent-reply keyboard now includes
        📞 Call back <name>  and  ✅ Mark called back
    (b) tap "📞 Call back <name>" → confirm prompt
    (c) tap "✅ Confirm" within 60s → toast + lead_status updates in
        the dashboard
    (d) wait 61s and tap "✅ Confirm" → "expired" reply, no action
    (e) type /clients as Hasan → see fleet table
    (f) type /clients as a non-operator → routes to NL Q&A
    (g) deliberately set my cap to $0.01, send any NL Q → throttle
        reply; /calls still works
    (h) add the bot to a group chat, type /start → no registration
        write, bot stays silent

═══════════════════════════════════════════════════════════════════════
START BY:
═══════════════════════════════════════════════════════════════════════
1. Reading the 12 required references in order
2. Producing the design doc (do NOT write code yet)
3. Asking me one question if anything is ambiguous

When the design is in front of me, say:
    "Tier 3 design ready — greenlight the build?"

Do not start coding before greenlight.
```

---

## Why this prompt is structured this way

- **Status snapshot covers Tier 1 + Tier 2** — Claude doesn't re-derive what shipped (PR #41 + PR #47 noted with shas)
- **Reserved codes called out explicitly** — `cb:<id>` / `mk:<id>` are placeholders in `menu.ts` today; Tier 3's first job is to make them real (followup A.6 + C.3)
- **L12–L20 numbered rules** — continues the L1–L11 series so a future Tier 4 cold-start can reference any of them by number
- **Commit 0 is the group-chat /start fix** — followup B.6 is a latent Tier 1 bug, not a Tier 3 regression; landing it first means the rest of Tier 3 builds on a fixed foundation. Also separable as its own PR if Tier 3 grows.
- **Mutations go through dashboard PATCH endpoints** — D.1 from the followups, mirroring `control-plane-mutation-contract.md` "Do not write directly to clients.\*"
- **DB-backed pending actions** — the in-memory rate limiter is fine because losing 1 minute of rate-limit state on redeploy is harmless; losing a confirm token mid-flow silently breaks a destructive mutation
- **PII-free reply audit at 1% sampling** — extends Tier 2 L10's no-PII rule; sample rate keeps the audit table cheap and reviewable
- **Operator commands gated on slug, not a new schema** — keeps Tier 3 narrow; `clients.telegram_owner_user_id` is flagged as Tier 4
- **Top-1% bar focuses on tap-only owner experience** — no typing required to call back a lead
