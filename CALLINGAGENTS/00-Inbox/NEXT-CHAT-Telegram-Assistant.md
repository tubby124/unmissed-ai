---
type: chat-prompt
status: ready-to-start
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Project/Index]]"
updated: 2026-04-28
---

# Cold-Start Prompt — Telegram Two-Way Assistant

> Paste the entire block below into a fresh Claude Code chat at the unmissed-ai repo root (`/Users/owner/Downloads/CALLING AGENTs`). It loads context, sets the bar, and tells the next session exactly what to audit and build.

---

```
You are a senior product engineer joining the unmissed.ai voice-agent platform.
The repo is at /Users/owner/Downloads/CALLING AGENTs (Next.js 15 on Railway,
Ultravox + Twilio + Supabase). I am Hasan, sole engineer + owner. Standing
autonomy applies — git push to origin, Railway redeploys, and Supabase migrations
on project qwhvblomlgeapzhnuwlb are pre-authorized when I say "ship", "merge",
or "do it". Do NOT delete data, drop tables, or send outbound customer
communications without confirmation.

YOUR MISSION
Build the Telegram bot @hassitant_1bot into a top-1% AI assistant that gives
each client FULL DASHBOARD PARITY from their phone. The end-state vision: a
client never has to log into the web dashboard — every read and (eventually)
every safe write happens via natural Telegram chat. Examples Hasan called out
explicitly:
  • "Who just called?" / "Last person who called?"           → read
  • "What were my last 5 calls? Anything urgent?"             → read + table
  • "Who's the wife of the last caller — can you add this    → write (VIP)
     number as a VIP client?" — and the dashboard frontend
     must reflect that change on next page load.
  • "Show me today's missed calls in a table"                 → read + table
  • "Mute Telegram alerts until tomorrow morning"             → write (settings)

Telegram is currently a one-way notifier; we want a two-way conversational
surface that mirrors what the dashboard exposes. WhatsApp is the eventual
successor, so design for portability — chat_id ↔ wa_id swap should be the
only meaningful change.

REQUIRED READING (read these IN THIS ORDER before writing any code)
 1. CALLINGAGENTS/Features/Telegram-Two-Way-Assistant.md       — full spec, tiers, acceptance criteria
 2. ~/.claude/projects/-Users-owner/memory/unmissed-notification-channels.md
 3. src/app/api/webhook/telegram/route.ts                       — current registration-only webhook
 4. src/lib/activate-client.ts (lines 80-110, 480-515)          — operator-ping pattern for slug=hasan-sharif
 5. docs/architecture/webhook-security-and-idempotency.md       — section on /telegram (no secret, UUID is auth)
 6. docs/architecture/control-plane-mutation-contract.md        — every dashboard field, its mutation class, and what sync it triggers (CRITICAL — this is the parity map source)
 7. CALLINGAGENTS/Clients/calgary-property-leasing.md           — Brian, the first client who'll use this
 8. src/app/dashboard/                                          — walk the routes (overview, calls, contacts, knowledge, settings) so you know what surfaces to mirror
 9. src/components/dashboard/settings/                          — 19 settings cards, each is a candidate Telegram surface
10. .claude/rules/core-operating-mode.md                        — phase discipline, truth model, bug-buckets
11. .claude/rules/prompt-edit-safety.md                         — only relevant if you touch agent prompts (you shouldn't)

GROUND RULES (project-specific)
- One narrow phase at a time. Do not bundle Tier 1 + Tier 2 + Tier 3 in one PR.
- Never .single() on client_users (admins have multiple rows). Use .limit(1).maybeSingle().
- Webhook idempotency is mandatory — Telegram retries on 5xx for 24h.
- chat_id → client_id is the multi-tenant gate. Every DB read AND write MUST
  filter / scope by the client_id derived from the chat_id. Never trust
  message body for identity.
- Private-chat-only — guard against group chat data leaks.
- Tier 1 (slash commands) MUST work even if OpenRouter / LLM is down.
- Use OpenRouter with anthropic/claude-haiku-4-5 for Tier 2. The key is
  $OPENROUTER_API_KEY in ~/.secrets — needs adding to Railway env vars before deploy.
- Active clients to avoid disrupting: hasan-sharif, exp-realty, windshield-hub,
  urban-vibe, calgary-property-leasing. Test on a fresh trial client.
- Writes (Tier 3) MUST go through the same write paths the dashboard uses
  (PATCH /api/dashboard/settings, etc.) so prompt patchers, knowledge reseed,
  and Ultravox sync still fire. Do NOT write directly to clients.* and bypass
  the mutation contract — that's how fake-control bugs are born.
- Every Tier 3 mutation MUST have a confirm step (inline keyboard:
  ✅ Confirm / ✗ Cancel) before the DB write, with a 60s expiry on
  callback_data tokens.

YOUR FIRST DELIVERABLE — AUDIT (before writing code)
Produce a written audit covering:
  a) The current webhook code path — every branch, what it does, what it ignores.
  b) The notifyTelegram() outbound path — where it fires, what it sends, what
     formatting (compact/standard/action_card) is wired.
  c) Known gaps and risks — security, idempotency, multi-tenant, rate limit, PII.
  d) The exact 1-line gate that today drops every non-/start message.
  e) A bug-bucket classification for any drift you find (source-of-truth /
     propagation / fake-control / etc — see core-operating-mode.md).
  f) Concrete file:line citations for every claim.
  g) DASHBOARD PARITY MAP — a table with one row per dashboard surface
     (Overview tiles, Calls list, Call detail, Contacts/VIP, Knowledge, each
     of the 19 Settings cards, Notifications, Billing). For each row report:
       • What the surface shows or controls
       • DB table(s) + column(s) it reads/writes
       • Mutation class (DB_ONLY / DB_PLUS_PROMPT / DB_PLUS_TOOLS / etc.)
       • Recommended Telegram tier (1 / 2 / 3 / out-of-scope)
       • Read template (slash command + canonical phrasing) and/or
         Write template (action verb + confirm UX outline)
       • Risk notes (e.g. "VIP write is just a JSONB toggle — frontend
         re-reads on next dashboard load, so reflection is automatic")
     Mark surfaces that should NOT be in scope (e.g. PDF knowledge upload,
     Stripe billing portal, calendar OAuth) and explain why.
  h) Specific spike on the two flagship Tier-2/3 examples Hasan called out:
       1. "Last 5 calls — anything urgent?" — confirm the exact call_logs
          columns available (caller_phone, caller_name, ai_summary,
          classification, urgency, started_at, etc.) and design the HTML
          table format that fits Telegram's 4096-char message limit.
       2. "Add this number as a VIP client" — find where VIP / contact
          records live today (memory note D98 says VIP outbound was
          deferred). If no VIP table exists yet, propose the smallest
          schema (e.g. clients.vip_phones JSONB array, or a contacts
          table with is_vip boolean) and confirm how the dashboard would
          read it back. Flag a Phase 0 migration if needed BEFORE Tier 3.

Once the audit is in front of me, I'll greenlight Tier 1.

TIER 1 PHASE PLAN (after audit greenlight)
- Add slash router: /help /calls /today /missed /minutes /settings /lastcall.
- Pure DB lookups, no LLM, no new dependencies.
- /calls and /today render an HTML table: time · caller · summary · urgency.
- Add private-chat guard, per-chat_id rate limit (10/min), update_id idempotency.
- Add operator-only commands gated to slug=hasan-sharif chat_id: /clients /health.
- Tests: unit tests for the router + multi-tenant filter. Integration test with
  a stubbed Supabase + a stubbed Telegram sendMessage.
- Ship as a single PR. Title: "feat(telegram): tier 1 slash commands".

TIER 2 PHASE PLAN (only after Tier 1 ships and is verified live)
- New file: src/lib/telegram-assistant.ts.
- OpenRouter call with anthropic/claude-haiku-4-5, 15s timeout.
- System prompt builder pulling last 20 call_logs + business_facts + extra_qa
  for the calling client_id. Reuses the same RLS-safe scope as Tier 1.
- Natural-language read parity: "anything urgent today?" / "did the wife of
  the guy from yesterday call back?" / "summarize this week" — all return
  cited, table-formatted answers grounded in call_logs.
- Telegram HTML formatting (no markdown). Tables for any list of 3+ rows.
- Telegram "typing…" indicator while waiting on the LLM.
- Tests for prompt assembly + cost ceiling (max_tokens: 600).
- Ship as a separate PR. Title: "feat(telegram): tier 2 natural-language Q&A".

TIER 3 PHASE PLAN (only after Tier 2 ships and Hasan greenlights writes)
- LLM tool-calling: the Haiku call gets a small set of typed actions
  (mark_vip, set_callback_status, mute_alerts_until, update_setting,
  send_text_to_caller). Each action emits a confirm card with inline
  keyboard before any mutation.
- All mutations route through existing dashboard APIs (PATCH
  /api/dashboard/settings, etc.) — never raw clients.* updates. This
  preserves prompt patchers, knowledge reseed, and Ultravox sync.
- Idempotency: each callback_data carries a one-time token (UUID + 60s TTL
  in a small telegram_pending_actions table) so a double-tap doesn't
  double-write.
- Frontend reflection: dashboard re-reads on page load; for any surface
  that caches (SWR / RSC), document the cache-bust path or add it.
- Ship one action at a time, each as its own PR, starting with the
  lowest-risk write (mark_vip — touches one column, no Ultravox sync,
  no prompt rebuild). Title pattern: "feat(telegram): tier 3 <action>".

TOP-1% BAR (every reply must clear these)
- Replies under 2s for slash commands, under 5s for LLM Q&A, under 8s
  for LLM Q&A that hits a tool.
- Never invents data — cite exact call IDs / phones / times.
- Concise — 3-line answers by default, drill-down on request.
- Tables for any list of 3+ rows; HTML <pre> for monospace alignment.
- Honest — "I don't have that yet" beats hallucinated answers.
- Conversational — handles "yo" / "hey" / "what's up" without lecturing.
- Confirm before any write. Always show the exact field, old value, new
  value, and which surface it affects ("This will update Settings → Voice
  → Voice ID. Old: Aisha. New: Mark.").
- Every reply ends with a suggested next step.

SUCCESS CRITERIA FOR THIS CHAT
- Audit document delivered (markdown, in CALLINGAGENTS/00-Inbox/) with the
  full DASHBOARD PARITY MAP and the two Tier-2/3 spikes.
- Tier 1 PR opened and ready to review (only after I greenlight the audit).
- No regressions on the 5 active clients.
- Hasan can text the bot "last 5 calls — anything urgent?" from his phone
  and get a real, table-formatted answer (Tier 1 covers /calls; Tier 2
  covers the natural-language interpretation).

START BY:
1. Reading the 11 required files in the order listed.
2. Walking the dashboard route tree to inventory every surface.
3. Producing the audit (do NOT write code yet) — including the parity map
   and the two flagship spikes.
4. Asking me one question if anything is ambiguous after the audit.

When you're done with the audit, say "Audit ready — greenlight Tier 1?" and
wait for my go.
```

---

## How to use this

1. Open a new Claude Code session at the repo root.
2. Paste the entire fenced block above as your first message.
3. Claude will read the spec + relevant code, write the audit to `CALLINGAGENTS/00-Inbox/`, and pause.
4. You review the audit, greenlight Tier 1.
5. Tier 1 ships. Then Tier 2. Then Tier 3.

## Why this prompt is structured this way

- **Mission first, then constraints.** Forces alignment on the *what* before the *how*.
- **Required reading list with order.** Stops "I'll just look at the webhook real quick and start coding."
- **Audit before code.** Forces drift-detection discipline (the core-operating-mode rule).
- **Phased shipping.** One PR per tier — bug-blast radius stays small.
- **Top-1% bar made explicit.** Prevents mediocre default behavior. The bar is referenced verbatim in acceptance criteria.
- **First-question gate.** Lets you correct course before any code is written.
