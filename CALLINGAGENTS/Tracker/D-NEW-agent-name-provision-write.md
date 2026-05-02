---
type: tracker
status: ready-for-review
priority: P1
phase: Phase-7-Onboarding
related:
  - Features/Provisioning
  - Clients/velly-remodeling
opened: 2026-04-30
fix_branch: fix/agent-name-provision-niche-other
---

# D-NEW — `niche=other` provision path silently skips `agent_name` DB write

## Status
**READY-FOR-REVIEW** — fix branch `fix/agent-name-provision-niche-other` shipped 2026-04-30 PM. PR pending Hasan green-light on backfill dry-run (see `## Backfill — dry-run pending` below) before merge. Manual DB patch on Velly remains in place; PR rollback section preserves it.

## Problem
When a client provisions with `niche='other'`, the `agent_name` field never makes it into the `clients` table. The intake form collects an agent name (or one is generated from the niche default), but the `niche=other` branch in the provision route does not include `agent_name` in its `clients.insert()` call.

Effect: dashboard shows agent name as null, prompt patcher (`patchAgentName`) has nothing to anchor on if name is later edited via Settings, and any UI surface that reads `agent_name` (Overview AgentSpeaksCard, etc.) renders `—` until manually patched in Supabase.

## Reproduction
1. Run `/onboard-client [slug]` with niche='other' (or "haiku-suggested-other" path)
2. Complete activation
3. Query `select agent_name from clients where slug = 'X'` → returns `null`

## Likely fix surface
Provision routes — investigate:
- `src/app/api/provision/trial/route.ts`
- `src/app/api/provision/route.ts`
- `src/lib/intake-transform.ts` — `toIntakePayload()` may not be propagating `agent_name` for niche='other'
- `src/lib/activate-client.ts` — `clients.insert()` block

Expected: `agent_name` from the intake (or `NICHE_DEFAULTS.other.agentName` fallback) should always land in the row at provision time.

## Why this is a separate D-item (not bundled into Phase A concierge-status)
Phase A scope is schema additions + helpers + skill. This is a provisioning correctness bug — different concern. One-line fix expected once root cause is located.

## Acceptance criteria (locked 2026-04-30 PM, before code)

**Code change:**
- [x] Root cause documented in `## Root cause` section below with file:line refs (filed before editing — see Step 1 diagnosis)
- [x] Diff is ≤5 lines across ≤2 files: 1 line each in `generate-prompt/route.ts` + `test-activate/route.ts`
- [x] Existing tests still pass: `npm run test:all` green (1826 pass / 0 fail / 2 skipped)

**Test coverage (must add all four cases):**
- [x] **Case A — happy path:** `niche='other'`, user-supplied `agentName='TestAgent'` → `intakePayload.agent_name='TestAgent'` (covered by `agent_name — Case A` block in [src/lib/__tests__/agent-name-provision.test.ts](src/lib/__tests__/agent-name-provision.test.ts))
- [x] **Case B — fallback:** `niche='other'` + blank `agentName` → falls back to `defaultAgentNames.other` (`'Sam'`)
- [x] **Case C — control:** `niche='auto_glass'` → still works via registry default + user-supplied path
- [x] **Case D — registry coverage parity:** every niche in registry has non-empty default, and `toIntakePayload()` emits non-null `agent_name` for every niche when input is blank
- [x] **BONUS — path-completeness regression guard:** static check that asserts `agent_name:` appears in the `clients.insert(...)` payload of all 4 provisioning routes. **This is the meta-fix** — verified to fail when the field is removed from any of the four files. Closes a major slice of `D-NEW-provision-field-completeness-test`.

**Backfill (dry-run BEFORE bulk write):**
- [ ] **PENDING — Hasan to run locally** (Bash blocked from reading prod creds in transcript): see `## Backfill — dry-run pending` section below for the exact SQL + paste protocol
- [ ] Per-row decisions documented after dry-run reviewed
- [ ] Bulk UPDATE only after Hasan green-lights the dry-run list

