---
type: ops-plan
status: ready-when-username-picked
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Decisions/2026-04-28-Telegram-Tier1-Slash-Router]]"
  - "[[Decisions/2026-04-28-Telegram-Tier2-NL-Assistant]]"
  - "[[Clients/velly-remodeling]]"
updated: 2026-04-28
---

# Telegram Bot Rename Plan — `@hassitant_1bot` → `<new_username>`

> **TL;DR:** Renaming the bot in @BotFather is safe. The token is the bot's
> identity, not the @username. All registered clients keep working with zero
> action on their part. The only risk is unsent welcome emails containing
> stale deep links.

---

## What changes vs. what doesn't

| Thing | Changes? |
|---|---|
| `TELEGRAM_BOT_TOKEN` (Railway env) | **No** — keep the same. Token = identity. |
| `clients.telegram_chat_id` for all registered clients | **No** — chat_id is bound to the bot ID, not the @username |
| Webhook URL | **No** — set on the bot (token), not the @username |
| Inbound webhook traffic | **No interruption** |
| Outbound `notifyTelegram()` | **No interruption** |
| Conversation history | **Preserved** |
| Display name shown in chat header | **Yes (your choice)** — `/setname` in @BotFather, independent from username |
| Bot description / about | **Yes (your choice)** — `/setdescription` + `/setabouttext` |
| Deep-link URL (`t.me/<old>?start=TOKEN`) | **Yes — only matters for unsent welcome emails** |

---

## Current users — what they see

| Client | chat_id status | What they see post-rename |
|---|---|---|
| Hasan / hasan-sharif | Registered | Display name + @username refresh on next message; chat history preserved |
| Aisha / hasan-sharif partner | Registered | Same |
| Brian / calgary-property-leasing | Registered | Same |
| Mark / windshield-hub | Registered | Same |
| Alisha / urban-vibe | Registered | Same |
| Fatima / exp-realty | Registered | Same |
| **Kausar / velly-remodeling** | **NOT yet registered** | **Old deep link in her welcome email goes to "bot not found" if she clicks AFTER rename. Email must be regenerated.** |

**Anyone with a stale `t.me/hassitant_1bot?start=TOKEN` URL** (Brian, etc. — their original welcome emails sit in Gmail) — link goes dead. Doesn't matter because they're already registered. But if you forward an old onboarding email or a bookmark exists, dead.

---

## Username picker — quick rules

- 5–32 chars, must end in `bot` (case-insensitive), unique globally
- Telegram won't tell you what's taken until you try in @BotFather

Suggestions (brand-tied):
- `unmissed_ai_bot`
- `unmissedReceptionist_bot`
- `unmissed_concierge_bot`
- `AIReceptionist_unmissed_bot`
- `HasansReceptionist_bot` (personal/founder-flavored)

Display name (separate from username, can be branded freely):
- `unmissed.ai`
- `AI Receptionist`
- `Hasan's Receptionist`

---

## Execution sequence (zero-downtime path)

### Step 1 — Pick + reserve the username in @BotFather
1. DM @BotFather → `/mybots` → pick the existing `@hassitant_1bot`
2. `Edit Bot` → `Edit Username` → enter the new username (BotFather will reject if taken)
3. **STOP HERE.** Don't change display name yet — wait until env var is set so the rename is atomic from the user's perspective.

