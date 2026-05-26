# Session Handoff — Multichannel Notifications (2026-05-25)

**Branch:** `main` (14 commits ahead of `origin/main`, NOT pushed)
**HEAD:** `519ddd68`
**Plan:** [docs/superpowers/plans/2026-05-25-multichannel-notifications.md](docs/superpowers/plans/2026-05-25-multichannel-notifications.md) (plan-commit `83fd57df`)
**Spec:** [docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md](docs/superpowers/specs/2026-05-25-multichannel-notifications-design.md)

---

## Completed This Session (Tasks 0 through 9)

| Task | Commit | What |
|------|--------|------|
| 0 | (working-tree only — no commit) | Reverted codex's uncommitted `RESEND_API_KEY_ENDVOICEMAIL_SEND` diff; tree matches HEAD |
| 0.5 | `754eefae` | Pre-deploy email flag state note added to plan |
| 1 | `0e511e77` | Migration `20260525000000_add_alert_channels.sql` (3 columns: `alert_phone`, `alert_email`, `sms_alerts_enabled`) — **APPLIED TO PROD** (project `qwhvblomlgeapzhnuwlb`). `database.types.ts` regenerated. |
| 2 | `8e49f70d` | All 3 fields registered in `settings-schema.ts` FIELD_REGISTRY (DB_ONLY, triggersSync: false), Zod schema, `buildUpdates`. +12 tests. Critical: NOT in `SYNC_TRIGGER_FIELDS` (test enforces). |
| 3 | `5ecd44a6` | `CompletedClient` interface extended with 4 fields. `sendEmailNotification` resolves destination via `alert_email ?? contact_email`. +4 tests. |
| 4 | `3e46ee91` | `shouldSendPerCallEmail` unified to symmetric `!== false`. **PROD BACKFILL APPLIED** — 10 rows with NULL flag + contact_email defensively set to false (non-voicemail, non-message_only). 4 working clients were already explicit false, unaffected. |
| 5 | `b86cd670` | `sendOwnerSmsAlert` + `buildOwnerSmsBody` + `resolveSmsOwnerDestination` added to `completed-notifications.ts`. New test file `notification-channels.test.ts` (+8 tests). |
| 5-followup | `dc3ddf57` | Backfilled `CompletedClient` test fixture with the 4 new fields (closed a tsc error). |
| 6 | `b252359d` | `/completed` webhook wired: SELECT extended, `sendOwnerSmsAlert` imported, added as 4th sibling between caller-SMS and email. **tsc fully clean after this commit.** |
| 7 | `afbceee4` | `POST /api/dashboard/notifications/test` endpoint. Auth via `client_users`, rate-limited 5/client/hour, synthetic NotificationContext. DONE_WITH_CONCERNS — see Known Issues. |
| 8 | `45221e52` | `ClientConfig` + `NotificationsConfigSection` SELECT extended with 3 new fields + `twilio_number` + `telegram_registration_token`. |
| 9 | `519ddd68` | `AlertsTab.tsx` rebuilt: 2-toggle block replaced with 3 channel cards (SMS / Email / Telegram). Each has destination input + Save + Send test alert + result chip. Telegram connect + style + weekly digest blocks untouched. |

**Test counts:** 2160 → 2172 pass (2 skipped). tsc clean.

---

## Decisions Made

- **Supabase project ID:** Plan said `kntgxkvgxlhrwonlfbny`. Verified against `package.json:db:types` and `ARCHITECTURE_STATE.md` — correct unmissed.ai prod ref is `qwhvblomlgeapzhnuwlb`. All Supabase ops in this branch used the correct ref. Plan file's Task 0.5 note records the correction.
- **Task 4 backfill:** Plan said "conditional on Task 0.5 state." Task 0.5 query showed 4 active clients explicit-false (safe), but 10 other rows (1 active canary + 9 paused, non-voicemail, non-message_only) had NULL flag + contact_email. Without backfill those would receive surprise per-call email after deploy. Backfill applied, 10 rows affected.
- **Email/Telegram testMode asymmetry (Task 7):** Plan called this out — only `sendOwnerSmsAlert` accepts `{ testMode: true }`. Email + Telegram functions get the same skip behavior via `callLogId: null`, but they will write a `notification_logs` row with `call_id=null` (the column is nullable). Harmless test noise.
- **Playwright button precedence bug:** Plan's draft had `!a.trim() && !b || c` (button incorrectly disabled by `c` alone). Fixed to `(!a.trim() && !b) || c` in Task 9 commit `519ddd68`.

---

## Pending / Next Steps

- [ ] **Task 10 — Playwright integration test.** Paused for user decision. Options:
  - (a) Ship as-is with auto-skip when `TEST_PASSWORD` env unset (matches `dashboard-features.spec.ts` pattern)
  - (b) Skip entirely — rely on Task 11 (Hasan manual) as the actual ship gate (which spec §7.3 calls the "only must-ship gate")
  - (c) Replace Playwright with a node:test unit test against `/api/dashboard/notifications/test` (mocks Supabase + send functions)
  - (d) Both Playwright + node:test API-route test
  - Draft file exists at [tests/notification-dashboard.spec.ts](tests/notification-dashboard.spec.ts) (untracked, unstaged). Content is correct (auto-skip on `!TEST_PASSWORD`, SMS tests also skip if test client has no twilio_number). Either delete or commit.