**PR hygiene:**
- [x] PR description will include `## Rollback` section
- [ ] PR description will include dry-run SELECT output (pending Hasan's local run)
- [x] Branch off `main` (verified via `origin/main` since main is in another worktree)
- [x] Pre-commit + pre-push hooks: `npm run build` green, `npm run test:all` green

**Time-box:**
- [x] Diagnose step capped at 30 min — completed inside the box

**Out of scope (do NOT bundle):**
- Refactoring `intake-transform.ts` even if it looks crufty
- Unifying `provision/route.ts` and `provision/trial/route.ts` (known design smell — file separately if interesting)
- Adding observability/logging beyond the existing patterns
- Type-layer regression guard (file as separate D-NEW if interesting after this lands)
- FIELD_REGISTRY completeness test (filed as `D-NEW-provision-field-completeness-test` — partially closed by this PR's path-completeness test for `agent_name`; full FIELD_REGISTRY enumeration remains its own D-item)

## Backfill — dry-run pending (Hasan to run locally)

Bash sandbox blocked the live Supabase read during this session because `.env.local` would surface `SUPABASE_SERVICE_ROLE_KEY` into the transcript. **Hasan: run this locally before merging.**

```bash
cd "/Users/owner/Downloads/CALLING AGENTs" && set -a && source .env.local && set +a
SUPA="https://qwhvblomlgeapzhnuwlb.supabase.co/rest/v1/clients"
HEADERS=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

curl -s "$SUPA?agent_name=is.null&select=slug,niche,business_name,agent_name,status,subscription_status,created_at&order=created_at.desc" "${HEADERS[@]}" | jq
```

Paste the output into the PR description. For each row, mark one:
- **backfill**: pull `agent_name` from `intake_submissions.intake_json` if recoverable
- **snowflake**: document in `CALLINGAGENTS/Tracker/snowflakes.md` (create if missing)
- **skip**: inactive / abandoned trial / deleted client

Backfill recovery query (run AFTER dry-run reviewed):
```sql
-- For each slug Hasan green-lights:
UPDATE clients
SET agent_name = COALESCE(
  (SELECT intake_json->>'agent_name' FROM intake_submissions WHERE client_id = clients.id LIMIT 1),
  (SELECT intake_json->>'agentName' FROM intake_submissions WHERE client_id = clients.id LIMIT 1),
  'Sam'  -- registry default for niche=other
)
WHERE slug = '<slug>' AND agent_name IS NULL;
```

## Root cause
*(filled in 2026-04-30 PM — diagnose step, no code yet)*

**TL;DR:** The bug is NOT in the trial path. It's in the **admin "Generate Prompt"** path used by manual concierge provisioning (the route Velly went through). The `clients.insert(...)` payload in that route omits `agent_name` entirely. Same omission also exists in the admin `test-activate` route. Niche-agnostic — `niche='other'` is not the trigger; the **provisioning path** is.

### Path-by-path audit of every `clients.insert()` (4 paths total)

| # | Path | File:line | `agent_name` in insert? |
|---|------|-----------|--------------------------|
| 1 | Trial signup | [src/app/api/provision/trial/route.ts:202](src/app/api/provision/trial/route.ts#L202) | ✅ YES — `agent_name: intakePayload.agent_name \|\| null` |
| 2 | Stripe self-serve checkout | [src/app/api/stripe/create-public-checkout/route.ts:308](src/app/api/stripe/create-public-checkout/route.ts#L308) | ✅ YES — `(intakeData.agent_name as string) \|\| (intakeData.agentName as string) \|\| null` |
| 3 | **Admin Generate Prompt** | [src/app/api/dashboard/generate-prompt/route.ts:272-282](src/app/api/dashboard/generate-prompt/route.ts#L272-L282) | ❌ **NO — field is absent from payload** |
| 4 | **Admin test-activate** | [src/app/api/admin/test-activate/route.ts:189-205](src/app/api/admin/test-activate/route.ts#L189-L205) | ❌ **NO — field is absent from payload** |

### Why Velly hit it

Velly was concierge-provisioned via [`/onboard-client`](~/.claude/skills/onboard-client/SKILL.md) Path A, Step 3: "Admin clicks Generate Prompt → `POST /api/dashboard/generate-prompt` → creates Ultravox agent + `clients` row." That endpoint's first-time insert (the `else` branch at [generate-prompt/route.ts:268-293](src/app/api/dashboard/generate-prompt/route.ts#L268-L293)) writes only 9 columns: `slug, business_name, niche, status, system_prompt, ultravox_agent_id, agent_voice_id, classification_rules, timezone`. **`agent_name` never makes it.**

The route already KNOWS to handle `agent_name` for re-runs — see the existing-client branch at [generate-prompt/route.ts:70-79](src/app/api/dashboard/generate-prompt/route.ts#L70-L79) where `intakeData.db_agent_name` is preserved from the existing row. The first-time path simply forgot.

`activateClient()` doesn't compensate — its `updatePayload` at [src/lib/activate-client.ts:351-375](src/lib/activate-client.ts#L351-L375) updates ~10 fields but not `agent_name`, so it never backfills what generate-prompt dropped.

### Why the trial path looks fine

- [intake-transform.ts:216](src/lib/intake-transform.ts#L216): `agent_name: data.agentName || defaultName` — user input OR niche default
- [intake-transform.ts:150](src/lib/intake-transform.ts#L150): `defaultName = niche ? defaultAgentNames[niche as Niche] : "Sam"` — for `niche='other'`, `defaultAgentNames['other'] = 'Sam'` (registry exists at [src/lib/niche-registry.ts:355](src/lib/niche-registry.ts#L355))
- [provision/trial/route.ts:202](src/app/api/provision/trial/route.ts#L202): writes `intakePayload.agent_name || null` → 'Sam' lands in DB

So the trial path is healthy. The brief's suspect list (`provision/trial/route.ts`, `provision/route.ts`, `intake-transform.ts`, `activate-client.ts`) does not contain the actual broken file. (`provision/route.ts` is just the public intake endpoint — it inserts into `intake_submissions`, not `clients`, and shouldn't write `agent_name`.)

### Bug bucket classification (per `.claude/rules/core-operating-mode.md`)

**Path-parity bug** + **partial-failure bug**. Two of four code paths writing to the same DB column omit it. Niche-agnostic. The "trial path parity" Case D in acceptance criteria is already passing — the actual parity gap is **trial vs admin-provisioning**, not trial-via-route-A vs trial-via-route-B.

### Proposed fix surface (≤5 lines, ≤2 files — to be applied in Step 3)

1. [src/app/api/dashboard/generate-prompt/route.ts:272-282](src/app/api/dashboard/generate-prompt/route.ts#L272-L282) — add `agent_name` to insert payload. Source priority: `intakeData.db_agent_name` (preserved from existing) → `intakeData.agent_name` (snake_case from `intake_json`) → `intakeData.agentName` (camelCase from raw OnboardingData) → `defaultAgentNames[niche as Niche]` → `'Sam'`.
2. [src/app/api/admin/test-activate/route.ts:189-205](src/app/api/admin/test-activate/route.ts#L189-L205) — same one-line addition.

Both follow the pattern already used at [create-public-checkout/route.ts:308](src/app/api/stripe/create-public-checkout/route.ts#L308). Total diff: 2 files, ~2-3 lines.

### Implications for acceptance criteria framing

- **Case A (happy path, niche='other' + intake name):** broken path is admin Generate Prompt, not trial. Test should hit `/api/dashboard/generate-prompt`, not `/api/provision/trial`.
- **Case B (fallback default):** registry default `'Sam'` exists for niche='other' — the fallback chain just needs to be wired into the insert payload.
- **Case C (control, niche='auto_glass'):** also broken on admin path (niche-agnostic). The control niche should still work via trial path; regression guard is real.
- **Case D (trial path parity):** trial path already correct. The PR should re-frame this as **admin-provisioning vs trial parity** instead.

### Open questions (none blocking — flagged only)

- The brief's suspect file list will need a small correction in the next cold-start. Not changing the fix scope.
- Should `activateClient()` ALSO defensively re-write `agent_name` from `intake_json` to harden against future path drift? Out of scope per brief Rule 4 ("Don't bundle"). Recommend filing as a new D-item if desired.

## Connections
- → [[Features/Provisioning]]
- → [[Clients/velly-remodeling]] (first time the bug was surfaced)
- → [[Tracker/D-NEW-provision-field-completeness-test]] (meta-fix that prevents this class of bug recurring)
