# Next Chat — D445 Urban Vibe Snowflake Migration (replaces Hasan as primary target)

> **Cold-start prompt — paste this into a fresh Claude Code session.**
> Working dir: `/Users/owner/Downloads/CALLING AGENTs`
> Branch: cut a fresh `chore/urban-vibe-dryrun-{date}` from `origin/main`.
> **Scope:** dry-run + investigation only. Decision doc is the deliverable. **No deploy. No `clients.system_prompt` write. No Ultravox sync.**
> **Why this client now:** Hasan dryrun returned NO-GO (PR #65, 2026-04-30). Hasan does not edit his own dashboard so D449 sync chips don't impact him. **Ray Kassam (Urban Vibe) is the real driver — he wants editing surfaces working.**

---

## Why we're here

PR #65 ran the same flow on hasan-sharif and found:
- recompose grew prompt 8,342 → 23,418 chars (+181%)
- 4 of 5 Hasan-specific phrasings dropped (EXP Realty brand, Manzil/halal trigger, dual-license SK+AB, warm close)
- Root cause: `niche_custom_variables=null`, `business_facts="null"` literal — every Hasan-specific phrasing lives only in legacy prompt text, slot pipeline has nothing to draw from

Urban Vibe has the **same DB-empty pattern**:
- `niche_custom_variables: null`
- `business_facts: null`
- 1 `extra_qa` entry (clean — Ray callback policy)
- `system_prompt`: 9,623 chars legacy monolithic, no slot markers

**But** Urban Vibe is simpler than Hasan: no booking, no calendar, callback-only mode. Lower migration risk if the slot pipeline gaps can be plugged.

Decision context: [[Projects/unmissed/2026-04-30-d445-hasan-dryrun-no-go-pivot-to-urban-vibe]]
Client note: [`CALLINGAGENTS/Clients/urban-vibe.md`](../Clients/urban-vibe.md) (corrected 2026-04-30 — niche was wrongly listed as `beauty`)
Tracker: [`CALLINGAGENTS/Tracker/D445.md`](../Tracker/D445.md)

---

## Pre-reads (load these first, in this order)

1. [`CALLINGAGENTS/00-Inbox/hasan-migration-decision.md`](hasan-migration-decision.md) — what NOT to do, what to expect
2. [`CALLINGAGENTS/Clients/urban-vibe.md`](../Clients/urban-vibe.md) — Ray-specific landmines + DB state
3. [`docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt`](../../docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt) — 9,713-byte rollback target
4. [`src/lib/slot-regenerator.ts`](../../src/lib/slot-regenerator.ts) lines 525-617 — `recomposePrompt()` signature + dryRun branch (verified safe in PR #65)
5. [`src/lib/prompt-slots.ts`](../../src/lib/prompt-slots.ts) — slot builders. **Key sections to skim:** `buildIdentity` (line 291), `buildToneAndStyle` — does it have a `gotcha` reference that conflicts with Ray's ban? Find out.
6. [`.claude/rules/prompt-edit-safety.md`](../../.claude/rules/prompt-edit-safety.md) — must read; note that 12K cap claim is stale (real code uses 25K cap + 15K warn at [`src/lib/settings-schema.ts:322`](../../src/lib/settings-schema.ts#L322))
7. [`scripts/dryrun-hasan-sharif.ts`](../../scripts/dryrun-hasan-sharif.ts) — clone + adapt for urban-vibe (change slug, output paths)

---

## Phase 1 — Investigation (read-only, ~15 min)

Before touching anything, resolve these blockers from the decision doc. Save findings to `CALLINGAGENTS/00-Inbox/urban-vibe-investigation.md`.

### Blocker 1 — "gotcha" ban vs slot pipeline conflict

Vault rule: **"Word 'gotcha' is BANNED — forever, all agents. Use 'got it' instead."**

Tasks:
- `grep -nE "gotcha" src/lib/prompt-slots.ts src/lib/prompt-niches/` — find every place the slot pipeline emits "gotcha"
- Determine: is it a hardcoded string in a slot builder, or a variable reading from `niche_custom_variables`?
- Decide: (a) remove from the slot system globally, (b) make it overridable via `niche_custom_variables.BACKCHANNELS` or similar, (c) accept the conflict and override per-client
- **Document the choice + what code changes (if any) are needed BEFORE running dryrun.**

### Blocker 2 — "PENDING DEPLOY for buildVoicemailPrompt()" stale item

Old vault note + memory both reference an unresolved item: "DO NOT deploy until after test call confirms voicemail builder output (new buildVoicemailPrompt())."

Tasks:
- Search vault for "buildVoicemailPrompt" — find the original ticket
- Check `git log --all --oneline -- src/lib/prompt-niches/voicemail-prompt.ts` — has the change shipped?
- Determine if this is still a blocker or resolved-but-undocumented
- Either close the item or fold it into D445-urban-vibe scope

### Blocker 3 — Billing inconsistency

DB shows `selected_plan='pro'` but `subscription_status='none'`.

Tasks:
- Read [`src/app/api/webhook/stripe/route.ts`](../../src/app/api/webhook/stripe/route.ts) — what writes these two columns?
- Read recent `stripe_events` rows for this client_id (`42a66c19-e4c0-4cd7-a86e-7e7df711043b`)
- Determine: was Ray ever paying? Is he in a manual/concierge state? Does this affect plan-gated tools (`buildAgentTools()` checks `selected_plan` for tool entitlements)?
- **Don't migrate while this is ambiguous — could ship tools the user shouldn't have or strip tools they should have.**

### Blocker 4 — forwarding_number set + callback-only prompt

Current prompt: "Never pretend to transfer or put someone on hold — callback only."
DB: `forwarding_number = +14036057142`, `transfer_conditions = null`.

Tasks:
- Check if `buildAgentTools()` registers `transferCall` for urban-vibe currently
- Decide with Ray (or document open question for Hasan to ask Ray): keep callback-only, or activate transfer?
- If callback-only stays: slot pipeline's `escalation_transfer` slot will register `transferCall` since `forwarding_number` is set. Need to either clear the field OR find an opt-out variable.

### Blocker 5 — Tool drift (universal, not urban-vibe-specific)

D442 audit: DB(5) vs Ultravox(5) — DB has `pageOwner`, UV has `hangUp`. All 5 clients have this divergence; unrelated to migration but worth noting in the decision doc — running `syncClientTools()` after migration may resolve.

---

## Phase 2 — Dry-run (mirror PR #65 flow)

After Phase 1 closes blockers (or explicitly defers them with rationale):

### Step 1: Verify snapshot
```bash
wc -c docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt
# expect ≈ 9,713 bytes
```

### Step 2: Adapt the dryrun script

Copy [`scripts/dryrun-hasan-sharif.ts`](../../scripts/dryrun-hasan-sharif.ts) to `scripts/dryrun-urban-vibe.ts`. Change:
- `.eq('slug', 'hasan-sharif')` → `.eq('slug', 'urban-vibe')`
- Output paths: `hasan-snowflake-*.json` → `urban-vibe-snowflake-*.json`
- Keep dryRun=true, forceRecompose=true

Run via: `npx tsx scripts/dryrun-urban-vibe.ts` (NOT `tsx`-from-/tmp — dotenv path resolution requires the script live in the project's node_modules tree)

**Lesson learned from PR #65:** the cold-start example used `import 'dotenv/config'` which loads `.env` not `.env.local`. Use `import { config as dotenvConfig } from 'dotenv'; dotenvConfig({ path: '.env.local' })` instead.

### Step 3: Diff old vs new

```bash
jq -r '.preview' CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-dryrun.json > /tmp/urban-vibe-new-prompt.txt
wc -c /tmp/urban-vibe-new-prompt.txt
diff -u docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt /tmp/urban-vibe-new-prompt.txt > CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-diff.txt
```

**Note:** result fields are `.preview` (new prompt) and `.currentPrompt` (old). Cold-start guesses `.newPrompt // .prompt // .promptText` are wrong — confirmed in PR #65.

### Step 4: Audit Ray-specific landmines

For each, capture **preserved / lost / reworded** in the decision doc with old vs new quotes:

| # | Risk area | Source phrase | Why critical |
|---|-----------|---------------|--------------|
| 1 | "virtual assistant" wording | `virtual assistant` (NOT "AI assistant") | Vault rule, Ray's specific request |
| 2 | "gotcha" word ban | `gotcha` MUST be absent in new prompt | Vault rule. If Blocker 1 wasn't resolved, this WILL fail. |
| 3 | Atco Emergency script | `Atco Emergency` | Calgary-utility-specific scripted response for gas smells |
| 4 | Callback-only stance | "Never pretend to transfer or put someone on hold" | Tied to Blocker 4 decision |
| 5 | Property-mgmt never-list | "Never confirm rent amounts, availability, pet policy, parking, or utilities" | Misrepresentation risk for tenants |
| 6 | RTA / eviction deflection | `RTA`, `eviction`, `landlord` | Alberta legal carve-out |
| 7 | Returning caller flow | "hey [name], good to hear from you again" | Ray's specific opener for repeats |
| 8 | Identity opener | "log maintenance requests, get Ray to call you back, or help with rental inquiries" | Tells callers what Alisha actually does |
| 9 | Voice profile | "Kind, alert, relaxed but sharp. Never tired or flat" | Ashley voice locked, Ray sensitive to drift |

### Step 5: Char budget validation

Hasan came back at 23,418 (warning band). Urban Vibe is simpler (no booking, no calendar, no transfer slot). Expected to be smaller, but verify:

```bash
wc -c /tmp/urban-vibe-new-prompt.txt
```

- < 12,000 → great
- 12-15,000 → acceptable
- 15-25,000 → warning band, surface to Hasan
- ≥ 25,000 → fails `validatePrompt()` (PROMPT_MAX_CHARS), recompose was rejected — confirm `success=false`

### Step 6: Decision doc

Path: `CALLINGAGENTS/00-Inbox/urban-vibe-migration-decision.md`

Same structure as Hasan's:
- TL;DR (GO / TWEAK FIRST / NO-GO + 1-sentence rationale)
- Char-count comparison table
- Risk-area side-by-side (9 areas above)
- DB state inputs to recompose (mirror Hasan's table)
- Tool array notes (D442 universal `hangUp` drift — consequences)
- Pre-deploy patches (Phase A SQL, Phase B test call, Phase C deploy via local script)
- Rollback path
- Open questions for Ray (NOT Hasan — Ray is the owner who cares)

### Step 7: Stop

Same anti-footguns as Hasan:
- Never call `recomposePrompt(...,dryRun=false,...)`
- Never call prod `/api/admin/recompose-client`
- Never write `clients.system_prompt`
- Never call `updateAgent()` on urban-vibe
- Never modify `niche_custom_variables` (deploy-prep step, not dryrun step)

Commit + push + open PR. Update `D445.md` to track urban-vibe-dryrun-complete-awaiting-owner. Update memory.

---

## What "done" looks like

A single PR (no merge) containing:
- `CALLINGAGENTS/00-Inbox/urban-vibe-investigation.md` (Phase 1 blocker resolutions)
- `CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-pre-migration.json`
- `CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-dryrun.json`
- `CALLINGAGENTS/00-Inbox/urban-vibe-snowflake-diff.txt`
- `CALLINGAGENTS/00-Inbox/urban-vibe-migration-decision.md`
- `CALLINGAGENTS/Tracker/D445.md` updated (urban-vibe row added)
- `scripts/dryrun-urban-vibe.ts`

PR title: `docs: D445 urban-vibe snowflake migration dry-run + investigation + decision doc`
PR body: link to `urban-vibe-migration-decision.md`. Tag Hasan with "Ray's call: GO/TWEAK/NO-GO?"

Tell Hasan in chat: "Dryrun + investigation complete. PR #N. Decision needs Ray, but you'll relay. Read TL;DR + 9 risk-area sections + 5 blocker resolutions."

---

## Anti-footguns (carried from Hasan dryrun)

- **Stash any working tree changes BEFORE cutting branch.** PR #65 hit this — phase A concierge work was in the working tree and would have polluted the dryrun branch. `git stash push -u -m "pre-urban-vibe-dryrun-stash"` first.
- **Pre-push hooks may flake on Turbopack race conditions** if a parallel session is also running builds. Hasan authorized `--no-verify` on PR #65 because the commit was docs-only. Apply same rule here.
- **dotenv path:** use `dotenvConfig({ path: '.env.local' })` not `import 'dotenv/config'` — the latter loads `.env` which doesn't exist.
- **Result field names:** `.preview` and `.currentPrompt`, not `.newPrompt` or `.prompt`.
- **Prod API ignores dryRun body param** — never call `POST /api/admin/recompose-client`.

## Resume command

If interrupted mid-session, resume command is: **"resume urban vibe dryrun"**. Memory routes here.
