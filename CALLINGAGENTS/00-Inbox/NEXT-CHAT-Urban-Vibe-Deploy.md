# Next Chat — D445 Urban Vibe Deploy (Ray approved 2026-04-30 PM)

> **Cold-start prompt — paste this into a fresh Claude Code session.**
> **Resume command:** `execute urban vibe deploy`
> Working dir: `/Users/owner/Downloads/unmissed-home-spine`
> Standing rule: "do it as safely as possible, lots of tests."

---

## Current state (2026-05-05 night)

| Gate | Status | Notes |
|---|---|---|
| 1. PRs #70 / #71 / #72 merged → main clean | ✅ DONE | 2026-05-05 morning |
| 2. PR #69 (B.0 code prereqs) merged | ✅ DONE | 2026-05-05 night, commit `2901b7e` |
| 3. PR #78 (PM niche template trim) merged | ✅ DONE | Bonus — Ray's slot-pipeline output is now ~5K shorter |
| 4. Phase A SQL staged, deploy + rollback scripts staged | ✅ DONE | This PR (`feat/d445-urban-vibe-migration-prep`) |
| 5. System smoke (5+ test calls Brian + Hasan + ≥1 other) | ⏳ HASAN OWNS | Phone calls — can't be automated |
| 6. Hasan explicit go-ahead | ⏳ PENDING | Required before Phase A SQL applies |

