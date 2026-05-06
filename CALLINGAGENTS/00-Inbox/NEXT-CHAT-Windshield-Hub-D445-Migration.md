# Next Chat — D445 Windshield Hub Migration to Slot Framework

> **Cold-start prompt — paste this into a fresh Claude Code session.**
> **Resume command:** `migrate windshield hub to slots`
> **Why this is happening now:** Hasan starts charging Mark next month. Paying customer = dashboard self-edit becomes a real product surface; Mark needs to be able to edit settings without breaking the agent. Slot-composed prompts make settings PATCHes regenerate the right section instead of needing manual prompt edits.

---

## Current state (verified 2026-05-05 night)

| Field | Value | Notes |
|---|---|---|
| `slug` | `windshield-hub` | Mark Johnson's auto glass shop |
| `hand_tuned` | `true` | Defensively locked. PR #81 guard refuses recompose unless `forceRecompose=true` |
| `system_prompt` length | 8,586 chars | Hand-tuned, working in production |
| Slot markers in prompt | **0** | Legacy-monolithic format |
| `business_facts` count | 12 | Already populated — good |
| `extra_qa` count | 9 | Already populated — good |
| `services_offered` | null | Needs backfill from prompt |
| `business_hours_weekday` | populated | OK |
| `business_hours_weekend` | null | Verify if Mark works weekends |
| `fields_to_collect` | empty | Needs backfill |
| `transfer_conditions` | null | Needs backfill |
| `knowledge_backend` | `pgvector` | OK |
| `forwarding_number` | check | Required for transferCall tool |

**Why this is the LOWEST-RISK D445 migration of the 3 remaining legacy clients:**
- Already has 12 facts + 9 QA populated → slot composition has real data to work with
- Niche = `auto_glass` → niche template is the most-tested pipeline (canary clients, promptfoo coverage)
- 8,586-char prompt is shorter than Hasan's (8,342) but cleaner — no dual-license / multi-brand context to lose
- Mark's call patterns are well-understood (windshield repair / replacement intake)

---

## Standing risks (from prior D445 dryruns)

