# Settings-Change Reconciler — Design Spec

**Status:** SPEC — not implemented. Needs Hasan sign-off on topology before code.
**Created:** 2026-06-04
**Source:** 2026-06-04 Settings Mutation Matrix audit + Hasan's "settings change → whole system updates" vision
**Author:** claude-code-session

---

## Problem statement

Today, when a user saves a field in the dashboard, four independent subsystems may react:

```
PATCH /api/dashboard/settings
  ├─ applyPromptPatches()         (patcher chain — section_edit, agent_name, voice_style, etc.)
  ├─ regenerateSlots()             (slot regen — for niche_custom_variables, city, booking_enabled D276)
  ├─ scheduleAutoRegen()           (async — for LOW_STAKES_REGEN_FIELDS, fire-and-forget)
  └─ voicemailFullRebuild()        (for voicemail/message_only clients)
```

Each path independently:
- Decides whether to fetch the current prompt
- Decides which patches/regens to run
- Decides whether to call `updateAgent()`
- Decides whether to reseed knowledge
- Writes `last_agent_sync_status`

This is the root of three pains:
1. **Drift risk** — adding a new field to the PATCH route without adding it to all four decision matrices silently drops one of the reactions. The voicemail-slot-parity test catches some of this; FIELD_REGISTRY catches some more; but there's no single coordinator.
2. **Race window** — `scheduleAutoRegen` fires async. PATCH returns `ok:true` immediately. Owner sees the dashboard update but the agent may still be regenerating in the background. D449 field_sync_status overlay partially mitigates but doesn't eliminate.
3. **Smart-system blocker** — the vision is "settings change → KB + prompt + agent all updated in lock-step." Today's four-paths architecture can't easily add a fifth "and also reseed promoted FAQs from `v_hot_knowledge_queries`" without each path being modified independently.

---

## Proposed design

### Single entry point

```ts
// src/lib/settings-change-reconciler.ts (NEW)

export type ChangeKind =
  | 'identity'           // agent_name, business_name, owner_name, display_name
  | 'voice'              // voice_style_preset, agent_voice_id
  | 'mode'               // call_handling_mode, agent_mode, booking_enabled
  | 'capability'         // sms_enabled, forwarding_number, transfer_conditions, knowledge_backend
  | 'knowledge'          // business_facts, extra_qa, services_offered
  | 'per_call_context'   // hours, after_hours, injected_note, context_data, staff_roster, service_areas
  | 'variables'          // niche_custom_variables, city
  | 'admin_runtime'      // twilio_number, monthly_minute_limit, telegram tokens, knowledge_backend
  | 'day1'               // today_update, business_notes, fields_to_collect, pricing_policy, etc.
  | 'outbound'           // outbound_*
  | 'notifications'      // alert_*, telegram_*, email_*
  | 'system_prompt_direct'  // direct prompt edit (admin or section edit)

export interface ReconcileInput {
  clientId: string
  diff: Record<string, { before: unknown; after: unknown }>  // built by buildUpdates output vs current DB row
  role: 'admin' | 'owner'
  triggeredBy: { userId: string; surface: 'settings_patch' | 'variables_patch' | 'oauth_callback' | 'analysis_apply' | 'learning_loop_approve' | 'admin_save' }
}

export interface ReconcileResult {
  reactions: ReactionResult[]
  fieldSyncStatus: Record<string, 'synced' | 'pending' | 'failed' | 'not_applicable'>
  ultravoxSynced: boolean
  totalLatencyMs: number
}

export async function reconcile(input: ReconcileInput): Promise<ReconcileResult>
```

### Reaction planner

Given the `diff`, the planner enumerates which reactions to run AND in which order. Reactions:

```ts
type Reaction =
  | { kind: 'patch_section', section: string }            // patcher chain step
  | { kind: 'regenerate_slots', slots: SlotId[] }          // slot regen
  | { kind: 'voicemail_rebuild' }                          // full rebuild
  | { kind: 'reseed_knowledge' }                           // reseedKnowledgeFromSettings
  | { kind: 'sync_agent', flags: AgentFlags }              // updateAgent + buildAgentTools
  | { kind: 'reseed_hot_queries' }                         // NEW — auto-promote frequent KB hits (Tier 3 future)
  | { kind: 'insert_prompt_version', meta: { changeDescription: string } }
  | { kind: 'notify_owner_drift', reason: string }         // when sync fails or partial-success
```

Planner = pure function `(diff, ChangeKind classifier) → Reaction[]`. Easy to unit-test.

### Topological execution

Reactions run in canonical order with explicit dependencies:

