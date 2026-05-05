---
type: tracker
status: open
priority: P1
phase: TBD-prompt-safety
related:
  - Features/Provisioning
  - Features/Slot-Pipeline
  - Tracker/D-NEW-recompose-respects-hand-tuned
  - Tracker/D-NEW-provision-field-completeness-test
  - Tracker/D-NEW-agent-name-provision-write
  - Clients/velly-remodeling
opened: 2026-05-05
---

# D-NEW — Provision-time slot-coverage gate (no client goes live with empty slots AND hand_tuned=false)

## Status
**OPEN — P1** — surfaced 2026-05-05 during Velly audit. Manual SOP update applied (Steps 9 & 10 in `unmissed-concierge-provisioning-bypass.md`), but no test or runtime gate enforces it.

## Problem
The 4 known `clients.insert()` provision routes (per memory `unmissed-provision-path-parity-audit.md`) can leave a row in a "schrodinger's prompt" state:
- `system_prompt` is set (hand-written or Sonar-generated)
- `hand_tuned = false`
- All slot fields empty: `business_facts = NULL or []`, `extra_qa = NULL or []`, `services_offered = NULL`, `business_hours_*` empty
- `status = 'active'`

In this state, the row passes all current health checks AND is one `recomposePrompt()` call away from prompt corruption (sibling D-item D-NEW-recompose-respects-hand-tuned). Velly was in this state for 7 days.

The class of bug: the system has no concept of "this client is in a half-provisioned state and any prompt operation will produce garbage."

## Required behavior

### Layer 1 — Static test (immediate, P1)
Add a Vitest in `tests/architecture/` (next to `agent-name-provision.test.ts`):

```ts
// tests/architecture/active-clients-have-prompt-source.test.ts
test('every active client has hand_tuned=true OR slot coverage >= MIN_SLOTS', async () => {
  const MIN_BUSINESS_FACTS = 5;
  const MIN_EXTRA_QA = 0; // optional but recommended
  const REQUIRED_NON_NULL = ['services_offered', 'business_hours_weekday'];

  const { data: clients } = await supabase
    .from('clients')
    .select('slug, hand_tuned, business_facts, extra_qa, services_offered, business_hours_weekday')
    .eq('status', 'active');

  const violations = clients.filter(c => {
    if (c.hand_tuned === true) return false; // hand-tuned is exempt
    const factCount = (c.business_facts || []).length;
    const qaCount = Array.isArray(c.extra_qa) ? c.extra_qa.length : 0;
    const hasRequired = REQUIRED_NON_NULL.every(f => c[f] != null && c[f] !== '');
    return factCount < MIN_BUSINESS_FACTS || !hasRequired;
  });

  expect(violations).toEqual([]); // fail with the exact list of broken slugs
});
```

This is a smoke test against prod-shape data — runs in CI and fails the build if a future PR ships a row in landmine state. Pattern matches D-NEW-provision-field-completeness-test (regression-guard style).

### Layer 2 — Provision route gate (follow-up, P2)
Each `clients.insert()` path validates: if `system_prompt` is being set AND `hand_tuned !== true` AND slot coverage is below threshold, throw with a descriptive error. Forces the provision code itself to either populate slots or explicitly mark hand_tuned.

This is more invasive — touches 4 code paths — but is the durable fix. Layer 1 buys time to land Layer 2 cleanly.

### Layer 3 — Admin UI badge (follow-up, P2)
On every client detail page, show a "⚠️ Recompose Risk" badge when `hand_tuned=false` AND slot coverage low. One-click "Mark as hand-tuned" or "Run intake-to-slot backfill" actions.

## Acceptance criteria
- [ ] Layer 1 test added under `tests/architecture/`
- [ ] Test runs against the same Supabase project that prod uses (or a snapshot fixture matching prod schema)
- [ ] Allowlist mechanism for known-exempt clients (e.g., test fixtures, paused trials)
- [ ] Layer 2 + 3 filed as follow-up D-items if not bundled

## Why this is a separate D-item
- D-NEW-provision-field-completeness-test guards single-field drops (e.g., `agent_name` missing in one path). This D-item guards the **multi-field combination** "active + non-hand-tuned + empty slots" — a different failure mode that no single-field test catches.
- D-NEW-recompose-respects-hand-tuned (sibling) is the runtime guard. This is the provision-side guard. Defense-in-depth.

## Connections
- → [[Tracker/D-NEW-recompose-respects-hand-tuned]] (runtime-side sibling)
- → [[Tracker/D-NEW-provision-field-completeness-test]] (single-field meta-pattern)
- → [[Tracker/D-NEW-agent-name-provision-write]] (recent provision-drop bug)
- → [[Features/Provisioning]]
- → [[Features/Slot-Pipeline]]
- → [[Clients/velly-remodeling]] (the near-miss)
- → memory: `unmissed-provision-path-parity-audit.md` (the 4-paths pattern)
- → memory: `unmissed-concierge-provisioning-bypass.md` (Steps 9 & 10 are the manual SOP this D-item codifies)
