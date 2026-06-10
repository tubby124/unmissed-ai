# Prompt Write Paths

**Created:** 2026-06-04
**Source:** Track 4 audit + system-prompt-writer-allowlist test
**Purpose:** Canonical reference for every code path that writes `clients.system_prompt`. New contributors learn the rule by reading this doc; the test [`src/lib/__tests__/system-prompt-writer-allowlist.test.ts`](../../src/lib/__tests__/system-prompt-writer-allowlist.test.ts) enforces the rule structurally.

---

## The architectural rule (Hasan, 2026-06-04 reformation mandate)

> Every future provision must go through the slot pipeline as if onboarded through the website.

Concretely: the `clients.system_prompt` column is the agent's runtime prompt. It is a derived artifact. The slot pipeline (`buildPromptFromIntake` + `regenerateSlots` + the patcher chain in `applyPromptPatches`) is the single source of structural truth for how that artifact gets composed. Any code path that writes to `system_prompt` outside this pipeline is either an intentional escape hatch or silent drift.

The system-prompt-writer-allowlist test enforces this by failing CI when an unaudited file writes the column.

---

## The 11 audited writers

Updated 2026-06-04. If you add a new writer, update both this doc AND `ALLOWED_WRITERS` in the test.

### Canonical settings PATCH path (1)

| File | Pattern | Notes |
|---|---|---|
| [src/app/api/dashboard/settings/route.ts](../../src/app/api/dashboard/settings/route.ts) | `.update(updates)` where `updates` was built by `buildUpdates` + `applyPromptPatches` + `regenerateSlots` | THE canonical user-facing PATCH. Routes through every layer: patcher chain → slot regen → DB write → reseedKnowledge → updateAgent → field_sync_status overlay. |

### Provisioning via `buildPromptFromIntake` (4)

| File | When | Sync? |
|---|---|---|
| [src/app/api/provision/trial/route.ts](../../src/app/api/provision/trial/route.ts) | Trial signup | Yes — at provision via `createAgent` |
| [src/app/api/dashboard/generate-prompt/route.ts](../../src/app/api/dashboard/generate-prompt/route.ts) | Onboarding initial generation | Yes — at provision via `createAgent` |
| [src/app/api/dashboard/regenerate-prompt/route.ts](../../src/app/api/dashboard/regenerate-prompt/route.ts) | "Regenerate from intake" (Day-1 edit panel) | Yes — separate `updateAgent` after write |
| [src/app/api/admin/test-activate/route.ts](../../src/app/api/admin/test-activate/route.ts) | Admin test-mode activation | Yes — `createAgent`/`updateAgent` |

### Slot-pipeline canonical helpers (2)

| File | Used by | Notes |
|---|---|---|
| [src/lib/slot-regenerator.ts](../../src/lib/slot-regenerator.ts) | Settings PATCH, variables PATCH, auto-regen | IS the slot pipeline. Section-level + full regen. |
| [src/lib/auto-regen.ts](../../src/lib/auto-regen.ts) | Async low-stakes settings changes | Wraps `buildPromptFromIntake` + `updateAgent` |

### Targeted patcher writes (slot-pipeline-compatible) (2)

| File | When | Sync? |
|---|---|---|
| [src/app/api/dashboard/variables/route.ts](../../src/app/api/dashboard/variables/route.ts) | Variable PATCH (PromptVariablesCard, AdminRecomposePanel) | Yes — via `regenerateSlots` + `syncToUltravox` |
| [src/app/api/auth/google/callback/route.ts](../../src/app/api/auth/google/callback/route.ts) | OAuth completion (Google Calendar connect) | Yes — `patchCalendarBlock` (slot-compatible) + `updateAgent` + tools sync |

### Append-style writers (slot-pipeline-unification candidates) (3)

These three append text to `system_prompt` directly rather than routing through the slot composer. They all sync Ultravox but bypass the patcher chain. **Refactor candidates** — see "Open work" below.

