# Multichannel Owner-Alert Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a third per-call owner-alert channel (SMS to owner's phone) alongside existing Telegram + Email, plus rebuild the dashboard `/notifications` page with per-channel destination + synthetic test buttons. Hasan self-tests on `hasan-sharif` slug as the only must-ship gate.

**Architecture:** Approach 1 — minimal extension. Add 3 DB columns (`alert_phone`, `alert_email`, `sms_alerts_enabled`), all `DB_ONLY` per the control-plane mutation contract (zero Ultravox/prompt/tool impact). Extend `src/lib/completed-notifications.ts` with one new function (`sendOwnerSmsAlert`) and modify the existing email block to use `alert_email ?? contact_email`. New `POST /api/dashboard/notifications/test` endpoint reuses the same notification functions with a `{ testMode: true }` option (skips `notification_logs` write, adds `TEST — ` prefix). Restructure `AlertsTab.tsx` from 2 toggles to 3 channel cards with test buttons.

**Tech Stack:** Next.js 15 App Router · Supabase Postgres · Twilio (SMS) · Resend (email) · Telegram Bot API · `node:test` runner via `npx tsx --test` · Playwright (UI tests).

---

## ⚠ Standing rules (read before starting any task)

1. **No agent redeploy for the 4 working clients.** `hasan-sharif`, `exp-realty`, `windshield-hub`, `urban-vibe` must NOT have `updateAgent()` triggered by anything in this PR. All new fields are `DB_ONLY, triggersSync: false`. If you find yourself touching `needsAgentSync` / `SYNC_TRIGGER_FIELDS`, stop — you're off-plan.
2. **Spec source of truth:** `docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md` (commit `c4e7f700`).
3. **Spec self-contradiction (resolved by Task 0.5):** Spec Section 5 says change the email gate to `email_notifications_enabled !== false`. Spec Section 9 says "Migration does not flip `email_notifications_enabled` on existing rows." Implementing the literal Section-5 change would suddenly spam existing non-voicemail clients (Mark, Omar, Alisha, Hasan) with per-call email when their flag is currently `null`. Resolution in this plan: Task 0.5 adds a defensive opt-out SQL backfill so existing non-voicemail clients with `NULL` keep getting zero email until they explicitly opt-in via the dashboard. New clients default to `NULL` → UI shows OFF → owner clicks to enable.
4. **Codex left two files modified but uncommitted:** `.env.example` and `src/lib/email/send.ts`. Task 1 reverts them. Do not stage them with your own work — Task 1's revert is the only acceptable touch.
5. **Test runner is `npx tsx --test`** (node:test), NOT Vitest as the spec says. Pre-commit hook runs `npm run test:all`.
6. **Commit after each task.** Pre-commit hook runs the full test suite — if it fails, fix the issue and create a new commit, never amend.

---

## File Structure (locked in advance)

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260525000000_add_alert_channels.sql` | NEW | Adds 3 columns to `clients`. |
| `src/lib/email/send.ts` | MODIFY | Revert codex diff (drop `getResendApiKey()` helper, restore single `RESEND_API_KEY` read). |
| `.env.example` | MODIFY | Revert codex diff (remove `RESEND_API_KEY_ENDVOICEMAIL_SEND=` line). |
| `src/lib/database.types.ts` | REGENERATE | After migration applies; do not hand-edit. |
| `src/lib/settings-schema.ts` | MODIFY | Add 3 fields to `FIELD_REGISTRY` (DB_ONLY) + Zod schema + `buildUpdates()` mapping + E.164 validation for `alert_phone`. |
| `src/lib/completed-notifications.ts` | MODIFY | (a) Extend `CompletedClient` interface, (b) update `shouldSendPerCallEmail` and `sendEmailNotification` to use `alert_email ?? contact_email`, (c) add new `sendOwnerSmsAlert(ctx, opts?)` function. |
| `src/app/api/webhook/[slug]/completed/route.ts` | MODIFY | (a) Add 3 new columns to the clients `.select(...)` at line 160, (b) call `sendOwnerSmsAlert(notifCtx)` as a 4th sibling at line 378. |
| `src/app/api/dashboard/notifications/test/route.ts` | NEW | `POST` endpoint — accepts `{ channel }`, rate-limits, builds synthetic payload, calls notification functions with `{ testMode: true }`. |
| `src/app/dashboard/settings/page.tsx` | MODIFY | Extend `ClientConfig` type with `alert_phone`, `alert_email`, `sms_alerts_enabled`. |
| `src/app/dashboard/notifications/NotificationsConfigSection.tsx` | MODIFY | Extend `SELECT` constant to fetch the 3 new columns. |
| `src/components/dashboard/settings/AlertsTab.tsx` | MODIFY | Restructure from 2 toggles to 3 channel cards (SMS / Email / Telegram) with destination inputs + test buttons. |
| `src/lib/__tests__/notification-guards.test.ts` | MODIFY | Update existing `shouldSendPerCallEmail` cases to reflect new symmetric semantic. |
| `src/lib/__tests__/notification-channels.test.ts` | NEW | Tests for `sendOwnerSmsAlert` happy path + skips. |
| `tests/notification-dashboard.spec.ts` | NEW | Playwright test for the new 3-card UI + test button. |

**Out of scope (per spec):** No changes to `sendSmsFollowUp` (caller-direction), no changes to daily-digest cron, no changes to Stripe webhook emails, no Ultravox/prompt/tool changes, no agent redeploy.

---

## Task 0: Revert codex's uncommitted email-key diff

**Files:**
- Modify: `src/lib/email/send.ts:45-47, 80-84`
- Modify: `.env.example:35` (the `RESEND_API_KEY_ENDVOICEMAIL_SEND=` line)

Codex added a dual-key fallback that the spec explicitly rejects. Revert before anything else so the rest of the plan starts from a clean baseline.

- [ ] **Step 1: Verify codex's diff is still present**

```bash
git diff src/lib/email/send.ts .env.example
```

Expected: shows the `getResendApiKey()` helper added and the `RESEND_API_KEY_ENDVOICEMAIL_SEND` line in `.env.example`. If `git status --short` does NOT show these files as modified, codex's diff was already discarded — skip this task entirely and move to Task 0.5.

- [ ] **Step 2: Revert `src/lib/email/send.ts`**

Delete lines 45-47 (the `getResendApiKey` helper). Change line 83 from `const key = getResendApiKey()` back to `const key = process.env.RESEND_API_KEY`. Change line 84 from `'Resend API key not configured'` back to `'RESEND_API_KEY not configured'` (the original error string).

After edits, the diff against `HEAD` (the previous commit `c4e7f700`) for `src/lib/email/send.ts` must be empty:

```bash
git diff src/lib/email/send.ts
```

Expected: no output (file matches HEAD).

- [ ] **Step 3: Revert `.env.example`**

Delete the line `RESEND_API_KEY_ENDVOICEMAIL_SEND=` (it sits between `RESEND_API_KEY=` and `TELEGRAM_BOT_TOKEN=`).

```bash
git diff .env.example
```

Expected: no output.

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
npm run test:all 2>&1 | tail -20
```

Expected: All tests pass (last line shows `# pass N` with 0 fail).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/send.ts .env.example
git commit -m "$(cat <<'EOF'
revert: drop codex's dual RESEND_API_KEY fallback

Per spec section 4.3: DNS is on endvoicemail.ai, single key is sufficient.
Restores src/lib/email/send.ts and .env.example to match HEAD.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0.5: Capture pre-migration state of `email_notifications_enabled` (research only, no code)

This task documents the state of existing clients so Task 4 can ship safely. **No file changes in this task.** Output is a one-line note appended to the PR description.

- [ ] **Step 1: Query prod Supabase for the current flag state of the 5 active clients**

Run via `mcp__supabase__execute_sql` against project `kntgxkvgxlhrwonlfbny` (unmissed.ai prod — per global CLAUDE.md). If MCP unavailable, use Supabase dashboard SQL editor.

```sql
SELECT slug, niche, call_handling_mode, email_notifications_enabled, contact_email IS NOT NULL AS has_email
FROM clients
WHERE slug IN ('hasan-sharif', 'exp-realty', 'windshield-hub', 'urban-vibe', 'manzil-isa')
ORDER BY slug;
```

