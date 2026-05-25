# Multichannel Notifications — Design Spec

**Date:** 2026-05-25
**Author:** Hasan (via brainstorming session)
**Status:** Approved — ready for implementation plan
**Phase priority:** Phase 1 (Hasan self-test) is the only must-ship. Phases 2–4 ship after Hasan signs off, requires explicit go-ahead.

---

## 1. Problem

Today, per-call owner alerts are inconsistent across the platform:

- **Telegram** — works for all clients, but onboarding friction is high (owners must install Telegram, scan QR, etc.). Adoption among non-technical owners (Kausar at Velly Remodeling, future concierge tier) is poor.
- **Email** — wired but gated behind `niche='voicemail' || call_handling_mode='message_only'` in `src/lib/completed-notifications.ts:579`. Real-business clients (remodeling, real estate, property mgmt) never receive per-call email even when `email_notifications_enabled=true`.
- **SMS** — `sendSmsFollowUp` exists but sends to the **caller**, not the **owner**. There is no owner-direction SMS alert today.

This blocks shipping Velly Remodeling (first $29 concierge client) at the level of polish Hasan wants: dashboard surface with all three channels, owner can pick what they want, defaults work for non-technical users.

## 2. Goal

Ship a 3-channel owner-alert system (SMS, Email, Telegram) that:
1. Defaults to SMS for new clients (lowest friction).
2. Lets owners enable any combination (multi-channel OR — get on every enabled channel).
3. Separates "alert destination" from "billing/owner identity" (Kausar's login is `kausarimam10@yahoo.com` but alerts go to `info@vellyremodeling.com`).
4. Preserves the standing no-redeploy rule for the 4 working clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe).
5. Exposes a dashboard self-service surface with per-channel "send test alert" buttons.

## 3. Non-Goals

- No new notification channels (Slack, Discord, webhook) in this round.
- No urgency-based channel routing (URGENT → SMS, normal → email). Multi-channel OR only.
- No notification framework refactor (no JSONB config, no per-event-type routing). Flat columns + extending existing files.
- No changes to caller-direction features: `sms_enabled` / `sendSmsFollowUp` / SMS templates for callers stay exactly as-is.
- No changes to the Ultravox agent, prompt, or tool registration. Notifications are DB-only fields.
- No changes to daily-digest / minute-usage-alert / Stripe transactional emails — they keep using `contact_email`.

## 4. Architecture

### 4.1 DB schema additions (one migration)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `alert_phone` | `text` nullable | `null` | SMS destination. Reads as `client.alert_phone ?? client.callback_phone`. |
| `alert_email` | `text` nullable | `null` | Email destination. Reads as `client.alert_email ?? client.contact_email`. |
| `sms_alerts_enabled` | `boolean` nullable | `null` (UI treats null as ON for new clients) | New default channel toggle. |
| `pending_sms_optin` | `boolean` | `false` | Marker for the Phase-4 Telegram outreach flow. Set when DM is sent; cleared on reply. |

**Per the control-plane mutation contract:** all four are classified `DB_ONLY` in `FIELD_REGISTRY` (`src/lib/settings-schema.ts`). Not added to `needsAgentSync` because they have zero Ultravox/prompt/tool impact.

**Backfill SQL in same migration** (preserves no-redeploy rule for 4 working clients):
```sql
UPDATE clients
SET sms_alerts_enabled = false, pending_sms_optin = true
WHERE slug IN ('hasan-sharif', 'exp-realty', 'windshield-hub', 'urban-vibe', 'manzil-isa');
```

### 4.2 Conceptual model — multi-channel OR

```
On call completed (in /api/webhook/[slug]/completed):
  for channel in [sms_owner, email, telegram]:
    if not enabled(channel, client): skip + log skip reason; continue
    destination = resolve(channel, client)
    if not destination: skip + log 'no destination'; continue
    if alreadyNotified(call_id, channel): skip; continue
    try:
      send(channel, destination, payload)
      log success in notification_logs
    catch e:
      log failure in notification_logs; continue (no channel blocks others)
```

Each channel is independent: failure isolation preserved.

### 4.3 Resend keys

Drop codex's uncommitted change. Single `RESEND_API_KEY` (DNS is on endvoicemail.ai, no purpose-based split needed yet).

- Revert `src/lib/email/send.ts` — delete `getResendApiKey()` helper, restore single `process.env.RESEND_API_KEY` read.
- Revert `.env.example` — delete `RESEND_API_KEY_ENDVOICEMAIL_SEND=` line.