1. **Prompt growth** — slot-composed output typically 1.5-2.5x input. Expect 12-22K chars. Hard max is 20K (PR #78 trim). If output exceeds, niche template needs further trim BEFORE migration.
2. **Lost hand-tuned context** — anything in the current prompt that doesn't have a corresponding DB column will be DROPPED. Audit the diff line-by-line.
3. **Voice / tone drift** — slot pipeline normalizes voice patterns. Mark's agent has a specific voice that callers know. Test calls REQUIRED before deploy.
4. **Tool state preservation** — `clients.tools` is runtime authoritative (PR #71 fixed). Migration must not touch the tools array.

---

## Pre-flight (cold-start in next chat)

1. Read this whole doc first
2. Read `CALLINGAGENTS/Tracker/D445.md` (universal playbook)
3. Read `CALLINGAGENTS/Tracker/D-NEW-recompose-respects-hand-tuned.md` — confirms `forceRecompose=true` is now required since `hand_tuned=true`
4. Read `scripts/dryrun-urban-vibe.ts` — pattern to copy for Windshield Hub
5. Read `CALLINGAGENTS/00-Inbox/hasan-migration-decision.md` — explains why Hasan was deferred (avoid same trap with Mark)

## Phase A — DRYRUN (no DB writes, no Ultravox sync)

```bash
# Copy dryrun-urban-vibe.ts → dryrun-windshield-hub.ts
# Adjust client_id query, run with forceRecompose=true (required because hand_tuned=true)
npx tsx scripts/dryrun-windshield-hub.ts > /tmp/windshield-dryrun.json
```

Compare:
- Current stored prompt (8,586 chars)
- Slot-pipeline output (expect 12-22K)
- Diff section by section
- Identify any Mark-specific content that would be dropped (insurance handling, after-hours emergencies, specific shop policies)

## Phase B — Backfill missing slot fields

Before migrating, populate any null DB fields that the current prompt has content for:
- `services_offered` from prompt's services section
- `business_hours_weekend` if Mark works weekends
- `transfer_conditions` from prompt's "transfer to Mark when..." block
- `fields_to_collect` from intake section
- Any `niche_*` overrides (e.g., `niche_emergency`, `niche_pricingModel`) → store in `niche_custom_variables`

This is the same backfill pattern used on Velly tonight. Reference Velly's row for the JSON shape.

## Phase C — Get Hasan's explicit go-ahead

Show Hasan:
- Current prompt (full)
- Proposed slot-composed prompt (full)
- Side-by-side diff highlighting losses
- Acceptance criteria: "I am OK losing X, Y, Z" — Hasan signs off

DO NOT proceed without Hasan's explicit "yes apply migration."

## Phase D — Test calls FIRST (still on hand-tuned prompt)

Mark's test number or Hasan's test DID — make 3 calls covering:
- Standard windshield repair intake
- Insurance question
- Transfer to Mark / "speak to a human"
- Pricing question
- Confirm baseline behavior

## Phase E — Apply migration

```ts
// In a one-off script (NOT via admin UI):
const result = await recomposePrompt(
  windshieldClientId,
  hasanUserId,
  false,      // dryRun
  true,       // forceRecompose — REQUIRED due to hand_tuned=true (PR #81 guard)
)
```

Then immediately:
- Verify `clients.system_prompt` updated
- Verify `prompt_versions` audit row created
- Verify Ultravox `callTemplate.systemPrompt` PATCHed (auto via savePromptAndSync)
- Verify `clients.tools` UNCHANGED (D442 lesson)

## Phase F — Test calls AFTER

Same 3-5 scenarios as Phase D. Compare:
- Voice/tone preserved
- Intake fields collected
- Pricing handled correctly
- Transfer fires on right triggers
- Knowledge tool returns relevant answers

If ANY scenario regresses → IMMEDIATE ROLLBACK:
```sql
-- Rollback prompt to prior version
UPDATE clients SET system_prompt = (
  SELECT system_prompt_text FROM prompt_versions
  WHERE client_id = '<windshield-id>'
  ORDER BY version DESC LIMIT 1 OFFSET 1
)
WHERE id = '<windshield-id>';
-- Then PATCH Ultravox to match
```

## Phase G — Optional: flip hand_tuned=false

Only AFTER 7+ days of clean post-migration calls. Flips Mark's row to "managed by slot pipeline" so future settings PATCHes auto-regenerate the right slot section.

```sql
UPDATE clients SET hand_tuned = false WHERE slug = 'windshield-hub';
```

DO NOT do this in the same session as the migration. Let it bake.

---

## What's already done (you don't need to redo)

- ✅ PR #81 (recompose hand_tuned guard) — merged 2026-05-05 23:41 UTC, deploy SUCCESS
- ✅ PR #82 (provision slot coverage on all 4 insert paths) — merged 2026-05-06 01:16 UTC, deployed
- ✅ Velly fully on slot framework (13 facts, 8 QA, 7 fields, services, hours, transfer)
- ✅ Manual SOP Steps 9 & 10 trimmed (hand_tuned=true is the only mandatory SQL now)

---

## Files to reference

- Universal D445 playbook: `CALLINGAGENTS/Tracker/D445.md`
- Urban Vibe completed example: `CALLINGAGENTS/00-Inbox/NEXT-CHAT-Urban-Vibe-Deploy.md`
- Hasan deferred decision: `CALLINGAGENTS/00-Inbox/hasan-migration-decision.md`
- Recompose guard contract: `CALLINGAGENTS/Tracker/D-NEW-recompose-respects-hand-tuned.md`
- Slot helper contract: `CALLINGAGENTS/Tracker/D-NEW-provision-slot-coverage-gate.md`
- Dryrun script template: `scripts/dryrun-urban-vibe.ts`
- Slot regenerator source: `src/lib/slot-regenerator.ts` (see `recomposePrompt`)
- Intake → slot mapping: `src/lib/intake-transform.ts` (`buildSlotInsertFields`)
- Mark Johnson client note: `CALLINGAGENTS/Clients/windshield-hub.md` (read for niche-specific context)

---

## Acceptance criteria for migration to be called DONE

- [ ] Phase A dryrun shows no critical context loss
- [ ] Phase B backfill populated all null slot fields where prompt had data
- [ ] Phase C: Hasan signed off on the diff
- [ ] Phase D: 3+ pre-migration baseline test calls captured
- [ ] Phase E: migration applied, all 3 truths in sync (DB, Ultravox stored, runtime tools)
- [ ] Phase F: 3+ post-migration test calls match baseline behavior
- [ ] Phase G: deferred to +7 days; create calendar reminder

If acceptance criteria fail at any step → ROLLBACK and document why. The migration is not urgent enough to ship broken.
