# Next Chat — D445 Urban Vibe Deploy (Ray approved TWEAK FIRST → GO)

> **Cold-start prompt — paste this into a fresh Claude Code session.**
> Working dir: `/Users/owner/Downloads/CALLING AGENTs`
> Current branch: `chore/d445-pivot-urban-vibe-2026-04-30` (PR #67, NOT merged)
> **Ray approved migration on 2026-04-30 PM.** Decisions captured below.
> Standing rule: **"do it as safely as possible, lots of tests."**

---

## Resume command

`execute urban vibe deploy`

---

## Ray's decisions (locked 2026-04-30 PM)

| # | Question | Ray's answer | Action |
|---|----------|--------------|--------|
| 1 | Billing reality | Pro plan, leave as-is. Ray is helping Hasan onboard clients (concierge state). | **DO NOT touch `subscription_status` or `selected_plan`.** Document concierge state. |
| 2 | SMS auto-followup | YES — keep `sms_enabled=true`, send SMS after every call. | Verify SMS_FOLLOWUP slot stays active. Test with live call. |
| 3 | Transfer | NOT live now (callback-only stays). BUT new feature needed: transfer toggle on Overview that (a) lets Ray pick number, (b) auto-updates system_prompt. | Migration: keep callback-only stance. **File D-NEW for transfer-toggle UX feature** — separate scope, doesn't block this deploy. |
| 4 | Greeting capability list | KEEP. Ray likes the old greeting: "Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. I can log maintenance requests, get Ray to call you back, or help with rental inquiries. What's going on?" | **REQUIRES SLOT-PIPELINE CODE CHANGE** — add `GREETING_OVERRIDE` variable plumbing. See Phase B.0 below. |
| 5 | VIP_PROTOCOL | WANT IT — keep slot active. | No DB change needed; slot already renders when `sms_enabled=true`. Test VIP context injection. |

**Plus all 5 items are gated on:**
- 🔴 Slot-pipeline hours-rendering bug fix (`normalize24hHours()` at [prompt-slots.ts:669](../../src/lib/prompt-slots.ts#L669))

---

## Execution plan (gated, sequential)

### Phase B.0 — Code changes (NEW; pre-Phase A)

These ship as one focused PR before the deploy SQL runs. Each is small + reviewable.

#### B.0.1 — Fix `normalize24hHours()` regex bug

**File:** [src/lib/prompt-slots.ts:669-679](../../src/lib/prompt-slots.ts#L669-L679)

**Bug:** `\b[AP]M\b` requires word boundary on both sides; misses `"8:30am"` (no space between digit and `am`). Result: `"8:30am"` → `"8:30 AMam"`.

**Fix (recommended option):**
```ts
export function normalize24hHours(raw: string): string {
  // Already-12h check: detect AM/PM with or without leading space
  if (/\d\s?[AP]M\b/i.test(raw)) return raw
  return raw.replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => {
    const hour = parseInt(h, 10)
    if (hour === 0) return `12:${m} AM`
    if (hour < 12) return `${hour}:${m} AM`
    if (hour === 12) return `12:${m} PM`
    return `${hour - 12}:${m} PM`
  })
}
```

**Test:** add unit test in [src/lib/__tests__/prompt-slots.test.ts](../../src/lib/__tests__/prompt-slots.test.ts) (or wherever existing hours tests live):
```ts
test('normalize24hHours skips space-less 12h format', () => {
  expect(normalize24hHours('Monday to Friday, 8:30am to 5pm')).toBe('Monday to Friday, 8:30am to 5pm')
  expect(normalize24hHours('8:30 AM to 5:00 PM')).toBe('8:30 AM to 5:00 PM')
  expect(normalize24hHours('Monday 8:00–17:00')).toContain('8:00 AM')
  expect(normalize24hHours('Monday 8:00–17:00')).toContain('5:00 PM')
})
```

#### B.0.2 — Add `GREETING_OVERRIDE` slot-pipeline variable

**Goal:** let Ray (and any client) override the preset's `greetingLine` with a fully custom greeting via `niche_custom_variables.GREETING_OVERRIDE`.

**Where to plumb:**

1. [src/lib/prompt-slots.ts](../../src/lib/prompt-slots.ts) — find the `buildConversationFlow()` slot (~line 357) where `## 1. GREETING` renders. Currently uses `ctx.greetingLine` (from preset).
2. Add `greetingOverride?: string` to `SlotContext` type.
3. In `buildConversationFlow`: if `ctx.greetingOverride` is set, render it; else fall back to `ctx.greetingLine` (preset default).
4. In `buildSlotContext()` (~line 683-720): read `customVars.GREETING_OVERRIDE` and pass to context.
5. Add `GREETING_OVERRIDE` to the [niche-capabilities.ts](../../src/lib/niche-capabilities.ts) `overrideKeys` arrays for property_management (and others — keep narrow to property_management for now if you want minimum diff).

**Test:** add unit test asserting `niche_custom_variables: { GREETING_OVERRIDE: "custom..." }` produces `## 1. GREETING\n\ncustom...` in the rendered prompt.

#### B.0.3 — Verify both code changes via dryrun

```bash
npx tsx scripts/dryrun-urban-vibe.ts
```

Expected: still produces `success=true`, no validation errors. Hours render `8:30am to 5pm` clean (no `AMam` corruption). Greeting still shows preset default (we haven't added the SQL override yet).

**Commit + push B.0 changes. Open as a separate small PR (B.0 is code-only, deploy is data-only).** This keeps the diff readable.

### Phase A — Data hygiene SQL (locked, all 4 statements + 1 new override)

After B.0 ships and merges to main:

```sql
-- A.1 — Switch voice preset (eliminates 2 of 3 "gotcha" leak sites)
UPDATE clients SET voice_style_preset = 'professional_warm' WHERE slug = 'urban-vibe';

-- A.2 — niche_custom_variables: Ray's name + bans + Atco rules + GREETING_OVERRIDE (Ray's old greeting)
UPDATE clients SET niche_custom_variables = '{
  "CLOSE_PERSON": "Ray",
  "FORBIDDEN_EXTRA": "NEVER use the word \"gotcha\" — use \"got it\" or \"sure\" instead. NEVER call yourself an \"AI assistant\" — say \"virtual assistant\" instead. For gas smell or carbon monoxide alarm: tell them to call Atco Emergency or 9-1-1 and get out of the unit, then take their name and unit for Ray to follow up.",
  "GREETING_OVERRIDE": "Thanks for calling Urban Vibe Properties — I''m Alisha, Ray''s virtual assistant. I can log maintenance requests, get Ray to call you back, or help with rental inquiries. What''s going on?"
}'::jsonb WHERE slug = 'urban-vibe';

-- A.3 — business_facts: Calgary/Atco/Ray identity
UPDATE clients SET business_facts = 'Urban Vibe Properties is a Calgary, Alberta property management company.
The property manager is Ray Kassam.
For natural-gas leaks or CO alarms: callers should phone Atco Emergency or 9-1-1 immediately and evacuate. Atco is the Alberta natural gas utility — Calgary tenants know the brand.
Property type: residential rentals only (no commercial). Service area: Calgary AB.
'::text WHERE slug = 'urban-vibe';

-- A.4 — Reformat hours to belt-and-suspenders the regex fix from B.0.1
UPDATE clients SET
  business_hours_weekday = 'Monday to Friday, 8:30 AM to 5:00 PM',
  business_hours_weekend = 'Saturday and Sunday, 10:00 AM to 4:00 PM'
WHERE slug = 'urban-vibe';

-- A.5 — DO NOT TOUCH: subscription_status='none', selected_plan='pro' stays as-is per Ray.
-- This is the concierge state. Documented but not modified.
```

**Run via Supabase MCP `execute_sql` (preferred) OR direct psql.** Do NOT use the Supabase web UI — leaves no audit trail.

**Take a fresh snapshot before running:**
```bash
# At a fresh terminal (in case live state drifted from 2026-04-30 baseline)
npx tsx scripts/audit-urban-vibe.ts > /tmp/urban-vibe-pre-A.json
```

### Phase B — Re-run dryrun, verify all wins materialize

```bash
npx tsx scripts/dryrun-urban-vibe.ts
jq -r '.preview' CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-dryrun.json > /tmp/urban-vibe-new-prompt-v2.txt
diff -u docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt /tmp/urban-vibe-new-prompt-v2.txt > CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-diff-v2.txt
```

**Verify in re-run preview (each one is a release-gate — STOP if any fails):**

- [ ] "Ray" appears in CLOSING (CLOSE_PERSON override worked)
- [ ] "Atco Emergency" appears (business_facts injection — confirm slot/runtime path)
- [ ] "virtual assistant" appears (GREETING_OVERRIDE renders Ray's greeting)
- [ ] "log maintenance requests, get Ray to call you back, or help with rental inquiries" — full capability list in greeting
- [ ] "gotcha" does NOT appear in VOICE_NATURALNESS or TONE_AND_STYLE (preset switch worked)
- [ ] "AI assistant" does NOT appear (FORBIDDEN_EXTRA enforces)
- [ ] Hours render `8:30 AM to 5:00 PM` (no `AMam` corruption)
- [ ] VIP_PROTOCOL slot still rendered (sms_enabled=true gates it)
- [ ] SMS_FOLLOWUP slot still rendered (sms_enabled=true)
- [ ] ESCALATION_TRANSFER section still says "TRANSFER NOT AVAILABLE" (callback-only preserved)
- [ ] Char count < 22,000 (small bump from greeting override + business_facts is acceptable)
- [ ] `validatePrompt()` returns `valid=true`

If ALL pass → proceed to Phase C.
If ANY fails → debug root cause + open follow-up D-item + STOP.

### Phase C — Tools sweep + sync

D442 universal `hangUp` drift might be a phantom finding. Run a real audit before deploy:

1. Read `clients.tools` from DB.
2. Read live Ultravox agent's `callTemplate.selectedTools` (via Ultravox API GET `/agents/{id}`).
3. Diff both `toolName` (built-ins) AND `temporaryTool.modelToolName` (HTTP tools).
4. If real divergence: run `syncClientTools(clientId)` to rebuild from current DB flags.
5. Confirm `transferCall` is NOT in resulting tools (subscription_status='none' → transferEnabled=false → no transferCall).

### Phase D — Deploy via local script (NOT prod API)

**Critical reminder:** [src/app/api/admin/recompose-client/route.ts](../../src/app/api/admin/recompose-client/route.ts) hardcodes `recomposePrompt(clientId, user.id, false, forceRecompose)`. The `dryRun` body param is IGNORED. So we cannot use the prod API.

**Deploy script:**

```ts
// scripts/deploy-urban-vibe.ts (NEW — write in next chat after Phase A-C pass)
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  // Resolve client + admin
  const { data: client } = await svc.from('clients').select('id').eq('slug', 'urban-vibe').limit(1).maybeSingle()
  const { data: admin } = await svc.from('client_users').select('user_id').eq('role', 'admin').limit(1).maybeSingle()
  if (!client?.id || !admin?.user_id) throw new Error('lookup failed')

  // Take live snapshot RIGHT BEFORE deploy (rollback safety)
  const { data: live } = await svc.from('clients').select('system_prompt').eq('id', client.id).single()
  const fs = await import('node:fs')
  const stamp = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(
    `docs/refactor-baseline/snapshots/${stamp}-pre-d445-deploy/urban-vibe-system-prompt.txt`,
    live!.system_prompt as string,
  )
  console.log('  rollback snapshot saved')

  // Live deploy
  const result = await recomposePrompt(client.id, admin.user_id as string, /* dryRun */ false, /* forceRecompose */ true)
  console.log('  deploy result:', result)

  if (!result.success) throw new Error(result.error)
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
```

Run: `npx tsx scripts/deploy-urban-vibe.ts`

This (a) writes `clients.system_prompt`, (b) inserts a `prompt_versions` audit row, (c) calls `updateAgent()` to push to Ultravox, (d) calls `syncClientTools()` to rebuild `clients.tools`.

### Phase E — Test calls (mandatory, multiple)

**Don't skip. Don't shortcut. Ray's voice = his brand.**

Test scenarios — minimum 5 calls, ideally to Ray's Twilio `+15873296845`:

| # | Scenario | Listen for |
|---|----------|------------|
| 1 | Cold call as new prospect | Old greeting renders ("I can log maintenance requests, get Ray to call you back, or help with rental inquiries"). Ashley voice unchanged. |
| 2 | Maintenance call (urgent — gas smell) | Atco Emergency mentioned. P1 flag. Name + unit collected. SMS sent post-call. |
| 3 | Maintenance call (routine — leaky faucet) | "got it" not "gotcha". Ray's name appears in close. |
| 4 | Rental prospect | Showing time captured. "the property manager will confirm" → should be "Ray will confirm" with override. |
| 5 | Returning caller (call from same number twice) | "hey [name], good to hear from you again" greeting on second call. Prior call summary referenced. |
| 6 (optional) | Caller asks for transfer | Agent says no, offers callback. |

After EACH call:
```bash
/review-call <ultravox-call-id>
```

Score on 5 dimensions. Append to `TEST_TRANSCRIPTS.md`. **If any test fails → rollback (Phase F) before next test.**

### Phase F — Rollback (only if Phase D or E fails)

```bash
# scripts/rollback-urban-vibe.ts (NEW — write in next chat if needed)
# Reads docs/refactor-baseline/snapshots/[stamp]-pre-d445-deploy/urban-vibe-system-prompt.txt
# Writes back to clients.system_prompt + calls updateAgent()
```

Or via SQL:
```sql
-- ONLY if rollback needed:
UPDATE clients SET system_prompt = '<paste old prompt from snapshot>' WHERE slug = 'urban-vibe';
-- Then call updateAgent() via a separate script to push the old prompt to Ultravox.
```

### Phase G — Post-deploy hygiene

- [ ] Update `Clients/urban-vibe.md`: snowflake-migration-target → migrated
- [ ] Update `Tracker/D445.md`: urban-vibe → done
- [ ] Update vault: `~/Downloads/Obsidian Vault/Projects/unmissed/2026-04-30-d445-urban-vibe-deployed.md`
- [ ] Update memory: change Urban Vibe entry from "ready to deploy" → "deployed [date]"
- [ ] File any new D-NEW items discovered during testing
- [ ] Confirm `last_agent_sync_status='success'`
- [ ] Confirm `clients.tools` matches expected set (no `transferCall`, has `submitMaintenanceRequest`, `sendTextMessage`, `queryKnowledge`, `pageOwner`, `hangUp`)

---

## D-NEW items to file (in this same execution chat)

### D-NEW-transfer-toggle-overview-ux (P1, Ray's request)

**Title:** Transfer toggle on Overview — pick number + auto-update system_prompt
**Why:** Ray asked for this directly. Current UX: editing `forwarding_number` is buried in settings. Ray wants a one-click toggle on the Overview page that (a) shows a number-picker if enabling, (b) writes `forwarding_number` to DB, (c) re-runs `recomposePrompt()` so the system prompt picks up the change automatically.
**Affects:** Overview page, settings PATCH route, slot-regenerator.
**Gating:** subscription_status entitlement (transfer is Pro-plan only). For Ray's concierge state, decide: allow always, or require subscription_status flip first?

### D-NEW-hours-rendering-bug-shipped (close on Phase B.0.1 ship)

**Title:** `normalize24hHours()` mangles space-less 12h format
**Status:** Fix shipped in Phase B.0.1 of D445-urban-vibe. Close immediately on merge.

### D-NEW-greeting-override-shipped (close on Phase B.0.2 ship)

**Title:** Add `GREETING_OVERRIDE` slot-pipeline variable
**Status:** Shipped in Phase B.0.2. Close on merge.

---

## Anti-footguns (carried forward)

- Working tree should be clean before any phase. `git status` first.
- Pre-commit/pre-push hooks may flake on Turbopack races. Cold-start anti-footgun authorizes `--no-verify` for docs-only commits, NOT for code changes. Code changes (Phase B.0) should pass hooks normally.
- dotenv path: `.env.local` not `.env`.
- `recomposePrompt` result fields: `.preview` and `.currentPrompt` (not `.newPrompt`).
- Prod recompose API ignores `dryRun` body param — never use it for migration.
- Take fresh snapshot RIGHT BEFORE deploy (Phase D includes this in the script).
- After deploy, **wait 30 seconds** before first test call to give Ultravox agent time to fully sync new prompt + tools.
- If a test call fails strangely (e.g., agent says "gotcha"), suspect prompt cache. Wait 5 minutes and retry once before rollback.

---

## Files this chat will touch

Code changes (Phase B.0):
- `src/lib/prompt-slots.ts` (regex fix + GREETING_OVERRIDE plumb)
- `src/lib/niche-capabilities.ts` (add GREETING_OVERRIDE to overrideKeys)
- `src/lib/__tests__/prompt-slots.test.ts` or similar (unit tests)

Migration scripts:
- `scripts/deploy-urban-vibe.ts` (NEW)
- `scripts/rollback-urban-vibe.ts` (NEW, only if needed)

Trackers + docs:
- `CALLINGAGENTS/Tracker/D445.md` (update on completion)
- `CALLINGAGENTS/Tracker/D-NEW-transfer-toggle-overview-ux.md` (NEW)
- `CALLINGAGENTS/Clients/urban-vibe.md` (update on completion)
- `CALLINGAGENTS/00-Inbox/urban-vibe-deploy-result-2026-XX-XX.md` (NEW — post-deploy report)

---

## What "done" looks like

1. PR for Phase B.0 (code changes) merged to main.
2. Phase A SQL run on prod, audit log captured.
3. Phase B re-run dryrun verified — all 12 release-gate checks pass.
4. Phase C tools sweep verified.
5. Phase D deploy script ran successfully — `last_agent_sync_status='success'`.
6. Phase E test calls (5+) all scored ≥4/5 on review.
7. Phase G post-deploy hygiene complete (memory + vault + trackers).
8. Ray gets a Telegram saying "Alisha is on the new system. Try a call. Edit anything you want from the dashboard now."

---

## Stop conditions

Stop and surface to Hasan if:
- Phase B re-run reveals any unexpected loss not in the 9-landmine list.
- `validatePrompt()` returns `valid=false` after Phase A SQL.
- Char count exceeds 25,000 (hard cap — recompose will refuse).
- Test call #1 (cold call) doesn't render Ray's old greeting verbatim.
- Test call #2 doesn't mention Atco Emergency on gas-smell scenario.
- Tools sweep finds `transferCall` registered (means subscription_status logic flipped unexpectedly).
- Any Ultravox API call returns 4xx/5xx during deploy.

In all stop cases: rollback (Phase F), file follow-up D-item, do not retry blind.
