---
type: audit
status: complete
date: 2026-06-01
scope: dashboard surfaces — Overview, Calls & Leads, Knowledge, Settings, Admin, Admin Notifications
related: [[Architecture/control-plane-mutation-contract]], [[Architecture/call-path-capability-matrix]], [[Tracker/D442]], [[Tracker/D278]], [[Tracker/D290]]
inventory: 2026-06-01-surface-inventory.csv
mode: read-only
---

# Dashboard Surface Audit — 2026-06-01

> **Goal.** Decide what to keep, consolidate, kill, or investigate across the dashboard. Settings is the cooked one; Admin/Notifications is the gold standard. The product question Hasan flagged — *"if I save something here, does it actually update the system?"* — is the lens.
>
> **Scope.** `/dashboard` Overview · `/dashboard/calls` · `/dashboard/knowledge` · `/dashboard/settings` · `/dashboard/admin` · `/dashboard/admin/notifications`. Out of scope but flagged where it bled in: `/dashboard/notifications`, `/dashboard/go-live`, `/dashboard/actions`, `/dashboard/billing`, `/dashboard/v2`.
>
> **Standing rules respected.** No code change this pass. No re-deploy. Do not undo Phase 6 Wave 2 work (D278 / D283b / D286 / D288 / D290) — all of those are checked against the refactor-phase-tracker before any "remove" verdict is made.

---

## 0. The save→system question, settled

For every settings field, the answer to *"does saving here update the live agent?"* comes from **`FIELD_REGISTRY` in [src/lib/settings-schema.ts](src/lib/settings-schema.ts)** + the **`computeNeedsSync()` / `syncToUltravox()` path in [src/app/api/dashboard/settings/route.ts](src/app/api/dashboard/settings/route.ts)**. Read in plain terms:

| Class | Fields | What save actually does |
|---|---|---|
| **Sync-triggering (17 fields)** | `system_prompt`, `forwarding_number`, `transfer_conditions`, `booking_enabled`, `call_handling_mode`, `agent_mode`, `agent_voice_id`, `knowledge_backend`, `sms_enabled`, `twilio_number` (admin), `voice_style_preset`, `agent_name`, `business_name`, `display_name`, `services_offered`, `business_facts`+`extra_qa` (via reseed), `niche_custom_variables` / `city` (via slot regen) | DB write → optional prompt patcher → `updateAgent(agentId, agentFlags)` → `clients.tools` rebuild → `last_agent_sync_at='success'` |
| **DB-only (rest)** | Hours / IVR / voicemail / timezone / notification toggles / SMS template / outbound_* / booking_buffer / context_data / injected_note / staff_roster | DB write only. Runtime reads on next call via `buildAgentContext()` (per-call) or inbound webhook (IVR/voicemail). |
| **Knowledge pipeline** | `business_facts` + `extra_qa` | DB write + `reseedKnowledgeFromSettings()` (pgvector) + sync. |
| **Silent no-op on legacy clients** | `niche_custom_variables.GREETING_LINE` and every other variable on 4/5 active clients | DB write to `niche_custom_variables` lands, but `regenerateSlots()` returns `success:false` (no slot markers) → response says `{ ok:true, prompt_rebuilt:false }` → live prompt unchanged. **This is D442 Phase 1.** Already documented; mitigation `field_sync_status` is plumbed in the PATCH response but only 8 cards consume it. |

**The good news:** the architecture is sound. The single chokepoint (`PATCH /api/dashboard/settings` + `applyPromptPatches()` + `syncToUltravox()`) genuinely covers the prompt+tools+reseed path. Sync errors get a Telegram alert and `last_agent_sync_status='error'`.

**The bad news:** the UI does not reliably surface that truth. `field_sync_status` is consumed in 8 admin-leaning cards (`AgentOverviewCard`, `SmsTab`, `CallHandlingModeCard`, `KnowledgeEngineCard`, `SetupCard`, `BookingCard`, `PromptVariablesCard`, `HoursCard`) — but **not** in the Overview chip modals, **not** in the Quick Add panels on Knowledge, and **not** in `NotificationsWidget`. The 8-of-30+ surfaces that show truth are mostly admin tools; the surfaces real owners touch most (Overview chips + Settings hero) are the silent ones.