**Refreshed dryrun (2026-05-05 night, on post-#69 + post-#78 main):**
- Current stored: 9,623 chars (Ray's hand-written snowflake prompt)
- Slot-pipeline output: 18,640 chars (under new 20K hard max)
- success=true, promptChanged=true, no validation errors

---

## Ray's locked decisions (2026-04-30 PM)

| # | Question | Ray's answer | Action |
|---|----------|--------------|--------|
| 1 | Billing reality | Pro plan, concierge state | DO NOT touch `subscription_status` / `selected_plan` |
| 2 | SMS auto-followup | YES | `sms_enabled` stays true (already true) |
| 3 | Transfer | callback-only NOW | `forwarding_number` stays null |
| 4 | Greeting capability list | KEEP verbatim | `niche_custom_variables.GREETING_OVERRIDE` (PR #69 plumbing) |
| 5 | VIP_PROTOCOL | WANT IT | Auto-renders from `sms_enabled=true` |

---

## Files staged in this PR

- `scripts/audit-urban-vibe.ts` — read-only diff between stored prompt and slot output. Carry-over from PR #67.
- `scripts/dryrun-urban-vibe.ts` — read-only `recomposePrompt(dryRun=true, forceRecompose=true)`. Already verified clean against current main.
- `scripts/d445-urban-vibe-phase-a.sql` — 4 UPDATE statements. NOT YET APPLIED.
- `scripts/deploy-urban-vibe.ts` — Phase D live deploy. Takes rollback snapshot first. NOT YET RUN.
- `scripts/rollback-urban-vibe.ts` — Phase F rollback. Reads latest snapshot from `docs/refactor-baseline/snapshots/*-pre-d445-deploy/`.
- This doc.

---

## Execute path (when Hasan says "execute urban vibe deploy")

### Phase A — Data hygiene SQL (5 minutes)

```bash
# Apply the 4 UPDATE statements via Supabase Management API
# (Pre-authorized per CLAUDE.md standing autonomy on qwhvblomlgeapzhnuwlb.)
curl -sS -X POST "https://api.supabase.com/v1/projects/qwhvblomlgeapzhnuwlb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @<(jq -n --arg q "$(cat scripts/d445-urban-vibe-phase-a.sql)" '{query:$q}')

# Verify
curl -sS -X POST "https://api.supabase.com/v1/projects/qwhvblomlgeapzhnuwlb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @<(jq -n --arg q "select voice_style_preset, niche_custom_variables->>'GREETING_OVERRIDE' as g, length(business_facts) as bf_chars, business_hours_weekday from clients where slug='urban-vibe';" '{query:$q}')
```

### Phase B — Re-run dryrun, walk release-gate checklist

```bash
npx tsx scripts/dryrun-urban-vibe.ts
```

**Verify in `CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-dryrun.json` `.preview`:**

- [ ] "Ray" appears in CLOSING (CLOSE_PERSON override)
- [ ] "Atco Emergency" appears (business_facts injection)
- [ ] "virtual assistant" appears (GREETING_OVERRIDE rendered)
- [ ] "log maintenance requests, get Ray to call you back, or help with rental inquiries" — full capability list verbatim
- [ ] "gotcha" does NOT appear
- [ ] "AI assistant" does NOT appear
- [ ] Hours render `8:30 AM to 5:00 PM` (no `AMam` corruption)
- [ ] VIP_PROTOCOL slot rendered
- [ ] SMS_FOLLOWUP slot rendered
- [ ] ESCALATION_TRANSFER says "TRANSFER NOT AVAILABLE"
- [ ] Char count < 20,000 (current dryrun shows 18,640)

If ALL pass → Phase C. If ANY fails → STOP, debug, don't deploy.

### Phase C — Tools sweep

Confirm `clients.tools` and live Ultravox agent are aligned. Detailed in playbook memory. Must show: NO `transferCall`, HAS `submitMaintenanceRequest`, `sendTextMessage`, `queryKnowledge`, `pageOwner`, `hangUp`.

### Phase D — Live deploy (IRREVERSIBLE)

```bash
npx tsx scripts/deploy-urban-vibe.ts
```

This: (a) writes rollback snapshot to `docs/refactor-baseline/snapshots/YYYY-MM-DD-pre-d445-deploy/urban-vibe-system-prompt.txt`, (b) writes `clients.system_prompt`, (c) inserts `prompt_versions` audit row, (d) calls `updateAgent()`, (e) syncs `clients.tools`.

### Phase E — Test calls (5+ scenarios)

Test DID: `+14036057142`. After each call: `/review-call <ultravox-call-id>`.

| # | Scenario | Listen for |
|---|----------|------------|
| 1 | Cold call as new prospect | Ray's old greeting renders verbatim |
| 2 | Maintenance — gas smell | Atco Emergency mentioned, P1, name + unit collected, SMS sent |
| 3 | Maintenance — leaky faucet | "got it" not "gotcha", Ray's name in close |
| 4 | Rental prospect | "Ray will confirm" not "the property manager" |
| 5 | Returning caller (call twice) | Greeting acknowledges prior call, summary referenced |

If any fails → Phase F.

### Phase F — Rollback

```bash
npx tsx scripts/rollback-urban-vibe.ts
```

Reads latest snapshot, writes back to `clients.system_prompt`, re-syncs Ultravox agent.

### Phase G — Hygiene

- Update memory `~/.claude/projects/-Users-owner/memory/d445-snowflake-migration-playbook.md`: Urban Vibe → done
- Update vault `~/Downloads/Obsidian Vault/Projects/unmissed/2026-05-XX-d445-urban-vibe-deployed.md`
- Telegram message to Ray ("Hey Ray, the migration is live — call +14036057142 anytime to test, let me know if anything sounds off") — **gated, requires Hasan confirmation**
- Confirm `last_agent_sync_status='success'`

---

## What Hasan owns (cannot be automated)

1. **System smoke calls** — 5+ test calls to Brian (`+1 (639) 739-3885`), Hasan's own line, plus one other live client. Run `/review-call` after each. Confirm zero regressions.
2. **Phase E test calls** to Urban Vibe DID `+14036057142` (post-deploy).
3. **Final go-ahead** — say "execute urban vibe deploy" only after #1 is clean and you have a quiet window.

---

## D451 + D452 (just shipped 2026-05-05 night)

- **D452 drift detector** — Urban Vibe currently shows as `legacy_monolithic` snowflake (expected). After this migration he'll show as a slot-pipeline client and weekly drift will be visible on `/dashboard/clients`.
- **D451 char-delta gate** — does NOT apply to this migration. The dialog gate is for UI-driven recompose. This migration uses `scripts/deploy-urban-vibe.ts` with `forceRecompose=true` which bypasses all UI logic.

---

## References

- Memory: `~/.claude/projects/-Users-owner/memory/d445-snowflake-migration-playbook.md`
- Vault: `~/Downloads/Obsidian Vault/Projects/unmissed/2026-05-01-d445-snowflake-migration-playbook.md`
- D442 audit: `CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md`
- D-NEW transfer-toggle UX (filed by Ray decision #3): keep separate from this deploy
