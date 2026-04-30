# Next Chat — D445 Hasan Snowflake Migration Dry-Run (Phase 2)

> **Cold-start prompt — paste this into a fresh Claude Code session.**
> Working dir: `/Users/owner/Downloads/CALLING AGENTs`
> Branch: cut a fresh `chore/hasan-dryrun-2026-04-30` from `origin/main`.
> **Scope:** dry-run only. Decision doc is the deliverable. **No deploy. No `clients.system_prompt` write. No Ultravox sync.**
> **Hasan's directive:** "Don't come back to me until it's done." Execute end-to-end without re-confirming.

---

## What just shipped (so you know the state)

PR #61 (squash-merge `a73d23c`, 2026-04-30 22:16 UTC) shipped D447 + D449 Phase 1:
- **D447:** new `GET /api/dashboard/agent/runtime-state` route + classifier + 60s LRU cache; AgentIdentityCard greeting tile bound to runtime truth behind `OVERVIEW_RUNTIME_TRUTH_ENABLED` flag (default off).
- **D449:** `field_sync_status` added to `PATCH /api/dashboard/settings` response; `usePatchSettings` exposes `getFieldSyncStatus` + `retryFieldSync` (3-retry budget); `<SyncStatusChip>` wired under GREETING_LINE in PromptVariablesCard.
- Tests: 1816 / 1814 pass / 0 fail.
- PR #62 updated D447 + D449 trackers to `phase-1-done`.
- Railway auto-deploys from `main`. `a73d23c` is on `main` — should be live by the time you read this.

**Phase 2 = THIS SESSION:** produce a decision doc Hasan can read in 5 minutes and answer "ship it" or "tweak X first." Stop at the decision doc. Do not deploy.

---

## Critical correction to the original plan

The original handoff (`NEXT-CHAT-D447-D449-Hasan-Migration.md`) said to call `POST https://app.unmissed.ai/api/admin/recompose-client` with `dryRun:true, forceRecompose:true`. **That route does NOT support `dryRun` as a body param** — read [src/app/api/admin/recompose-client/route.ts](../../src/app/api/admin/recompose-client/route.ts): it hardcodes `recomposePrompt(clientId, user.id, false, forceRecompose)`. Calling that prod endpoint **would write `clients.system_prompt` and sync to Ultravox** — that is a deploy.

**Use the LOCAL SCRIPT path instead.** Import `recomposePrompt()` directly from [src/lib/slot-regenerator.ts](../../src/lib/slot-regenerator.ts), call with `dryRun: true`, no API round-trip. Same code path, no write. Pattern:

```ts
// scripts/dryrun-hasan-sharif.ts
import { recomposePrompt } from '@/lib/slot-regenerator'
import { createServiceClient } from '@/lib/supabase/server'

const HASAN_USER_ID = '<resolve from clients.id where slug=hasan-sharif then look up an admin from client_users>'
// Or use a dummy UUID for triggeredByUserId in dryrun — recomposePrompt's saveResult path
// is skipped on dryRun:true so the user_id never reaches a write.

const clientId = '<lookup>'
const result = await recomposePrompt(clientId, HASAN_USER_ID, /* dryRun */ true, /* forceRecompose */ true)

console.log(JSON.stringify(result, null, 2))
```

Run via `cd /Users/owner/Downloads/CALLING\ AGENTs && npx tsx scripts/dryrun-hasan-sharif.ts`. Inspect `result.newPrompt` (or whatever the field is called — verify by reading `recomposePrompt` return shape in slot-regenerator.ts lines 530-616).

---

## Pre-reads (load these first, in this order)

1. [Architecture/Snowflake-Migration-Deep-Plan.md](../Architecture/Snowflake-Migration-Deep-Plan.md) — Section 3.1 Hasan-specific risk profile; Section 4 rollback procedure
2. [Tracker/D445.md](../Tracker/D445.md) — snowflake migration master ticket
3. [Tracker/D447.md](../Tracker/D447.md) and [Tracker/D449.md](../Tracker/D449.md) — both `phase-1-done` after `a73d23c`
4. [src/lib/slot-regenerator.ts](../../src/lib/slot-regenerator.ts) lines 525-617 — `recomposePrompt()` signature + return shape + dryRun branch
5. [src/lib/prompt-edit-safety.md](../../.claude/rules/prompt-edit-safety.md) — must read before any prompt-shaped change
6. [docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt](../../docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt) — 8396-byte rollback target

