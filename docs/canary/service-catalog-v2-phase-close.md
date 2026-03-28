# Service Catalog v2 — Phase Close

**Date:** 2026-03-28
**Status:** CLOSED

---

## Shipped scope

- `src/lib/service-catalog.ts` — pure helpers: `parseServiceCatalog`, `formatServiceCatalog`, `buildBookingNotesBlock`, `rowsToCatalogItems`, `validateServiceWrite`
- `src/app/api/dashboard/services/route.ts` — GET + POST (authenticated, ownership-gated)
- `src/app/api/dashboard/services/[id]/route.ts` — PATCH + DELETE (authenticated, ownership-gated)
- `src/app/api/dashboard/services/analyze/route.ts` — AI draft generation (stateless, no DB write)
- `src/app/api/dashboard/services/apply/route.ts` — user-approved draft INSERT (INSERT-only, no upsert)
- `src/lib/agent-mode-rebuild.ts` — patched to prefer `client_services` active rows over `clients.service_catalog` JSONB
- `src/lib/prompt-builder.ts` — patched for catalog preference + `appointment_booking` TRIAGE override + booking notes injection
- `src/lib/__tests__/service-catalog.test.ts` — 40 unit tests for catalog helpers
- `src/lib/__tests__/service-catalog-prompt.test.ts` — 17 integration tests for catalog → prompt behavior
- `tests/truth-audit/service-catalog-save.spec.ts` — Playwright CRUD + ownership + governance spec

**Tests:** 72/72 pass (unit). Playwright spec requires `TEST_PASSWORD` env — run manually against Railway.

---

## Known gap — v2.1 hardening item (not deferred, not optional)

**The standard `regenerate-prompt/route.ts` path does not inject `client_services` rows.**

Only the deep-mode rebuild path (`agent-mode-rebuild.ts`, triggered via `/api/dashboard/regenerate-prompt` with an `agent_mode` override) reads `client_services` and injects catalog into the prompt. The standard regen path (used by most settings saves and manual regenerations) does not.

**Why it is not a v2 blocker:**
Catalog-augmented booking behavior (TRIAGE override with service names) only fires when `agent_mode='appointment_booking'`. That mode is exclusively activated via the deep-mode rebuild path, which already injects `client_services`. There is no production call path today where a client reaches `appointment_booking` mode via standard regen.

**Why it is a v2.1 item and must be resolved:**
If a client edits their service catalog (adds/removes rows via the new API) and then hits "Regenerate Prompt" on the standard path, their prompt silently rebuilds without the updated catalog. Their agent's TRIAGE section reflects stale or absent service data. This is truth drift — the DB says one thing, the deployed prompt says another.

**Decision required (pick one — do not leave both open):**

Option A: Patch `regenerate-prompt/route.ts` standard path to query `client_services` and inject rows into `intakeData.service_catalog` before calling `buildPromptFromIntake()`. Same logic as lines 154–165 of `agent-mode-rebuild.ts`. Narrow patch, ~10 lines.

Option B: Document in the product that catalog-augmented behavior is exclusively a deep-mode rebuild feature. Gate the "Regenerate Prompt" UI to always use the deep-mode rebuild path when `service_catalog` rows exist for the client. Update the settings card accordingly so owners know what they're getting.

Option A is the correct engineering choice. Option B is acceptable only if the UX makes the distinction explicit and unavoidable.

**This must be resolved before any client is onboarded with a populated service catalog.**

---

## Rollback

No DB schema changes in this phase. All new routes are additive. To roll back:

1. Remove the 5 new route files under `src/app/api/dashboard/services/`
2. Revert `agent-mode-rebuild.ts` to remove the `client_services` query (lines 154–165)
3. Revert `prompt-builder.ts` catalog preference changes

The `client_services` table and its RLS policies were added in a prior migration — that migration is independent of this phase and is not rolled back here.

---

## Next stream

**Transfer failure recovery verification.**

The transfer-status route (`src/app/api/webhook/[slug]/transfer-status/route.ts`) is 324 lines and implements reconnect logic, but it has never had a live verification gate. The route is production code for all clients with forwarding numbers.

Prove before closing:
1. No infinite reconnect loop — recovery fires once per failed transfer, not on a repeat trigger
2. No double-fired alert — `notification_logs` guard prevents duplicate Telegram notifications
3. Original call log and recovery call log both present and linked (`parent_call_log_id` FK)
4. Both original and recovery transcripts intelligible in the dashboard call history

Evidence file: `docs/canary/transfer-recovery-proof.md` (to be written after verification).
