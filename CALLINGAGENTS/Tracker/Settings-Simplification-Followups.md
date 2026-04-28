---
type: tracker
status: deferred
date: 2026-04-28
tags: [settings, ux, deferred, followup]
related:
  - "[[../Decisions/2026-04-28-settings-page-simplification]]"
---

# Settings Simplification — Followups

Deferred from the 2026-04-28 sweep. None are urgent — all are noise/duplication on the non-admin Settings page that wasn't worth bundling into the same diff.

Resume with: "do the settings simplification followups" or call out specific item numbers.

---

## #1 — "Advanced" Prompt Editor button on Overview hero

**File:** [[../../src/app/dashboard/settings/SettingsView]] lines 368-387 (`POWER USER` amber pill)

**Issue:** Opens [[../../src/components/dashboard/settings/PromptEditorModal]] for raw system prompt edits. 99% of clients shouldn't touch this. It's a footgun on the most-visited Settings page.

**Options:**
- A) Hide entirely for non-admin
- B) Move under a collapsible "Advanced" section at the bottom of the page
- C) Keep as-is (current state — power-user escape hatch)

**Decision needed.** Hasan called this a judgment call.

---

## #2 — Plan & Billing duplication on Settings page

**File:** [[../../src/components/dashboard/settings/AgentTab]] lines 737-799 (non-admin lower band)

**Issue:** Renders for non-admin: Timezone selector + Plan & Billing band (`PlanInfoCard` + `BillingCard`) + `SetupProgressRing` + "Phone & call forwarding" link card.

The Plan & Billing rows duplicate everything on `/dashboard/billing`. With the tab bar now hidden for non-admin, these are the only billing UIs accessible from Settings — but they shouldn't be on Settings at all.

**Recommendation:** Drop `PlanInfoCard` + `BillingCard` from this band. Keep Timezone + SetupProgressRing + Phone & call forwarding link. Let `/dashboard/billing` own billing.

---

## #3 — ActivityLog at the very bottom

**File:** [[../../src/components/dashboard/settings/AgentTab]] lines 802-804 (full width)

**Issue:** ActivityLog renders at the bottom of Settings for both admin and non-admin. Activity logs belong on `/dashboard/calls` or `/dashboard/insights`, not Settings.

**Recommendation:** Hide for non-admin. Admin can keep it as a god-mode debugging surface.

---

## #4 — PM Setup Checklist

**File:** [[../../src/components/dashboard/settings/AgentTab]] lines 293-297

**Issue:** Property-management niche only — renders at the very top of the grid. Fine as-is unless we want it moved. Low priority.

**Action:** Leave alone unless a PM client complains.

---

## #5 — OutboundAgentConfigCard renders unconditionally

**File:** [[../../src/components/dashboard/settings/AgentTab]] lines 681-691

**Issue:** Outbound calling isn't shipped for any client (per [[../Architecture/call-path-capability-matrix]] — Path F: "No outbound calling path was found in the codebase"). Yet `OutboundAgentConfigCard` renders for everyone, admin and non-admin.

**Recommendation:** Wrap in `{isAdmin && ...}` until outbound calling is actually a product. Right now it's a configurable surface for a feature that doesn't exist.

---

## Suggested batch order if resuming

1. **#5** — narrowest, safest (one-line change). Removes a dead-feature config surface.
2. **#3** — hide ActivityLog for non-admin. One-line change.
3. **#2** — drop billing duplication. ~20 lines removed, no logic change.
4. **#1** — needs Hasan's call on hide vs collapse vs keep.
5. **#4** — leave alone.