## 5. Components & Files (~8 files changed)

### Backend — call dispatch path
1. **`src/lib/completed-notifications.ts`**
   - Remove gate at line 579 (`niche === 'voicemail' || call_handling_mode === 'message_only'`). Email fires when `email_notifications_enabled !== false && (alert_email || contact_email) is set`.
   - Extract the existing inline email block (lines ~618–672) into a new named function `sendOwnerEmailAlert(ctx, opts?: { testMode?: boolean })`. Same logic, just named + testable. Resolves destination as `client.alert_email ?? client.contact_email`.
   - Add `sendOwnerSmsAlert(ctx, opts?: { testMode?: boolean })` modeled on `sendTelegramAlert`. Uses `client.twilio_number` as FROM. Sends to `client.alert_phone ?? client.callback_phone`. When `testMode=true`: prepends `TEST — ` to the body and skips the `notification_logs` write. Otherwise writes `notification_logs` with `channel='sms_owner'` (new value, distinct from existing `channel='sms'` which means caller-direction).
   - Extend the existing `notificationsAlreadySent(callId, channel)` query to include `channel='sms_owner'`.
   - Top-level handler in `/completed` calls all three (`sendOwnerSmsAlert`, `sendTelegramAlert`, `sendOwnerEmailAlert`) as siblings.

2. **`src/lib/email/send.ts`** — revert codex diff (single `RESEND_API_KEY`).

3. **`.env.example`** — remove `RESEND_API_KEY_ENDVOICEMAIL_SEND=` line.

### Backend — dashboard
4. **`src/app/api/dashboard/notifications/test/route.ts` (NEW)**
   - `POST`, accepts `{ channel: 'sms' | 'email' | 'telegram' }`.
   - Auth: `client_users` gate (standard pattern).
   - Rate-limit: 5/client/hour via `SlidingWindowRateLimiter`.
   - Builds synthetic payload (hardcoded fake caller `+1 (555) 123-4567`, summary `'TEST — This is what your call alerts will look like.'`, classification `{ status: 'completed', urgency: 'normal' }`).
   - Calls the SAME `sendOwner{Sms,Email}Alert` (and `sendTelegramAlert` for the telegram case) used at call time, passing the named option `{ testMode: true }`. The functions handle the test branch internally (skip `notification_logs` write, add `TEST — ` prefix to message body). No global state, no side channel — explicit function parameter.
   - Returns `{ ok, deliveryId, error? }`.

5. **`src/app/api/dashboard/settings/route.ts`** — extend `updates{}` accumulator to accept `alert_phone`, `alert_email`, `sms_alerts_enabled`. Validate `alert_phone` against E.164 regex `^\+[1-9]\d{1,14}$`. Validate `alert_email` against the existing email regex used for `contact_email`. These are DB-only — do NOT trigger `needsAgentSync`.

### Backend — Telegram outreach (one-off helper)
6. **`scripts/outreach/sms-optin-broadcast.ts` (NEW)** — admin-run script. DMs the existing 5 clients via their `telegram_chat_id` with a yes/no question. Sets `pending_sms_optin=true` on those rows.

7. **`src/app/api/webhook/telegram/route.ts`** — extend message handler: if message text matches `/^(yes|y|yeah|yep)/i` AND `pending_sms_optin=true` on the matching client, set `sms_alerts_enabled=true`, `pending_sms_optin=false`, and reply `"✅ SMS alerts on. You'll get a text on your next call."`. If `/^(no|n|nah)/i`, set `pending_sms_optin=false` and reply `"Got it — staying with Telegram."` Anything else: ignore (lets normal flow continue).

### Frontend — dashboard UI
8. **`src/app/dashboard/notifications/NotificationsConfigSection.tsx`** — restructure from 2 toggles into 3 channel cards. Each card:
   ```
   ┌───────────────────────────────────────────┐
   │ [icon] CHANNEL NAME           [Enable ▢]  │
   │ Destination: [input field]    [Save]      │
   │ Status: ✓ Active / — Off / ⚠ Needs setup  │
   │ [Send test alert]      Last delivery: ... │
   └───────────────────────────────────────────┘
   ```
   - SMS card: `alert_phone` input with `callback_phone` shown as placeholder/default hint.
   - Email card: `alert_email` input with `contact_email` shown as placeholder/default hint.
   - Telegram card: unchanged (linked chat ID or "Connect" CTA).
   - "Send test alert" disabled if channel not enabled or destination missing.
   - "Last delivery" reads `notification_logs` `order by sent_at desc limit 1` per channel.