```
1. patch_section            (must run before regen — section content feeds slot composer)
2. voicemail_rebuild        (mutually exclusive with regen — pipeline switch)
3. regenerate_slots         (depends on patch_section)
4. reseed_knowledge         (independent — can run parallel with regen, but blocks sync)
5. reseed_hot_queries       (independent — can run parallel)
6. sync_agent               (depends on regen + reseed_knowledge for tool registration)
7. insert_prompt_version    (depends on regen — final prompt text needed)
8. notify_owner_drift       (depends on sync_agent failure)
```

The reconciler executes this DAG. Each reaction returns a result; failures don't abort downstream reactions that don't depend on it.

### Field sync status (D449 unified)

Today's D449 overlay does per-field sync status as a best-effort post-hoc check. With the reconciler, every reaction emits a status update per affected field. The overlay becomes a side-effect of the DAG execution, not a separate calculation.

```json
{
  "field_sync_status": {
    "agent_name": "synced",
    "niche_custom_variables.GREETING_LINE": "pending",   // regen still running async
    "business_facts": "synced",
    "extra_qa": "synced",
    "queryKnowledge_tool": "synced"
  }
}
```

---

## What this enables

1. **One place to add new reactions.** Want to add "auto-promote queries hit ≥ 5 times in 30 days to extra_qa"? Add a `reseed_hot_queries` reaction. Wire it into the planner with its dependencies. Done. No need to modify settings/route.ts or variables/route.ts or auto-regen.ts separately.
2. **One place to track sync truth.** D449 stops being best-effort; it becomes the DAG's emitted state.
3. **One place to test.** The planner is pure. Given a diff, the expected reaction list is deterministic. Add a planner test fixture per change kind.
4. **Easier slot-pipeline unification.** The 3 append-style writers in `prompt-write-paths.md` can be refactored to emit a `ReconcileInput` to this reconciler instead of writing system_prompt directly.

---

## Migration strategy (non-breaking)

This can ship behind a feature flag without disrupting Velly or any active client.

**Phase 0 — Shadow run (read-only telemetry)**
- Reconciler runs alongside the current four-paths code on every settings PATCH
- Diffs the reaction list it would have run vs what actually ran
- Logs discrepancies to a new telemetry table `reconciler_shadow_diffs`
- Surface to dashboard: "Reconciler would have done X but production did Y" — review weekly

**Phase 1 — Opt-in flip (per-client)**
- Add `clients.use_settings_reconciler` boolean column (default false)
- When true: settings PATCH delegates to the reconciler instead of the four-paths code
- Test on `e2e-test-plumbing-co` first, then opt in remaining clients gradually

**Phase 2 — Default-on**
- Flip default to true
- Keep the old paths as fallback for 30 days
- Then delete the old paths

Throughout: Velly stays on the old path until Hasan explicitly migrates it.

---

## What this does NOT change

- The slot composer (`buildPromptFromIntake` / `composeSlots`) — same canonical builder
- The patcher chain (`prompt-patcher.ts`) — same surgical patchers
- The Ultravox sync logic (`updateAgent` / `buildAgentTools`) — same flags assembly
- The knowledge pipeline (`reseedKnowledgeFromSettings`, `embedChunks`) — same surfaces

The reconciler is an orchestrator. It doesn't replace any of the pieces. It coordinates them.

---

## Open questions for Hasan

1. **Where does the reconciler live?** New module `src/lib/settings-change-reconciler.ts`, or extend the existing `slot-regenerator.ts`?
2. **Telemetry destination for shadow run?** New table `reconciler_shadow_diffs` or extend `client_events`?
3. **Per-client opt-in flag?** `clients.use_settings_reconciler` boolean — or feature flag table?
4. **Failure mode for partial-success?** If `reseed_knowledge` succeeds but `sync_agent` fails, do we revert? Or accept eventual consistency + Telegram alert (current behavior)?
5. **Hot-set baking strategy?** When `reseed_hot_queries` decides a query should be promoted, does it write to `extra_qa` (durable, owner-visible) or a new `auto_promoted_qa` column (separate, more easily reverted)?

---

## Estimated effort

- Planner + reaction registry: 1-2 days
- Shadow run integration: 1 day
- Telemetry table + dashboard surface: 1 day
- Per-client opt-in flag + migration: 1 day
- Documentation + tests: 1 day

Total: ~1 week to shadow-run-ready, ~2 weeks to default-on. Single engineer.

---

## References

- Settings mutation matrix audit: [Projects/unmissed/2026-06-04-settings-mutation-matrix.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-settings-mutation-matrix.md)
- Test findings + smart-promotion vision: [Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion.md)
- Companion docs:
  - [control-plane-mutation-contract.md](control-plane-mutation-contract.md) — field-level mutation truth
  - [prompt-write-paths.md](prompt-write-paths.md) — file-level allowlist of writers
  - [niche-completeness-profile.md](niche-completeness-profile.md) — proactive "you haven't configured X yet" loop