| File | When | Sync? | Refactor opportunity |
|---|---|---|---|
| [src/app/api/dashboard/analysis/[id]/route.ts](../../src/app/api/dashboard/analysis/[id]/route.ts) | Auto-apply analytics recommendation | Yes — full `updateAgent` after | Route through `extra_qa` (via `reseedKnowledgeFromSettings`) instead of bolting text onto the prompt |
| [src/app/api/dashboard/settings/prompt-versions/route.ts](../../src/app/api/dashboard/settings/prompt-versions/route.ts) | Prompt version rollback | Yes — full `updateAgent` after | Legitimate "undo" path. Content was previously vetted by `insertPromptVersion`. Leave as-is. |
| [src/lib/learning-loop/approval.ts](../../src/lib/learning-loop/approval.ts) | Owner approves a learning-loop suggestion (system_prompt_append patch type) | Yes — full `updateAgent` + `insertPromptVersion` after | Route through `extra_qa` or `business_facts` when the suggestion is FAQ-like, so smart-promoted answers reseed the KB instead of bolting text. See [niche-completeness-profile.md](niche-completeness-profile.md) and [settings-change-reconciler.md](settings-change-reconciler.md). |

### Admin escape hatches (2 — flagged for hardening)

| File | When | Sync? | Hardening TODO |
|---|---|---|---|
| [src/app/api/admin/save-prompt/route.ts](../../src/app/api/admin/save-prompt/route.ts) | Admin pastes prompt in test panel | Yes — full callTemplate rebuild | Wrap with audit trail: require `change_description`, insert `admin_audit` row, Telegram alert ops on every use |
| [src/app/api/admin/backfill-sms-prompt/route.ts](../../src/app/api/admin/backfill-sms-prompt/route.ts) | Admin bulk migration | **No — DB-only update** | Add `triggerUltravoxSync: true` post-step so bulk migrations don't leave Ultravox stale until next setting change |

---

## How to add a new write path

Default answer: **don't.** Use one of the canonical paths above.

If you actually need a new path:

1. Document the WHY (one-line rationale) — what makes this not fit `PATCH /api/dashboard/settings` or `regenerateSlots()`?
2. Add an entry to `ALLOWED_WRITERS` in `src/lib/__tests__/system-prompt-writer-allowlist.test.ts` with the rationale
3. Add a row to this doc under the right category
4. If the path skips `updateAgent`, document the assumed manual re-sync trigger (don't leave drift unexplained)
5. PR title should include `[prompt-write-path]` so reviewers know to look hard

---

## Why a few patterns aren't allowed by the test

| Bad pattern | Why | Fix |
|---|---|---|
| `await supabase.from('clients').update({ system_prompt: rawText })` in a non-allowlisted file | Bypasses patcher chain + slot regen + field_sync_status | Route through one of the 11 audited writers, OR get explicit allowlist entry |
| Skipping `updateAgent()` after a prompt change | DB and live agent drift silently until next sync trigger | Always call `updateAgent` (or route through a helper that does — `syncToUltravox` in settings/route.ts, or `regenerateSlots` which syncs internally) |
| Conditional `updateAgent` based on env or flag without telemetry | "Sometimes synced, sometimes not" is the worst failure mode | Always log the decision, write `last_agent_sync_status` to DB |

---

## Open work (2026-06-04 — proposed, not shipped)

Sourced from Track 4 audit + the smart-promotion vision in [matrix-test-findings note](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion.md):

1. **Route `learning-loop/approval.ts` system_prompt_append through `extra_qa`** — turns approved learning into reseeded KB instead of bolted text. Closes the smart-promotion loop properly. Needs a `category: 'faq'` discriminator on the suggestion row.
2. **Route `dashboard/analysis/[id]/route.ts` auto-apply through `business_facts` or `extra_qa`** — same logic; recommendation flows through KB pipeline.
3. **Add `triggerUltravoxSync: true` post-step to `admin/backfill-sms-prompt`** — eliminates deferred-sync gap. One-line change.
4. **Wrap `admin/save-prompt` with audit trail** — `change_description` required, `admin_audit` row inserted, Telegram alert. Doesn't restrict the escape hatch but makes use visible.
5. **Build the `SettingsChangeReconciler`** — see [settings-change-reconciler.md](settings-change-reconciler.md). Replaces the four independent regen entry points with a single orchestrator.

---

## Cross-references

- Test enforcing this doc: [src/lib/__tests__/system-prompt-writer-allowlist.test.ts](../../src/lib/__tests__/system-prompt-writer-allowlist.test.ts)
- Field-level companion (every PATCH-accepted field): [control-plane-mutation-contract.md](control-plane-mutation-contract.md)
- Settings field write surface: [src/lib/settings-schema.ts](../../src/lib/settings-schema.ts) (FIELD_REGISTRY)
- Vault audit notes:
  - [Projects/unmissed/2026-06-04-settings-mutation-matrix.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-settings-mutation-matrix.md)
  - [Projects/unmissed/2026-06-04-session-complete-tracks-1-4.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-session-complete-tracks-1-4.md)
