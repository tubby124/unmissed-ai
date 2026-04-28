---
type: feature
status: proposed
tags:
  - telegram
  - assistant
  - openrouter
  - notifications
  - product
related:
  - "[[Project/Index]]"
  - "[[Architecture/control-plane-mutation-contract]]"
  - "[[Architecture/per-call-context-contract]]"
  - "[[Architecture/webhook-security-and-idempotency]]"
  - "[[Clients/calgary-property-leasing]]"
updated: 2026-04-28
---

# Telegram Two-Way Assistant

> **Goal:** Turn the @hassitant_1bot Telegram bot from a passive one-way notifier into the **primary product surface** — a chat where each client can audit calls, ask questions about their leads, and (later) take actions, all from their phone. Telegram is the only channel until domain ships; WhatsApp is the eventual successor (same architecture).

---

## 1. Why this matters

- Domain-blocked. Email is gated by S15 (no domain → no transactional sender). Telegram is the only durable channel we have.
- Phone is where SMB owners live. Brian, Mark (Windshield Hub), Alisha (Urban Vibe) all check Telegram more than they check the dashboard.
- Dashboard isn't ready for handoff. Hasan's standing rule: *"text me anything you want changed."* Telegram-as-dashboard removes that bottleneck.
- WhatsApp portability. Architecture maps 1:1 (chat_id → client_id, inbound webhook → router → LLM → reply). When WhatsApp Business Cloud API is mature, this code ports with ~10% delta.

---

## 2. Current state (audit baseline)