### Settings schema registry
- **`src/lib/settings-schema.ts`** — add `alert_phone`, `alert_email`, `sms_alerts_enabled` to `FIELD_REGISTRY` as `{ mutationClass: 'DB_ONLY', triggersSync: false }`.

### Files NOT changed (verified safe)
- `src/lib/database.types.ts` — regenerated by Supabase CLI post-migration.
- `src/app/api/webhook/[slug]/completed/route.ts` — already fetches client columns via `select(...)`; append `alert_phone, alert_email, sms_alerts_enabled` to that SELECT.
- Stripe webhook, billing page, agent prompt path — zero touches.

## 6. Data Flow & Idempotency

### 6.1 Live call → notification fanout
```
1. Twilio inbound → /api/webhook/[slug]/inbound (unchanged)
2. Ultravox agent runs the call
3. Call ends → Ultravox signed callback to /api/webhook/[slug]/completed
4. /completed:
   ├─ CAS-update call_logs: live → processing (existing guard)
   ├─ Classify call + generate AI summary (existing)
   ├─ Write call_logs.ai_summary, call_logs.classification (existing)
   ├─ if (notificationsAlreadySent(callId)): return (existing)
   └─ Notification fanout (changed):
        ├─ buildNotificationContext(ctx)
        ├─ if (client.sms_alerts_enabled !== false && destination):
        │    sendOwnerSmsAlert(ctx)
        │    log notification_logs(channel='sms_owner', call_id, status)
        ├─ if (client.telegram_notifications_enabled !== false && chat_id):
        │    sendTelegramAlert(ctx)  ← existing
        │    log notification_logs(channel='telegram', ...)
        └─ if (client.email_notifications_enabled !== false && (alert_email||contact_email)):
             sendOwnerEmailAlert(ctx)  ← existing function, gate removed
             log notification_logs(channel='email', ...)
5. /completed returns 200 (after() fire-and-forget preserved)
```

### 6.2 Idempotency model
`notification_logs` table is the dedup surface. Existing `channel` values: `'telegram'`, `'email'`, `'sms'` (caller-direction — DO NOT collide).
**New value:** `'sms_owner'`.

Guard:
```ts
const alreadySent = await supabase
  .from('notification_logs')
  .select('id')
  .eq('call_id', callId)
  .eq('channel', 'sms_owner')
  .maybeSingle()
if (alreadySent) return
```

Same pattern protects today's Telegram + Email paths. Ultravox retries (up to 10x) safely.

