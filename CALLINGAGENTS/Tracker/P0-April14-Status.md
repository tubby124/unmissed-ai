---
type: tracker
status: done
tags: [p0, pivot, trust-fixes]
updated: 2026-04-15
---

# P0 Pivot Fixes — April 14 (ALL DONE ✅)

Branch: `fix/p0-pivot-fixes`
Plan: `docs/superpowers/plans/2026-04-15-p0-pivot-fixes.md`
Context: [[April-14-Audit-Pivot]]

All 6 items shipped 2026-04-15. Resume Phase 7 (2-Minute Agent).

---

## Status

| D# | Item | Commit | Status |
|----|------|--------|--------|
| D375 | Fix Zara WebRTC context | prior session | ✅ done |
| D379 | Strip pricing to 2 tiers | `bb7ab88` | ✅ done |
| D380 | Concierge Onboarding SOP | `f8d4e5b` | ✅ done |
| D376 | Hide broken Telegram pill | `da83b9c` | ✅ done |
| D377 | Expose triage/intent box | `2ad0d27` | ✅ done |
| D378 | End button on LiveCallBanner | `505bc6e` | ✅ done |

---

## Key Findings From This Audit

### Orphaned Component (D377)
`AgentIntelligenceSection.tsx` was fully built with knowledge sources + capability unlock cards but **never imported anywhere**. Fixed by wiring into `UnifiedHomeSection.tsx` left column.

**Rule for future audits:** Before any dashboard component audit, grep for imports:
```bash
grep -r "import.*ComponentName" src/
```
Zero results = orphaned. Check systematically.

### Fake-Control Bug (D376)
Telegram pill in QuickConfigStrip rendered even when disconnected. Pattern: always filter capability pills by their connection state before rendering.

### Path-Parity Bug (D378)
`CallDetail.tsx` had End button; `LiveCallBanner.tsx` didn't. Whenever a call action exists on the detail page, it should also exist on the overview banner.

### Phantom Data (D379)
3rd pricing tier existed in `PLANS` array but wasn't a real product tier. Always validate UI against actual product state.

---

## Future Items Surfaced

- `isAdmin={true}` hardcoded in `CallDetail.tsx:675` — should reflect actual auth role
- IVR / Booking / Transfer pills in QuickConfigStrip may also need connection-state filtering
- Run systematic orphaned-component audit across all dashboard components

---

## Next Step

Resume [[Phase 7 — 2-Minute Agent]] starting with D291 (GBP auto-import).