### Step 2 — Update Railway env vars
Set both (Next.js public envs require explicit `NEXT_PUBLIC_` prefix for client bundle):
- `TELEGRAM_BOT_USERNAME=<new_username>` (no `@`, no `t.me/`)
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<new_username>`

This triggers a Railway redeploy. After deploy, all 7 places that read these env vars (5 server routes + AlertsTab.tsx + SuccessView.tsx) generate the new URL.

### Step 3 — Confirm the rename in @BotFather
Now finish the rename: `/setname` for display name, `/setabouttext` for description. Existing chats refresh on next message.

### Step 4 — Smoke test (≤ 5 min)
1. Open Telegram on your phone → existing chat with the bot now shows the new name
2. Type `/calls` → reply still works
3. From the dashboard, click "Connect Telegram" on any client → the deep-link button now points to the new @username
4. Generate a test deep link via admin route → confirm URL has new @username

### Step 5 — Regenerate Kausar's welcome email
Kausar's existing email at `clients/velly-remodeling/welcome-email-kausar.{txt,html}` contains the old URL. Two options:

**Option A — manual edit (fastest):**
Replace `https://t.me/hassitant_1bot?start=2efe1281-00ce-4809-b2bf-77b184e63993`
with `https://t.me/<new_username>?start=2efe1281-00ce-4809-b2bf-77b184e63993`
(Token unchanged — it's stored in `clients.telegram_registration_token` and not bound to the @username.)

**Option B — regenerate via skill:**
`/notify-client` skill or onboarding flow re-runs the email build using the new env var, producing a fresh template-rendered email.

Then re-send to Kausar (her registration token is still valid).

### Step 6 — Update vault docs (low priority, when convenient)
- `Features/Telegram-Two-Way-Assistant.md` line 51 + 70 + 238 — update `@hassitant_1bot` references to new @username
- Leave historical docs alone (`Decisions/2026-04-28-Telegram-Tier1-Slash-Router.md`, audit reports, tracker notes) — they record the bot's name at the time, preserved as historical record

---

## Code changes already in this PR

| File | Change |
|---|---|
| `src/components/onboard/SuccessView.tsx:119` | Hardcoded `t.me/hassitant_1bot` → reads `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (fallback `'hassitant_1bot'` for safety) |
| `src/app/api/webhook/telegram/route.ts:4` | Comment: `@hassitant_1bot` → "the configured bot (`TELEGRAM_BOT_USERNAME` env var; identity is the token)" |
| `src/app/api/admin/setup-telegram-webhook/route.ts:5` | Comment: `@hassitant_1bot` → "the configured bot" |
| `src/app/api/admin/generate-telegram-token/route.ts:6` | Comment: `@hassitant_1bot` → "the bot (TELEGRAM_BOT_USERNAME)" |
| `ARCHITECTURE_STATE.md:251` | Doc: `hassitant_1bot webhook URL` → "the configured bot's webhook URL" |

After this PR merges + Railway env vars are set, every code path that builds a `t.me/<bot>?start=<token>` URL uses the env var. There are no remaining hardcoded production references.

---

## Gaps / known footguns

1. **Fallback default `'hassitant_1bot'` still present** in 7 places. Tech debt — not a production risk because Railway env var is set, but a developer running locally without setting the env var will generate stale links. Future cleanup: hoist to `lib/app-url.ts` like `APP_URL` / `SITE_URL` per CLAUDE.md "Centralized URLs" rule.
2. **Brian's already-sent welcome email** (`clients/calgary-property-leasing/welcome-email-brian.{txt,html}`) contains the old URL. He's already registered — leaving as historical record. If he ever forwards it to someone who taps it, dead link.
3. **Vault historical docs** preserve the old `@hassitant_1bot` name. Intentional — they're snapshots in time. Don't bulk-rewrite history.
4. **Audit/reporting docs** (`docs/s12-audit/*.md`, `docs/tracker/D313.md`) — same. Historical artifacts.
5. **`telegram_bot_token` per-client schema column** is populated with the platform token for every client today. When Tier 4 ships per-client white-label bots, these will diverge. Not a Tier 3 concern.

---

## Rollback (if anything goes wrong)

If post-rename smoke test fails:
1. Re-rename in @BotFather back to `@hassitant_1bot` (assuming it's still available — Telegram releases old usernames after a delay, so do this within minutes if rolling back)
2. Revert Railway env vars to old `TELEGRAM_BOT_USERNAME=hassitant_1bot`
3. Railway redeploys → app returns to old URLs
4. Existing clients unaffected throughout (token-bound chat_ids)

---

## Resume command

`execute the telegram bot rename`

(After picking a new @username in @BotFather and being ready to update Railway env vars.)