### 6.3 Synthetic test path
`POST /api/dashboard/notifications/test?channel=sms`:
- Auth + rate-limit
- Fetch client row (`twilio_number, alert_phone, callback_phone, alert_email, contact_email, telegram_chat_id, telegram_bot_token`)
- Build synthetic payload (see Section 5 file #4)
- Call SAME production functions with `{ testMode: true }` option → skips `notification_logs` write, prepends `TEST — ` to message body
- Returns `{ ok, deliveryId?, error? }`

Test exercises real production code — if test passes, real path works.

### 6.4 Per-channel failure isolation
Each channel wrapped in try/catch. One channel failing does NOT block other channels or the 200 response.

### 6.5 Missing destination handling
If owner-SMS enabled but `alert_phone` and `callback_phone` both null:
- Log: `[completed] SMS owner-alert SKIPPED slug=X: no alert_phone or callback_phone`
- Insert `notification_logs(channel='sms_owner', status='skipped_no_destination')`
- Dashboard "Last delivery" shows `⚠ Needs setup` instead of pretending success.

If owner-SMS enabled but `twilio_number` null (shouldn't happen post-provision but guard anyway):
- Log: `skipped_no_from`
- Same dashboard treatment.

## 7. Testing & Verification

### 7.1 Unit tests
**File:** `src/lib/__tests__/notification-channels.test.ts` (NEW)
- `sendOwnerSmsAlert` happy path
- `sendOwnerSmsAlert` skip cases: disabled, no destination, no FROM
- `sendOwnerSmsAlert` dedupe via `notification_logs`
- `sendOwnerEmailAlert` fires for non-voicemail niches (regression coverage for the gate removal)
- `sendOwnerEmailAlert` uses `alert_email` when present, falls back to `contact_email`
- `sendOwnerEmailAlert` skips when `email_notifications_enabled=false`

**File extended:** `src/lib/__tests__/notification-guards.test.ts`
- Per-channel failure isolation: mock telegram throws, verify email + SMS still fire.

### 7.2 Playwright integration test
**File:** `tests/notification-dashboard.spec.ts` (NEW)
- Use the `e2e-test-plumbing-co` fixture (only client phase tracker authorizes touching).
- Render `/dashboard/notifications`, verify 3 channel cards.
- Toggle SMS on, fill `alert_phone`, click "Send test alert".
- Assert `POST /api/dashboard/notifications/test` returned 200.
- Assert no `notification_logs` row was written (test sends don't pollute).

### 7.3 Manual verification gates

**Gate A — Hasan self-test (slug `hasan-sharif`, Aisha system) [MUST SHIP]**
1. Run migration on prod Supabase.
2. SQL: set `sms_alerts_enabled=true`, `pending_sms_optin=false`, `alert_phone='<Hasan's cell>'`, `email_notifications_enabled=true`, `alert_email='hasan.sharif@exprealty.com'`. (Migration backfill set `pending_sms_optin=true` for all 5 clients including Hasan; Gate A explicitly clears it on his row since he's a self-test, not awaiting an opt-in reply.)
3. Verify 3 channel cards render on `/dashboard/notifications`.
4. Click "Send test SMS" → confirm SMS lands.
5. Click "Send test email" → confirm email lands.
6. Run backfill preview tool: `npx tsx scripts/dev/backfill-notification-preview.ts --slug=hasan-sharif --count=20 --channels=sms,email`. Tool fetches last 20 `call_logs`, rebuilds payloads from stored data, sends real-format notifications (with `[BACKFILL]` prefix, `__test_mode=true`). Hasan sees 20 historical calls rendered through the new format.
7. Real call test → all 3 channels fire within 30s.
8. Iterate on SMS copy if needed; re-run backfill; re-eyeball.

**Gate passes when:** Hasan signs off on SMS + email format vs Telegram.

**Gates B (Brian) and C (Velly/Kausar) — DEFERRED until Hasan signs off Gate A and explicitly says "go".** Details in Section 8.

### 7.4 Drift detection
After migration, run drift-detector against `hasan-sharif`:
- Saved (DB): new columns present
- Generated (would-be agent state): unchanged
- Deployed (Ultravox): unchanged

Confirms zero agent drift, no-redeploy rule preserved.

### 7.5 Cost monitoring
Add one log line in `sendOwnerSmsAlert`:
```ts
console.log(`[sms_owner_alert] client=${slug} cost_estimate_cad=$0.011`)
```
Grep Railway logs monthly to tally trial-period SMS spend. If excessive, revisit Hasan-absorbs-cost decision in a follow-up.

## 8. Launch Sequence (priority-ordered)

### Phase 0 — Code ship (1 PR, 1 deploy)
1. Migration adds 4 columns + backfill SQL.
2. 8 file changes per Section 5.
3. Vitest + Playwright pass locally.
4. Push → Railway auto-deploys.
5. Drift-detector run against `hasan-sharif` → ✅ zero agent change.

### Phase 1 — Gate A: Hasan self-test [MUST SHIP]
See Section 7.3 Gate A. Only must-ship gate in this design.

### Phase 2 — Gate B: Brian / Calgary Property Leasing [DEFERRED, requires Hasan go-ahead]
1. Verify Brian's slug in Supabase (`SELECT slug, business_name FROM clients WHERE business_name ILIKE '%calgary%property%'`).
2. Confirm Brian has `twilio_number` set.
3. SQL: set `sms_alerts_enabled=true`, `alert_phone='<Brian's cell>'`.
4. DM Brian on Telegram: "Hey Brian, I just turned on SMS call alerts in addition to your Telegram. Next call you get, you'll see both. Let me know what you think."
5. Brian gets 1 real call → confirm SMS lands → ask feedback.

### Phase 3 — Gate C: Velly / Kausar (first paid concierge) [DEFERRED, requires Hasan go-ahead]
1. Send already-drafted Kausar email (Stripe link, login, dial code, test instructions) via gworkspace gmail.py.
2. Wait for Kausar to add card → Stripe webhook flips `subscription_status=active`.
3. Admin SQL sets Velly's row: `sms_alerts_enabled=true`, `alert_phone='<Kausar's cell>'`, `email_notifications_enabled=true`, `alert_email='info@vellyremodeling.com'`, `telegram_notifications_enabled=true`.
4. Kausar tests "Send test alert" buttons for all 3 channels in her dashboard.
5. Kausar calls business cell → no answer → forward → Eric → call completes → all 3 channels fire within 30s.

**Gate passes when:** Kausar confirms all 3 channels landed AND Stripe shows $29 billed.

#### Velly-specific operational checklist (parallel to Phase 3)
- [ ] Velly has `twilio_number` provisioned (confirmed yes — verify in DB)
- [ ] `forwarding_number=+13069887699` (Eric's Twilio number — matches the `**004*13069887699#` dial code)
- [ ] `selected_plan='founding'` or whichever plan corresponds to $29/mo
- [ ] Stripe price ID matches `buy.stripe.com/bJeeV5dzu43Z16J6z22VG01`
- [ ] `kausarimam10@yahoo.com` is in `client_users` for Velly slug, role='owner'

### Phase 4 — Existing-client opt-in broadcast [DEFERRED, after Gates A + B]
1. Run `npx tsx scripts/outreach/sms-optin-broadcast.ts` — DMs Omar (exp-realty), Mark (windshield-hub), Alisha (urban-vibe), Fatima (manzil-isa). Sets `pending_sms_optin=true`.
2. As they reply yes/no via Telegram, the extended `/api/webhook/telegram` handler auto-flips `sms_alerts_enabled` and uses `callback_phone` as default `alert_phone` (or prompts for one if missing).

### Phase 5 — Ongoing
- All new trial clients get `sms_alerts_enabled=null` (UI default ON) at provision time.
- `/dashboard/notifications` is the long-term self-service surface.
- After 30 days of real usage: review trial-period Twilio SMS spend, decide whether to gate SMS to paid-only.

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Existing clients get surprise SMS | High | Migration backfill sets `sms_alerts_enabled=false` for all 5 existing clients explicitly. They opt-in via Phase 4 Telegram broadcast. |
| Owner-SMS sent from client's `twilio_number` triggers A2P 10DLC compliance flags | Medium | Only existing twilio_number-holders are eligible. Hasan owns the Twilio account — registration handled at account level. Re-verify in Twilio console before Phase 4. |
| SMS cost during trials eats margin | Medium | Cost-monitoring log line + 30-day review (Section 7.5). Can gate SMS to paid-only via a one-line check in `sendOwnerSmsAlert` if needed. |
| Removing the email niche gate spams existing voicemail-only clients | Low | Voicemail niche clients already get email per the existing gate — behavior unchanged for them. Non-voicemail clients only get email if `email_notifications_enabled !== false && (alert_email || contact_email)` resolved. Migration does not flip `email_notifications_enabled` on existing rows. |
| Codex's RESEND_API_KEY_ENDVOICEMAIL_SEND change loses fallback | Low | DNS is on endvoicemail.ai; single key is sufficient. If we need rotation later, add it then. |
| Test endpoint becomes a Twilio cost attack vector | Low | Rate-limited 5/client/hour. Auth-gated via `client_users`. Synthetic payload only. |
| `alert_phone` validation accepts garbage | Low | E.164 regex on save in `settings/route.ts`. UI input mask helps. |

## 10. Open Questions (resolved during brainstorming, captured for record)

1. ~~Scope: Velly-only vs generalize?~~ → Generalize.
2. ~~SMS routing: client's own number vs platform alerts number?~~ → Client's own `twilio_number`.
3. ~~Phone field: reuse `callback_phone` vs add `alert_phone`?~~ → Add `alert_phone`, fall back to `callback_phone`.
4. ~~Channel mode: OR vs PRIORITY vs urgency-routed?~~ → OR, with SMS as new default.
5. ~~Email field: reuse `contact_email` vs add `alert_email`?~~ → Add `alert_email`, fall back to `contact_email`.
6. ~~Migration for existing 5 clients?~~ → Backfill `sms_alerts_enabled=false, pending_sms_optin=true`; Telegram outreach in Phase 4.
7. ~~Codex's dual Resend keys?~~ → Drop. Single `RESEND_API_KEY`.
8. ~~Test button payload?~~ → Synthetic preview (hardcoded fake call).
9. ~~Approach 1 vs 2 vs 3?~~ → Approach 1 (minimal extension).
10. ~~Hasan-first priority?~~ → Gate A only must-ship. Gates B + C deferred.

## 11. Acceptance Criteria

Code ship complete when:
- [ ] Migration runs cleanly on prod Supabase
- [ ] 8 files changed per Section 5
- [ ] All Vitest tests in Section 7.1 pass
- [ ] Playwright test in Section 7.2 passes
- [ ] Drift-detector against `hasan-sharif` reports zero changes
- [ ] Hasan signs off Gate A (Section 7.3)

Phases 2-4 are explicitly out of scope for the initial PR. They ship on Hasan's go-ahead after Gate A.
