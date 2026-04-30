# Session Handoff — 2026-04-30 PM (D442 Followup — Fix 1.5 + Fix 4 + D445 forceRecompose)

## Completed This Session

- **`210d598`** — `fix(d442): registry-readonly enforcement + phone-only capability labels` shipped to `feat/admin-redesign-phase-0-5`. 4 files, ~22 lines. Closes universal Greeting fake-control + adds "Phone calls only" footnotes to IVR/Transfer surfaces.
- **`d9d0be7`** — `feat(d445): forceRecompose bypass on recomposePrompt for snowflake migration` shipped to same branch. Added 4th positional `forceRecompose: boolean = false` to `recomposePrompt()` ([slot-regenerator.ts:526](src/lib/slot-regenerator.ts#L526)). Distinct migration changelog string. Admin-only opt-in via `force_recompose` body field. Public `variables/preview` route intentionally NOT changed — keeps the marker guard for end users.
- **D447 spec written** at [CALLINGAGENTS/Tracker/D447.md](CALLINGAGENTS/Tracker/D447.md) — Fix 1 (runtime truth on Overview). Full ticket: new `/api/dashboard/agent/runtime-state` endpoint with 60s LRU + ETag, 3-component refactor, 6-reason divergence classifier, Ultravox quota mitigation, feature-flag rollout sequence.
- **D448 investigation ticket** at [CALLINGAGENTS/Tracker/D448.md](CALLINGAGENTS/Tracker/D448.md) — universal `clients.tools.hangUp` divergence across all 5 clients. 3 hypotheses, 5-step procedure. Marked as **hard blocker for D447's tool-comparison logic.**
- **NEXT-CHAT-D442-Followup.md** rewritten at [CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md](CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md) with full cold-start including 5 verifications + 5 net-new learnings.

## Decisions Made

- **Public `variables/preview` route was deliberately NOT given the forceRecompose bypass.** Migration tooling = admin route only. Owner-facing preview keeps the marker guard for safety. Any future "let me preview the migration as the owner" must build a separate admin-gated path, not relax the public route.
- **Distinct changelog string for migration runs** ("Snowflake migration to slot format (D445 forceRecompose)") so the `prompt_versions` audit trail distinguishes one-shot migrations from routine recomposes.
- **Positional 4th boolean over options-object refactor** — chose narrow diff per code-change discipline. Flagged in memory: next caller addition makes it 5 positional booleans, which IS the breaking point.
- **D447 written with H1/H2/H3 dependency on D448** rather than guessing which array (`clients.tools` vs Ultravox `selectedTools`) is runtime-authoritative. The audit found `hangUp` missing from `clients.tools` on all 5 clients but the agents do hang up correctly — contradicts the documented mutation contract.
- **Recommended D448 first in next chat** — 30-min focused investigation that either confirms or rewrites the foundation that D447, drift-detector, command-routing, and the mutation contract all sit on top of.

## Current State

- **Prod:** No prod state changed this session. Both commits on `feat/admin-redesign-phase-0-5`, not merged to main yet.
- **Branch:** `feat/admin-redesign-phase-0-5` is now 2 commits ahead of where it was (`c2f9e06` → `d9d0be7`). Pushed to origin.
- **Build:** PASS. `test:all` PASS (pre-commit). `slot-regenerator.test.ts` 26/26 PASS. `test:settings-truth` 16/16 PASS.
- **Uncommitted on branch:** the usual vault notes (`Tracker/D437`, `Tracker/D442`, `Tracker/D443`, `Tracker/D444`, `Tracker/D445`, `Tracker/D446`, `Tracker/D447` (new), `Tracker/D448` (new), `00-Inbox/NEXT-CHAT-D442-*` files (rewritten), `00-Inbox/overview-drift-audit-2026-04-30.md`, `Architecture/Snowflake-Migration-Deep-Plan.md`, `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/`, several already-modified vault notes from prior sessions). All untracked. None code.
- **PR:** GitHub offered a PR link on first push: `https://github.com/tubby124/unmissed-ai/pull/new/feat/admin-redesign-phase-0-5`. Not opened.

## Pending / Next Steps

- [ ] **D448 truth-tracer dispatch** — answer H1/H2/H3 on `clients.tools` vs Ultravox `selectedTools` divergence. Hard blocker for D447.
- [ ] **D447 file path verifications** before any code (HomeOverview.tsx existence, deep-link router targets).
- [ ] **File D449 (Fix 2 per-field warning chip)** — independent of D447, cheap.
- [ ] **File D450 (Fix 3 `twilio_number` → `needsAgentSync`)** — one-line backend change.
- [ ] **forceRecompose integration test** — required before first per-client D445 migration. The bypass branch has zero coverage.
- [ ] **Decide go/no-go on D447** — or defer indefinitely if D443 (shipped) + D449 close enough of the trust gap.
- [ ] **Vault-sync the untracked tracker notes** when convenient.
- [ ] **Optionally open PR** for `feat/admin-redesign-phase-0-5` — currently 2 commits ahead, both green.
- [x] Telegram Tier 3 still shipped per prior session — no rollback signal seen.

## Files Changed (this session)

- `src/app/api/dashboard/variables/route.ts` — Fix 1.5 backend reject (committed `210d598`)
- `src/components/dashboard/CapabilitiesCard.tsx` — Fix 4 phone-only footnote (`210d598`)
- `src/components/dashboard/home/AgentIdentityCard.tsx` — Fix 1.5 frontend Edit-button gate (`210d598`)
- `src/components/dashboard/home/QuickConfigStrip.tsx` — Fix 4 phone-only footnotes (`210d598`)
- `src/lib/slot-regenerator.ts` — D445 forceRecompose 4th param + distinct changelog (`d9d0be7`)
- `src/app/api/admin/recompose-client/route.ts` — accept `force_recompose` body field (`d9d0be7`)
- `CALLINGAGENTS/Tracker/D447.md` — new spec
- `CALLINGAGENTS/Tracker/D448.md` — new investigation ticket
- `CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md` — rewritten cold-start
- `SESSION-HANDOFF.md` — this file (overwritten)

## How to Continue

To pick up: read [CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md](CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md). Recommended first move is **dispatch the truth-tracer agent for D448** before any D447 code. D448 either confirms the documented mutation contract (`clients.tools` is runtime-authoritative) or rewrites it — either way, D447's tool-comparison logic depends on the answer, and so does every prior drift-detector run anchored on `clients.tools`.

If owner wants a fast win without that investigation: file + ship D450 (Fix 3 `twilio_number` → `needsAgentSync` one-liner). It's independent, low-risk, and closes a documented MEDIUM gap.

Don't ship any per-client D445 migration until the forceRecompose integration test exists. Currently the bypass branch is untested.