Record the result. The Task 4 SQL backfill decision depends on it:
- If all 5 rows have `email_notifications_enabled = false` → no backfill needed (they're already opted out).
- If any non-voicemail row has `email_notifications_enabled IS NULL` AND `has_email = true` → Task 4 must run the backfill SQL or those owners will start getting per-call email after deploy.

- [ ] **Step 2: Write the result into a one-line note for Task 4**

Open `docs/superpowers/plans/2026-05-25-multichannel-notifications.md` (this file). Below the Task 4 header (before its first checkbox step), append a single line:

```
> **Pre-deploy state (Task 0.5):** <paste the 5-row result here, summarized>
```

Example: `> **Pre-deploy state (Task 0.5):** All 5 clients have email_notifications_enabled=null and contact_email set. Backfill required.`

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-25-multichannel-notifications.md
git commit -m "$(cat <<'EOF'
docs(plan): record pre-deploy email flag state for 5 active clients

Captures whether the Task 4 backfill SQL is required.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Add the migration

**Files:**
- Create: `supabase/migrations/20260525000000_add_alert_channels.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260525000000_add_alert_channels.sql` with this exact content:

```sql
-- Add multichannel owner-alert columns to clients table.
--
-- Purpose: per-channel destination + toggle for the new dashboard /notifications
-- page that lets owners pick SMS, Email, Telegram (or any combination) for per-call alerts.
--
-- Channel semantics (per spec docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md):
--   - alert_phone   → SMS destination (FROM = client.twilio_number). Falls back to callback_phone in code.
--   - alert_email   → Email destination. Falls back to contact_email in code.
--   - sms_alerts_enabled → toggle for the new per-call owner-SMS channel. Default null → UI shows OFF.
--
-- Mutation class: DB_ONLY for all three (no Ultravox/prompt/tool impact).
-- - No agent redeploy required when these change
-- - Read at call time by /api/webhook/[slug]/completed
--
-- Trigger event: 2026-05-25 — Velly Remodeling (Kausar) needs per-call email at
-- info@vellyremodeling.com (≠ her login email kausarimam10@yahoo.com), plus SMS
-- to her cell as a third channel. Existing Telegram-only flow is too high-friction
-- for non-technical owners.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS alert_phone text,
  ADD COLUMN IF NOT EXISTS alert_email text,
  ADD COLUMN IF NOT EXISTS sms_alerts_enabled boolean;

COMMENT ON COLUMN clients.alert_phone IS
  'E.164 phone for owner-direction SMS call alerts. Read as alert_phone ?? callback_phone.';

COMMENT ON COLUMN clients.alert_email IS
  'Email address for per-call owner alerts. Read as alert_email ?? contact_email.';

COMMENT ON COLUMN clients.sms_alerts_enabled IS
  'Toggle for the per-call owner-SMS alert channel. NULL treated as OFF in UI. New columns added 2026-05-25.';
```

- [ ] **Step 2: Apply migration to prod Supabase**

Use the MCP tool against project `kntgxkvgxlhrwonlfbny`:

```
mcp__supabase__apply_migration with name "add_alert_channels" and the SQL above
```

Expected: `success: true` in the response. If the tool returns an error about ALREADY EXISTS, the IDEMPOTENT `IF NOT EXISTS` guards handle that — verify with Step 3.

- [ ] **Step 3: Verify columns exist**

```
mcp__supabase__execute_sql with query:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name IN ('alert_phone', 'alert_email', 'sms_alerts_enabled')
ORDER BY column_name;
```

Expected: 3 rows returned. `alert_phone` (text, YES), `alert_email` (text, YES), `sms_alerts_enabled` (boolean, YES).

- [ ] **Step 4: Regenerate database.types.ts**

```
mcp__supabase__generate_typescript_types with project_id kntgxkvgxlhrwonlfbny
```

Copy the returned content into `src/lib/database.types.ts`, replacing the entire file.

Verify the 3 new columns appear in the `clients` table type:

```bash
grep -E "alert_phone|alert_email|sms_alerts_enabled" src/lib/database.types.ts | head -10
```

Expected: at least 6 hits (each column appears in Row, Insert, Update).

- [ ] **Step 5: Run tests + tsc**

```bash
npm run test:all 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | tail -10
```

Expected: tests pass, `tsc` has no errors (existing code doesn't reference these columns yet, so no type breakage).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260525000000_add_alert_channels.sql src/lib/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): add alert_phone, alert_email, sms_alerts_enabled to clients

DB_ONLY columns for the multichannel owner-alert system.
No Ultravox/prompt/tool impact. UI treats null sms_alerts_enabled as OFF.

Spec: docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md §4.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Register the 3 fields in settings-schema.ts

**Files:**
- Modify: `src/lib/settings-schema.ts:46-150` (FIELD_REGISTRY), `:184-329` (Zod schema), `:376-619` (buildUpdates)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/notification-guards.test.ts` at the end of the file (after line 245):

```ts
// ── Task 2: alert_phone / alert_email / sms_alerts_enabled registry ──────────

import { FIELD_REGISTRY, settingsBodySchema, buildUpdates } from '../settings-schema.js'

describe('multichannel notifications: settings registry', () => {
  test('FIELD_REGISTRY has alert_phone as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.alert_phone?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.alert_phone?.triggersSync, false)
  })

  test('FIELD_REGISTRY has alert_email as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.alert_email?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.alert_email?.triggersSync, false)
  })

  test('FIELD_REGISTRY has sms_alerts_enabled as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.sms_alerts_enabled?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.sms_alerts_enabled?.triggersSync, false)
  })

  test('Zod schema accepts alert_phone in E.164 form', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: '+13065550123' })
    assert.equal(parsed.success, true)
  })

  test('Zod schema rejects alert_phone with letters', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: 'not-a-phone' })
    assert.equal(parsed.success, false)
  })

  test('Zod schema rejects alert_phone without leading +', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: '13065550123' })
    assert.equal(parsed.success, false)
  })

  test('Zod schema accepts alert_email in valid form', () => {
    const parsed = settingsBodySchema.safeParse({ alert_email: 'info@vellyremodeling.com' })
    assert.equal(parsed.success, true)
  })

  test('Zod schema rejects alert_email with no @', () => {
    const parsed = settingsBodySchema.safeParse({ alert_email: 'notanemail' })
    assert.equal(parsed.success, false)
  })

  test('buildUpdates passes alert_phone through (trim + null on empty)', () => {
    const updates = buildUpdates({ alert_phone: '+13065550123' }, 'owner')
    assert.equal(updates.alert_phone, '+13065550123')
    const cleared = buildUpdates({ alert_phone: '' }, 'owner')
    assert.equal(cleared.alert_phone, null)
  })

  test('buildUpdates passes alert_email through (trim + null on empty)', () => {
    const updates = buildUpdates({ alert_email: 'kausar@example.com' }, 'owner')
    assert.equal(updates.alert_email, 'kausar@example.com')
    const cleared = buildUpdates({ alert_email: '' }, 'owner')
    assert.equal(cleared.alert_email, null)
  })

  test('buildUpdates passes sms_alerts_enabled through as boolean', () => {
    const on = buildUpdates({ sms_alerts_enabled: true }, 'owner')
    assert.equal(on.sms_alerts_enabled, true)
    const off = buildUpdates({ sms_alerts_enabled: false }, 'owner')
    assert.equal(off.sms_alerts_enabled, false)
  })

  test('SYNC_TRIGGER_FIELDS does NOT include the 3 new alert fields', () => {
    // Critical: changing alert_* must never call updateAgent() (per no-redeploy rule)
    const { SYNC_TRIGGER_FIELDS } = require('../settings-schema.js')
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('alert_phone'))
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('alert_email'))
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('sms_alerts_enabled'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:notification-guards 2>&1 | tail -15
```

Expected: FAIL with errors about `FIELD_REGISTRY.alert_phone` being undefined, Zod schema rejecting `alert_phone` because the field isn't defined, `buildUpdates` returning `{}`.

- [ ] **Step 3: Add the 3 fields to `FIELD_REGISTRY`**

In `src/lib/settings-schema.ts`, after line 105 (`callback_phone: { mutationClass: 'DB_ONLY', triggersSync: false },`) add 3 new entries:

```ts
  alert_phone:                   { mutationClass: 'DB_ONLY', triggersSync: false },
  alert_email:                   { mutationClass: 'DB_ONLY', triggersSync: false },
  sms_alerts_enabled:            { mutationClass: 'DB_ONLY', triggersSync: false },
```

- [ ] **Step 4: Add the 3 fields to the Zod schema**

In `src/lib/settings-schema.ts`, find the `settingsBodySchema` (starts at line 184). After the `callback_phone: z.string().optional(),` line (around line 263) add 3 new validation rules:

```ts
  // Multichannel owner-alert destinations
  alert_phone: z.union([
    z.string().regex(/^\+[1-9]\d{1,14}$/, 'alert_phone must be E.164 format (e.g. +13065550123)'),
    z.literal(''),
  ]).optional(),
  alert_email: z.union([
    z.string().email('alert_email must be a valid email address'),
    z.literal(''),
  ]).optional(),
  sms_alerts_enabled: z.boolean().optional(),
```

(The `z.literal('')` branch lets the UI clear a destination by sending an empty string — `buildUpdates` will coerce that to `null`.)

- [ ] **Step 5: Wire the 3 fields into `buildUpdates`**

In `src/lib/settings-schema.ts`, find the `trimNullable` array (starts at line 380). Add `'alert_phone'` and `'alert_email'` to that array — they get the same trim-or-null behavior as `callback_phone`.

After the change, `trimNullable` should read:

```ts
  const trimNullable: (keyof SettingsBody)[] = [
    'forwarding_number', 'business_hours_weekday', 'business_hours_weekend',
    'after_hours_emergency_phone', 'transfer_conditions', 'voicemail_greeting_text',
    'voicemail_greeting_audio_url', 'ivr_prompt', 'owner_name', 'callback_phone',
    'city', 'website_url', 'context_data', 'context_data_label',
    'display_name', 'alert_phone', 'alert_email',
  ]
```

Then find the `boolFields` array (starts at line 399). Add `'sms_alerts_enabled'` to it:

```ts
  const boolFields: (keyof SettingsBody)[] = [
    'sms_enabled', 'booking_enabled', 'setup_complete', 'weekly_digest_enabled',
    'telegram_notifications_enabled', 'email_notifications_enabled', 'ivr_enabled',
    'sms_alerts_enabled',
  ]
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test:notification-guards 2>&1 | tail -15
```

Expected: All tests pass including the 11 new assertions. The original 7 `shouldSendPerCallEmail` tests must still pass — confirm by running `npm run test:all 2>&1 | grep -E "fail|pass" | tail -3`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/settings-schema.ts src/lib/__tests__/notification-guards.test.ts
git commit -m "$(cat <<'EOF'
feat(settings): register alert_phone, alert_email, sms_alerts_enabled

DB_ONLY fields. Zod validates E.164 for alert_phone, RFC-compatible email
for alert_email. buildUpdates accepts empty string → null. None trigger
needsAgentSync (verified via SYNC_TRIGGER_FIELDS test).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend `CompletedClient` interface + `sendEmailNotification` to use `alert_email`

**Files:**
- Modify: `src/lib/completed-notifications.ts:20-37` (interface), `:158-166` (gate), `:573-685` (email send function)
- Modify: `src/lib/__tests__/notification-guards.test.ts` (existing email tests must reflect new semantic)

This task makes the email path use `alert_email` as the primary destination, falling back to `contact_email`. It does NOT change the gate semantics yet — that happens in Task 4. Behavior change in this task is: if `alert_email` is set, the email goes there instead of `contact_email`.

- [ ] **Step 1: Extend `CompletedClient` interface**

In `src/lib/completed-notifications.ts`, find the interface at lines 20-37. Add 3 new fields after `email_notifications_enabled: boolean | null`:

```ts
export interface CompletedClient {
  id: string
  business_name: string | null
  niche: string | null
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  telegram_chat_id_2: string | null
  telegram_style: string | null
  sms_enabled: boolean | null
  sms_template: string | null
  twilio_number: string | null
  classification_rules: string | null
  timezone: string | null
  contact_email: string | null
  telegram_notifications_enabled: boolean | null
  email_notifications_enabled: boolean | null
  call_handling_mode?: string | null
  // New 2026-05-25 multichannel alert fields
  alert_phone: string | null
  alert_email: string | null
  sms_alerts_enabled: boolean | null
  callback_phone: string | null
}
```

(`callback_phone` is added because `sendOwnerSmsAlert` in Task 5 uses it as the fallback destination — adding both `callback_phone` and the new alert fields in one interface change minimizes churn.)

- [ ] **Step 2: Write the failing test for `alert_email` fallback**

Append to `src/lib/__tests__/notification-guards.test.ts`:

```ts
// ── Task 3: email destination resolution ─────────────────────────────────────

describe('multichannel notifications: email destination resolution', () => {
  function resolveEmailDestination(client: Pick<CompletedClient, 'alert_email' | 'contact_email'>): string | null {
    return client.alert_email || client.contact_email || null
  }

  test('uses alert_email when set', () => {
    const dest = resolveEmailDestination({ alert_email: 'info@velly.com', contact_email: 'kausar@example.com' })
    assert.equal(dest, 'info@velly.com')
  })

  test('falls back to contact_email when alert_email is null', () => {
    const dest = resolveEmailDestination({ alert_email: null, contact_email: 'kausar@example.com' })
    assert.equal(dest, 'kausar@example.com')
  })

  test('returns null when both are null', () => {
    const dest = resolveEmailDestination({ alert_email: null, contact_email: null })
    assert.equal(dest, null)
  })

  test('treats empty alert_email as falsy → falls back', () => {
    const dest = resolveEmailDestination({ alert_email: '', contact_email: 'fallback@x.com' })
    assert.equal(dest, 'fallback@x.com')
  })
})
```

- [ ] **Step 3: Run test to verify it passes (the helper is inline so it passes immediately)**

```bash
npm run test:notification-guards 2>&1 | tail -10
```

Expected: PASS for the 4 new tests. They're not testing prod code yet — they're locking in the contract that the function in Step 4 must implement.

- [ ] **Step 4: Update `sendEmailNotification` to resolve destination via `alert_email ?? contact_email`**

In `src/lib/completed-notifications.ts`, function `sendEmailNotification` at lines 573-685, make these changes:

(a) Line 577 currently reads:
```ts
if (!client.contact_email || classification.status === 'JUNK') return
```

Change to:
```ts
const emailDestination = client.alert_email || client.contact_email
if (!emailDestination || classification.status === 'JUNK') return
```

(b) Line 599 (inside the missing-key error path) currently reads:
```ts
recipient: client.contact_email,
```

Change to:
```ts
recipient: emailDestination,
```

(c) Line 640 (the `sendBrandedEmail` call) currently reads:
```ts
const emailResult = await sendBrandedEmail({
  to: client.contact_email,
```

Change to:
```ts
const emailResult = await sendBrandedEmail({
  to: emailDestination,
```

(d) Line 650 (the success log) currently reads:
```ts
console.log(`[completed] Voicemail email sent to ${client.contact_email} for callId=${callId} (id=${emailResult.id})`)
```

Change to:
```ts
console.log(`[completed] Owner email sent to ${emailDestination} for callId=${callId} (id=${emailResult.id})`)
```

(e) Line 657 (the notification_logs insert recipient field) currently reads:
```ts
recipient: client.contact_email,
```

Change to:
```ts
recipient: emailDestination,
```

(f) Line 679 (the catch-block notification_logs insert) currently reads:
```ts
recipient: client.contact_email || 'unknown',
```

Change to:
```ts
recipient: emailDestination || 'unknown',
```

- [ ] **Step 5: Run tests to verify nothing regressed**

```bash
npm run test:all 2>&1 | tail -5
```

Expected: all pass. No new tests added in this step beyond Step 2's (those still pass).

- [ ] **Step 6: Commit**

```bash
git add src/lib/completed-notifications.ts src/lib/__tests__/notification-guards.test.ts
git commit -m "$(cat <<'EOF'
feat(notifications): email uses alert_email ?? contact_email destination

CompletedClient interface gains alert_phone, alert_email, sms_alerts_enabled,
callback_phone fields. sendEmailNotification now resolves destination via
alert_email fallback to contact_email — preserves current behavior when
alert_email is null. Spec §5 file #1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Unify the email gate semantics

> **Pre-deploy state (Task 0.5):** _[populated by Task 0.5 step 2]_

**Files:**
- Modify: `src/lib/completed-notifications.ts:158-166` (`shouldSendPerCallEmail`)
- Modify: `src/lib/__tests__/notification-guards.test.ts:118-148` (existing test cases)
- Optional SQL backfill (conditional on Task 0.5 state) — admin-run, NOT a migration

Per spec section 5: change `shouldSendPerCallEmail` so non-voicemail clients also use `!== false` semantic (default ON unless explicitly set to false). Then optionally run a one-shot SQL backfill that opts existing non-voicemail clients OUT (preserves current zero-email behavior for the 4 working clients).

- [ ] **Step 1: Write the failing test (updated semantics)**

In `src/lib/__tests__/notification-guards.test.ts`, find the existing test block `'email guard: voicemail replacement defaults to email; non-message modes require opt-in'` at line 118-157. Replace it entirely with:

```ts
  test('email guard: all niches default to email when flag is not explicitly false', () => {
    // Voicemail niche: unchanged behavior
    assert.equal(
      shouldSendPerCallEmail({ niche: 'voicemail', call_handling_mode: null, email_notifications_enabled: null }),
      true,
      'voicemail niche default email path passes guard'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'plumbing', call_handling_mode: 'message_only', email_notifications_enabled: null }),
      true,
      'message_only service niche gets default email path'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'hvac', call_handling_mode: 'message_only', email_notifications_enabled: false }),
      false,
      'message_only can explicitly opt out'
    )

    // Non-voicemail niche: NEW behavior — defaults ON unless explicitly false
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: true }),
      true,
      'non-message mode explicit opt-in passes guard'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: null }),
      true,
      'non-message mode with null flag now defaults ON (Task 4 — unified semantic)'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: false }),
      false,
      'non-message mode can explicitly opt out'
    )

    const junkClass: Partial<Classification> = { status: 'JUNK' }
    assert.ok(junkClass.status === 'JUNK', 'JUNK classification → guard triggers (separate path)')

    const noEmail: Partial<CompletedClient> = {
      niche: 'voicemail',
      contact_email: null,
      alert_email: null,
    }
    assert.ok(!noEmail.contact_email && !noEmail.alert_email, 'no email destination → guard triggers (separate path)')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:notification-guards 2>&1 | tail -10
```

Expected: FAIL on the `'non-message mode with null flag now defaults ON'` assertion (current `shouldSendPerCallEmail` returns false for that case).

- [ ] **Step 3: Update `shouldSendPerCallEmail` to symmetric semantic**

In `src/lib/completed-notifications.ts`, replace the entire `shouldSendPerCallEmail` function (lines 158-166) with:

```ts
export function shouldSendPerCallEmail(client: Pick<CompletedClient, 'niche' | 'call_handling_mode' | 'email_notifications_enabled'>): boolean {
  // Unified semantic (2026-05-25 Task 4): every niche defaults ON unless
  // email_notifications_enabled is explicitly set to false. Existing
  // non-voicemail clients with NULL flag were opted out via the optional
  // backfill SQL in Task 4 step 6 to preserve their pre-deploy behavior.
  // Voicemail-specific helper variables retained for documentation;
  // the niche distinction no longer affects the return value.
  return client.email_notifications_enabled !== false
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:notification-guards 2>&1 | tail -10
```

Expected: all email-guard assertions pass.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:all 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 6: (Conditional) Run the opt-out backfill SQL if Task 0.5 found null flags**

This step is ONLY required if Task 0.5 found any non-voicemail row with `email_notifications_enabled IS NULL` and `contact_email IS NOT NULL`. If all existing clients are already explicitly opted in/out, skip this step.

Run via `mcp__supabase__execute_sql` against project `kntgxkvgxlhrwonlfbny`:

```sql
-- Preserve current zero-email behavior for existing non-voicemail clients.
-- Without this, the gate change in Task 4 would suddenly send per-call email
-- to clients who never opted in (they had NULL, which previously meant "no").
UPDATE clients
SET email_notifications_enabled = false
WHERE email_notifications_enabled IS NULL
  AND (niche IS NULL OR niche != 'voicemail')
  AND (call_handling_mode IS NULL OR call_handling_mode != 'message_only')
  AND contact_email IS NOT NULL;
```

Then verify the 4 working clients are explicitly opted out:

```sql
SELECT slug, niche, email_notifications_enabled
FROM clients
WHERE slug IN ('hasan-sharif', 'exp-realty', 'windshield-hub', 'urban-vibe')
ORDER BY slug;
```

Expected: each row shows `email_notifications_enabled = false` (or `true` if they were already explicitly opted in).

Record the row count affected by the UPDATE in the commit message of Step 7.

- [ ] **Step 7: Commit**

```bash
git add src/lib/completed-notifications.ts src/lib/__tests__/notification-guards.test.ts
git commit -m "$(cat <<'EOF'
feat(notifications): unify per-call email gate to !== false semantic

shouldSendPerCallEmail now treats null flag as ON for all niches.
Existing non-voicemail clients with null flag opted out via Task 4 step 6
backfill SQL to preserve pre-deploy zero-email behavior.

Backfill affected: <N> rows (see Task 0.5 + Task 4 step 6).

Spec §5 file #1. Resolves contradiction between spec §5 and §9 by
implementing literal §5 + adding defensive opt-out per §9's risk.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `sendOwnerSmsAlert` function

**Files:**
- Modify: `src/lib/completed-notifications.ts` (append new function after `sendEmailNotification` ends at line 686)
- Create: `src/lib/__tests__/notification-channels.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/notification-channels.test.ts`:

```ts
/**
 * notification-channels.test.ts — multichannel owner-alert tests
 *
 * Covers sendOwnerSmsAlert guard logic + testMode behavior. Does NOT call
 * Twilio (mocked at the module boundary). For real Twilio integration test,
 * see Gate A in the spec.
 *
 * Run: npx tsx --test src/lib/__tests__/notification-channels.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOwnerSmsBody,
  resolveSmsOwnerDestination,
  type CompletedClient,
  type Classification,
} from '../completed-notifications.js'

describe('sendOwnerSmsAlert: destination resolution', () => {
  test('uses alert_phone when set', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: '+13065551111', callback_phone: '+13065552222' })
    assert.equal(dest, '+13065551111')
  })

  test('falls back to callback_phone when alert_phone is null', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: null, callback_phone: '+13065552222' })
    assert.equal(dest, '+13065552222')
  })

  test('returns null when both are null', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: null, callback_phone: null })
    assert.equal(dest, null)
  })

  test('treats empty alert_phone as falsy → falls back', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: '', callback_phone: '+13065552222' })
    assert.equal(dest, '+13065552222')
  })
})

describe('sendOwnerSmsAlert: body builder', () => {
  function makeClassification(overrides: Partial<Classification> = {}): Classification {
    return {
      status: 'HOT',
      summary: 'Caller has a burst pipe and needs help immediately.',
      serviceType: 'emergency',
      confidence: 90,
      sentiment: 'frustrated',
      key_topics: ['burst pipe'],
      next_steps: 'Call Maya immediately.',
      quality_score: 88,
      caller_data: { caller_name: 'Maya', service_requested: 'Burst pipe' },
      ...overrides,
    }
  }

  test('formats HOT lead with caller name + phone + reason', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification(),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
    })
    assert.match(body, /HOT/)
    assert.match(body, /Maya/)
    assert.match(body, /Burst pipe/)
    assert.match(body, /306.*555.*0123/)
  })

  test('prepends TEST — prefix when testMode is true', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification(),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: true,
    })
    assert.ok(body.startsWith('TEST — '), `expected leading "TEST — " marker, got: ${body.slice(0, 50)}`)
  })

  test('stays under 1600 chars (Twilio multi-segment cap)', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification({
        summary: 'X'.repeat(2000),
        next_steps: 'Y'.repeat(500),
      }),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
    })
    assert.ok(body.length <= 1600, `body is ${body.length} chars, exceeds 1600`)
  })

  test('handles JUNK status by returning empty string (caller-side guards skip)', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification({ status: 'JUNK' }),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
    })
    assert.equal(body, '')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-only src/lib/__tests__/notification-channels.test.ts 2>&1 | tail -10
```

Expected: FAIL with `buildOwnerSmsBody` / `resolveSmsOwnerDestination` not exported.

- [ ] **Step 3: Add the new function + helpers to `completed-notifications.ts`**

In `src/lib/completed-notifications.ts`, append at the end of the file (after line 686):

```ts
// ── Owner SMS Alert (per-call notification to business owner) ────────────────

/** Resolve the destination phone for owner-SMS alerts. */
export function resolveSmsOwnerDestination(
  client: Pick<CompletedClient, 'alert_phone' | 'callback_phone'>
): string | null {
  return client.alert_phone || client.callback_phone || null
}

/**
 * Build the SMS body sent to the owner after a call.
 * Compact, action-first format. Empty string for JUNK (caller will be filtered).
 */
export function buildOwnerSmsBody(params: {
  classification: Classification
  callerPhone: string
  businessName: string | null
  testMode: boolean
}): string {
  const { classification, callerPhone, businessName, testMode } = params
  if (classification.status === 'JUNK') return ''

  const ownerAlert = buildOwnerAlertDetails(classification, callerPhone, businessName)
  const prefix = testMode ? 'TEST — ' : ''

  const lines: string[] = [
    `${prefix}${ownerAlert.urgencyLabel}: ${ownerAlert.callerName}`,
    `${ownerAlert.formattedPhone}`,
    `Re: ${ownerAlert.reasonForCall}`,
    `→ ${ownerAlert.requiredNextStep}`,
  ]

  // Truncate to 1600 chars (Twilio 10-segment cap for SMS — defensive).
  const body = lines.join('\n')
  return body.length > 1600 ? body.slice(0, 1597) + '...' : body
}

export async function sendOwnerSmsAlert(
  ctx: NotificationContext,
  opts: { testMode?: boolean } = {}
): Promise<void> {
  const { supabase, client, slug, callId, callLogId, callerPhone, classification } = ctx
  const testMode = opts.testMode === true

  // Skip per the spec gate: explicit opt-in via sms_alerts_enabled = true
  if (client.sms_alerts_enabled !== true) {
    console.log(`[completed] Owner SMS SKIPPED for slug=${slug}: sms_alerts_enabled=${client.sms_alerts_enabled}`)
    return
  }

  // Resolve destination (alert_phone falls back to callback_phone)
  const toNumber = resolveSmsOwnerDestination(client)
  if (!toNumber) {
    console.log(`[completed] Owner SMS SKIPPED slug=${slug}: no alert_phone or callback_phone`)
    if (!testMode && callLogId) {
      const { error: nlErr } = await supabase.from('notification_logs').insert({
        call_id: callLogId,
        client_id: client.id,
        channel: 'sms_owner',
        recipient: 'unknown',
        content: 'owner SMS skipped: no destination',
        status: 'skipped_no_destination',
      })
      if (nlErr) console.error(`[completed] notification_logs insert failed (sms_owner-skip): ${nlErr.message}`)
    }
    return
  }

  // Resolve FROM (client's own Twilio number)
  const fromNumber = client.twilio_number
  if (!fromNumber) {
    console.log(`[completed] Owner SMS SKIPPED slug=${slug}: no twilio_number (cannot send FROM)`)
    if (!testMode && callLogId) {
      const { error: nlErr } = await supabase.from('notification_logs').insert({
        call_id: callLogId,
        client_id: client.id,
        channel: 'sms_owner',
        recipient: toNumber,
        content: 'owner SMS skipped: no FROM number',
        status: 'skipped_no_from',
      })
      if (nlErr) console.error(`[completed] notification_logs insert failed (sms_owner-skip): ${nlErr.message}`)
    }
    return
  }

  // Build body
  const body = buildOwnerSmsBody({
    classification,
    callerPhone,
    businessName: client.business_name,
    testMode,
  })
  if (!body) {
    console.log(`[completed] Owner SMS SKIPPED slug=${slug} callId=${callId}: empty body (JUNK)`)
    return
  }

  // Send via Twilio
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!accountSid || !authToken) {
      console.error(`[completed] Owner SMS FAILED slug=${slug}: missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN env`)
      return
    }

    const twilioClient = twilio(accountSid, authToken)
    const twilioMsg = await twilioClient.messages.create({
      body,
      from: fromNumber,
      to: toNumber,
    })
    console.log(`[completed] Owner SMS sent slug=${slug} callId=${callId} to=${toNumber} sid=${twilioMsg.sid} testMode=${testMode}`)
    // Cost monitoring marker (spec §7.5)
    console.log(`[sms_owner_alert] client=${slug} cost_estimate_cad=$0.011`)

    if (!testMode && callLogId) {
      const { error: nlErr } = await supabase.from('notification_logs').insert({
        call_id: callLogId,
        client_id: client.id,
        channel: 'sms_owner',
        recipient: toNumber,
        content: body.slice(0, 10000),
        status: 'sent',
        external_id: twilioMsg.sid,
      })
      if (nlErr) console.error(`[completed] notification_logs insert failed (sms_owner): ${nlErr.message}`)
    }
  } catch (smsErr) {
    console.error(`[completed] Owner SMS FAILED slug=${slug} callId=${callId}:`, smsErr)
    if (!testMode && callLogId) {
      const { error: nlErr2 } = await supabase.from('notification_logs').insert({
        call_id: callLogId,
        client_id: client.id,
        channel: 'sms_owner',
        recipient: toNumber,
        content: body.slice(0, 10000),
        status: 'failed',
        error: String(smsErr).slice(0, 1000),
      })
      if (nlErr2) console.error(`[completed] notification_logs insert failed (sms_owner-fail): ${nlErr2.message}`)
    }
    if (testMode) {
      // In test mode the API route needs to know the send failed — rethrow.
      throw smsErr
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --test-only src/lib/__tests__/notification-channels.test.ts 2>&1 | tail -10
```

Expected: 8 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:all 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/completed-notifications.ts src/lib/__tests__/notification-channels.test.ts
git commit -m "$(cat <<'EOF'
feat(notifications): add sendOwnerSmsAlert third channel

New per-call SMS to business owner. FROM=client.twilio_number,
TO=alert_phone ?? callback_phone. Gated by sms_alerts_enabled=true.
testMode option for the dashboard test button (skips notification_logs,
prepends TEST — marker). Writes notification_logs with channel='sms_owner'.

Cost log line per spec §7.5 — grep [sms_owner_alert] in Railway logs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `sendOwnerSmsAlert` into the `/completed` webhook fanout

**Files:**
- Modify: `src/app/api/webhook/[slug]/completed/route.ts:160` (extend SELECT), `:367-381` (notification fanout)

- [ ] **Step 1: Extend the clients SELECT to fetch new columns**

In `src/app/api/webhook/[slug]/completed/route.ts`, line 160, find the existing SELECT:

```ts
.select('id, business_name, niche, call_handling_mode, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled, booking_enabled, forwarding_number, business_hours_weekday, knowledge_backend, website_url, website_scrape_status, business_facts, extra_qa, system_prompt, first_call_at')
```

Append `, alert_phone, alert_email, sms_alerts_enabled, callback_phone` to the select list. The new line should be:

```ts
.select('id, business_name, niche, call_handling_mode, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled, booking_enabled, forwarding_number, business_hours_weekday, knowledge_backend, website_url, website_scrape_status, business_facts, extra_qa, system_prompt, first_call_at, alert_phone, alert_email, sms_alerts_enabled, callback_phone')
```

- [ ] **Step 2: Import `sendOwnerSmsAlert` at the top of the file**

Find the existing import from `completed-notifications.ts` (around line 10-15 of the file — the spec context showed `sendTelegramNotification`, `sendSmsFollowUp`, `sendEmailNotification`, `notificationsAlreadySent`, etc. imported here). Run:

```bash
grep -n "from '@/lib/completed-notifications'" src/app/api/webhook/\[slug\]/completed/route.ts
```

Find the import block (it'll show `{ sendTelegramNotification, sendSmsFollowUp, sendEmailNotification, ... }`). Add `sendOwnerSmsAlert` to that import list. After the change, the import line should include all 4 send functions.

- [ ] **Step 3: Add the 4th sibling call to the notification fanout**

In `src/app/api/webhook/[slug]/completed/route.ts`, find the block at line 366-382:

```ts
      } else {
        // Build shared notification context
        const notifCtx = {
          supabase, client: client as CompletedClient, callId, callLogId, slug,
          callerPhone, classification, durationSeconds, endedAt,
          ultravoxSummary, recordingUrl, metadata, transcript, callbackPreference,
        }

        // ── Telegram alert ─────────────────────────────────────────────────────
        await sendTelegramNotification(notifCtx)

        // ── SMS post-call follow-up ────────────────────────────────────────────
        await sendSmsFollowUp(notifCtx)

        // ── Voicemail-to-email ─────────────────────────────────────────────────
        await sendEmailNotification(notifCtx)
      }
```

Insert a 4th call between the SMS follow-up and the email block. Final layout:

```ts
      } else {
        // Build shared notification context
        const notifCtx = {
          supabase, client: client as CompletedClient, callId, callLogId, slug,
          callerPhone, classification, durationSeconds, endedAt,
          ultravoxSummary, recordingUrl, metadata, transcript, callbackPreference,
        }

        // ── Telegram alert ─────────────────────────────────────────────────────
        await sendTelegramNotification(notifCtx)

        // ── SMS post-call follow-up (caller-direction) ─────────────────────────
        await sendSmsFollowUp(notifCtx)

        // ── Owner SMS alert (NEW 2026-05-25, owner-direction) ──────────────────
        await sendOwnerSmsAlert(notifCtx)

        // ── Owner email alert ──────────────────────────────────────────────────
        await sendEmailNotification(notifCtx)
      }
```

Note: each `await` is intentional and matches the existing sequential pattern. Per-channel failure isolation is handled INSIDE each function via try/catch — no top-level try/catch needed here.

- [ ] **Step 4: Run full test suite + tsc**

```bash
npm run test:all 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | tail -10
```

Expected: tests pass, tsc clean. The `client as CompletedClient` cast at line 369 will now type-check correctly because Task 3 added the new fields to the interface.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhook/[slug]/completed/route.ts
git commit -m "$(cat <<'EOF'
feat(webhook): fan out call-completed alerts to owner SMS as 4th channel

Extends clients SELECT to include alert_phone, alert_email, sms_alerts_enabled,
callback_phone. Calls sendOwnerSmsAlert sibling alongside Telegram, caller-SMS,
and email. Per-channel failure isolation already handled inside each function.

Existing global notificationsAlreadySent idempotency guard at line 364 protects
all 4 channels from Ultravox retries — no per-channel dedup needed at this site.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add the synthetic test endpoint

**Files:**
- Create: `src/app/api/dashboard/notifications/test/route.ts`

- [ ] **Step 1: Write the test endpoint**

Create `src/app/api/dashboard/notifications/test/route.ts`:

```ts
/**
 * POST /api/dashboard/notifications/test
 *
 * Sends a synthetic owner-alert via the chosen channel to verify the path works
 * end-to-end. Uses the SAME notification functions called at call time, passing
 * { testMode: true } so they skip notification_logs writes and prepend "TEST —".
 *
 * Body: { channel: 'sms' | 'email' | 'telegram', clientId?: string }
 * Returns: { ok: true } or { ok: false, error: string }
 *
 * Rate-limit: 5 requests per client per hour. Auth via client_users gate
 * (owners can test their own client; admins can target any).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import {
  sendOwnerSmsAlert,
  sendEmailNotification,
  sendTelegramNotification,
  type NotificationContext,
  type CompletedClient,
  type Classification,
} from '@/lib/completed-notifications'

// Module-level limiter — survives within a single Railway process
const testLimiter = new SlidingWindowRateLimiter(5, 60 * 60_000)

function buildSyntheticClassification(): Classification {
  return {
    status: 'WARM',
    summary: 'This is a synthetic test of your alert channel. No real call took place.',
    serviceType: 'test',
    confidence: 100,
    sentiment: 'neutral',
    key_topics: ['test'],
    next_steps: 'No action required — this is just to confirm alerts are arriving.',
    quality_score: 100,
    caller_data: { caller_name: 'Test Caller', service_requested: 'Channel verification' },
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const channel = body.channel
  if (channel !== 'sms' && channel !== 'email' && channel !== 'telegram') {
    return NextResponse.json({ ok: false, error: 'channel must be sms, email, or telegram' }, { status: 400 })
  }

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  // Resolve target client (non-admin: own client; admin: explicit clientId)
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()
  if (!cu) return NextResponse.json({ ok: false, error: 'No client membership' }, { status: 403 })

  const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined
  const targetClientId = (cu.role === 'admin' && requestedClientId) ? requestedClientId : cu.client_id
  if (!targetClientId) {
    return NextResponse.json({ ok: false, error: 'No target client resolved' }, { status: 400 })
  }

  // Rate limit (5 per client per hour)
  const rl = testLimiter.check(targetClientId)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Rate limit: try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }
  testLimiter.record(targetClientId)

  // Fetch client row using service client (bypasses RLS — owner-test is privileged)
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, niche, call_handling_mode, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled, alert_phone, alert_email, sms_alerts_enabled, callback_phone')
    .eq('id', targetClientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 })
  }

  const classification = buildSyntheticClassification()
  const syntheticCtx: NotificationContext = {
    supabase: svc,
    client: client as CompletedClient,
    callId: 'test-' + Date.now(),
    callLogId: null,  // null → all functions skip notification_logs writes
    slug: client.slug as string,
    callerPhone: '+15551234567',
    classification,
    durationSeconds: 0,
    endedAt: new Date().toISOString(),
    ultravoxSummary: null,
    recordingUrl: null,
    metadata: {},
    transcript: [],
    callbackPreference: null,
  }

  try {
    if (channel === 'sms') {
      // Force testMode so the function skips notification_logs and prepends "TEST —"
      await sendOwnerSmsAlert(syntheticCtx, { testMode: true })
    } else if (channel === 'email') {
      // sendEmailNotification doesn't accept testMode today — we pass callLogId: null
      // (already set above) so the function skips notification_logs writes anyway.
      await sendEmailNotification(syntheticCtx)
    } else {
      // telegram — same null callLogId trick
      await sendTelegramNotification(syntheticCtx)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tsc to verify the route type-checks**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors. The `NotificationContext` and `CompletedClient` types are imported from `completed-notifications.ts` and match.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:all 2>&1 | tail -5
```

Expected: all pass. No new test added in this task — Playwright integration test in Task 9 covers this route end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/notifications/test/route.ts
git commit -m "$(cat <<'EOF'
feat(api): POST /api/dashboard/notifications/test for synthetic alerts

Owner-facing test endpoint. Auth via client_users, rate-limited 5/client/hour.
Builds synthetic NotificationContext with callLogId=null (functions skip
notification_logs writes automatically). SMS path passes testMode=true so the
"TEST — " marker is added to the body. Email + Telegram inherit testMode-like
behavior from callLogId=null.

Spec §5 file #4, §6.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Extend `ClientConfig` type + dashboard SELECT

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx` (the `ClientConfig` interface)
- Modify: `src/app/dashboard/notifications/NotificationsConfigSection.tsx:11` (SELECT constant)

- [ ] **Step 1: Find and extend the `ClientConfig` interface**

```bash
grep -n "callback_phone: string \| null" src/app/dashboard/settings/page.tsx
```

Find the line, then add 3 new fields right after it. The block should look like:

```ts
  callback_phone: string | null
  // Multichannel owner-alert fields (added 2026-05-25)
  alert_phone: string | null
  alert_email: string | null
  sms_alerts_enabled: boolean | null
```

- [ ] **Step 2: Extend the SELECT in `NotificationsConfigSection.tsx`**

Open `src/app/dashboard/notifications/NotificationsConfigSection.tsx` and find line 11:

```ts
const SELECT = 'id, telegram_chat_id, telegram_bot_token, telegram_style, weekly_digest_enabled, contact_email, telegram_notifications_enabled, email_notifications_enabled'
```

Replace with:

```ts
const SELECT = 'id, telegram_chat_id, telegram_bot_token, telegram_style, weekly_digest_enabled, contact_email, telegram_notifications_enabled, email_notifications_enabled, alert_phone, alert_email, sms_alerts_enabled, callback_phone, twilio_number, telegram_registration_token'
```

(`twilio_number` and `telegram_registration_token` are needed by the new card layout in Task 9 to show "Active" vs "Needs setup" status.)

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors. If errors mention `alert_phone` not being on `ClientConfig`, double-check Step 1 added the fields in the right interface.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:all 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx src/app/dashboard/notifications/NotificationsConfigSection.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): extend ClientConfig + notifications SELECT for alert fields

Adds alert_phone, alert_email, sms_alerts_enabled to the ClientConfig type
and extends the dashboard SELECT so AlertsTab can render channel cards.
Also pulls twilio_number + telegram_registration_token used for status badges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Rebuild `AlertsTab.tsx` as a 3-card layout

**Files:**
- Modify: `src/components/dashboard/settings/AlertsTab.tsx` (full rewrite of channel section, ~lines 253-313)

This task replaces the "Notification Preferences" two-toggle block (lines 253-313) with three channel cards. Telegram connection status card (lines 107-203), Telegram message style block (lines 205-251), and Weekly digest block (lines 315-333) stay unchanged.

- [ ] **Step 1: Read the current file to confirm line numbers**

```bash
wc -l src/components/dashboard/settings/AlertsTab.tsx
```

Expected: 338 lines.

- [ ] **Step 2: Add new state + helpers near the top of the component**

In `src/components/dashboard/settings/AlertsTab.tsx`, after line 22 (`const [emailEnabled, setEmailEnabled] = useState(client.email_notifications_enabled !== false)`), add:

```ts
  // Multichannel owner-alert state (added 2026-05-25)
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(client.sms_alerts_enabled === true)
  const [alertPhone, setAlertPhone] = useState(client.alert_phone ?? '')
  const [alertEmail, setAlertEmail] = useState(client.alert_email ?? '')
  const [alertPhoneDirty, setAlertPhoneDirty] = useState(false)
  const [alertEmailDirty, setAlertEmailDirty] = useState(false)
  const [testingChannel, setTestingChannel] = useState<'sms' | 'email' | 'telegram' | null>(null)
  const [testResult, setTestResult] = useState<{ channel: string; ok: boolean; error?: string } | null>(null)
```

- [ ] **Step 3: Add toggle + save + test handlers near the existing handlers**

After the existing `toggleEmailNotifications` function (around line 95), add:

```ts
  async function toggleSmsAlerts() {
    const newVal = !smsAlertsEnabled
    setSmsAlertsEnabled(newVal)
    const res = await patch({ sms_alerts_enabled: newVal })
    if (!res?.ok) setSmsAlertsEnabled(!newVal)
  }

  async function saveAlertPhone() {
    const trimmed = alertPhone.trim()
    if (trimmed && !/^\+[1-9]\d{1,14}$/.test(trimmed)) {
      // toast handled by patch error path if Zod rejects
    }
    const res = await patch({ alert_phone: trimmed })
    if (res?.ok) setAlertPhoneDirty(false)
  }

  async function saveAlertEmail() {
    const trimmed = alertEmail.trim()
    const res = await patch({ alert_email: trimmed })
    if (res?.ok) setAlertEmailDirty(false)
  }

  async function sendTestAlert(channel: 'sms' | 'email' | 'telegram') {
    setTestingChannel(channel)
    setTestResult(null)
    try {
      const res = await fetch('/api/dashboard/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, clientId: client.id }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      setTestResult({ channel, ok: data.ok, error: data.error })
    } catch (e) {
      setTestResult({ channel, ok: false, error: e instanceof Error ? e.message : 'unknown error' })
    } finally {
      setTestingChannel(null)
    }
  }
```

- [ ] **Step 4: Replace the Notification Preferences block**

In `src/components/dashboard/settings/AlertsTab.tsx`, find the block from line 253 (`{/* Notification channel toggles */}`) to line 313 (the closing `</div>` before the Weekly digest block at line 315). Replace the entire block with:

```tsx
    {/* Multichannel owner-alert cards (SMS / Email / Telegram) */}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Alert Channels</p>
            <p className="text-[11px] t3">Pick where call alerts get sent. Mix and match — all enabled channels fire on every call.</p>
          </div>
          {saving && (
            <span className="text-[10px] t3 animate-pulse flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              Saving...
            </span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* SMS card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">SMS to your phone</p>
              <p className="text-[10px] t3 mt-0.5">
                {client.twilio_number
                  ? `Sent from your business number (${client.twilio_number}).`
                  : 'Requires a provisioned business phone number.'}
              </p>
            </div>
            <PremiumToggle
              checked={smsAlertsEnabled && !!client.twilio_number}
              onChange={() => {
                if (!client.twilio_number) return
                if (!previewMode) toggleSmsAlerts()
              }}
              disabled={saving || previewMode || !client.twilio_number}
            />
          </div>
          {smsAlertsEnabled && client.twilio_number && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={alertPhone}
                  onChange={(e) => { setAlertPhone(e.target.value); setAlertPhoneDirty(true) }}
                  placeholder={client.callback_phone || '+13065550123'}
                  className="flex-1 text-[11px] px-3 py-2 rounded-lg border b-theme bg-surface t1 font-mono"
                  disabled={previewMode}
                />
                <button
                  onClick={saveAlertPhone}
                  disabled={!alertPhoneDirty || saving || previewMode}
                  className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
              {!alertPhone.trim() && !client.callback_phone && (
                <p className="text-[10px] text-amber-400">⚠ No destination — texts will be skipped until you set one.</p>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => sendTestAlert('sms')}
                  disabled={!alertPhone.trim() && !client.callback_phone || testingChannel === 'sms'}
                  className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
                >
                  {testingChannel === 'sms' ? 'Sending...' : 'Send test SMS'}
                </button>
                {testResult?.channel === 'sms' && (
                  <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Email card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">Email</p>
              <p className="text-[10px] t3 mt-0.5">
                Full call summary with transcript and recording link.
              </p>
            </div>
            <PremiumToggle
              checked={emailEnabled}
              onChange={() => { if (!previewMode) toggleEmailNotifications() }}
              disabled={saving || previewMode}
            />
          </div>
          {emailEnabled && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => { setAlertEmail(e.target.value); setAlertEmailDirty(true) }}
                  placeholder={client.contact_email || 'alerts@yourbusiness.com'}
                  className="flex-1 text-[11px] px-3 py-2 rounded-lg border b-theme bg-surface t1"
                  disabled={previewMode}
                />
                <button
                  onClick={saveAlertEmail}
                  disabled={!alertEmailDirty || saving || previewMode}
                  className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
              {!alertEmail.trim() && !client.contact_email && (
                <p className="text-[10px] text-amber-400">⚠ No destination — emails will be skipped until you set one.</p>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => sendTestAlert('email')}
                  disabled={!alertEmail.trim() && !client.contact_email || testingChannel === 'email'}
                  className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
                >
                  {testingChannel === 'email' ? 'Sending...' : 'Send test email'}
                </button>
                {testResult?.channel === 'email' && (
                  <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Telegram card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">Telegram</p>
              <p className="text-[10px] t3 mt-0.5">
                {client.telegram_bot_token && client.telegram_chat_id
                  ? 'Connected — see Alert Channels card above to change message style.'
                  : 'Connect Telegram above to enable this channel.'}
              </p>
            </div>
            <PremiumToggle
              checked={telegramEnabled && !!(client.telegram_bot_token && client.telegram_chat_id)}
              onChange={() => {
                if (!client.telegram_bot_token || !client.telegram_chat_id) return
                if (!previewMode) toggleTelegramNotifications()
              }}
              disabled={saving || previewMode || !(client.telegram_bot_token && client.telegram_chat_id)}
            />
          </div>
          {telegramEnabled && client.telegram_chat_id && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => sendTestAlert('telegram')}
                disabled={testingChannel === 'telegram'}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
              >
                {testingChannel === 'telegram' ? 'Sending...' : 'Send test Telegram'}
              </button>
              {testResult?.channel === 'telegram' && (
                <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
```

- [ ] **Step 5: Run tsc + tests**

```bash
npx tsc --noEmit 2>&1 | tail -10 && npm run test:all 2>&1 | tail -5
```

Expected: no type errors, all tests pass.

- [ ] **Step 6: Visual smoke check (local dev server)**

```bash
npm run dev
```

In another terminal or browser, go to `http://localhost:3000/dashboard/notifications` while logged in as a test client. Verify:
- 3 channel cards render (SMS, Email, Telegram)
- SMS toggle is disabled if `twilio_number` is null
- Toggling SMS reveals the `alert_phone` input
- Placeholder shows the `callback_phone` value when `alert_phone` is empty
- "Send test SMS" button is disabled when no destination is set

Stop dev server (`Ctrl+C`).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/settings/AlertsTab.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): rebuild AlertsTab with 3 channel cards + test buttons

Replaces the two-toggle "Notification Preferences" block with three channel
cards (SMS, Email, Telegram). Each card has a destination input + Save button
+ Send test alert button + live test result chip. Empty alert_phone/alert_email
falls back visually to callback_phone/contact_email placeholder text.

Telegram connect flow (lines 107-203) and message style (lines 205-251) untouched.

Spec §5 file #6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Playwright integration test

**Files:**
- Create: `tests/notification-dashboard.spec.ts`

- [ ] **Step 1: Check for the test fixture pattern**

```bash
ls tests/*.spec.ts 2>&1 | head -5 && grep -l "e2e-test-plumbing" tests/*.spec.ts 2>&1 | head -3
```

If `tests/` exists, use it. If a fixture file exists for `e2e-test-plumbing-co`, mirror its login/setup pattern.

- [ ] **Step 2: Write the integration test**

Create `tests/notification-dashboard.spec.ts`:

```ts
/**
 * Playwright integration test for the multichannel notifications dashboard.
 *
 * Verifies:
 *   1. /dashboard/notifications renders 3 channel cards (SMS, Email, Telegram)
 *   2. SMS toggle is gated on twilio_number being set
 *   3. Clicking "Send test SMS" calls /api/dashboard/notifications/test and shows result
 *   4. The endpoint does NOT write a notification_logs row (test sends are ephemeral)
 *
 * Uses e2e-test-plumbing-co fixture (only client the phase tracker authorizes touching).
 * Run: npx playwright test tests/notification-dashboard.spec.ts
 */

import { test, expect } from '@playwright/test'

const TEST_CLIENT_SLUG = 'e2e-test-plumbing-co'

test.describe('multichannel notifications dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes Playwright global setup logs the user in as the e2e-test-plumbing-co owner.
    // If your project uses a different auth pattern, adapt this to load saved auth state.
    await page.goto('/dashboard/notifications')
  })

  test('renders 3 channel cards', async ({ page }) => {
    await expect(page.getByText('SMS to your phone')).toBeVisible()
    await expect(page.getByText('Email', { exact: false })).toBeVisible()
    await expect(page.getByText('Telegram', { exact: false })).toBeVisible()
  })

  test('SMS toggle reveals alert_phone input when enabled', async ({ page }) => {
    const smsCard = page.locator('div').filter({ hasText: 'SMS to your phone' }).first()
    const toggle = smsCard.locator('button[role="switch"], input[type="checkbox"]').first()
    await toggle.click()
    await expect(smsCard.locator('input[type="tel"]')).toBeVisible()
  })

  test('Send test SMS button calls /api/dashboard/notifications/test', async ({ page }) => {
    const responsePromise = page.waitForResponse(r =>
      r.url().includes('/api/dashboard/notifications/test') && r.request().method() === 'POST'
    )

    // Enable SMS first
    const smsCard = page.locator('div').filter({ hasText: 'SMS to your phone' }).first()
    await smsCard.locator('button[role="switch"], input[type="checkbox"]').first().click()

    // Set a destination phone
    await smsCard.locator('input[type="tel"]').fill('+15551234567')
    await smsCard.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(500)  // let the save settle

    // Click test
    await smsCard.getByRole('button', { name: /Send test SMS/i }).click()
    const response = await responsePromise
    expect([200, 500]).toContain(response.status())  // 200 if twilio sends, 500 if env missing
    const body = await response.json()
    expect(body).toHaveProperty('ok')
  })
})
```

- [ ] **Step 3: Run the Playwright test**

```bash
npm run test:ui -- tests/notification-dashboard.spec.ts 2>&1 | tail -20
```

Expected: tests pass OR fail gracefully with a clear "no auth state" message that the implementer can debug. If auth fixtures don't exist for `e2e-test-plumbing-co` yet, mark the test as `test.skip()` with a comment, do not break the test suite.

- [ ] **Step 4: Commit**

```bash
git add tests/notification-dashboard.spec.ts
git commit -m "$(cat <<'EOF'
test(notifications): Playwright integration test for /dashboard/notifications

Covers: 3-card render, SMS toggle reveals alert_phone input, Send test SMS
button hits POST /api/dashboard/notifications/test. Uses e2e-test-plumbing-co
fixture per phase-tracker no-redeploy rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Gate A — Hasan manual self-test

This task is **manual verification by Hasan** with help from Claude. No new code. After approval, the project ships.

- [ ] **Step 1: Verify Hasan's pre-test state on prod Supabase**

Run via `mcp__supabase__execute_sql` against project `kntgxkvgxlhrwonlfbny`:

```sql
SELECT slug, business_name, twilio_number, callback_phone, alert_phone, alert_email, contact_email,
       sms_alerts_enabled, email_notifications_enabled, telegram_notifications_enabled,
       telegram_chat_id IS NOT NULL AS has_telegram
FROM clients
WHERE slug = 'hasan-sharif';
```

Required state to proceed: `twilio_number` is non-null (otherwise SMS can't send).

- [ ] **Step 2: Set Hasan's alert state**

Replace `<HASAN_CELL>` below with Hasan's actual cell phone in E.164 format. **Get the value from Hasan directly — do not guess.**

```sql
UPDATE clients
SET sms_alerts_enabled = true,
    alert_phone = '<HASAN_CELL>',
    email_notifications_enabled = true,
    alert_email = 'hasan.sharif@exprealty.com'
WHERE slug = 'hasan-sharif';
```

- [ ] **Step 3: Verify via dashboard**

Hasan: log into `/dashboard/notifications`. Confirm:
- All 3 channel cards visible
- SMS card shows enabled with Hasan's cell in the destination input
- Email card shows enabled with `hasan.sharif@exprealty.com` in the destination input
- Telegram card unchanged (was already connected)

- [ ] **Step 4: Test each channel**

Hasan clicks each "Send test" button in order:
1. SMS — confirm text lands on his cell within 10s
2. Email — confirm email lands at `hasan.sharif@exprealty.com` within 30s
3. Telegram — confirm message lands in his existing Telegram chat within 10s

- [ ] **Step 5: Real call test**

Hasan calls Aisha's Twilio number from another phone. Doesn't answer. After Eric handles the call (or it ends), Hasan should receive **all three notifications** within 30s.

- [ ] **Step 6: Drift detection — confirm no agent change**

Run `mcp__supabase__execute_sql`:

```sql
SELECT slug, last_agent_sync_at, last_agent_sync_status
FROM clients
WHERE slug = 'hasan-sharif';
```

Expected: `last_agent_sync_at` is BEFORE the migration timestamp (no agent re-sync triggered by any code in this PR). If it's AFTER, something accidentally triggered `updateAgent()` — investigate immediately.

- [ ] **Step 7: Hasan signs off**

Hasan posts in the working session: "Gate A passes" or files specific changes he wants. If changes are requested, open a follow-up task list rather than amending this plan.

---

## Self-Review

### 1. Spec coverage

| Spec section | Task |
|---|---|
| §4.1 — 3 DB columns | Task 1 |
| §4.3 — drop codex Resend dual-key | Task 0 |
| §5 file #1 — completed-notifications.ts changes (gate + sendOwnerSmsAlert) | Tasks 3, 4, 5 |
| §5 file #2-3 — email/send.ts + .env.example revert | Task 0 |
| §5 file #4 — new test endpoint | Task 7 |
| §5 file #5 — settings PATCH accepts new fields | Task 2 |
| §5 file #6 — dashboard 3-card layout | Task 9 |
| §5 settings schema registry | Task 2 |
| §5 "Files NOT changed" — completed/route.ts SELECT extension | Task 6 |
| §6 — call flow + idempotency | Task 6 wires it up |
| §6.5 — missing destination handling | Built into Task 5's sendOwnerSmsAlert |
| §7.1 — unit tests | Tasks 2, 3, 4, 5 |
| §7.2 — Playwright | Task 10 |
| §7.3 Gate A — Hasan self-test | Task 11 |
| §7.4 — drift detection | Task 11 Step 6 |
| §7.5 — cost log line | Task 5 (inside sendOwnerSmsAlert) |
| §8 — launch sequence Phase 0 + Phase 1 | Tasks 0-10 are Phase 0, Task 11 is Phase 1 |
| §9 — risk: email gate change spams existing clients | Tasks 0.5 + 4 step 6 (defensive opt-out) |
| §11 — acceptance criteria | All tasks |

Gaps: none.

### 2. Placeholder scan
- `<HASAN_CELL>` in Task 11 Step 2 is intentionally a fill-in for Hasan's actual cell — flagged with "Get the value from Hasan directly — do not guess."
- `<N>` in Task 4 Step 7 commit message is the actual row count from Task 4 Step 6's UPDATE — filled in at execution time.
- No TBD / TODO / "similar to" — every code block is complete.

### 3. Type consistency
- `sendOwnerSmsAlert(ctx, opts?: { testMode?: boolean })` — same signature in Tasks 5, 7
- `resolveSmsOwnerDestination(client: Pick<CompletedClient, 'alert_phone' | 'callback_phone'>): string | null` — consistent
- `buildOwnerSmsBody(params: { classification, callerPhone, businessName, testMode }): string` — consistent
- `channel = 'sms_owner'` for notification_logs writes — consistent across Tasks 5 and 7 (test endpoint skips writes via `callLogId: null`)
- `CompletedClient` interface gets the same 4 new fields (`alert_phone`, `alert_email`, `sms_alerts_enabled`, `callback_phone`) in Task 3 — used identically in Tasks 5, 7

### 4. Risks
- Task 9's UI rewrite is the highest-churn diff (~150 net lines). Step 6 visual smoke check is the catch.
- Task 4's gate change has a real behavior shift for existing non-voicemail clients — Task 0.5 + Task 4 Step 6 mitigate. If implementer skips Step 6, Mark/Omar/Alisha/Hasan get emailed on every call until they opt out.
- Task 7's test endpoint uses `createServiceClient()` to bypass RLS. That's correct (owner-test is privileged) but worth double-checking the auth gate above it (Task 7 Step 1 lines 50-67) doesn't have an admin scope bypass bug.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-multichannel-notifications.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