- [ ] **Final code review.** Dispatch `unmissed-code-reviewer` over the 11-commit branch diff (`83fd57df..HEAD`).
- [ ] **Push to `origin/main`** — 14 commits ahead, unpushed. Push is pre-authorized but was held during execution. Should be a deliberate decision after final review.
- [ ] **Task 11 — Hasan manual self-test (spec §7.3 Gate A — the only must-ship gate):**
  1. SQL (prod, project `qwhvblomlgeapzhnuwlb`): set `sms_alerts_enabled=true`, `alert_phone='<Hasan's cell, E.164>'`, `email_notifications_enabled=true`, `alert_email='hasan.sharif@exprealty.com'` on slug `hasan-sharif`.
  2. Verify all 3 cards render on `/dashboard/notifications`.
  3. Click each "Send test" button: SMS / email / Telegram all land within 10-30s.
  4. Real call to Aisha's Twilio number → confirm all 3 channels fire within 30s.
  5. Drift check: `SELECT last_agent_sync_at FROM clients WHERE slug='hasan-sharif'` should be BEFORE the migration timestamp (no agent re-sync triggered by anything in this PR).
  6. Sign off "Gate A passes" or file specific changes.

---

## Files Changed

```
.env.example                                                              (reverted to HEAD — no commit)
src/lib/email/send.ts                                                     (reverted to HEAD — no commit)
docs/superpowers/plans/2026-05-25-multichannel-notifications.md
supabase/migrations/20260525000000_add_alert_channels.sql                 (new)
src/lib/database.types.ts                                                 (regenerated; +180 lines drift catch-up)
src/lib/settings-schema.ts
src/lib/__tests__/notification-guards.test.ts
src/lib/completed-notifications.ts
src/lib/__tests__/notification-channels.test.ts                           (new)
src/app/api/webhook/[slug]/completed/route.ts
src/app/api/dashboard/notifications/test/route.ts                         (new)
src/app/dashboard/settings/page.tsx
src/app/dashboard/notifications/NotificationsConfigSection.tsx
src/components/dashboard/settings/AlertsTab.tsx
```

Untracked:
- [tests/notification-dashboard.spec.ts](tests/notification-dashboard.spec.ts) — Task 10 draft, decision pending
- `CALLINGAGENTS/00-Inbox/2026-05-21-harness-continuation-prompt.md` — pre-existing, not from this session

---

## Prod DB State Notes

- 3 new columns live on `clients` in project `qwhvblomlgeapzhnuwlb`: `alert_phone text`, `alert_email text`, `sms_alerts_enabled boolean`. All nullable.
- `email_notifications_enabled` backfill applied: 10 rows updated to `false` defensively. The 4 working clients (`hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`) were already explicit `false` and were not touched by the backfill.
- No agent redeploy triggered. All 3 new fields are `DB_ONLY, triggersSync: false`. Tests enforce they're NOT in `SYNC_TRIGGER_FIELDS`.

---

## Known Issues / Concerns

1. **Email/Telegram testMode asymmetry (Task 7):** The synthetic test endpoint writes `notification_logs` rows with `call_id=null` when channel ∈ {email, telegram}. Spec §6.3 says the test should be ephemeral; this is a minor deviation. Acceptable per plan's own docstring acknowledgment. If we want true skip, add `{ testMode }` parameter to `sendEmailNotification` + `sendTelegramNotification` (mirror `sendOwnerSmsAlert` pattern). Follow-up, not blocker.

2. **Plan project-ID error:** The plan file still references `kntgxkvgxlhrwonlfbny` in 3 places that weren't edited. The Task 0.5 amendment notes the correction inline. A docs-only find/replace pass would close this.

3. **`database.types.ts` drift catch-up:** Task 1's regen pulled in unrelated pre-existing schema (`inbound_personality`, `outbound_*`, `learning_loop_suggestions` table) that earlier commits introduced without regenerating types. Type cleanup, not new functionality.

4. **`manzil-isa` not in this DB:** The plan named 5 active clients; Task 0.5 query found only 4. `manzil-isa` is the n8n-legacy test client mentioned in `.claude/rules/command-routing.md` and isn't in `clients` table of unmissed.ai prod. Not a concern for this PR.

---

## How to Continue

Next session, paste:

> Resume multichannel notifications — Tasks 0-9 done on main (HEAD=519ddd68). Read SESSION-HANDOFF.md at repo root. Decide Task 10 approach (Playwright vs node:test vs skip), then run final review, then push, then Hasan executes Task 11 manual gate.

Or if jumping straight to Task 11:

> Multichannel notifications dashboard is shipped (14 commits, unpushed). I'm ready for Task 11 Gate A. Push to origin first, then walk me through the manual SQL + dashboard test buttons. My cell is <E.164>.