---

## Auth / env requirements

- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for unmissed prod. `createServiceClient()` reads these.
- `~/.secrets` (sourced by `~/.zshrc`) has `SUPABASE_SERVICE_KEY` (legacy name) and `SUPABASE_ACCESS_TOKEN` (CLI). Local script path uses `.env.local`, not `~/.secrets`.
- **No `ADMIN_TOKEN` needed.** Local script bypasses the API. If you nonetheless decide to call the prod API (DON'T — see correction above), you'd need a Supabase JWT for an admin user, not a static token — that route uses `auth.getUser()`.

---

## Phase 2 — Step-by-step

### Step 1: Verify snapshot
```bash
wc -c docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt
# expect ≈ 8396 bytes
```
This file is the rollback target. Confirm it exists and is non-empty before proceeding.

### Step 2: Capture hasan-sharif's current state
Write to `CALLINGAGENTS/00-Inbox/hasan-snowflake-pre-migration.json`:
- `clients.id`, `clients.slug`, `clients.niche`, `clients.business_name`, `clients.agent_name`, `clients.agent_voice_id`
- `clients.system_prompt` (current legacy-monolithic prompt — should match the snapshot at byte length)
- `clients.niche_custom_variables` (object — these are the inputs `recomposePrompt` will use)
- `clients.business_facts`, `clients.extra_qa`, `clients.context_data`
- `clients.tools` (current tool array — D442 audit should match this)
- `clients.last_agent_sync_at`, `clients.last_agent_sync_status`

Use the local script approach with `createServiceClient()`. Do NOT write back to Supabase — read-only. Save the JSON file.

### Step 3: Run the dry-run

Write `scripts/dryrun-hasan-sharif.ts`:

```ts
import 'dotenv/config'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import { createServiceClient } from '../src/lib/supabase/server'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const svc = createServiceClient()

  const { data: client, error } = await svc
    .from('clients')
    .select('id, slug')
    .eq('slug', 'hasan-sharif')
    .limit(1)
    .maybeSingle()

  if (error || !client) throw new Error(`hasan-sharif lookup failed: ${error?.message ?? 'not found'}`)

  // Pick any admin user_id — only used for prompt_versions audit row, which is also skipped on dryRun
  const { data: adminCu } = await svc
    .from('client_users')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (!adminCu?.user_id) throw new Error('no admin user_id in client_users')

  console.log(`Running recomposePrompt(${client.id}, ${adminCu.user_id}, dryRun=true, forceRecompose=true)`)

  const result = await recomposePrompt(client.id, adminCu.user_id, true, true)

  const outPath = path.resolve('CALLINGAGENTS/00-Inbox/hasan-snowflake-dryrun.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(`success=${result.success} promptChanged=${result.promptChanged} charCount=${result.charCount} error=${result.error ?? 'none'}`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

Run:
```bash
cd "/Users/owner/Downloads/CALLING AGENTs" && npx tsx scripts/dryrun-hasan-sharif.ts
```

**Expected:** `success=true, promptChanged=true, error=none, charCount=<some N>`. The dryRun branch in `recomposePrompt()` (slot-regenerator.ts ~line 590) returns the new prompt without persisting. If `success=false` with error "Old-format prompt without section markers", you forgot `forceRecompose:true`.

**Verify your dryRun script does NOT write:** before running, grep the saveResult path in `recomposePrompt` to confirm it's gated by `if (dryRun) return ...` BEFORE the supabase update + updateAgent calls. If for any reason that gate is missing (it shouldn't be, given D445 just shipped), STOP and surface to Hasan.

### Step 4: Diff old vs new

```bash
# Extract new prompt from JSON
jq -r '.newPrompt // .prompt // .promptText' CALLINGAGENTS/00-Inbox/hasan-snowflake-dryrun.json > /tmp/hasan-new-prompt.txt
wc -c /tmp/hasan-new-prompt.txt

# Side-by-side diff
diff -u docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt /tmp/hasan-new-prompt.txt > CALLINGAGENTS/00-Inbox/hasan-snowflake-diff.txt
```

(If the JSON field name is different — e.g., `result.newPrompt` doesn't exist but `result.prompt` does — adapt. Read the actual return shape from slot-regenerator.ts before running jq.)

### Step 5: Audit Hasan-specific risk areas

For each of these, scan both prompts (use `grep -i` on both files) and capture **preserved / lost / reworded** in the decision doc:

| # | Risk area | Source phrase to grep | Why it matters |
|---|-----------|----------------------|----------------|
| 1 | Islamic greeting | `Wa Alaikum Assalam` | Hasan greets Muslim callers in Arabic — losing this breaks brand fit. If lost, capture into `niche_custom_variables.RELIGIOUS_GREETING_RESPONSE` (or similar slot) BEFORE deploy. |
| 2 | Manzil / halal-financing | `Manzil`, `halal`, `riba`, `halal financing` | Mandatory `queryKnowledge` before deferring. Slot pipeline has equivalent "rule 30 forbidden_extra" but the literal "Manzil" brand name will not survive the recompose. |
| 3 | Slang allowance | `gonna`, `kinda`, `wanna` | VOICE_STYLE slot must permit casual contractions. If recompose forces "going to" / "kind of", agent will sound stiffer than current production. |
| 4 | Dual-license SK + AB | `Saskatchewan`, `Alberta`, `dual.licens`, `licensed in both` | Hasan is licensed in both provinces. Lost = misrepresentation risk. |
| 5 | Quick-response shortcuts | `Is Hasan there`, `Can I speak to Hasan` | Specific scripted answers ("Hasan is showing a property right now…") that callers expect. Lost = generic deflection. |

### Step 6: Validate prompt size
```bash
wc -c /tmp/hasan-new-prompt.txt
```
Must be **< 12000 bytes** per `.claude/rules/prompt-edit-safety.md`. If between 10K-12K, surface as warning. If ≥12K, the new prompt fails `validatePrompt()` and the recompose itself would have been rejected — but flag it loud.

### Step 7: Write the decision doc

Path: `CALLINGAGENTS/00-Inbox/hasan-migration-decision.md`

Required sections (Markdown, copy-pastable for Hasan):

```markdown
# Hasan-Sharif Snowflake Migration — Dry-Run Decision

**Run date:** 2026-04-30
**Source snapshot:** docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt (8396 bytes)
**New prompt:** CALLINGAGENTS/00-Inbox/hasan-snowflake-dryrun.json (jq -r .newPrompt)
**Char counts:** old=<N1>, new=<N2>, delta=<+/-N3 (+/-X.X%)>

## TL;DR
- GO / NO-GO: [GO | TWEAK FIRST | NO-GO]
- One-sentence rationale.

## Risk-area side-by-side

### 1. Islamic greeting
**Old (snapshot):**
> <quote the line>

**New (recompose):**
> <quote the line — or "ABSENT">

**Verdict:** preserved / lost / reworded. If lost, recommended pre-stage: `niche_custom_variables.RELIGIOUS_GREETING_RESPONSE = "<exact phrasing>"`.

### 2. Manzil / halal-financing
[same structure]

### 3. Slang allowance (gonna/kinda/wanna)
[same structure]

### 4. Dual-license SK+AB
[same structure]

### 5. Quick-response shortcuts ("Is Hasan there?")
[same structure]

## Tool array changes
- Old `clients.tools` (from pre-migration JSON): [list]
- New tool array (computed by recomposePrompt → buildAgentTools): [list]
- Diff: [+added, -removed, =same]

## Char-count comparison
| Metric | Old | New | Delta |
|--------|-----|-----|-------|
| Total chars | … | … | … |
| Section count (estimated by `# ` headers) | … | … | … |
| Validate-prompt warnings | … | … | … |

## Recommended pre-deploy patches to niche_custom_variables
Before any deploy, write these into `niche_custom_variables` so the recompose preserves Hasan's voice:
1. `KEY = "value"` — reason
2. ...

## Recommended deploy procedure
1. Apply niche_custom_variables patches above (single SQL UPDATE on `clients` row).
2. Re-run dry-run to confirm new prompt now includes preserved phrasings.
3. Inspect re-run dryrun output.
4. Deploy via `POST /api/admin/recompose-client` with `force_recompose: true`. (NOTE: this route currently lacks dryRun; if you want a dryrun-against-prod path we'd add a body param first.)
5. Within 5 minutes of deploy: place a manual test call to Hasan's Twilio number, validate behavior on the 5 risk areas above.
6. If any risk area regresses: rollback via `clients.system_prompt = <snapshot contents>` + `updateAgent(ultravox_agent_id, {systemPrompt: snapshot})`.

## Rollback path
- Snapshot at `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/hasan-sharif-system-prompt.txt` (8396 bytes).
- One SQL `UPDATE clients SET system_prompt = '<contents>' WHERE slug='hasan-sharif'` + `updateAgent()` returns to current state.
- Estimated rollback time: <5 min.

## Open questions for Hasan
- [list anything ambiguous you hit during the dryrun]
```

### Step 8: Stop here

Do **not**:
- Call `POST /api/admin/recompose-client` (it does not support dryRun and will deploy)
- Write to `clients.system_prompt`
- Call `updateAgent()` on hasan-sharif
- Modify `niche_custom_variables` (those are the inputs you're recommending Hasan tweak FIRST)
- Migrate any other client (exp-realty / windshield-hub / urban-vibe — all blocked on Hasan dryrun result)

Do:
- Commit the decision doc + dryrun JSON + diff to a docs branch (`docs/hasan-dryrun-decision`)
- Push + open PR (no merge — Hasan reviews the doc first)
- Update `CALLINGAGENTS/Tracker/D445.md` with note "Hasan dry-run complete, decision doc at `00-Inbox/hasan-migration-decision.md`, awaiting owner go/no-go". Status stays `not-started` until actual deploy.
- Update `~/.claude/projects/-Users-owner/memory/MEMORY.md` "DEFERRED BUILDS" entry: replace the D447/D449/Hasan-migration entry with a Hasan-deploy-pending entry pointing to the decision doc PR.

## What "done" looks like

A single PR (no merge) containing:
- `CALLINGAGENTS/00-Inbox/hasan-snowflake-pre-migration.json`
- `CALLINGAGENTS/00-Inbox/hasan-snowflake-dryrun.json`
- `CALLINGAGENTS/00-Inbox/hasan-snowflake-diff.txt`
- `CALLINGAGENTS/00-Inbox/hasan-migration-decision.md`
- `CALLINGAGENTS/Tracker/D445.md` updated with dryrun-complete note
- `scripts/dryrun-hasan-sharif.ts`
- (optionally) memory MEMORY.md pointer update

PR title: `docs: D445 hasan-sharif snowflake migration dry-run + decision doc`
PR body: link to `hasan-migration-decision.md`. Tag Hasan with "GO/NO-GO?".

Tell Hasan in chat: "Dry-run complete. Decision doc at PR #<N>. Read the TL;DR + 5 risk-area sections. Reply GO / TWEAK / NO-GO."

That's it. Stop after that message.

---

## Anti-footguns

- **Never call recomposePrompt with `dryRun: false` in this session.** That deploys.
- **Never call the `/api/admin/recompose-client` prod endpoint.** It deploys (no dryRun support).
- **Don't migrate other clients.** Hasan-only this session. Migration order is `hasan-sharif → exp-realty → windshield-hub → urban-vibe` per the cold-start, but each gets its own session.
- **Don't update `niche_custom_variables`.** That's a deploy-prep step Hasan does AFTER reviewing the decision doc.
- **Don't flip `OVERVIEW_RUNTIME_TRUTH_ENABLED`.** That's a separate ramp.
- **Snapshot must exist before running.** If the snapshot file is empty or missing, abort and surface — there's no rollback target without it.

## Resume command

If interrupted mid-session, the resume command is: **"resume hasan dryrun"**. Memory will route to this file.

---

## Why no deploy this session

Per D442 Phase 1 audit + D445 spec + Hasan's earlier directive: each snowflake migration is its own atomic ticket (`D445-{slug}`) with explicit owner approval before deploy. Hasan agreed to be migrated FIRST so he can catch breakage fastest, but that doesn't change the gate — every snowflake deploy still requires "go" on the decision doc.
