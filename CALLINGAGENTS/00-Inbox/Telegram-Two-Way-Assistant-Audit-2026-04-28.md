---
type: audit
status: ready-for-review
related:
  - "[[Features/Telegram-Two-Way-Assistant]]"
  - "[[Architecture/control-plane-mutation-contract]]"
  - "[[Architecture/per-call-context-contract]]"
  - "[[Architecture/webhook-security-and-idempotency]]"
  - "[[Clients/calgary-property-leasing]]"
updated: 2026-04-28
---

# Telegram Two-Way Assistant — Audit

> Scope: pre-greenlight audit before Tier 1 PR. Diagnoses the current bot, the live notify path, and produces a parity map of every dashboard surface against a recommended Telegram tier. No code in this PR.

---

## A. Current webhook code path — every branch

File: [src/app/api/webhook/telegram/route.ts](../../src/app/api/webhook/telegram/route.ts)

| Branch | Lines | Behavior | Side effect |
|---|---|---|---|
| Body parse fails (non-JSON) | [42-46](../../src/app/api/webhook/telegram/route.ts#L42-L46) | Return 200 silently | None |
| `update.message?.text` missing | [49](../../src/app/api/webhook/telegram/route.ts#L49) | Return 200 silently | None |
| Non-`/start` text — **THE GATE** | [56-58](../../src/app/api/webhook/telegram/route.ts#L56-L58) | `if (!text.startsWith('/start')) return new NextResponse('OK', { status: 200 })` — silently drops every other message | None |
| `/start` with no token | [62-65](../../src/app/api/webhook/telegram/route.ts#L62-L65) | DM the user "use the link from your welcome email" | 1 sendMessage |
| `/start <token>` lookup miss | [70-84](../../src/app/api/webhook/telegram/route.ts#L70-L84) | Reply "link is invalid or already used" | 1 sendMessage; 200 (don't retry invalid tokens) |
| `/start <token>` — DB write fails | [88-101](../../src/app/api/webhook/telegram/route.ts#L88-L101) | Return 500 to force Telegram retry; token still valid | None |
| `/start <token>` — DB write succeeds | [103-129](../../src/app/api/webhook/telegram/route.ts#L103-L129) | Persist `telegram_chat_id`, `telegram_bot_token`; null out registration token; reply "Connected!"; ping operator (slug=hasan-sharif) with new chatId+client_id | 2 sendMessage (client + operator) |

**The exact 1-line gate that drops every non-`/start` message** (per item d in the brief):
```ts
// src/app/api/webhook/telegram/route.ts:56-58
if (!text.startsWith('/start')) {
  return new NextResponse('OK', { status: 200 })
}
```
This is the only line that needs to be replaced with the slash router + assistant dispatcher to unblock Tier 1.

**Auth model.** No webhook secret. The UUID `telegram_registration_token` in the message body is the credential — single-use, consumed on first match (set to null). This is intentional and documented in [webhook-security-and-idempotency.md §2](../../docs/architecture/webhook-security-and-idempotency.md). It's correct for registration but does **not** authenticate a Tier 2/3 free-text message from an already-registered chat — that has to be authenticated by a fresh chat_id → clients lookup on every message. The body is untrusted.

**Reply formatting.** [route.ts:35](../../src/app/api/webhook/telegram/route.ts#L35) hardcodes `parse_mode: 'HTML'`. Tier 1+2 should keep HTML. Markdown will not render reliably across Telegram clients (per [Features/Telegram-Two-Way-Assistant.md §7.4](../Features/Telegram-Two-Way-Assistant.md)).

---

## B. Outbound notifyTelegram() path — where it fires, what it sends

There is no single function called `notifyTelegram()`. The outbound path is `sendAlert()` in [src/lib/telegram.ts](../../src/lib/telegram.ts), which all senders import.

### B.1 Outbound primitive

[src/lib/telegram.ts](../../src/lib/telegram.ts):
- `sendAlert(botToken, chatId, message, chatId2?)` — POST to `api.telegram.org/bot{token}/sendMessage`
- Always `parse_mode: 'HTML'`
- 10s timeout, 1 retry on 5xx/network errors, respects `Retry-After` on 429 (cap 10s)
- Permanent failures: 400/403/404 — no retry, returns false
- Optional second chatId (not currently used in outbound, but sendAlert supports it)

### B.2 Where it fires

| Caller | File | What | Style |
|---|---|---|---|
| Post-call summary | [src/lib/completed-notifications.ts](../../src/lib/completed-notifications.ts) (`sendTelegramNotification`) called from [completed/route.ts:344](../../src/app/api/webhook/[slug]/completed/route.ts#L344) | After every real call, build message via `telegram-formats.ts` and send to client | controlled by `clients.telegram_style` ∈ {`compact`, `standard`, `action_card`}; auto_glass keeps a dedicated format |
| System failure alert | [completed/route.ts:295-300](../../src/app/api/webhook/[slug]/completed/route.ts#L295-L300) | `endReason='connection_error'` or `'system_error'` → `⚠️ SYSTEM FAILURE` to client + chat_id_2 | hardcoded text, ignores `telegram_style` |
| First call milestone | [completed/route.ts:362-368](../../src/app/api/webhook/[slug]/completed/route.ts#L362-L368) | `🎉 First call received!` once per client (atomic guard on `first_call_at`) | hardcoded text |
| 80% / 100% minute warnings | [completed/route.ts:415-431](../../src/app/api/webhook/[slug]/completed/route.ts#L415-L431) | Once per cycle (timestamp dedup on `minute_warning_80_sent_at` / `_100_sent_at`) | hardcoded text |
| Voicemail captured | [src/app/api/webhook/[slug]/voicemail/route.ts](../../src/app/api/webhook/[slug]/voicemail/route.ts) | New voicemail → alert with recording link | hardcoded text |
| SMS inbound | [src/app/api/webhook/[slug]/sms-inbound/route.ts](../../src/app/api/webhook/[slug]/sms-inbound/route.ts) | Inbound SMS reply notification | hardcoded text |
| Maintenance request | [src/app/api/webhook/[slug]/maintenance-request/route.ts](../../src/app/api/webhook/[slug]/maintenance-request/route.ts) | New maintenance request submission | hardcoded text |
| Transfer status | [src/app/api/webhook/[slug]/transfer-status/route.ts](../../src/app/api/webhook/[slug]/transfer-status/route.ts) | Transfer success/failure | hardcoded text |
| Stripe events | [src/app/api/webhook/stripe/route.ts](../../src/app/api/webhook/stripe/route.ts) | Operator-side ping (slug=hasan-sharif): trial converted, payment received, etc. | hardcoded text |
| Activation/onboard | [src/lib/activate-client.ts:84-87](../../src/lib/activate-client.ts#L84-L87), [475-518](../../src/lib/activate-client.ts#L475-L518) | Step-by-step operator alerts during `activateClient()` (trial start, paid activation, trial converted) | hardcoded text |

### B.3 Telegram style modes (clients.telegram_style)

[src/lib/telegram-formats.ts](../../src/lib/telegram-formats.ts):
- `compact` — minimal, action line + key detail
- `standard` — balanced (DEFAULT)
- `action_card` — structured with divider lines

Action-line rule (D248): HOT/WARM put the call-to-action on line 2 (`📞 Call NOW: ...` / `📞 Follow up: ...`); COLD = summary only; JUNK returns empty string and the caller skips `sendAlert`. Auto-glass niche keeps a dedicated format in [completed-notifications.ts](../../src/lib/completed-notifications.ts) (it does not flow through `telegram-formats.ts`).

### B.4 What the bot does **not** currently send

- No two-way chat (the entire point of this build).
- No daily / weekly digest (`weekly_digest_enabled` exists in `FIELD_REGISTRY` and `clients` table but is read by no cron).
- No usage warnings under 80%.
- No knowledge-gap alerts.
- No callback-due reminders (`followup_reminded_at` exists on `call_logs` but no cron uses it).

These are notify-side gaps but not in scope here — flagged for separate tracker items if useful.

---

## C. Known gaps and risks

### C.1 Security

| Gap | File:line | Bug-bucket | Severity |
|---|---|---|---|
| **Group-chat data leak.** No `chat.type !== 'private'` guard. If a client adds @hassitant_1bot to a group, every other group member can issue `/start <token>` (low risk — token must match) but more importantly will see Tier 1 + Tier 2 replies once shipped. | route.ts (entire file) | source-of-truth (auth scope) | **HIGH** for Tier 1+ |
| **Per-chat_id rate limit absent.** Bot username `@hassitant_1bot` is publicly discoverable. Anyone can DM, invoking the slash router (free) or — once Tier 2 ships — the OpenRouter LLM call ($$). | n/a (new) | partial-failure (cost containment) | **HIGH** for Tier 2 |
| **Tier 2 + 3 use chat_id as identity.** `chat_id → clients.id` is the only multi-tenant key. Compromise of a chat_id (Telegram account hijack of a client owner) = full read/write to that client's data. Acceptable for v1 but flag as "trust the platform" risk in the welcome email. | n/a | source-of-truth | MEDIUM (acceptable, document) |
| **No `update_id` idempotency.** Telegram retries on any 5xx for up to 24h. Tier 1 slash commands are read-only and idempotent, but a Tier 3 write that returns 5xx mid-flight could fire twice unless we dedupe. Existing post-call notify path uses `notification_logs` for dedup; this surface needs its own. | n/a (new) | partial-failure | MEDIUM (Tier 1 OK; required for Tier 3) |
| **No webhook secret.** Intentional, documented in [route.ts:14-15](../../src/app/api/webhook/telegram/route.ts#L14-L15) and [webhook-security-and-idempotency.md §2](../../docs/architecture/webhook-security-and-idempotency.md). UUID-token-in-body is the auth for `/start`. For Tier 1+ messages, the chat_id lookup is the auth. Acceptable. | n/a | n/a | Acceptable |

### C.2 Multi-tenant correctness

| Gap | Bug-bucket | Notes |
|---|---|---|
| Every DB read MUST scope by `client_id` derived from `chat_id`. The audit found no current code that already does this (there's no Tier 1 yet), so the rule has to be designed in. **Hard rule:** `chat_id → clients.id` lookup happens once per message; every subsequent query must `.eq('client_id', clientId)`. | path-parity | Reuse the multi-tenant pattern from [contacts/route.ts:31-37](../../src/app/api/dashboard/contacts/route.ts#L31-L37) — `.eq('client_id', clientId)`. |
| Operator commands (`/clients`, `/health`) need a separate gate: `clientRow.slug === 'hasan-sharif'`. Pattern exists already in [activate-client.ts:80-85](../../src/lib/activate-client.ts#L80-L85). | path-parity | Reuse exact same lookup. |
| **`.single()` ban** on `client_users` (admins have multiple rows — see CLAUDE.md). The Tier 1+ webhook should be looking up `clients` by `telegram_chat_id` (one-to-one) so `.single()` is OK for that — but if the assistant ever joins to `client_users` for permission checks, use `.limit(1).maybeSingle()`. | source-of-truth | Documented in [CLAUDE.md](../../CLAUDE.md). |

### C.3 PII / privacy

- Tier 2 will ship `call_logs.transcript`, `caller_name`, `caller_phone` to OpenRouter (Anthropic Haiku). Acceptable at current volume per [Features/Telegram-Two-Way-Assistant.md §7.1](../Features/Telegram-Two-Way-Assistant.md). Revisit when domain + PIPEDA work lands (S16c-d in tracker).
- Don't log free-text content to a `telegram_query_log` table. Slash command names + chat_id are fine.

### C.4 Latency / cost

- Tier 1 slash command must be sub-2s. All work is one DB query + one Telegram sendMessage — easy.
- Tier 2 LLM call: 15s timeout, 600 max_tokens, `anthropic/claude-haiku-4-5` via OpenRouter. ~$0.0005/turn. Tier 1 must keep working when OpenRouter is down (Tier 1 ≠ Tier 2).
- `OPENROUTER_API_KEY` is in `~/.secrets` and exists in the CLI shell. **Not yet in Railway prod env.** Required before Tier 2 ships.

### C.5 Webhook idempotency for Tier 3

Tier 3 confirm-then-write needs:
- Inline keyboard `callback_data` with one-time UUID + 60s TTL.
- A `telegram_pending_actions` table (or reuse an existing TTL store) to atomically claim the token before write.
- Mutations route through dashboard PATCH endpoints (see §F), never raw `clients.*` updates — preserves prompt patchers, knowledge reseed, Ultravox sync.

---

## D. Bug-bucket classification (from [core-operating-mode.md](../../.claude/rules/core-operating-mode.md))

| Bucket | Drift in scope here |
|---|---|
| **source-of-truth** | None today — registration is correctly token-based and writes the canonical column. Tier 3 must keep writes flowing through the existing PATCH endpoints, not invent a new one. |
| **propagation** | None today — registration is one-shot. Tier 3 mutations must trigger `needsAgentSync` paths via the existing settings PATCH route (see [settings-schema.ts:46](../../src/lib/settings-schema.ts#L46) FIELD_REGISTRY); writing direct to `clients.*` would propagate to DB but not to Ultravox = exactly the fake-control bug below. |
| **path-parity** | Latent. Tier 3 writes through Telegram and through the dashboard must produce identical side effects. Solution: Tier 3 calls the same HTTP routes the dashboard does. Same multi-tenant lookups. |
| **fake-control** | At risk in Tier 3. If we wrote `clients.booking_enabled = true` directly without going through `PATCH /api/dashboard/settings`, the prompt patcher (`patchCalendarBlock`) and the `updateAgent()` sync would never fire — UI would see "booking on" but the live agent would have no calendar tool. Mitigation: route every Tier 3 write through dashboard PATCH endpoints. Hard rule. |
| **partial-failure** | Tier 1 ships even if OpenRouter is down. Tier 3 writes need the confirm-token TTL store. Outbound `sendAlert` already has retry + 5xx/permanent-error split. |
| **capability-gating** | Plan entitlements MUST be re-evaluated on Tier 3 reads/writes — Telegram cannot let a `lite` plan client toggle `booking_enabled=true` if `getPlanEntitlements('lite').bookingEnabled === false`. The dashboard PATCH route already enforces this; routing Tier 3 through it inherits the gate for free. |
| **duplicate-surface** | Tier 1 `/calls`, `/today`, `/missed`, `/minutes` should reuse the same DB queries as the dashboard. Don't fork. Add a thin `lib/telegram/queries.ts` that imports the same helpers used by [home/V2CallList.tsx](../../src/components/dashboard/home/V2CallList.tsx) data path. |

---

## E. Dashboard route + surface inventory

### E.1 Dashboard top-level routes ([src/app/dashboard/](../../src/app/dashboard/))

| Route | Purpose | Tier match |
|---|---|---|
| `/dashboard` | Home / Overview (V2 unified) | Read parity needed — Tier 1+2 |
| `/dashboard/calls` and `/calls/[id]` | Calls list + detail | Read parity needed — Tier 1+2 |
| `/dashboard/leads` | Leads queue (HOT/WARM, callback tracker) | Read parity needed — Tier 1; Tier 3 lead status writes |
| `/dashboard/bookings` | Booking calendar | Read in Tier 2 (NL) |
| `/dashboard/knowledge` | Facts/FAQ/website knowledge surface | Read in Tier 2; Tier 3 quick-add later |
| `/dashboard/settings` | All 19 settings cards | Read + Tier 3 writes (per card) |
| `/dashboard/notifications` | Telegram/email/digest config | Tier 3 writes |
| `/dashboard/billing` | Plan + minutes used | Tier 1 read |
| `/dashboard/setup`, `/dashboard/go-live`, `/dashboard/welcome` | Onboarding flow | Out-of-scope |
| `/dashboard/intake`, `/dashboard/lab`, `/dashboard/agent` | Prompt lab / intake | Out-of-scope |
| `/dashboard/insights`, `/dashboard/advisor` | Analytics + advice | Tier 2 stretch |
| `/dashboard/numbers`, `/dashboard/voices`, `/dashboard/demos` | Admin / config | Out-of-scope (admin-only) |
| `/dashboard/clients` | Operator multi-client view | Tier 1 admin command (`/clients`) |
| `/dashboard/maintenance` | Property-mgmt maintenance inbox | Read in Tier 2 (NL); Tier 3 status writes |
| `/dashboard/live` | Live call monitor | Out-of-scope (websocket realtime) |
| `/dashboard/actions` | Booking + transfer actions | Tier 3 writes via existing PATCH |

### E.2 Settings cards (49 .tsx files in `settings/`, ~21 user-facing per CLAUDE.md "19 cards" + admin-only)

The full list lives in [src/components/dashboard/settings/](../../src/components/dashboard/settings/). The user-facing surfaces, grouped per [AgentTab.tsx](../../src/components/dashboard/settings/AgentTab.tsx) section markers, are mapped in §F.

### E.3 Overview (home) tiles ([src/components/dashboard/home/](../../src/components/dashboard/home/))

`OverviewCallLog`, `BookingCalendarTile`, `AgentSpeaksCard`, `AgentKnowsCard`, `AgentRoutesOnCard`, `BillingTile`, `NotificationsTile`, `BusinessHoursTile`, `IvrVoicemailTile`, `PostCallActionsTile`, `TodayUpdateCard`, `AgentContextPreviewTile`, `AgentReadinessRow`, `QuickConfigStrip`, `ShareNumberCard`, `KnowledgeQuickAddCard`, `UnansweredQuestionsTile`, `NicheInsightsTile`, `PendingReviewTile`, `ActivationTile`. Side-sheets: Identity, Forwarding, Hours, Notifications, Knowledge, Billing.

---

## F. DASHBOARD PARITY MAP

> Source authority: [docs/architecture/control-plane-mutation-contract.md](../../docs/architecture/control-plane-mutation-contract.md) §2 + [src/lib/settings-schema.ts:46-145](../../src/lib/settings-schema.ts#L46-L145) FIELD_REGISTRY.
>
> Mutation classes: `DB_ONLY`, `DB_PLUS_PROMPT`, `DB_PLUS_TOOLS`, `DB_PLUS_PROMPT_PLUS_TOOLS`, `DB_PLUS_KNOWLEDGE_PIPELINE`, `PER_CALL_CONTEXT_ONLY`, `READ_MODEL_ONLY`.
>
> Tier: 1 = slash command (no LLM); 2 = NL Q&A (LLM-mediated); 3 = action with confirm card; OOS = out-of-scope for Telegram.
>
> Read template format: `/cmd <args> → "canonical phrasing"`.
> Write template: `verb → confirm card text`.

### F.1 Overview tiles

| Surface | Reads / controls | DB source | Mutation class | Tier | Read template | Write template | Risk notes |
|---|---|---|---|---|---|---|---|
| Recent calls (OverviewCallLog) | last 5 calls | `call_logs` (caller_phone, ai_summary, started_at, call_status) | n/a (read-only) | 1 + 2 | `/calls` → "Last 5 calls — anything urgent?" | n/a | Reuse the table format from spike H.1 |
| Stats hero (StatsHeroCard) | minutes used, calls today, conversion | `clients.seconds_used_this_month`, derived | READ_MODEL_ONLY | 1 | `/minutes` and `/today` | n/a | Trivial |
| Agent speaks card | greeting, voice, SMS post-call | `clients.agent_name`, `agent_voice_id`, `sms_template` | DB_PLUS_PROMPT / DB_PLUS_TOOLS | 3 | `/settings voice` | "Update voice → Aisha → Mark? (Will resync agent — ~2s)" | Voice change triggers `updateAgent()` — confirm + show 2s notice |
| Agent knows card | facts + FAQ + website status + KB chunk count | `clients.business_facts`, `extra_qa`, `website_scrape_status`, `knowledge_chunks` count | DB_PLUS_KNOWLEDGE_PIPELINE | 1 read; 3 add-fact later | `/knowledge status` | "Add fact → '<text>'? (will reseed knowledge — ~5s)" | Adding QA triggers reseed → ~5s. Defer to Tier 3 wave 2 — not first action. |
| Agent routes on card | call_handling_mode, agent_mode | `clients.call_handling_mode`, `agent_mode` | DB_PLUS_PROMPT | 3 | n/a (uncommon NL ask) | "Switch to triage mode? (rebuilds prompt — ~3s)" | Triggers slot regen — non-trivial. Defer past Tier 3 wave 1. |
| Booking calendar tile | upcoming bookings | `bookings` table (TBD — confirm via `/dashboard/bookings`) | n/a | 2 (NL) | "what's on my calendar today?" | n/a | Read-only Tier 2 |
| Notifications tile | telegram_notifications_enabled, telegram_style, weekly_digest | `clients.telegram_notifications_enabled`, `telegram_style`, `weekly_digest_enabled` | DB_ONLY | 3 | `/settings notifications` | "Pause Telegram alerts until tomorrow morning?" | Writes are DB_ONLY — no agent sync. Lowest-risk Tier 3 surface besides VIP. |
| Business hours tile | weekday + weekend hours | `clients.business_hours_weekday`, `business_hours_weekend` | DB_PLUS_PROMPT (weekday) / PER_CALL_CONTEXT_ONLY (weekend) | 1 read; 3 write later | "what are my hours today?" | "Change weekday hours to 9am-6pm? (rebuilds prompt — ~3s)" | Weekday change triggers prompt patch + agent sync. Defer Tier 3 write past wave 1. |
| IVR / voicemail tile | ivr_enabled, ivr_prompt, voicemail_greeting_text | `clients.ivr_enabled`, `ivr_prompt`, `voicemail_greeting_text`, `voicemail_greeting_audio_url` | DB_ONLY | 3 (later) | `/settings ivr` | "Disable IVR menu?" | DB_ONLY — safe. Defer to wave 2. |
| Today update card | injected_note | `clients.injected_note` | PER_CALL_CONTEXT_ONLY | 3 | `/settings today_update` | "Set today's update to '<text>'? (live on next call)" | Per-call injection — no agent sync needed. **Excellent first Tier 3 wave 1 candidate** alongside VIP. |
| Post-call actions tile | sms_enabled, sms_template | `clients.sms_enabled`, `sms_template`, `twilio_number` | DB_PLUS_TOOLS | 3 | n/a | "Enable SMS post-call follow-up?" | Triggers tool registration — confirm UX + sync notice. |
| Activation tile / share number | twilio_number, status | `clients.twilio_number`, `status` | DB_PLUS_TOOLS / DB_ONLY | 1 read | `/help` shows DID | n/a | Read-only |
| Today's update | injected_note | same as above | PER_CALL_CONTEXT_ONLY | 3 | covered above | covered above | covered above |

### F.2 Calls page

| Surface | Reads / controls | DB source | Mutation class | Tier | Read template | Write template | Risk notes |
|---|---|---|---|---|---|---|---|
| Calls list | all calls paginated | `call_logs` | n/a | 1 + 2 | `/calls`, `/today`, `/missed` | n/a | See spike H.1 for table format |
| Call detail | one call full transcript | `call_logs` (transcript JSON, recording_url, key_topics, next_steps) | n/a | 2 (NL) | "what did Sarah say yesterday?" | n/a | Recording playback OOS in Telegram (signed URL inline OK) |
| Lead status PATCH | `lead_status` ∈ {new, called_back, booked, closed} | `call_logs.lead_status` | DB_ONLY | 3 | n/a | "Mark John (call ID …) called back?" | Routes through [api/dashboard/calls/[id]/route.ts:33-49](../../src/app/api/dashboard/calls/[id]/route.ts#L33-L49). Idempotent. **Strong Tier 3 wave 1 candidate** (no agent sync, low risk). |
| Call status PATCH | reclassify HOT/WARM/COLD/JUNK/MISSED | `call_logs.call_status` | DB_ONLY | 3 (later) | n/a | "Reclassify call as JUNK?" | Same route. |

### F.3 Settings cards — selected (full ~21 cards listed in [AgentTab.tsx](../../src/components/dashboard/settings/AgentTab.tsx))

| Card | Field(s) | Class | Tier | Notes |
|---|---|---|---|---|
| AgentIdentityHeader | `agent_name`, `business_name` | DB_PLUS_PROMPT | 3 (wave 2) | Triggers prompt patch + sync (~2s). Confirm + diff. |
| VoiceTab + VoiceStyleCard | `agent_voice_id`, `voice_style_preset` | DB_PLUS_TOOLS / DB_PLUS_PROMPT | 3 | Voice id change is fast resync; preset change patches prompt. |
| AgentModeCard | `agent_mode` ∈ {voicemail_replacement, lead_capture, info_hub, appointment_booking} | DB_PLUS_PROMPT | 3 (wave 2) | Slot regen — defer. |
| CallHandlingModeCard | `call_handling_mode` ∈ {message_only, triage, full_service} | DB_PLUS_PROMPT | 3 (wave 2) | Slot regen — defer. |
| HoursCard | `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone` | mixed | 1 read; 3 write wave 2 | Weekday + after_hours_* trigger prompt patch. |
| BookingCard | `booking_enabled`, `booking_service_duration_minutes`, `booking_buffer_minutes` | DB_PLUS_PROMPT_PLUS_TOOLS | 3 (wave 2) | Highest-risk — toggles prompt block + 2 tools + UI badge. Confirm with explicit note. |
| StaffRosterCard | `staff_roster` JSONB | PER_CALL_CONTEXT_ONLY | 3 (wave 2) | No sync. Tier 3 add/remove possible. |
| IvrMenuCard | `ivr_enabled`, `ivr_prompt` | DB_ONLY | 3 (wave 2) | DB only. Safe. |
| **VIPContactsCard** | `client_contacts.is_vip`, `vip_relationship`, `vip_notes`, `transfer_enabled` | DB_ONLY (separate table) | 3 (wave 1 — flagship) | Routes through [api/dashboard/contacts/route.ts](../../src/app/api/dashboard/contacts/route.ts). Frontend re-reads on next page load — automatic dashboard reflection. **See spike H.2.** |
| CallRoutingCard | `forwarding_number`, `transfer_conditions` | DB_PLUS_TOOLS | 3 (wave 2) | Triggers tool re-register + sync. Phone-only — disabled for browser test. |
| ContextDataCard | `context_data`, `context_data_label` | PER_CALL_CONTEXT_ONLY | 3 (wave 2) | Per-call injection — no sync. |
| ServicesOfferedCard | `services_offered` | DB_PLUS_PROMPT | 3 (wave 2) | Prompt patch (slot regen for some niches). |
| AgentKnowledgeCard / WebsiteKnowledgeCard / KnowledgeEngineCard | `business_facts`, `extra_qa`, `website_url`, scrape pipeline | DB_PLUS_KNOWLEDGE_PIPELINE | 2 read; 3 quick-add wave 2 | Reseed = ~5s. Read parity is high-value Tier 2. |
| AlertsTab / NotificationsTile | `telegram_notifications_enabled`, `email_notifications_enabled`, `telegram_style`, `weekly_digest_enabled` | DB_ONLY | 3 (wave 1 candidate) | DB only — safe. "Mute alerts until tomorrow morning" maps here. |
| BillingCard / PlanInfoCard | `selected_plan`, `subscription_status`, `monthly_minute_limit`, `seconds_used_this_month` | DB_ONLY (Stripe-driven) | 1 read | `/minutes` / `/billing`. Writes happen via Stripe — OOS. |
| WebhooksCard | derived from APP_URL + slug | n/a | OOS | Operator-only |
| RuntimeCard | runtime debug state | n/a | OOS | Admin |
| GodModeCard | `twilio_number`, `monthly_minute_limit`, etc. | mixed (admin) | OOS | Admin only — operator commands `/clients` / `/health` cover the safe subset |
| AdminPromoPanel / AdminRecomposePanel | admin-only prompt operations | n/a | OOS | Admin only |
| PromptEditorCard / SectionEditorCard / PromptVariablesCard / PromptVersionsCard | `system_prompt`, sections | DB_PLUS_PROMPT | OOS for Tier 3 | Editing system_prompt over Telegram = footgun. Read-only OK in Tier 2. |
| LearningLoopCard / PromptSuggestionsCard | learning loop suggestions | feature-gated | OOS | Defer until live with paying clients. |
| OutboundAgentConfigCard | `outbound_*` fields | DB_ONLY | OOS | Outbound campaigns are a separate product |
| DangerZoneCard | client deletion / pause | mixed | OOS | Never via Telegram |
| TrialUpgradeSection / BillingTab | Stripe checkout | external | OOS | Stripe portal handles |
| TestCallCard | start a WebRTC test call | n/a | OOS | Browser-only |

### F.4 Out-of-scope surfaces (with reason)

| Surface | Why OOS |
|---|---|
| PDF/file upload (`AgentKnowledgeCard` upload path) | Telegram file size cap + virus-scan path makes this fragile. Web-only. |
| Stripe billing portal | Stripe-hosted, redirects required. Send a deep link only. |
| Calendar OAuth (`calendar_auth_status`) | Requires OAuth redirect URL — Telegram can't host the dance. Send a deep link to `/dashboard/actions`. |
| Recording playback | Telegram supports audio messages but signed URLs expire in minutes; safer to send the URL and let Telegram preview. |
| Live call monitoring (`/dashboard/live`) | Real-time websocket — outside one-shot message model. |
| Prompt editing (`PromptEditorCard`) | Multi-K char prompts + diff review needs UI. Read-only summarisation OK in Tier 2. |
| Niche / `niche_custom_variables` overhaul | Slot regeneration = full rebuild. Web-only. |
| Operator client list, full health dashboard | Some operator commands (`/clients`, `/health`) gated to slug=hasan-sharif. OK as Tier 1. |

---

## G. Files-changed plan (Tier 1 only — for reference; no code yet)

When greenlit, Tier 1 lives in:

1. [src/app/api/webhook/telegram/route.ts](../../src/app/api/webhook/telegram/route.ts) — replace lines 56-58 with router dispatch
2. `src/lib/telegram/router.ts` (new) — slash command switch + private-chat guard + per-chat_id rate limiter
3. `src/lib/telegram/queries.ts` (new) — typed read helpers (`fetchLastNCalls`, `fetchTodayCalls`, `fetchMissed`, `fetchMinutes`, `fetchClientByChatId`, `fetchOperatorMode`)
4. `src/lib/telegram/format.ts` (new) — HTML table builder with 4096-char chunking
5. `supabase/migrations/<timestamp>_telegram_updates_seen.sql` (new) — `update_id` idempotency table (pruned by TTL)
6. `src/lib/__tests__/telegram-router.test.ts` (new) — unit tests for slash dispatch + multi-tenant scope + private-chat guard

Out of Tier 1: OpenRouter, telegram_assistant.ts, write paths.

---

## H. Spikes — the two flagship Tier-2/3 examples

### H.1 SPIKE 1 — "Last 5 calls — anything urgent?"

**Available `call_logs` columns** (verified against [src/lib/database.types.ts:318-361](../../src/lib/database.types.ts#L318-L361)):

`id, client_id, twilio_call_sid, ultravox_call_id, started_at, ended_at, duration_seconds, caller_phone, caller_name, ai_summary, call_status, lead_status, sentiment, confidence, key_topics (JSON), next_steps, callback_preference, service_type, transcript (JSON), recording_url, contact_id, in_call_sms_sent, faq_suggestions (JSON), call_direction`

**Urgency proxy.** No literal `urgency` column. Use `call_status` ∈ {`HOT` 🔥, `WARM` 🟡, `COLD` ❄️, `JUNK` 🗑, `MISSED` 🚫, `UNKNOWN` ⚠️}, populated post-call by classification ([completed/route.ts](../../src/app/api/webhook/[slug]/completed/route.ts)). HOT/WARM = answer to "anything urgent?". Optional secondary signal: `lead_status='new'` (no callback yet).

**Telegram limit.** 4096 chars per message; HTML mode strips most tags, but `<b>`, `<i>`, `<code>`, `<pre>`, `<a href>` render reliably.

**Proposed `/calls` (Tier 1) format** (HTML table inside `<pre>` for monospace alignment):

```
🔥 = HOT  🟡 = WARM  ❄️ = COLD  🚫 = MISSED

<pre>
🔥 09:42  (403) 555-0142  John Doe   booking
🟡 11:15  (403) 555-9988  —          quote
❄️ 13:02  (587) 555-3344  Sarah K    info
🚫 15:30  (403) 555-7711  —          —
🔥 16:48  (403) 555-2200  Mark H     urgent leak
</pre>

<b>2 urgent</b> · /lastcall for full summary · /missed for callbacks
```

Rules:
- 5 rows max, `<pre>` wrapper, fixed column widths chosen so longest row stays under ~70 chars
- Column order: `status_emoji  HH:MM  caller_phone  caller_name  service_type-or-blank`
- Truncate `caller_name` to 10 chars, `service_type` to 14 chars
- Always end with one-line legend + suggested next step
- Total message size ~600 chars — well under 4096

**`/lastcall` (single call detail)** — same query, `LIMIT 1`:

```
🔥 <b>John Doe</b> · (403) 555-0142
09:42 · 2m 14s · HOT

Wants Tuesday 10am booking for AC tune-up.
Asked about pricing — said yes to ~$180 estimate.

Next steps: confirm slot, send Tuesday quote
Recording: https://...

/calls for last 5 · mark john called back
```

Char budget ~500.

**Proposed `/today` and `/missed`** — same table primitive, different `WHERE` clause.

**Tier 2 NL spike** — "anything urgent?" — system prompt skeleton (from [Features/Telegram-Two-Way-Assistant.md §4](../Features/Telegram-Two-Way-Assistant.md)) ingests the same last-20 `call_logs` rows + `business_facts` + `extra_qa`, runs through `anthropic/claude-haiku-4-5` via OpenRouter with `max_tokens: 600`. Reply must cite call IDs / phones / times — never invent. Honest "no urgent calls today" fallback when filter returns 0 rows.

**Verdict:** ship-ready. No schema migration. One read query, one formatter. Tier 2 NL builds on the same query path.

### H.2 SPIKE 2 — "Add this number as a VIP client"

**VIP storage exists today.** Memory note D98 said outbound VIP was deferred, but the inbound-side VIP infra is live:

- Table: `client_contacts` ([api/dashboard/contacts/route.ts](../../src/app/api/dashboard/contacts/route.ts))
- Columns: `id, client_id, phone, name, email, tags, notes, is_vip, vip_relationship, vip_notes, transfer_enabled, preferences, last_call_at, created_at`
- RLS scoped on `client_id` (per [resolveAuth() helper:6-19](../../src/app/api/dashboard/contacts/route.ts#L6-L19))
- Card: [VIPContactsCard.tsx](../../src/components/dashboard/settings/VIPContactsCard.tsx) shows VIPs and re-fetches on mount via `useEffect` ([:54](../../src/components/dashboard/settings/VIPContactsCard.tsx#L54)) — **dashboard reflection is automatic on next page load**, no cache to bust.
- The card is wired into [AgentTab.tsx:646-651](../../src/components/dashboard/settings/AgentTab.tsx#L646-L651) under a `PlanGate` for `transfer` feature.

**No Phase 0 migration needed.** All schema is in place.

**Tier 3 write design — flagship example:**

Conversation:
```
Owner:  who's the wife of the last caller? add this number as a VIP
Bot:    [Tier 2 LLM identifies "wife" via call_logs.transcript context]
        Last caller was John Doe at (403) 555-0142.
        He mentioned his wife Sarah's number: (403) 555-9988.

        Add (403) 555-9988 as VIP?
        Name: Sarah Doe
        Relationship: spouse
        Transfer enabled: yes

        ✅ Confirm    ✗ Cancel
```

Inline keyboard `callback_data` carries a one-time UUID from `telegram_pending_actions` table:

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | Token used in callback_data |
| `chat_id` | bigint | Multi-tenant scope |
| `client_id` | uuid fk clients | Resolved at create |
| `action_type` | text | `'add_vip'`, `'mark_called_back'`, `'mute_alerts'`, ... |
| `payload` | jsonb | The pending insert/update body |
| `expires_at` | timestamptz | NOW() + 60s |
| `consumed_at` | timestamptz | nullable, atomic claim |

On ✅ tap:
1. SELECT FOR UPDATE on `telegram_pending_actions` WHERE `id = token` AND `consumed_at IS NULL` AND `expires_at > now()`.
2. UPDATE `consumed_at = now()` (atomic claim).
3. POST to `/api/dashboard/contacts` with the same body the dashboard uses (preserves RLS, validation, normalizePhoneNA, multi-tenant guard).
4. Reply "Done — Sarah Doe added as VIP. View on dashboard: <link>"

**Why route through the existing endpoint** (path-parity rule from §D): the dashboard's POST normalizes the phone via `normalizePhoneNA` ([contacts/route.ts:57-60](../../src/app/api/dashboard/contacts/route.ts#L57-L60)). Bypassing it would introduce a phone format drift bug. Same logic applies to every Tier 3 write — use the dashboard endpoint, not a parallel raw write.

**Why this is the lowest-risk Tier 3 first action:**
- No prompt change, no Ultravox sync, no plan gate beyond the existing `transfer` feature gate.
- Frontend re-reads on mount — instant reflection.
- Idempotent on retry (the consumed_at guard prevents double-write).
- Reverts via the same DELETE endpoint if mistaken.

**Verdict:** ship-ready as Tier 3 wave 1 first action. Schema unchanged.

---

## I. Top-1% bar — verification path

Reusing the bar from the cold-start prompt, here's how each criterion will be verified before Tier 1 ships:

| Criterion | Verification |
|---|---|
| <2s slash | benchmark in unit test: stub Supabase + Telegram, assert end-to-end <2s |
| Never invents data | all Tier 1 replies are direct DB rows. Tier 2 will require a "no fabrication" rule in system prompt + a citation field in the response |
| 3-line answers default | format helpers cap row count + char budget |
| Tables for 3+ rows | `<pre>` table builder is the only renderer for multi-row replies |
| Honest "I don't have that yet" | `/calls` on a fresh client returns "No calls yet — share your number and forward calls in to start." |
| Conversational | Tier 1 router falls through unrecognized text → "Hi! Try /help — or wait for Tier 2 (coming soon)" |
| Confirm before write | enforced by `telegram_pending_actions` table (Tier 3 only — not in Tier 1) |
| Suggested next step | every reply ends with "/cmd for X" footer |

---

## J. One question before greenlight

**Should Tier 1's `/lastcall` reply include a recording link by default?** Recordings are private storage paths converted to signed URLs at notify time ([completed/route.ts:319-321](../../src/app/api/webhook/[slug]/completed/route.ts#L319-L321), [src/lib/recording-url.ts](../../src/lib/recording-url.ts)). Embedding the signed URL in `/lastcall` makes the message ~80 chars longer but turns Telegram into the playback surface. Tradeoff: the signed URL has a TTL (typically 1h); if Brian opens the message a day later, the link is dead. Two options:

- **A.** Inline signed URL (1h TTL) — instant playback when fresh, dead link later. Match dashboard behavior.
- **B.** Indirect link to `/dashboard/calls/[id]` — always live, requires dashboard login.

Default recommendation: **A** (inline, regenerate on demand via a future `/play <call_id>` slash if needed). Confirm before ship.

---

**Audit ready — greenlight Tier 1?**