**Where notifications live (Hasan's other question).** Five surfaces today:
1. `NotificationsWidget` on Settings non-admin hero — 3 toggles (Telegram/Email/SMS)
2. `AlertsTab` under Settings/notifications tab (admin only) — full alert config + style
3. `SmsTab` under Settings/notifications tab — full SMS template
4. `/dashboard/notifications` — standalone page with its own `NotificationsConfigSection`
5. `/dashboard/admin/notifications` — admin-only delivery log (gold standard)

(2) + (3) + (4) all write the same 3 boolean columns and 1 template column. (5) is read-only. **The right answer is one config page (`/dashboard/notifications`) for owners, the admin log stays.**

---

## 1. Overview — coherent except for one fake-control class

**Files.** [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) → [src/components/dashboard/ClientHomeV2.tsx](src/components/dashboard/ClientHomeV2.tsx) → [src/components/dashboard/home/UnifiedHomeSectionV2.tsx](src/components/dashboard/home/UnifiedHomeSectionV2.tsx) + 17 inline modals in [InlineModalsV2.tsx](src/components/dashboard/home/InlineModalsV2.tsx).

**Coherent (keep).** The Wave 2 redesign worked. The single column flow — toasts → `AgentIdentityCardCompact` (10-chip identity grid) → orb + recent calls → `AgentKnowsCard` (consolidated facts/FAQs/services/KB) → `Agent Readiness band` (6 rows) → plan + upgrade — reads cleanly and the cards visually agree. The InlineModalsV2 pattern is the right answer to "stop scattering settings"; every chip and readiness row opens a focused modal that writes to the same single PATCH chokepoint.

**Out of place / fake controls.**
- **`GreetingModal` is the only fake-control class still shipping** ([InlineModalsV2.tsx:113](src/components/dashboard/home/InlineModalsV2.tsx#L113)). Per D442 §1: registry says `editable: false`, UI shows Edit, PATCH does not enforce the registry, and on 4/5 active clients `regenerateSlots` silently no-ops. Saving "feels" successful. **This is the most damaging trust bug in the product.** Fix is the audit-recommended Fix 1.5 — three lines of code, one backend guard plus a `meta.editable` UI gate.
- **`Activity` tab on the segmented control** ([ClientHomeV2.tsx:417](src/components/dashboard/ClientHomeV2.tsx#L417)) duplicates the recent-calls list that Overview already shows via `V2CallList`. Either kill the tab or kill `V2CallList` on the Overview tab. Recommend killing the Activity tab — the deep-link to `/dashboard/calls` already exists.

**Duplicate surfaces vs Settings.**
- The 10 chips on `AgentIdentityCardCompact` (Greeting, SMS, Telegram, IVR, Voicemail, Booking, Transfer, Website, GBP, Today) are the **same flags** that `CapabilitiesCard` renders in Settings hero. Same data, two visualizations. Decision: keep chips (Overview is the right home for "what does my agent do?"), drop `CapabilitiesCard` from Settings hero.
- The 6 readiness rows (Hours / Services / FAQs / Booking / Knowledge / Gaps) overlap **the 4-item `QuickSetupStrip` on Settings** AND **the 4-item `SetupProgressRing` at the bottom of Settings**. Three "% set up" widgets is two too many. Keep Overview's, kill the other two.

**Verdict.**
- **Keep:** AgentIdentityCardCompact, AgentKnowsCard, V2CallList, Agent Readiness band, all InlineModalsV2 modals (except greeting fix below), toast strip, ActivationTile, plan card.
- **Investigate:** GreetingModal (fake control — needs D442 Fix 1.5).
- **Remove:** Activity tab (duplicates V2CallList), `/dashboard/v2` nav entry (live `/dashboard` is already v2).

---

## 2. Calls & Leads — already gold-standard

**Files.** [src/app/dashboard/calls/page.tsx](src/app/dashboard/calls/page.tsx) → [CallsList](src/components/dashboard/CallsList.tsx) + [ContactsView](src/components/dashboard/ContactsView.tsx).

**Coherent.** Two cards. 2/3 column for calls + 1/3 for contacts. The header is a plain `<h1>` + subtitle — same minimalist pattern Admin Notifications uses. The self-healing logic for processing-stuck calls (Railway restart killed the `after()` callback) is correct and silent.

**No issues found.** No fake controls. No duplicate surfaces. Hasan's "how easy to just see shit" lens fits this page perfectly — the table is dense but it's the right answer for a call log.

**Verdict.**
- **Keep everything.** No changes.

---

## 3. Knowledge — coherent but one stub and one duplicate file

**Files.** [src/app/dashboard/knowledge/KnowledgePageView.tsx](src/app/dashboard/knowledge/KnowledgePageView.tsx) renders 11 top-level cards across 4 tiers + a 6-content drawer.

**Coherent.** The 4-tier layout is sound: Health/Talk-to-Agent/Quick-Add → Facts/FAQs/Gaps → Sources/Suggestions/Top-queries → AskYourAgent. The provenance card answers "where did this fact come from?" which is the right question. `CallContextPreview` in the drawer is the **single best trust surface in the entire dashboard** — it shows the literal callerContext block that gets injected per call. That alone makes Knowledge worth keeping at its current shape.

**Out of place / consolidation candidates.**
- **`TestCallCard` (Tier 1 center orb)** is the 4th instance of the orb across the dashboard (Overview / Knowledge / Settings hero / Settings/general). Header already has a "Talk to Agent" button. Either drop the Tier-1 orb and rely on the header button, or drop the header button. Recommend dropping the header button — the orb is the better entry point and it owns the CallContext state.
- **`WebsiteKnowledgeCard` + `WebsiteSourcesList` live under [src/components/dashboard/settings/](src/components/dashboard/settings/)** but are imported by Knowledge. Pure file-organization misfit — move them to `components/dashboard/knowledge/`. Zero runtime impact, but the next person reading the tree will trip.
- **Bulk AI Answers drawer is a stub.** [KnowledgePageView.tsx:895](src/app/dashboard/knowledge/KnowledgePageView.tsx#L895) — content reads *"Coming soon: batch-generate answers for all unanswered caller questions"*. The button is fully wired (`QUICK_ADD_ACTIONS` exposes it; drawer routes to it). **Either ship the bulk endpoint or remove the action from the Quick Add grid.** Right now it's a dead button on a primary surface.

**Verdict.**
- **Keep:** all the live cards + drawers (Health, Facts/FAQs/Gaps editors, Sources, Suggestions, TopQueries, AskYourAgent, Provenance, CallContextPreview).
- **Consolidate:** orb + header "Talk to Agent" button (pick one).
- **Investigate:** Bulk AI Answers (ship or remove).
- **File move (low priority):** WebsiteKnowledgeCard + WebsiteSourcesList → `components/dashboard/knowledge/`.

---

## 4. Settings — the cooked one. Real kill list below.

**Files.** [src/app/dashboard/settings/SettingsView.tsx](src/app/dashboard/settings/SettingsView.tsx) hosts:
- A **non-admin hero** (4 cards) above the tab content.
- A **3-tab bar** (general · notifications · billing) — admin-only by visibility, but non-admin still lands on `general` content beneath the hero.
- **AgentTab grid** ([src/components/dashboard/settings/AgentTab.tsx](src/components/dashboard/settings/AgentTab.tsx)) — **~18 cards for non-admin, ~32 for admin**.
- A side `SettingsPanel` drawer for `HoursCard` (one card only).
- A `PromptEditorModal` opened from the hero "Advanced" button — overlapping the in-grid `PromptEditorCard`.

The visual language never agrees with Overview. Overview uses `AgentIdentityCardCompact`, `AgentKnowsCard`, `AgentRoutesOnCard` (consolidated, dense, chip-driven). Settings uses a 2-3 column generic grid of disparate cards each doing its own thing.

### 4.1 Out-of-place cards

The following do not belong on Settings — they live elsewhere already and the Settings copy is redundant.

| Card | File | Already lives at | Verdict |
|---|---|---|---|
| `CapabilitiesCard` (hero) | [CapabilitiesCard.tsx](src/components/dashboard/CapabilitiesCard.tsx) | Overview `AgentIdentityCardCompact` chips render the same flags | **Remove from Settings hero** |
| `TestCallCard` (hero + AgentTab) | [TestCallCard.tsx](src/components/dashboard/settings/TestCallCard.tsx) | Overview hero orb; Knowledge orb | **Remove both Settings instances** |
| `NotificationsWidget` (hero) | inline in [SettingsView.tsx:606](src/app/dashboard/settings/SettingsView.tsx#L606) | `/dashboard/notifications` + `AlertsTab` + `SmsTab` | **Consolidate — Settings should link to `/dashboard/notifications`, not own toggles** |
| `Prompt Editor` button → `PromptEditorModal` (hero) | [PromptEditorModal.tsx](src/components/dashboard/settings/PromptEditorModal.tsx) | `PromptEditorCard` further down on the same page | **Pick one. Recommend killing the modal and using the inline card** |
| `AgentKnowledgeCard` | [AgentKnowledgeCard.tsx](src/components/dashboard/settings/AgentKnowledgeCard.tsx) | Overview `AgentKnowsCard`; Knowledge page | **Remove** |
| "Manage knowledge" link card | inline in [AgentTab.tsx:534](src/components/dashboard/settings/AgentTab.tsx#L534) | Sidebar nav | **Remove (sidebar already does this)** |
| `AdvancedContextCard` (admin) | [AdvancedContextCard.tsx](src/components/dashboard/settings/AdvancedContextCard.tsx) | All four fields are on Overview + Knowledge | **Remove from Settings** |
| `WebsiteSourcesList` + `WebsiteKnowledgeCard` (admin grid) | [WebsiteKnowledgeCard.tsx](src/components/dashboard/settings/WebsiteKnowledgeCard.tsx) | Knowledge drawer | **Remove from Settings grid** |
| "Answering schedule" / "Booking on Actions" / "Phone & call forwarding" link cards | inline in AgentTab | Sidebar nav already provides each link | **Remove all three — they're text-only redirects** |
| `QuickSetupStrip` (page-level **and** in-grid duplicate) | [QuickSetupStrip.tsx](src/components/dashboard/settings/QuickSetupStrip.tsx) | Overview Agent Readiness band has the same 4 dimensions | **Remove (drop both instances)** |
| `SetupProgressRing` (non-admin bottom) | [SetupProgressRing.tsx](src/components/dashboard/settings/SetupProgressRing.tsx) | Overview Agent Readiness band already shows this | **Remove** |
| `PlanInfoCard` + `BillingCard` (rendered twice each) | [PlanInfoCard.tsx](src/components/dashboard/settings/PlanInfoCard.tsx) | The admin top row AND non-admin bottom both render them | **Render once, not twice** |
| `BillingTab` | [BillingTab.tsx](src/components/dashboard/settings/BillingTab.tsx) | Third surface for plan + billing on top of the two `BillingCard` renders | **Remove tab — keep the inline `BillingCard`** |
| `HoursCard` in `SettingsPanel` side drawer | [HoursCard.tsx](src/components/dashboard/settings/HoursCard.tsx) | Overview `HoursModal` writes the same fields | **Kill the side drawer entirely — only one card uses it** |

### 4.2 Fake controls / propagation risks

These look real but don't always reach the live agent:

| Card | Risk | Mitigation |
|---|---|---|
| `PromptVariablesCard` ([PromptVariablesCard.tsx](src/components/dashboard/settings/PromptVariablesCard.tsx)) | Same D442 silent-no-op as Overview Greeting — `regenerateSlots` returns `success:false` on legacy clients | `FieldSyncStatusChip` IS consumed here ✅ — owner sees the warning. **Keep with the chip wired.** |
| `GodModeCard` ([GodModeCard.tsx](src/components/dashboard/settings/GodModeCard.tsx)) — `twilio_number` field | Admin writes the number, but per mutation-contract §7.2 + D442 §Risk-2, `twilio_number` is NOT in `needsAgentSync` until a separate `sms_enabled` toggle fires. The SMS tool stays stale on the live agent. | Either fix the route (one-line add to `SYNC_TRIGGER_FIELDS`) or surface a chip. **Investigate — not a kill candidate.** |
| `OutboundAgentConfigCard` ([OutboundAgentConfigCard.tsx](src/components/dashboard/OutboundAgentConfigCard.tsx)) | Writes 5 `outbound_*` fields, but per per-call-context-contract §1.10 + call-path-capability-matrix §1.F, **no production outbound calling path exists in the codebase**. The fields are DB_ONLY and read by nothing. | **Investigate: confirm no outbound consumer, then either ship outbound MVP or hide this card.** |
| `VIPContactsCard` ([VIPContactsCard.tsx](src/components/dashboard/settings/VIPContactsCard.tsx)) | Plan-gated to `transfer`, but D98 in the deferred list says "VIP contacts outbound path" is unbuilt. | **Investigate: confirm `clients.vip_contacts` is actually consumed at call time. If not, hide.** |

### 4.3 What actually belongs on Settings

After the kills above, Settings reduces to **the agent's behavioural config that doesn't have a better home**:

- **Identity & Voice section** (already in Overview hero in compact form — but Settings can keep the editorial-grade form): `AgentModeCard` / `CallHandlingModeCard`, `VoiceStyleCard`, `VoicemailGreetingCard`, `SectionEditorCard 'identity'` (admin).
- **Behaviour section**: `CallRoutingCard`, `IvrMenuCard`, `BookingCard` (admin), `StaffRosterCard`, `SectionEditorCard 'triage'`, `PmConfigCard` (PM niche).
- **Knowledge gate** (admin): `KnowledgeEngineCard` (pgvector toggle), `SectionEditorCard 'knowledge'`.
- **Agent script** (admin power-user): `PromptEditorCard`, `ImprovePromptCard`, `PromptVersionsCard`.
- **Loop**: `LearningLoopCard`, `PromptSuggestionsCard`.
- **Admin power**: `AgentConfigCard`, `WebhooksCard`, `GodModeCard`, `RuntimeCard`.
- **Plan**: `PlanInfoCard` + `BillingCard` (once each).
- **Timezone** inline select.
- **Activity** log.

That's ~14 cards for non-admin (down from ~22), ~22 for admin (down from ~32). And the hero on top is gone.

---

## 5. Admin — two implementations, one nav, no source of truth

**Files.** [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) admin branch (legacy) + [src/app/dashboard/admin/page.tsx](src/app/dashboard/admin/page.tsx) (redesign behind `isAdminRedesignEnabled()`).

Both render: SystemPulse → ActionItems → LiveCallBanner → ClientHealthBar. The legacy one ADDS MonthlySpendCard + TalkToZaraAdminButton. The redesign ADDS the 3 admin-tool link cards (Notifications / Harness Findings / Learning Bank).

**Real problem.** Sidebar `NAV_ITEMS` has both `/dashboard` (label: "Command Center" for admins) AND `/dashboard/admin` (label: "Admin") as separate entries. Same goes for `/dashboard/v2` (Overview v2). **Three nav entries for two implementations of the same page** — depends on the feature flag, but the nav doesn't know that.

**Verdict.**
- **Decide the flag.** If `ADMIN_REDESIGN_ENABLED` is going on permanently, kill `/dashboard` admin branch (lines 67-178 of `page.tsx`) and consolidate MonthlySpendCard + TalkToZaraAdminButton into `/dashboard/admin`. Drop "Command Center" label override.
- **Kill the `/dashboard/v2` nav entry** unconditionally — main `/dashboard` is already v2 via ClientHomeV2.
- **Keep:** SystemPulse, ActionItems, LiveCallBanner, ClientHealthBar, MonthlySpendCard, TalkToZaraAdminButton, the 3 admin-tool link cards.

---

## 6. Admin Notifications — keep as the gold-standard reference

**Files.** [src/app/dashboard/admin/notifications/page.tsx](src/app/dashboard/admin/notifications/page.tsx) + [src/components/admin/notifications/](src/components/admin/notifications/).

This is the visual + structural pattern the rest of the dashboard should imitate:
- Server component does auth + 1 query.
- One `PageHeader` (title + subtitle).
- One `StatsRibbon` (4 channels × 9 statuses) — horizontal, dense, glanceable.
- One `FilterStrip` (URL-driven so filters are bookmarkable / shareable).
- One `NotificationRow` list with click-to-expand.
- One `LifecycleDrawer` for per-client deep-dive.

**Total: 5 component types, 1 page, ~200 LOC.** Compare with Settings/general at ~32 cards across two component trees and 5 file paths.

**Verdict.** Keep as-is. **Use as the reference layout** when redesigning Settings.

---

## 7. Final kill + consolidate plan, ordered by impact

### Wave 1 — trust fix (1 day, single-PR)

1. **Fix the universal Greeting fake-control** (D442 Fix 1.5).
   - [src/app/api/dashboard/variables/route.ts](src/app/api/dashboard/variables/route.ts) — reject PATCH when `varDef.editable === false`.
   - [src/components/dashboard/home/AgentIdentityCardCompact.tsx](src/components/dashboard/home/AgentIdentityCardCompact.tsx) + the Settings PromptVariablesCard — hide Edit button when `meta.editable === false`.
   - Surface `field_sync_status` from PATCH response into `GreetingModal` so saves that silently no-op render a "Saved, but not live yet" chip.
   - **Impact:** the single highest-trust loss in the product, fixed for all 4 active legacy clients in one ship.

2. **Wire `field_sync_status` chip into every Overview InlineModalsV2 save handler.**
   - Already plumbed through `usePatchSettings.ts`; just call `getFieldSyncStatusForClient(field)` after each save and render `<FieldSyncStatusChip>`.
   - **Impact:** owners stop trusting silently-broken saves.

### Wave 2 — Settings consolidation (1-2 days, additive)

3. **Drop the Settings non-admin hero entirely.** `CapabilitiesCard`, hero `TestCallCard`, `Prompt Editor` button + modal, `NotificationsWidget` — all four duplicate surfaces that exist on Overview or `/dashboard/notifications`. Land Settings on the `AgentTab` grid directly.

4. **Kill the side `SettingsPanel` drawer** that only renders `HoursCard`. Hours lives on Overview's HoursModal.

5. **Kill duplicate setup signals.** Remove `QuickSetupStrip` (both instances) and `SetupProgressRing`. Overview's Agent Readiness band is canonical.

6. **Render `PlanInfoCard` + `BillingCard` once each.** Drop the admin top-row instance; keep the inline render. Drop `BillingTab`.

7. **Drop redundant in-grid cards on AgentTab.** Remove `AgentKnowledgeCard`, `AdvancedContextCard`, the "Manage knowledge" / "Answering schedule" / "Booking on Actions" / "Phone & forwarding" link cards, and the admin `CapabilitiesCard` (top of grid). Move `WebsiteSourcesList` + `WebsiteKnowledgeCard` out of Settings (they're already rendered by Knowledge).

8. **Pick one PromptEditor entry point.** Recommend the inline `PromptEditorCard`. Drop `PromptEditorModal`.

### Wave 3 — Notifications surface unification (0.5 day)

9. **Make `/dashboard/notifications` the only owner config surface.** Keep `AlertsTab` + `SmsTab` content but render them on `/dashboard/notifications` instead of the Settings tab. Drop the Settings `notifications` tab. The Overview chips and Settings hero `NotificationsWidget` are already gone after Wave 2.

10. **Keep `/dashboard/admin/notifications` untouched.** That is the gold standard; do not bundle owner config into it.

### Wave 4 — Admin consolidation (0.5 day)

11. **Pick the admin home.** Either set `isAdminRedesignEnabled()` to permanent ON and delete the legacy `/dashboard` admin branch (lines 67-178 of `src/app/dashboard/page.tsx`), or flip it off and drop `/dashboard/admin/page.tsx`. Don't carry both.

12. **Remove `/dashboard/v2` from `NAV_ITEMS`.** Main `/dashboard` is already v2.

13. **Move `MonthlySpendCard` + `TalkToZaraAdminButton` into whichever admin page wins** in step 11.

### Wave 5 — Investigations (do these BEFORE removing the related cards)

14. **`OutboundAgentConfigCard`.** Confirm no production outbound consumer exists (per call-path-capability-matrix §1.F). If yes, hide the card until outbound MVP ships. If outbound is shipping soon, keep as-is.

15. **`VIPContactsCard`.** Trace whether `clients.vip_contacts` is consumed at call time. If unwired (per deferred D98), hide.

16. **`GodModeCard` twilio_number sync gap.** One-line fix: add `'twilio_number'` to the `SYNC_TRIGGER_FIELDS` derivation OR mirror current admin behaviour by exposing a manual "Resync agent" button on the card.

17. **Bulk AI Answers drawer.** Ship the endpoint or remove the action from `QUICK_ADD_ACTIONS`.

### Out of scope (deferred to other passes)

- Snowflake migration (D304 / D445). Not a UI fix; not in this audit's scope.
- Wave 2 `D283b` / `D286` / `D288` / `D290` rebuilds — these are the surfaces that worked. **Do not undo them.**
- Quality fixes for `/dashboard/notifications` standalone page — out of scope but it should be the only owner config surface after Wave 3.

---

## 8. Numbers

| Surface | Before | After (after Waves 1-4) |
|---|---|---|
| Settings cards (non-admin) | ~22 (4 hero + 18 grid) | ~14 grid only |
| Settings cards (admin) | ~32 grid | ~22 grid |
| TestCallCard instances | 4 (Overview / Knowledge / Settings hero / Settings grid) | 2 (Overview / Knowledge) |
| Setup-% widgets | 3 (Overview band / QuickSetupStrip x2 / SetupProgressRing) | 1 (Overview band) |
| BillingCard renders | 3 (admin top / non-admin bottom / BillingTab) | 1 |
| Notification config surfaces | 4 (NotificationsWidget / AlertsTab / SmsTab / /notifications) | 1 (`/dashboard/notifications`) |
| Admin Command Center implementations | 2 (`/dashboard` admin + `/dashboard/admin`) | 1 |
| Sidebar Overview entries | 2 (`/dashboard` + `/dashboard/v2`) | 1 |
| Fake controls that ship saved-but-not-live | Greeting (universal) + every variable on 4/5 legacy clients (D442) | 0 visible (chips surface the no-op truth) |

---

## 9. What's intentionally not on the kill list

These looked suspect on first read but check out against the architecture docs and the Phase 6 Wave 2 tracker:

- **`AgentIdentityCardCompact`** — D290 + D286 ship. Replaces three legacy tiles. Keep.
- **`AgentKnowsCard`** — D290 Wave 2 win. Keep.
- **`Agent Readiness band`** — replaces 5 previous tiles. Keep.
- **`ActivityLog`** — proper audit trail; keep.
- **`KnowledgeCompiler` / `KnowledgeProvenanceCard` / `KnowledgeGaps` / `CallContextPreview`** — these are the highest-trust surfaces in the product. Keep all.
- **`LearningLoopCard` / `PromptSuggestionsCard`** — the closed-loop learning system. Keep.
- **`RuntimeCard`** — admin truth-tracer. Keep.
- **`SectionEditorCard` (all 3 instances)** — admin power tools backed by `prompt-sections.ts`. Keep.

---

## 10. Cross-reference

- D442 (legacy snowflake drift audit): [CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md](CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md) — Wave 1 above is Fix 1.5 from that audit.
- Phase 6 Wave 2 tracker (do-not-undo): [.claude/rules/refactor-phase-tracker.md](.claude/rules/refactor-phase-tracker.md) — D278 / D283b / D286 / D288 / D290 / D266 all confirmed shipped and kept.
- Control plane mutation contract (save-→-system truth): [docs/architecture/control-plane-mutation-contract.md](docs/architecture/control-plane-mutation-contract.md).
- Call path capability matrix (UI truth obligations §6): [docs/architecture/call-path-capability-matrix.md](docs/architecture/call-path-capability-matrix.md).
- Per-call context contract (what's safe to leave in DB only): [docs/architecture/per-call-context-contract.md](docs/architecture/per-call-context-contract.md).
- Inventory CSV: [docs/dashboard-audit/2026-06-01-surface-inventory.csv](docs/dashboard-audit/2026-06-01-surface-inventory.csv).
