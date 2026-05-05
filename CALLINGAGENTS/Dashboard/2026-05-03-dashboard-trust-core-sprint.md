---
type: session-log
tags: [dashboard, trust-core, runtime-truth, playwright, e2e]
date: 2026-05-03
related:
  - [[Tracker/D447]]
  - [[Tracker/D449]]
  - [[Tracker/D450]]
  - [[Tracker/D446]]
  - [[Dashboard/Dashboard Architecture]]
---

# Dashboard Trust-Core Sprint — 2026-05-03

## What Shipped

- Overview capability truth now prefers deployed runtime/tool state when available and falls back to DB/home API state when runtime state is unavailable or unknown.
- `QuickConfigStrip` and `CapabilitiesCard` now render runtime-backed truth for:
  - Knowledge lookup
  - Booking
  - SMS follow-up
  - Transfer
- When DB/config says a capability exists but runtime tools do not, dashboard now shows an explicit trust state:
  - Quick config pill: `Not live`
  - Capabilities card: `Saved, but not live yet`
  - CTA becomes `Review` instead of a misleading active/upgrade state
- Added `src/lib/runtime-tool-truth.ts` as a pure helper for mapping runtime tools to UI capability state.
- Added regression coverage:
  - `src/lib/__tests__/runtime-tool-truth.test.ts`
  - `tests/dashboard-trust-core.spec.ts`
  - explicit D450 `twilio_number` sync trigger assertion in `settings-schema.test.ts`
- Fixed a real dashboard runtime warning discovered by authenticated Playwright:
  - `VoicePicker` had a nested `<button>` inside the dropdown trigger, causing an invalid HTML hydration warning on `/dashboard/agent`.
  - Outer trigger is now an accessible `role="button"` container, leaving the inner preview button valid.
- Dashboard Playwright helpers now acknowledge the one-time recording authorization modal before clicking underlying dashboard controls.

## Test Account

- `e2etest@unmissed.ai` password was rotated to the requested temporary test password for authenticated e2e.
- Do not commit/store the plaintext password in tracker notes. Use shell env `TEST_PASSWORD=...` when running Playwright.

## Verification

- `npm run build` passed.
- `npm run test:all` passed: 1826 passing, 2 skipped.
- Local authenticated dashboard group passed against `http://localhost:3002` with `--workers=1`:
  - 16 passed
  - 5 skipped
- Skipped tests are the Phase 4 settings e2e cases gated by their own admin/service env requirements.
- The same group with default parallel workers overloaded local dev enough that `/login` field fills timed out. Treat local dashboard Playwright runs as serial unless the dev server is pre-warmed and stable.

## What This Closes

- [[Tracker/D450]] is stale/resolved: `twilio_number` already triggers sync via `FIELD_REGISTRY.twilio_number.triggersSync`, and now has explicit regression coverage.
- [[Tracker/D447]] Phase 2 capability surfaces are complete for Overview:
  - `QuickConfigStrip`
  - `CapabilitiesCard`
- [[Tracker/D446]] is resolved:
  - shared extractor now recognizes `toolName`, `nameOverride`, and `temporaryTool.modelToolName`
  - unknown tool wire shapes log raw JSON and remain in comparisons as `__UNKNOWN_TOOL_SHAPE_{index}__`
  - D442 frozen fixture rerun shows `hangUp=OK` for all 5 audited clients

## Still Open

- [[Tracker/D447]] is not fully closed:
  - route-level cache test with mocked Ultravox is still not added
  - runtime rollout/default-on policy for `OVERVIEW_RUNTIME_TRUTH_ENABLED` is still pending
  - broader per-field runtime divergence chips remain outside this sprint
- [[Tracker/D449]] Phase 2 remains:
  - wire `SyncStatusChip` across the remaining settings cards
  - add multi-chip collapse UX
  - revisit D369 page-level banner after 30 days clean
- Post-D446 tool cleanup remains separate:
  - decide whether `hasan-sharif` stored-template/stage tool mismatch needs a tracker
  - decide whether `urban-vibe` DB-only `pageOwner` should be synced in a later owner-approved sweep
- Go-live/launch work remains separate:
  - domain purchase / verified sending domain
  - carrier-aware forwarding wizard
  - trial auto-disable policy
  - Urban Vibe/snowflake migration only if an owner actually needs editable prompt fields to propagate

## Next Recommended Order

1. Finish [[Tracker/D449]] Phase 2 on the highest-traffic settings cards.
2. Decide the trial auto-disable policy.
3. Buy/verify domain and production email sending.
4. Build the carrier-aware Go Live wizard.
5. Only then revisit snowflake migrations client-by-client.