| Asset | File | Status |
|---|---|---|
| Webhook receiver | [src/app/api/webhook/telegram/route.ts](../src/app/api/webhook/telegram/route.ts) | Handles `/start <token>` only. Ignores all other text. |
| Outbound notify | `notifyTelegram()` (search across `lib/`) | Post-call summaries fire when `telegram_chat_id` populated. Working on 5 clients today. |
| Deep-link generator | `/api/dashboard/telegram-link` | UUID token → `https://t.me/hassitant_1bot?start=<token>`. |
| Per-client config | `clients.telegram_chat_id`, `telegram_bot_token`, `telegram_registration_token`, `telegram_notifications_enabled`, `telegram_style` | All present. |
| Operator alerts | `clients` row WHERE `slug='hasan-sharif'` is the operator inbox (pattern in [activate-client.ts:82-87](../src/lib/activate-client.ts#L82-L87)) | Used for trial-converted, payment-received pings. |

**Gap:** the webhook returns 200 + ignores any non-`/start` text ([route.ts:56-58](../src/app/api/webhook/telegram/route.ts#L56-L58)). Every other message Brian sends to the bot is silently dropped. That's the one line that gates this whole feature.

---

## 3. Architecture

```
incoming Telegram update (POST /api/webhook/telegram)
  │
  ├─ chat.type !== 'private'  → 200, no-op (block group-chat data leaks)
  │
  ├─ text starts with "/start" → registration handler (already shipped)
  │
  ├─ text starts with "/<cmd>" → slash router (Tier 1)
  │     /calls   /today   /missed   /minutes   /help   /settings
  │
  └─ free text              → assistant handler (Tier 2)
        ├─ rate-limit per chat_id (10 msg/min)
        ├─ lookup client by chat_id (multi-tenant gate)
        ├─ fetch context: last 20 call_logs + business_facts + extra_qa
        ├─ build system prompt (per-client persona)
        ├─ POST OpenRouter — model: anthropic/claude-haiku-4-5
        └─ sendTelegramMessage(reply)
```

**Identity model.** `chat_id → clients.id` is the multi-tenant boundary. Every fetch must filter by the client_id derived from the chat_id. Never trust client-supplied identifiers in the message body.

**Statelessness.** v1 is one-shot per message (no conversation memory). Each turn re-includes full call_log context. Add a `telegram_conversations` table only if multi-turn coherence becomes a clear win.

---

## 4. Tier breakdown

### Tier 1 — Slash commands (ship first)

Zero LLM cost, zero new dependencies. Pure DB lookups + formatted Telegram replies.

| Command | Behavior | Source |
|---|---|---|
| `/help` | List all commands. | hardcoded |
| `/calls` | Last 5 calls: caller_phone, when, ai_summary truncated to 100 chars. | `call_logs` WHERE `client_id` |
| `/today` | Today's count + 3-line summaries. | `call_logs` WHERE date = today |
| `/missed` | Calls flagged HOT/WARM with no callback marked. | `call_logs` WHERE `lead_score >= warm` |
| `/minutes` | Minutes used / limit, days remaining in cycle. | `clients.seconds_used_this_month` |
| `/settings` | Quick toggles: pause notifications, change style. Returns inline keyboard. | `clients` row |

**Implementation:** ~80 lines added to existing `route.ts`. One switch statement keyed on the first word of `text`. No LLM call. **Effort: 1 hour.**

### Tier 2 — Natural-language Q&A (ship next)

Free-text questions answered by an LLM with the client's call data as context.

**Examples:**
- "what did the last caller want?"
- "how many calls today vs yesterday?"
- "anyone urgent I should call back first?"
- "summarize this week"
- "did anyone ask about pricing?"
- "what's the best lead from this week?"

**Implementation pattern:**
```typescript
// src/lib/telegram-assistant.ts (new file)
export async function answerForClient(
  client: ClientRow,
  question: string
): Promise<string> {
  const recentCalls = await fetchLastNCalls(client.id, 20)
  const systemPrompt = buildAssistantPrompt(client, recentCalls)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(15000),
  })
  // ... parse + return
}
```

**System prompt skeleton:**
```
You are {client.business_name}'s call-log assistant on Telegram.
The owner is {client.owner_name}. They will ask questions about their inbound
calls, leads, and recent business activity.

RULES
- Answer concisely. Telegram messages should be short.
- Never invent calls, callers, or details not in the context.
- If you don't have enough info, say so and suggest a slash command.
- Format with line breaks, not markdown headers (Telegram strips most markdown).
- Bold caller names with <b>...</b> (HTML mode).

RECENT CALLS (last 20):
{rendered call_logs with caller_phone, time, ai_summary, lead_score}

BUSINESS FACTS:
{client.business_facts}

FAQS:
{client.extra_qa}
```

**Cost math:** ~2K input + 300 output per turn at Haiku rates. ~$0.0005/turn. 100 turns/client/month → ~$0.05/client/month. **Effort: 2-3 hours.**

**Env var:** `OPENROUTER_API_KEY` already in `~/.secrets`. Needs adding to Railway prod env vars.

### Tier 3 — Action-taking (later)

Bot can DO things, not just report. Requires LLM tool-calling + a confirmation step before any outbound side effect.

| Intent | Tool | Risk |
|---|---|---|
| "Text the last caller saying I'll call back at 3" | Twilio SMS via existing `/api/webhook/[slug]/sms` | Outbound to real phone — confirm first |
| "Mark John as called back" | Update `lead_status` on call_logs row | Internal state — low risk |
| "Add this number to do-not-call" | Insert `sms_opt_out` row | Internal state — low risk |
| "Pause my agent for 2 hours" | Flip a toggle in `clients` (new column?) | Customer-impacting — confirm first |
| "Show me the recording of call X" | Generate signed URL via `getSignedRecordingUrl()` | Read-only — low risk |

**Defer until Tier 1+2 are proven.** Confirmation UX (inline-keyboard yes/no buttons) needs design.

---

## 5. Hardening checklist (before any tier ships)

- [ ] **Private-chat-only guard** — `if (update.message.chat.type !== 'private') return 200`. Prevents data leak when client adds bot to a group.
- [ ] **Per-chat_id rate limit** — 10 msg/min via existing `SlidingWindowRateLimiter`. Prevent OpenRouter spend abuse if bot username is scraped.
- [ ] **Multi-tenant lookup** — every DB query joins on `client_id` derived from `chat_id`, never from message body.
- [ ] **Webhook idempotency** — Telegram resends on 5xx. Dedupe on `update.update_id` (add a small `telegram_updates_seen` table with TTL, or rely on stateless safety of read-only commands).
- [ ] **Logging** — log slash command usage to `telegram_query_log` (new table) for product analytics. Don't log free-text content (PII).
- [ ] **Operator visibility** — admin slash command `/clients` (gated to `slug=hasan-sharif` chat_id) listing every connected client + minute usage.
- [ ] **Graceful degradation** — if OpenRouter is down, the slash commands still work. Tier 1 must never depend on Tier 2.

---

## 6. WhatsApp portability map

When we move to WhatsApp Business Cloud API:

| Telegram concept | WhatsApp equivalent | Code delta |
|---|---|---|
| `chat_id` | `wa_id` (E.164 phone) | rename column, same lookup pattern |
| `bot_token` | App access token + phone_number_id | env var + per-tenant routing |
| `update.message.text` | `entry[0].changes[0].value.messages[0].text.body` | parse helper |
| `sendMessage` API | `messages` API with template/text payload | reusable wrapper |
| `/start <token>` deep link | `wa.me/15555550100?text=START%20<token>` | URL builder |
| Inline keyboards | Interactive buttons / list messages | UX-layer change |

The router, multi-tenant lookup, OpenRouter call, and call_log fetch are all ~100% reusable. Estimate: 1 day to port Tier 1+2 once Telegram versions are proven.

---

## 7. Risks + open questions

1. **PII in OpenRouter prompts.** Call logs include caller names, phone numbers, summaries. OpenRouter's data-handling stance is acceptable for current volume; revisit when domain + PIPEDA work lands (S16c-d).
2. **Bot username discovery.** Anyone can DM @hassitant_1bot. Non-registered chat_ids should get a polite *"This bot only responds to clients of unmissed.ai. Reply STOP to opt out."* and a chat_id-based rate limit.
3. **Conversation memory.** Single-turn is good enough for v1 but follow-up questions ("and the one before that?") will fail. Add `telegram_conversations` table when this becomes the top complaint.
4. **Markdown rendering.** Telegram parses HTML tags in `parse_mode: 'HTML'` but not all clients render the same. Stick to `<b>`, `<i>`, `<code>`, `<pre>`. No nested formatting.
5. **Operator vs client mode.** Hasan's chat_id (slug=hasan-sharif) should unlock admin commands (`/clients`, `/health`, `/revenue`). Rest of the world gets client-mode only.

---

## 8. Acceptance criteria (top-1% bar)

A "top-1% agent" feels like:
- **Instant** — replies under 2s for slash commands, under 5s for LLM Q&A.
- **Right** — never invents data. Cites exact call IDs / phones / times when relevant.
- **Concise** — 3-line answers by default. Drill-down on request.
- **Conversational** — handles "yo" / "hey" / "what's up?" without confusion. Doesn't lecture.
- **Actionable** — every reply ends with a suggested next step ("/calls for more" or "want me to text them back?").
- **Honest about limits** — "I don't have that yet" beats hallucinated answers.
- **Owns its mistakes** — if a slash command errors, the bot says so plainly with a recovery path.

---

## 9. Files to read before starting work

```
src/app/api/webhook/telegram/route.ts          — current registration-only handler
src/lib/activate-client.ts                     — operator-ping pattern (slug=hasan-sharif lookup)
src/app/api/webhook/[slug]/completed/route.ts  — post-call summary outbound (where notifyTelegram fires)
src/lib/twilio.ts (sliding-window rate-limit)  — reuse pattern for chat_id limiting
docs/architecture/webhook-security-and-idempotency.md
~/.claude/projects/-Users-owner/memory/unmissed-notification-channels.md
```

---

## 10. Resume command

`audit and build the telegram assistant`
