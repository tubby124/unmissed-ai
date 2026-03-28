# Trial Mode Switcher — Phase Close

**Date:** 2026-03-28
**Status:** SHIPPED

---

## Scope

Add a trial-facing mode-switching surface that lets new/trial users pick how their AI agent handles calls, see honest capability notes, and immediately test the selected mode via the existing orb/browser test path.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/home/TrialModeSwitcher.tsx` | NEW — buyer-language mode picker component |
| `src/app/api/dashboard/home/route.ts` | Added `call_handling_mode` to SELECT query and JSON response |
| `src/components/dashboard/ClientHome.tsx` | Added `callHandlingMode: string | null` to `HomeData` interface |
| `src/components/dashboard/home/TrialActiveSection.tsx` | Imported + integrated `TrialModeSwitcher` in both `isFirstVisit` and returning-trial paths |
| `src/lib/__tests__/trial-mode-switcher.test.ts` | NEW — unit tests for buyer labels, booking disclaimer, plan gate, default fallback |

---

## Architecture Decisions

### Existing `call_handling_mode` — not a new system
Uses the existing `call_handling_mode` DB column (`message_only | triage | full_service`) and the `AGENT_MODES` array in `src/lib/capabilities.ts`. No new mode system created.

### Save path — standard settings PATCH
`usePatchSettings(clientId, false)` → `PATCH /api/dashboard/settings` → `call_handling_mode` is in `computeNeedsSync` trigger list → Ultravox `updateAgent()` fires automatically. No special-casing.

### Honest sync state
`usePatchSettings` exposes `syncStatus: 'synced' | 'failed' | null`. The component surfaces:
- `synced` → green "Mode saved — agent updated live"
- `failed` → amber "Mode saved — agent sync delayed (will apply on next call)"
- `saved` + no sync needed → "Mode saved"

### Honest booking disclaimer
`full_service` mode selected + `hasBooking=false` (calendar not connected) → amber note with direct link to `/dashboard/settings?tab=integrations`. Agent explicitly described as running as AI Receptionist until calendar is connected.

### Post-save test CTA
After a successful save, a "Test this mode now" button calls `onRetest` (wired to `resetCall()` from `useCallContext`). This collapses the orb back to idle so the user can immediately start a fresh test call with the new mode active.

### Plan gate
`full_service` requires `selectedPlan === 'pro'` or trial/null subscription status. Identical gate to `CallHandlingModeCard.tsx`. Trial users always get full access.

### Placement
- **isFirstVisit path**: After provisioning headline, before the agent test card — pick mode before first test
- **Returning trial path**: After the trial label, before the agent test card — always visible on each return visit

---

## What is NOT changed

- The internal `agent_mode` deep-rebuild system (`agent-mode-rebuild.ts`) — untouched
- `AgentModeCard.tsx` (admin-only deep mode card) — untouched
- `CallHandlingModeCard.tsx` (settings page card) — untouched; `TrialModeSwitcher` is a complementary surface for the trial home, not a replacement
- Billing / provisioning routes — untouched
- Any paid-user dashboard paths (`PaidReadySection`, `PaidAwaitingSection`) — untouched

---

## Known Gap (not a blocker)

The standard regenerate-prompt path (`POST /api/dashboard/regenerate-prompt`) does not currently inject `client_services` into the regenerated prompt. This is pre-existing and unrelated to this phase. Tracked in the phase-close note for service-catalog-v2.

---

## Tests

```
npx tsx --test src/lib/__tests__/trial-mode-switcher.test.ts
```

Covers:
- AGENT_MODES registry: 3 modes, correct IDs, buyer labels stable, all required fields present, cumulative feature inclusion, booking quote
- Booking disclaimer predicate: all 4 combinations
- Plan gate predicate: trial, null status, pro, lite/core locked
- Default mode fallback: valid, null, unrecognized inputs

---

## Rollback

1. Revert `TrialActiveSection.tsx` (remove import + two switcher blocks)
2. Revert `ClientHome.tsx` (remove `callHandlingMode` from HomeData)
3. Revert `home/route.ts` (remove `call_handling_mode` from SELECT + response)
4. Delete `TrialModeSwitcher.tsx` and `trial-mode-switcher.test.ts`

No DB migration, no schema change, no Stripe/Ultravox config change required.
