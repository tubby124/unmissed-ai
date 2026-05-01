---
type: tracker
status: partial
priority: P2
phase: TBD-after-Phase-B-1
related:
  - Architecture/Control-Plane-Mutation-Contract
  - Features/Provisioning
  - Tracker/D-NEW-agent-name-provision-write
opened: 2026-04-30
---

# D-NEW — Provision-time field completeness test (meta-fix)

## Status
**PARTIAL — P2** — Phase B Step 1 (`fix/agent-name-provision-niche-other` branch, 2026-04-30 PM) shipped a path-completeness regression test for `agent_name` specifically. See `agent_name — path-completeness (regression guard)` block in [src/lib/__tests__/agent-name-provision.test.ts](src/lib/__tests__/agent-name-provision.test.ts) — it reads each of the 4 known `clients.insert()` route files and asserts `agent_name:` appears in the payload. Fails the build if a future PR drops the field from any path. Verified by removing the line and watching the test fail.

**Remaining for full closure:** the FIELD_REGISTRY-wide enumeration (every PROMPT_AFFECTING + RUNTIME_ONLY user-editable field gets a similar lock). This is more involved — different field classes have different provision-time behaviors. P2 still.

## Problem
The `agent_name` provision drop bug (D-NEW-agent-name-provision-write) is a single instance of a recurring class: a field in `FIELD_REGISTRY` (or `clients` schema) is set/edited via the dashboard but silently NOT written during provision. The user notices when the dashboard renders `—` instead of the value they typed at intake.

This has happened at least twice in the codebase history per audit notes. There is no test that asserts: "every field that has a settings PATCH path also has a provision write path."

## Why this is a separate D-item
Phase B Step 1 fixes the specific Velly bug (`agent_name` for `niche=other`). This tracker is the *systemic* prevention — a test that catches the next instance before it ships. Different scope, file separately.

## Required behavior
Add a Jest/Vitest test (location TBD — likely `tests/architecture/`) that:
1. Reads `FIELD_REGISTRY` from `src/lib/settings-schema.ts`
2. For each field marked as user-editable via PATCH:
   - Verifies the field is included in `provision/trial/route.ts` `clients.insert()` block (or has an explicit allowlist exception with a comment)
   - Verifies `intake-transform.ts` `toIntakePayload()` propagates the field
3. Fails CI if a new editable field lands without a corresponding provision write path

## Acceptance criteria
- [ ] Test file added under `tests/architecture/`
- [ ] Test asserts contract for current `FIELD_REGISTRY` (snapshot the current state)
- [ ] Test fails if an editable field is added without provision wiring
- [ ] Allowlist comment pattern documented for genuinely provision-immutable fields (e.g., `niche` itself)
- [ ] CI runs the test on every PR

## Why P2 not P1
- D-NEW-agent-name-provision-write fixes the immediate symptom
- This is preventative, not corrective
- Best built when adding tests is the actual focus, not bundled with bug fix
- Premature if there are only 2 historical instances of the class — wait for the 3rd before committing engineering time

## Connections
- → [[Architecture/Control-Plane-Mutation-Contract]] (the contract this test enforces)
- → [[Tracker/D-NEW-agent-name-provision-write]] (the specific bug this prevents recurring)
- → [[Features/Provisioning]]
