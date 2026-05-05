---
type: tracker
status: partial
priority: P1
phase: TBD-prompt-safety
related:
  - Features/Slot-Pipeline
  - Features/Provisioning
  - Architecture/Control-Plane-Mutation-Contract
  - Tracker/D-NEW-provision-slot-coverage-gate
  - Clients/velly-remodeling
opened: 2026-05-05
---

# D-NEW — `recomposePrompt()` must respect `hand_tuned=true`

## Status
**PARTIAL — runtime guards SHIPPED 2026-05-05** in PR `feat/recompose-respects-hand-tuned`. `recomposePrompt()`, `regenerateSlot()`, `regenerateSlots()` all now refuse on `hand_tuned=true` (recomposePrompt accepts `forceRecompose=true` to override; the slot-level functions have no escape hatch — flip `clients.hand_tuned=false` manually if intentional). Helper exported as `checkHandTunedGuard()`. 5 unit tests covering true/false/null/undefined/missing-key + force-override + missing-slug. All 1860 tests pass.

**Remaining (separate UX work):**
- Admin UI: surface `hand_tuned` flag visibly in `AdminRecomposePanel` (badge or warning chip near Recompose button)
- Admin UI: `RecomposeConfirmDialog` should show a hand_tuned warning state in the dialog
- Optional: bundle the queued `recomposePrompt` options-object refactor (per memory `unmissed-recompose-prompt-signature`)

## Problem
`recomposePrompt()` in `src/lib/recompose-prompt.ts` (verify path) regenerates `clients.system_prompt` by composing slot-pipeline output from `clients` row data (business_facts, extra_qa, services_offered, hours, niche template, etc.). It does not check `clients.hand_tuned` before running.

For clients that were manually provisioned with a hand-written prompt + empty slots:
- Slot composition produces an empty/garbage prompt (often the Sonar-contaminated `niche=other` template)
- Recompose OVERWRITES the hand-written 7,775-char prompt with the empty-slot output
- Client agent immediately starts saying wrong things on next call (or recompose triggers `updateAgent()` and the live Ultravox agent picks up the corrupted prompt within seconds)

Velly was 1 dashboard click away from this for 7 days (2026-04-28 → 2026-05-05). Kausar never logged in, so the bomb never went off. Audit caught it.

## Why this is a separate D-item
- D-NEW-provision-slot-coverage-gate (sibling) is the **provisioning-side** prevention — every new client must have slots OR be marked hand_tuned. This D-item is the **runtime-side** prevention — even if a row slips through with hand_tuned=false + empty slots, recompose itself refuses to wipe it.
- Defense-in-depth: both must exist. One blocks the wrong state from being created; the other blocks the destructive operation from running on the wrong state.

## Required behavior

### Option A (preferred — explicit force flag)
```ts
async function recomposePrompt(
  clientId: string,
  userId: string,
  options?: { dryRun?: boolean; forceRecompose?: boolean }
): Promise<RecomposeResult> {
  const client = await fetchClient(clientId);
  if (client.hand_tuned && !options?.forceRecompose) {
    throw new Error(
      `Refusing to recompose hand_tuned=true client "${client.slug}". ` +
      `Pass { forceRecompose: true } to override (will wipe hand-written prompt).`
    );
  }
  // ... existing logic
}
```

Per memory `unmissed-recompose-prompt-signature.md`: signature was already 4 positional booleans `(clientId, userId, dryRun, forceRecompose)` and a refactor to options object on 5th param is queued. **Bundle this D-item with that refactor** — one signature change, two guards.

### Option B (always require explicit acknowledgment, no force flag)
Stricter — recompose throws on `hand_tuned=true` regardless. Hasan must manually flip `hand_tuned=false` before recomposing. Safer but more friction; would require admin UI changes too.

Recommend Option A.

## Acceptance criteria
- [ ] `recomposePrompt()` reads `clients.hand_tuned` before running
- [ ] If `hand_tuned=true` AND `forceRecompose` not passed → throw with descriptive error
- [ ] All callers reviewed: `AdminRecomposePanel`, `scripts/recompose-brian.ts`, any cron/migration scripts, settings PATCH auto-recompose paths
- [ ] Admin UI surfaces the `hand_tuned` flag visibly (badge or warning chip near recompose button)
- [ ] Test: provision a hand_tuned=true row, attempt recompose, verify it throws
- [ ] Test: same row with forceRecompose=true, verify it runs
- [ ] Snapshot test: existing 4 active clients (hasan, exp-realty, windshield-hub, urban-vibe) — verify recompose does NOT throw on them (assumes they're hand_tuned=false; if any are hand_tuned=true, document the migration path)

## Bundling opportunity
- Combine with `unmissed-recompose-prompt-signature` refactor (options-object on 5th param)
- Combine with admin UI `RecomposeConfirmDialog` enhancement — show `hand_tuned` warning state in the dialog

## Connections
- → [[Tracker/D-NEW-provision-slot-coverage-gate]] (provision-side sibling)
- → [[Features/Slot-Pipeline]]
- → [[Architecture/Control-Plane-Mutation-Contract]] (system_prompt is DB_PLUS_PROMPT — recompose is the high-impact mutation path)
- → [[Clients/velly-remodeling]] (the near-miss that surfaced this)
- → [[Decisions/Hand-Tuned-Prompt-Protection]] (file ADR if implementing Option A vs B)
