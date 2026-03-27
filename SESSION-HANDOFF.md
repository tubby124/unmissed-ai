# Session Handoff — 2026-03-27

## Task
Implement the 10 hardening fixes for the SMS platform (plan: `~/.claude/plans/jaunty-sparking-pancake.md`).

---

## Completed This Session

### 1. DB Migration (`supabase/migrations/20260327100000_sms_outcome.sql`) ✅
- `call_logs.sms_outcome` enum CHECK: `sent`, `blocked_opt_out`, `failed_provider`, `failed_missing_phone`
  - `failed_no_consent` REMOVED — was dead-state, never implemented anywhere
  - Backfill: `UPDATE call_logs SET sms_outcome = 'sent' WHERE in_call_sms_sent = true`
- **Unique partial index** `idx_sms_logs_unique_incall_send` on `sms_logs(related_call_id)` WHERE not null + outbound — atomic idempotency gate
- Stronger audit columns on `sms_logs`: `error_code`, `error_message`, `provider_message_sid`, `attempted_at`
- `idx_sms_opt_outs_lookup` index

**STILL NEEDS:** run `mcp__supabase__apply_migration` against project `qwhvblomlgeapzhnuwlb`

### 2. SMS Route (`src/app/api/webhook/[slug]/sms/route.ts`) ✅
- Atomic idempotency: INSERT-as-claim into `sms_logs` before Twilio call. 23505 = bail. No race window.
- Demo dedup fixed: `demo_calls.in_call_sms_sent` checked before INSERT (demo path had lost this guard)
- `sms_outcome` written on ALL exit paths: `blocked_opt_out`, `failed_missing_phone`, `sent`, `failed_provider`
- Stronger audit: `provider_message_sid`, `error_message` written to `sms_logs`
- `failed_no_consent` removed entirely

### 3. Plan updated (`~/.claude/plans/jaunty-sparking-pancake.md`) ✅
- Track B.1 atomic idempotency section added
- `failed_no_consent` removed from migration spec
- VoIP claim removed from `getSmsBlock()` spec (backend doesn't implement it)
- Backfill section updated with 6 safety requirements
- Test plan updated with negative proofs + regenerate/backfill tests

### 4. `src/lib/prompt-patcher.ts` ✅
- `getSmsBlock()` — clean block, no VoIP claim
- `patchSmsBlock(prompt, enabled)` — idempotent add/remove

### 5. `src/app/api/dashboard/settings/route.ts` ✅
- Imports `patchSmsBlock`
- New patch block fires on `sms_enabled` change → appends/removes `# SMS FOLLOW-UP`, validates, triggers `needsAgentSync`

### 6. `src/app/api/dashboard/regenerate-prompt/route.ts` ✅
- Imports `patchSmsBlock`
- Re-applies SMS block post-regen when `sms_enabled = true`

---

## Pending (not yet implemented)

### 7. Admin backfill (`src/app/api/admin/backfill-sms-prompt/route.ts`) — NOT STARTED
Fixes all existing `sms_enabled=true` clients missing `# SMS FOLLOW-UP` in prompt.
Required: `?dry_run=true`, chunked (5 at a time, 300ms delay), per-client error isolation, admin auth, idempotent re-run.
This is the "make a pass to patch all other systems" request.

### 8. sms-status route (`src/app/api/dashboard/calls/[id]/sms-status/route.ts`) — NOT STARTED
Returns `{ outcome, opted_out, opted_out_at }`. Must join through `client_users` for tenant ownership — do NOT trust call.id alone.

### 9. `CallRow.tsx` → extract `CallRowExpanded.tsx` — NOT STARTED
- Add `sms_outcome?: string | null` and `client_id?: string | null` to `CallLog` interface
- Extract expanded panel (lines ~274–470) into `CallRowExpanded.tsx`
- Add SMS status section using `/api/dashboard/calls/[id]/sms-status`
- `unknown` fallback in rendering (never let missing/bad enum crash the badge)

### 10. `src/app/dashboard/calls/page.tsx` — NOT STARTED
Add `sms_outcome, client_id` to the select on line 95.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260327100000_sms_outcome.sql` | NEW |
| `src/app/api/webhook/[slug]/sms/route.ts` | Rewritten |
| `src/lib/prompt-patcher.ts` | Added getSmsBlock + patchSmsBlock |
| `src/app/api/dashboard/settings/route.ts` | Added sms_enabled patch hook |
| `src/app/api/dashboard/regenerate-prompt/route.ts` | Added SMS re-apply |
| `~/.claude/plans/jaunty-sparking-pancake.md` | Updated with B.1 + all fixes |

---

## How to Continue

```
1. Apply migration: mcp__supabase__apply_migration → 20260327100000_sms_outcome.sql
2. Implement items 7–10 above
3. npm run build (must be clean)
4. Toggle sms_enabled off→on for windshield-hub → verify prompt patched
5. POST /api/admin/backfill-sms-prompt?dry_run=true → verify counts
6. POST /api/admin/backfill-sms-prompt (live run for all sms_enabled clients)
7. /prompt-deploy windshield-hub to verify live agent updated
```
