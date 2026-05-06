---
type: tracker
status: not-started
priority: P2
phase: TBD-prompt-safety
related:
  - Features/Slot-Pipeline
  - Tracker/D-NEW-recompose-respects-hand-tuned
  - Architecture/Control-Plane-Mutation-Contract
opened: 2026-05-06
spawned-by: D445-windshield-hub Phase E (manual pointer fix required)
---

# D-NEW — `recomposePrompt()` doesn't update `active_prompt_version_id` pointer

## Status
**not-started.** Surfaced 2026-05-06 during D445-windshield-hub Phase E migration. Manual fix applied to windshield-hub via [scripts/fix-active-prompt-version.ts](../../scripts/fix-active-prompt-version.ts).

## Problem
`recomposePrompt()` in [src/lib/slot-regenerator.ts:332](../../src/lib/slot-regenerator.ts#L332) inserts a `prompt_versions` audit row but does NOT update `clients.active_prompt_version_id` to point at the new row. The pointer keeps pointing at the prior version.

```ts
// slot-regenerator.ts:330-342 (current — missing the active pointer update)
try {
  await insertPromptVersion(svc, {
    clientId,
    content: newPrompt,
    changeDescription,
    triggeredByUserId,
    triggeredByRole: triggeredByUserId ? 'owner' : 'system',
    prevCharCount: (client.system_prompt as string).length,
  })
} catch (err) {
  console.warn(`[slot-regen] Prompt version insert failed: ${err}`)
}
```

The correct pattern lives in [src/lib/auto-regen.ts:126-138](../../src/lib/auto-regen.ts#L126-L138):

```ts
const newVersion = await insertPromptVersion(svc, { ... })
await svc.from('clients')
  .update({ active_prompt_version_id: newVersion.id })
  .eq('id', clientId)
```

## Impact

- **Runtime**: NONE. `clients.system_prompt` is the source of truth for what gets PATCHed to Ultravox. The pointer is a tracking field for audit/UI display.
- **Dashboard UX**: prompt version display will show stale "current version = v(N-1)" while DB content is actually v(N).
- **Rollback UX**: harder to identify which version is "current" when running rollback SQL — the pointer lies.

## Repro

Any `recomposePrompt(clientId, userId, dryRun=false, ...)` call. Confirmed on windshield-hub 2026-05-06:
- Pre: `active_prompt_version_id` = v28 (Mar 31)
- recomposePrompt inserts v29
- Post: `active_prompt_version_id` STILL = v28 ❌

## Fix

Match the auto-regen.ts pattern:

```ts
try {
  const newVersion = await insertPromptVersion(svc, { ... })
  await svc.from('clients')
    .update({ active_prompt_version_id: newVersion.id })
    .eq('id', clientId)
} catch (err) {
  console.warn(`[slot-regen] Prompt version insert/link failed: ${err}`)
}
```

`insertPromptVersion` already returns the new row's id (per its signature at `src/lib/prompt-version-utils.ts:41`). Just thread it through.

## Acceptance criteria

- [ ] `recomposePrompt()` updates `active_prompt_version_id` to the just-inserted version's id
- [ ] Test: dry-run + apply on a sandbox client; verify pointer matches latest `prompt_versions.id`
- [ ] Backfill all 4 founding-club clients post-D445 — sweep `active_prompt_version_id` to latest version per client
- [ ] Document in mutation contract that `active_prompt_version_id` must be updated whenever `system_prompt` is updated

## Connections
- → [[Tracker/D-NEW-recompose-respects-hand-tuned]] — same function, related guard work
- → [[Architecture/Control-Plane-Mutation-Contract]] — `system_prompt` is `DB_PLUS_PROMPT`, audit pointer should follow
